const chokidar = require(`chokidar`)
const nodemon = require(`nodemon`)

let server

const config = {
  verbose: true,
  script: `${__dirname}/../src/index.js`,
  watch: false,
  env: {
    DEV_SERVER: `1`,
  },
}

const watcher = chokidar.watch([`${__dirname}/../src`], {
  atomic: 500,
})

watcher.on(`ready`, () => {
  console.info(`Watching source directory...`)
  console.info(`Booting dev server...`)
  server = nodemon(config)
  watcher.on(`change`, () => {
    console.info(`Restarting dev server...`)
    nodemon.emit(`restart`)
  })
})

process.once(`SIGINT`, shutdown)
process.once(`SIGTERM`, shutdown)
process.once(`SIGUSR2`, shutdown)
process.once(`SIGUSR1`, shutdown)

function shutdown() {
  console.log(`Shutting down dev server...`)
  watcher.close()
  server.emit(`quit`)
  process.exit(0)
}
