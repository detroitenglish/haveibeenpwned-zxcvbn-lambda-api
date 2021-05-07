module.exports = {
  root: true,
  env: {
    node: true,
    es6: true,
  },
  parser: `babel-eslint`,
  plugins: [`prettier`, `babel`],
  extends: [`eslint:recommended`, `plugin:prettier/recommended`],
  parserOptions: {
    ecmaVersion: 9,
    sourceType: `module`,
  },
  rules: {
    'babel/no-invalid-this': 0,
    'babel/no-unused-expressions': 0,
    'babel/valid-typeof': 1,
    'no-console': 0,
    'no-empty': `off`,
    'no-var': `error`,
    'prefer-template': `error`,
    quotes: [`warn`, `backtick`],
    eqeqeq: `error`,
    strict: `error`,
    'require-await': `error`,
    'prettier/prettier': [
      `warn`,
      {},
      {
        usePrettierrc: true,
      },
    ],
  },
}
