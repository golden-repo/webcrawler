//jshint esversion: 6
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf } = format;
 
const myFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});
 
const logger = createLogger({
  format: combine(
    label({ label: 'Crawler' }),
    timestamp(),
    myFormat
  ),
  transports: [new transports.Console(), new winston.transports.File({ filename: 'crawler.log' })]
});

return logger;