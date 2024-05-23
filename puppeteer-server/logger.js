const winston = require("winston");
const moment = require("moment-timezone");
const fs = require("fs");
const path = require("path");
const DailyRotateFile = require("winston-daily-rotate-file");

// Define an external directory for logs
const baseLogsDir = path.join(process.cwd(), "logs");

// Create directory if not created already
if (!fs.existsSync(baseLogsDir)) {
  fs.mkdirSync(baseLogsDir, { recursive: true });
}

// Common timestamp format function
const timestampFormat = () =>
  moment().tz("Asia/Tashkent").format("YYYY-MM-DD_HH-mm-ss");

// Create a common format for loggers
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: timestampFormat }),
  winston.format.prettyPrint()
);

// Create the main logger with a unique file for each run
const logger = winston.createLogger({
  level: "info",
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
    new winston.transports.File({
      filename: path.join(baseLogsDir, `app-${timestampFormat()}.log`),
      maxSize: "40m",
      maxFiles: "14d",
    }),
  ],
});

// Create the hotel match logger with a unique file for each run
const hotelMatchLogger = winston.createLogger({
  level: "info",
  format: logFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(
        baseLogsDir,
        `hotel-matches-${timestampFormat()}.log`
      ),
      maxSize: "30m",
      maxFiles: "14d",
    }),
  ],
});

// Create the hotel not match logger with a unique file for each run
const hotelNotMatchLogger = winston.createLogger({
  level: "info",
  format: logFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(
        baseLogsDir,
        `hotel-not-matches-${timestampFormat()}.log`
      ),
      maxSize: "30m",
      maxFiles: "14d",
    }),
  ],
});

module.exports = {
  logger,
  hotelMatchLogger,
  hotelNotMatchLogger,
};
