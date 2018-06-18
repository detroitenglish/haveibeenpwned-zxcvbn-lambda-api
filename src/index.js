'use strict'
import '@babel/polyfill'
import express from 'express'
import path from 'path'
import bodyParser from 'body-parser'
import helmet from 'helmet'
import zxcvbn from 'zxcvbn'
import axios from 'axios'
import crypto from 'crypto'

const app = express()

// Parse body as JSON by default
app.use(bodyParser.json())

// Use headers from reverse proxies as remote source
app.enable('trust proxy')

// Basic security headers
app.use(helmet())

const router = express.Router()

// Health check and/or warm-up endpoint for the function container
router.get('/_up', (req, res) => res.status(200).json({ ok: true }))

// Set the scoring endpoint
const endpoint = path.normalize(`/` + (process.env.SCORING_ENDPOINT || '/_score'))

// Util for creating a pwndpasswords range query URL
const pwnedUrl = p => `https://api.pwnedpasswords.com/range/${p}`

// Password scoring and haveibeenpwned crosscheck endpoint
router.post(endpoint, async (req, res) => {
  let message, pwned, ok

  const { password } = req.body

  if (!password || typeof password !== 'string' || !password.length) {
    // something's wrong with the input - bail!
    return res.status(400).json({
      ok: false,
      message: `'password' must be a string of length > 0`
    })
  }

  // synchronously score the password, keep the score number
  let { score } = zxcvbn(password)

  try {
    // range query the pwnedpasswords API
    pwned = await pwnedPassword(password)
    ok = true
  } catch (err) {

    // something done goofed, log it...
    console.error(err)

    ok = false

    // nuke any values possibly set so we don't return them
    pwned = void 0
    score = void 0

    // send reason for failure
    message = err.message
  }

  if (pwned) score = 0

  return res.status(200).json({ ok, score, pwned, message })

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
        throw new Error(`Unable to check password pwnage`)
      })

    if (!result.includes(suffix)) {
      return 0
    }

    result = result.split('\r\n')
    const match = result.find(r => r.includes(suffix))
    const hits = match.split(':')[1]
    return +hits
  }
})

const routePrefix = process.env.ROUTE_PREFIX || `/`

app.use(path.normalize(`/` + routePrefix), router)

// export for use in lambda handler...
module.exports = app
