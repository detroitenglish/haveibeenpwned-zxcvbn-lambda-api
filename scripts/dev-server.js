const chokidar = require('chokidar')
const nodemon = require('nodemon')
const del = require('del')
const { transformFile } = require('@babel/core')
const { promisify } = require('util')
const { writeFileSync: write } = require('fs')

const transpile = promisify(transformFile)

let server

const config = {
  verbose: true,
  script: `${__dirname}/../app/index.js`,
  watch: false,
  env: {
    DEV_SERVER: '1',
  },
}

const watcher = chokidar.watch([`${__dirname}/../src`], {
  atomic: 500,
})

watcher.on('ready', () => {
  console.info(`Watching source directory...`)
  console.info(`Booting dev server...`)
  server = nodemon(config)
  watcher.on('change', async path => {
    await del(config.script)
    const script = await transpile(path)
    write(config.script, script.code)
    console.info(`Restarting dev server...`)
    nodemon.emit('restart')
  })
})

process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))
process.once('SIGUSR2', () => shutdown('SIGUSR2'))
process.once('SIGUSR1', () => shutdown('SIGUSR1'))

function shutdown() {
  console.log(`Shutting down dev server...`)
  watcher.close()
  server.emit('quit')
  process.exit(0)
}
