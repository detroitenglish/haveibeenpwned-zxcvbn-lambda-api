'use strict'
import '@babel/polyfill'
import express from 'express'
import path from 'path'
import bodyParser from 'body-parser'
import helmet from 'helmet'
import zxcvbn from 'zxcvbn'
import fs from 'fs'
import axios from 'axios'
import crypto from 'crypto'
import lru from 'tiny-lru'
import cors from 'cors'

if (process.env.DEV_SERVER) {
  // Set environment vars from dev.env.json for a dev server
  const environment = JSON.parse(fs.readFileSync(__dirname + '/../dev.env.json'))
  for (let [key, value] of Object.entries(environment)) {
    process.env[key] = value
  }
} else {
  // Set env to production in Lambda
  process.env.NODE_ENV = 'production'
}

const app = express()

// Parse body as JSON by default
app.use(bodyParser.json())

const corsOptions = {
  origin: process.env.ALLOW_ORIGINS && process.env.ALLOW_ORIGINS.includes(',')
    ? process.env.ALLOW_ORIGINS.split(',')
    : '*',
  maxAge: process.env.CORS_MAXAGE ? +process.env.CORS_MAXAGE : 0,
}

app.use(cors(corsOptions))

// Use headers from reverse proxies as remote source
app.enable('trust proxy')

// Basic security headers
app.use(helmet())

const router = express.Router()

// Health check and/or warm-up endpoint for the function container
router.get('/_up', (req, res) => res.status(200).json({ ok: true }))

// Set the scoring endpoint
const endpoint = path.normalize(`/` + (process.env.SCORING_ENDPOINT || '/_score'))

// Set the API route prefix
const routePrefix = process.env.ROUTE_PREFIX || `/`

// create a mini cache of max 1000 entries, ignore events, expire entries after 5 minutes
// but auto-renew entry ttl whenever accessed
const cache = lru(1e3, false, 3e5)

// Password scoring and haveibeenpwned crosscheck endpoint
router.post(endpoint, async (req, res) => {
  let ok, score, message

  const { password } = req.body

  if (!password || typeof password !== 'string' || !password.length) {
    // something's wrong with the input - bail!
    return res.status(400).json({
      ok: false,
      message: `'password' must be a string of length > 0`
    })
  }

  // try the lru-cache first
  const cachedResult = cache.get(password)

  if (cachedResult) {
    // hit! send cached result, entry ttl has been auto-renewed
    res.set('x-cached-result', 1)
    return res.status(200).json(cachedResult)
  }

  // nope, not in cache
  res.set('x-cached-result', 0)

  // so run both tasks in parallel
  let [strength, pwned] = await Promise.all([
    zxcvbn(password),
    pwnedPassword(password),
  ])
    .catch(err => {
      // something went kaputt, log it
      console.error(err)

      message = err.message || 'Unknown error'

      // you get nothing - good day, sir!
      return Array(2)
    })

  // validate results
  ok = strength.hasOwnProperty('score') && Number.isSafeInteger(pwned)

  if (ok) {
    score = strength.score
    if (pwned && process.env.ALWAYS_RETURN_SCORE !== "true") score = 0

    // cache our funky-fresh results
    cache.set(password, { ok, score, pwned })
  }

  return res.status(200).json({ ok, score, pwned, message })
})

app.use(path.normalize(`/` + routePrefix), router)

if (process.env.DEV_SERVER) {
  // start a development server if that's what we're up to
  const port = +process.env.DEV_SERVER_PORT || 3000

  app.listen(port, err => {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    console.log(`Development server up on port ${port}`)
  })
} else {
  // export for use in lambda handler...
  module.exports = app
}


// Util for creating a pwndpasswords range query URL
const pwnedUrl = p => `https://api.pwnedpasswords.com/range/${p}`

// Range-search input against pwnedpasswords
async function pwnedPassword(pw) {
  const hash = Array.from(
    await crypto
      .createHash('sha1')
      .update(pw)
      .digest('hex')
      .toUpperCase()
  )
  const prefix = hash.splice(0, 5).join('')
  const suffix = hash.join('')

  let result = await axios({
    url: pwnedUrl(prefix),
    method: 'GET',
  })
    .then(result => result.data)
    .catch(err => {
      // Something's goofy - abandon ship!
      throw err
    })

  if (!result.includes(suffix)) {
    return 0
  }

  result = result.split('\r\n')
  const match = result.find(r => r.includes(suffix))
  const hits = match.split(':')[1]

  return +hits
}
