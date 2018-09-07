const path = require('path');
const winston = require('winston');

// Set this to whatever, by default the path of the script.
const logPath = __dirname + '/logs';
const tsFormat = () => (new Date().toISOString());
const { combine, timestamp, json } = winston.format;

const accessLog = winston.createLogger({
    level: 'verbose',
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: path.join(logPath, 'access.log'),
            timestamp: tsFormat,
            level: 'verbose'})
    ],
    format: winston.format.combine(timestamp(), json())
});

const errorLog = winston.createLogger({
    level: 'silly',
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: path.join(logPath, 'errors.log'),
            timestamp: tsFormat,
            level: 'silly'})
    ],
    format: winston.format.combine(timestamp(), json())
});

module.exports = {
    errorLog: errorLog,
    accessLog: accessLog
};