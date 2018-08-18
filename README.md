# **Your** 5-Min. Secure Password Scoring and Pwnage Protection API

(Already drunk the Cloudflare Kool-Aid? [Check out the Cloudflare-Worker version here](https://github.com/detroitenglish/pw-pwnage-cfworker))

Deploy a private, secure and serverless RESTful endpoint for sanely scoring users' new passwords using Dropbox's [`zxcvbn`](https://github.com/dropbox/zxcvbn) library while (k-)anonymously querying Troy Hunt's [`haveibeenpwned`](https://haveibeenpwned.com/) collection of +5.1 *billion* breached accounts.

![API in Action](.github/pwnage.gif?raw=true "API in Action")

&nbsp;&nbsp;&nbsp;&nbsp;*Example: handling results with [VuetifyJS](https://github.com/vuetifyjs/vuetify)*
<br>
<br>
## Motivation
<a href="https://twitter.com/DetroitEnglish/status/1008276231199055874" target="_blank">People seemed to think this concept was neat</a>. An AWS Lambda REST API was the ~~best~~ only solution I could think of that's easy to deploy, language/framework agnostic and, most importantly, **https by default** 🔒

---

## Quick Start
1. Create an AWS profile with IAM full access, Lambda full access and API Gateway Administrator privileges.
2. Add the keys to your ~/.aws/credentials file:
    ```
    [pwnage]
    aws_access_key_id = YOUR_ACCESS_KEY
    aws_secret_access_key = YOUR_ACCESS_SECRET
    ```
    To use another profile, set it with `npm config set haveibeenpwned-zxcvbn-lambda-api:aws_profile some-aws-profile`  (default: `pwnage`)

3. Copy/Rename `example.env.json` to `env.json` and edit as you see fit. Note that all entries **must** be strings, less we anger the Lambda gods.
    - (Optional) Define your AWS region of choice with `npm config set haveibeenpwned-zxcvbn-lambda-api:aws_region some-aws-region` (default: `eu-central-1`)
    - (Optional) Define your API Gateway environment (aka version) with `npm config set haveibeenpwned-zxcvbn-lambda-api:aws_environment some-version` (default: `development`)
4. Launch 🚀 with `npm run deploy`


### Development Server
You can boot this API as an express development server like so:
1. Copy/Rename `example.env.json` to `dev.env.json` and configure as you see fit.
2. Boot the development server with `npm run dev`

**Note**: Development mode will add some random artificial latency to each request in a feeble attempt to simulate the wonky network conditions we encounter in the wild.

### Configuration
The following options are configurable via `env.json` or `dev.env.json`:

- `"ALLOW_ORIGINS"`: A **comma-separated** whitelist of origins for Cross Origin Resource Sharing. If none are provided, all origins are allowed (default: `""`)
    - Example: `"ALLOW_ORIGINS": "https://secure.domain.lol,http://unsecure.domain.wtf"`

- `"CORS_MAXAGE"`: Value in seconds for the `Access-Control-Max-Age` CORS header (default: `"0"`)

- `"ALWAYS_RETURN_SCORE"`: Return the `zxcvbn` score even if the `pwnedpasswords` match value is > 0. See [Response](#Response) for details (default: `"false"`)
- `"DEV_SERVER_PORT"`: Port to use when running as a local server for development (default: `"3000"`)

- `"USER_INPUTS"`: Comma-separated list of words/phrases to be included in the `zxcvbn` strength estimation dictionary. It's a good idea to include e.g. your company and/or application name here (default: `""`)

- `"RETURN_ZXCVBN_RESULT"`: Return the full result of the `zxcvbn` strength estimation as a `metadata` response key. Refer to the [zxcvbn documentation](https://github.com/dropbox/zxcvbn#usage) for details on what that includes (default: `"false"`)

Note that all `env.json` values **must** be strings, less you anger the Lambda gods.

### Updating
Update the Lambda API with any changes you make to the source by running `npm run update`.

Update environment variables à la changes to `env.json` by running `npm run update-env`.

### Sorcery 🧙‍
Lambda function and API Gateway configuration are fully automated using the cool-as-a-cucumber [claudia.js](https://claudiajs.com/documentation.html) - refer to the claudia.js docs to learn more about serverless voodoo magic.

## REST API

Following a successful deployment or update, `claudia.js` prints a configuration object for your freshly deployed Lambda function, which includes a secure url for immediate access to your function:

GET the warmup endpoint to verify access:
```bash
curl \
  -X GET \
  "https://$FUNCTION_ID.execute-api.$REGION.amazonaws.com/$ENVIRONMENT/$PREFIX/_up"
```

POST user password input as JSON to:
```bash
curl \
  -X POST \
  "https://$FUNCTION_ID.execute-api.$REGION.amazonaws.com/$ENVIRONMENT/$PREFIX/_score" \
  -H 'content-type: application/json' \
  -d '{ "password": "🍌📞bananaphone📞🍌" }'
```

Optionally, include an array of words or phrases to include in the zxcvbn dictionary:
```bash
curl \
  -X POST \
  "https://$FUNCTION_ID.execute-api.$REGION.amazonaws.com/$ENVIRONMENT/$PREFIX/_score" \
  -H 'content-type: application/json' \
  -d '{ "password": "roflcopters", "userInputs": ["MyCompanyName"] }'
```

### Request

POST user password input as JSON with field `password` like so:

```javascript
// pwned password
{
  "password": "monkey123"
}
```
```javascript
// stronger password
{
  "password": "wonderful waffles"
}
```
```javascript
// very strong password (technically), with supplementary dictionary
// NOTE: you'd be wise to test this client-side _before_ sending this request...
{
  "password": "emailAddress@of-this.user",
  "userInputs": ["somethingUserSpecific", "emailAddress@of-this.user"]
}
```
```javascript
// very strong password, with supplementary dictionary
{
  "password": "14HFF3vA8qremH9Fe3A9nsXw",
  "userInputs": ["somethingUserSpecific", "emailAddress@of-this.user"]
}
```

#### Be the best - cancel requests!
The scoring function will gracefully terminate when an aborted request is detected, though you'll still incur a Gateway API call and a Lamdba function call for the respective request and invocation.

But [Troy Hunt and Cloudflare offer us the `pwnedpasswords` API for free](https://haveibeenpwned.com/Donate) - and that's pretty cool 😎 So please help keep overhead low by either cancelling open requests on new input, or governing requests on the frontend with something like [lodash.debounce](https://www.npmjs.com/package/lodash.debounce).

### Response

The Lambda gods will reply with an appropriate status code and a JSON body, with `ok` indicating successful scoring and range search, a strength estimation `score` of 0 through 4 per `zxcvbn`, and `pwned` matches, indicating the number times the input appears in the `haveibeenpwned` database.

```javascript
// pwned password: 'monkey123'
{
    "ok": true,
    "score": 0,
    "pwned": 56491
}
```
```javascript
// stronger password: 'wonderful waffles'
{
    "ok": true,
    "score": 3,
    "pwned": 0
}
```
```javascript
// password: 'emailAddress@of-this.user'; matches supplementary dictionary entry...
{
    "ok": true,
    "score": 0,
    "pwned": 0
}
```
```javascript
// very strong password: '14HFF3vA8qremH9Fe3A9nsXw'
{
    "ok": true,
    "score": 4,
    "pwned": 0
}
```

By default, if `pwned` is greater than 0, then `score` will **always** be 0. You can override this behavior by settings `"ALWAYS_RETURN_SCORE"` to `"true"` in `env.json`

If `"RETURN_ZXCVBN_RESULT"` is configured `"true"`, responses will also include a `metadata` key with the complete `zxcvbn` [strength estimation result object](https://github.com/dropbox/zxcvbn#usage).

#### Errors

Failure will return JSON to inform you that something's not `ok` and a `message` as to why.

```json
{
    "ok": false,
    "message": "It went kaput 💩"
}
```

### Good to Know
The health-check endpoint `/_up` is included by default; this also serves as a handy means to warm-up a Lambda function container before your users start feeding you input.

Lambda's Node 8 runtime supports `async/await` natively, nevertheless deploying will transpile `src/index.js` to JS compatible with Node 6.

Finally, it may seem strange that deploying will first nuke `package-lock.json`, and then reinstall dependencies - it is a workaround for `claudia.js` weirdness that I cannot explain but occurs when retrying failed deployments ¯\\\_(ツ)\_/¯

## Because Software

### Disclaimer
I am not affiliated with Amazon, Troy Hunt, Dropbox, haveibeenpwned, good software development in general, or any combination thereof.

Handling user passwords is no laughing matter, so handle them with care and respect.

Just like your own users, assume that I have no idea what I'm doing. This part is important, because I have no idea what I'm doing.

**REVIEW THE SOURCE**, and use at your own risk 🙈

### License
MIT
