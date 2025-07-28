import * as path from 'path'
import * as winston from 'winston'

import * as url from 'url';
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

// Set this to whatever, by default the path of the script.
const logPath = __dirname + '/logs';
const tsFormat = () => (new Date().toISOString());
const { combine, timestamp, json, errors } = winston.format;

export const accessLog = winston.createLogger({
    level: 'verbose',
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: path.join(logPath, 'access.log'),
            timestamp: tsFormat,
            level: 'verbose'})
    ],
    format: winston.format.combine(errors({stack: true}), timestamp(), json())
});

export const errorLog = winston.createLogger({
    level: 'silly',
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: path.join(logPath, 'errors.log'),
            timestamp: tsFormat,
            level: 'silly'})
    ],
    format: winston.format.combine(errors({stack: true}), timestamp(), json())
});
