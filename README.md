# haveibeenpwned-zxcvbn-lambda-api
Here's a chance to have your very own serverless API endpoint up on AWS Lambda so you can score new user passwords with the Dropbox's fantastic `zxcvbn` library _AND_ check their password against Troy Hunt's [haveibeenpwned](https://haveibeenpwned.com/) database via his APIv2 Range Query endpoint.

![API in Action](.github/pwnage.gif?raw=true "API in Action")

_**NOTE**: this is for the BACKEND API only - how to handle the response client-side is your own monster to slay :dragon_face:_

## Lazy quick-start
1. Create an AWS profile with IAM full access, Lambda full access and API Gateway Administrator privileges.
2. Add the keys to your ~/.aws/credentials file:
    ```
    [pwnage]
    aws_access_key_id = YOUR_ACCESS_KEY
    aws_secret_access_key = YOUR_ACCESS_SECRET
    ```
    If you want to use another profile namespace, set it with `npm config set haveibeenpwned-zxcvbn-lambda-api:aws_profile some-aws-profile`  (default is `pwnage`)

3. Rename `example.env.json` to `env.json` and change the values to whatever suits your fancy.
4. Set your AWS region of choice with `npm config set haveibeenpwned-zxcvbn-lambda-api:aws_region some-aws-region` (default is `eu-central-1`)
5. Set your deployment environment for AWS API Gateway with `npm config set haveibeenpwned-zxcvbn-lambda-api:aws_region devOrTestingOrProdOrSomething` (default is `development`)
6. Install dependencies with `npm install`
7. Launch 🚀 with `npm run deploy`
8. Change whatever you need to change in the AWS API Gateway to make this work with your own application.

### Updating
Update the Lambda API with any changes you make to the source by running `npm run update`


### Sorcery
This uses the cool-as-a-cucumber [claudia.js](https://claudiajs.com/documentation.html) for handling AWS deployment - please refer to the claudia.js docs to learn more about this serverless voodoo magic.

## How to Use

Following deployment, `claudia.js` prints the AWS config JSON for your freshly deployed Lambda function. The last key `url` gives you an instant and secure route to your function:

Hit the healthcheck/warmup endpoint:
```
    https://{{GENERATED_ID}}.execute-api.{{AWS_REGION}}.amazonaws.com/production/{{ROUTE_PREFIX}}/_up
```

Or start firing off POST (see below) requests to:
```
    https://{{GENERATED_ID}}.execute-api.{{AWS_REGION}}.amazonaws.com/production/{{ROUTE_PREFIX}}/{{SCORING_ENDPOINT}}
```

### Request
POST the input **over HTTPS** as JSON using the field `password` like so:
```
{
  "password": "monkey123"
}
```
### Response
The API will respond with `ok` indicating successful scoring and range-query, a `score` of 0 through 4 per `zxcvbn`, and `pwned` indicating the number times the input appears in the `haveibeenpwned` database. Note that if `pwned` is greater than 0, `score` will always be 0.
```
{
    "ok": true,
    "score": 0,
    "pwned": 56491
}
```
### Good to Know
The health-check endpoint `/_up` is included by default; this also serves as a handy means to warm-up a Lambda function container before your users start feeding you input.

### Disclaimer
I am not affiliated with Amazon, Troy Hunt, Dropbox, haveibeenpwned or any combination thereof. People just seemed to think that this was neat, and this was the easiest way I could come up with to share it.

Handling user passwords is no laughing matter, so handle them with care and respect.

That being said: just like your users, assume that I have no idea what I'm doing - REVIEW THE SOURCE, and use this at your own risk!

### License
Licensed under [GLWTPL](https://raw.githubusercontent.com/me-shaon/GLWTPL/master/LICENSE)
