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

app.use(bodyParser.json())

app.enable('trust proxy')

app.use(helmet())

const router = express.Router()

const route = r => path.normalize(`${routePrefix}/${r}`)

const endpoint = path.normalize(`/` + (process.env.SCORING_ENDPOINT || '/_score'))

// Health check and/or warm-up endpoint for the function container
router.get('/_up', (req, res) => res.status(200).json({ ok: true }))

// Password scoring and haveibeenpwned crosscheck endpoint
router.post(endpoint, async (req, res) => {
  const { password } = req.body
  if (!password || typeof password !== 'string' || !password.length) {
    return res.status(400).json({
      ok: false,
      message: `'password' must be a string of length > 0`
    })
  }
  let message, pwned, ok
  const pwnedUrl = p => `https://api.pwnedpasswords.com/range/${p}`
  let { score } = zxcvbn(password)
  try {
    pwned = await pwnedPassword(password)
    ok = true
  } catch (err) {
    req.log.error(err)
    ok = false
    pwned = 1
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
      .catch(err => {  // something done goofed
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

// ====================================================
const routePrefix = process.env.ROUTE_PREFIX || `/`
app.use(path.normalize(`/` + routePrefix), router)

// =============================================================================

module.exports = app
