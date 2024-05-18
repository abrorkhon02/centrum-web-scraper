const { logger } = require("./logger");
const { exec } = require("child_process");
const fs = require("fs");
const fsExtra = require("fs-extra");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const bodyParser = require("body-parser");
const path = require("path");
const isPkg = typeof process.pkg !== "undefined";
const basePath = isPkg ? path.dirname(process.execPath) : __dirname;
const webpages = [
  { name: "Centrum", url: "https://online-centrum-holidays.com/search_tour" },
  { name: "Kompas", url: "https://online.kompastour.kz/search_tour" },
  { name: "FunSun", url: "https://b2b.fstravel.asia/search_tour" },
  {
    name: "Kazunion",
    url: "https://uae.kazunion.com/Kazunion/SearchPackage?isFHome=1",
  },
  { name: "Prestige", url: "http://online.uz-prestige.com/search_tour" },
  { name: "EasyBooking", url: "https://tours.easybooking.uz/search_tour" },
  { name: "AsiaLuxe", url: "https://asialuxe.uz/tours/" },
];

// Setup directories
const uploadsDir = path.join(basePath, "uploads"); // Original templates
const backupDir = path.join(uploadsDir, "backup");
const outputDir = path.join(uploadsDir, "output"); // New directory for processed files

[uploadsDir, backupDir, outputDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const upload = multer({ storage: multer.memoryStorage() });

const WebScraper = require("./webScraper");
const ExcelManager = require("./excelManager");
const scraper = new WebScraper(webpages);
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, "./frontend")));

// API endpoints
app.post("/api/start-session", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .send({ success: false, message: "No file uploaded." });
  }

  const url = req.body.url;
  const originalFileName = req.file.originalname;
  const originalFilePath = path.join(uploadsDir, originalFileName); // Path to the uploaded template

  // Create backup file path with timestamp
  const backupFilePath = path.join(
    backupDir,
    `${path.parse(originalFileName).name}_${new Date()
      .toLocaleString()
      .replace(/[/\\?%*:|"<>]/g, "-")}${path.parse(originalFileName).ext}`
  );

  const outputFilePath = path.join(outputDir, originalFileName); // Output file in the output directory

  try {
    await backupOriginalFile(originalFilePath, backupFilePath);

    await scraper.launchBrowser();
    const scrapeResult = await scraper.navigateAndScrape(url);
    await scraper.closeBrowser();

    if (scrapeResult.error) {
      logger.info(scrapeResult.error);
      res.status(500).send({
        success: false,
        message: `Scraping completed with errors: ${scrapeResult.error}`,
      });
      return;
    }

    if (scrapeResult.data.length === 0) {
      throw new Error("No data found on the page.");
    }

    let aggregatedData = aggregateData(scrapeResult);
    await processAndUpdateFile(
      originalFilePath,
      aggregatedData,
      scrapeResult,
      outputFilePath
    ); // Process and save to output
    logger.info(`Updated file saved to: ${outputFilePath}`);

    exec(`start excel "${outputFilePath}"`, (error) => {
      // Open the output file
      if (error) {
        logger.info(`Could not open Excel file: ${error.message}`);
        res.status(500).send({
          success: false,
          message: `Could not open Excel file: ${error.message}`,
        });
        return;
      }
      res.send({
        success: true,
        message: "Data scraped and saved to Excel successfully.",
        filePath: outputFilePath,
      });
    });
  } catch (error) {
    logger.info("Failed to scrape data:", error);
    res.status(500).send({
      success: false,
      message: `Failed to scrape data: ${error.message}`,
    });
  }
});

// Catch-all route to serve index.html for frontend routing
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "./frontend/index.html"));
});

const port = 3000;
const localURL = "http://localhost:";
app.listen(port, () => {
  logger.info(`Server running on ${localURL}${port}`);
  open(localURL + port);
});

function open(url) {
  switch (process.platform) {
    case "darwin":
      exec(`open ${url}`);
      break;
    case "win32":
      exec(`start ${url}`);
      break;
    case "linux":
      exec(`xdg-open ${url}`);
      break;
    default:
      throw new Error("Unsupported platform");
  }
}

async function backupOriginalFile(tempFilePath, backupFilePath) {
  try {
    await fsExtra.copy(tempFilePath, backupFilePath);
    logger.info(`Backup created at: ${backupFilePath}`); // Use Winston logger
  } catch (err) {
    throw new Error(`Backup failed: ${err}`);
  }
}

async function processAndUpdateFile(
  originalFilePath,
  aggregatedData,
  scrapeResult,
  outputFilePath
) {
  try {
    const excelManager = new ExcelManager(originalFilePath); // Load the original template
    await excelManager.loadTemplate();
    const worksheet = excelManager.getWorksheet(1);
    processAggregatedData(
      worksheet,
      aggregatedData,
      scrapeResult.destinationAndStartDate,
      excelManager
    );
    await excelManager.saveWorkbook(outputFilePath); // Save to the output file path
  } catch (error) {
    logger.info(`Failed to process file: ${error}`); // Use Winston logger
    throw error;
  }
}

function aggregateData(scrapedResults) {
  let hotelOffers = {};

  scrapedResults.data.forEach((entry) => {
    const hotel = entry.hotel;
    const date = entry.date.split(",")[0].trim();
    if (!hotelOffers[hotel]) {
      hotelOffers[hotel] = {};
    }
    if (!hotelOffers[hotel][date]) {
      hotelOffers[hotel][date] = entry;
    } else if (hotelOffers[hotel][date].price > entry.price) {
      hotelOffers[hotel][date] = entry;
    }
  });

  Object.keys(hotelOffers).forEach((hotel) => {
    hotelOffers[hotel] = Object.values(hotelOffers[hotel]).sort((a, b) => {
      const dateA = new Date(a.date.split(",")[0].trim());
      const dateB = new Date(b.date.split(",")[0].trim());
      return dateA - dateB;
    });
  });

  logger.info("Aggregated data: ", { offers: hotelOffers }); // Use Winston logger
  return { offers: hotelOffers };
}

function processAggregatedData(
  worksheet,
  aggregatedData,
  destinationAndStartDate,
  excelManager
) {
  const { offers } = aggregatedData;

  Object.entries(offers).forEach(([hotel, datesOffers]) => {
    logger.info(
      // Use Winston logger
      `Processing data for hotel: ${hotel}, Start Date: ${destinationAndStartDate.startDate}`
    );
    excelManager.insertHotelData(
      worksheet,
      hotel,
      datesOffers,
      destinationAndStartDate.destination,
      destinationAndStartDate.startDate
    );
  });
}
