const winston = require("winston");
const moment = require("moment-timezone");
const fs = require("fs");
const path = require("path");

// Define an external directory for logs
const baseLogsDir = path.join(process.cwd(), "logs");

// Create directory if not created already
if (!fs.existsSync(baseLogsDir)) {
  fs.mkdirSync(baseLogsDir, { recursive: true });
}

function generateLogFileName(prefix) {
  const date = moment().tz("Asia/Tashkent").format();
  return `${prefix}-${date.replace(/:/g, "-")}.log`;
}

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({
      format: () => moment().tz("Asia/Tashkent").format(),
    }),
    winston.format.prettyPrint()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
    new winston.transports.File({
      filename: path.join(baseLogsDir, generateLogFileName("app")),
    }),
  ],
});

const hotelMatchLogger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({
      format: () => moment().tz("Asia/Tashkent").format(),
    }),
    winston.format.prettyPrint()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(baseLogsDir, generateLogFileName("hotel-matches")),
    }),
  ],
});

const hotelNotMatchLogger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({
      format: () => moment().tz("Asia/Tashkent").format(),
    }),
    winston.format.prettyPrint()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(
        baseLogsDir,
        generateLogFileName("hotel-not-matches")
      ),
    }),
  ],
});

module.exports = {
  logger,
  hotelMatchLogger,
  hotelNotMatchLogger,
};
