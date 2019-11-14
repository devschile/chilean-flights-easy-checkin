const winston = require('winston')
const Sentry = require('winston-sentry-log')

const level = 'debug'

const logger = winston.createLogger({
  transports: [
    // @ts-ignore
    new Sentry({ dsn: process.env.SENTRY_DSN, level }),
    new winston.transports.Console({
      format: winston.format.simple(),
      level
    })
  ]
})
module.exports = logger
