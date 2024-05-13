const { logger } = require("./logger");
const { exec } = require("child_process");
const fs = require("fs");
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
const uploadsDir = path.join(basePath, "uploads");
const backupDir = path.join(uploadsDir, "backup");
const tempUploadsDir = path.join(uploadsDir, "temp_uploads");

[uploadsDir, backupDir, tempUploadsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempUploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage: storage });

const WebScraper = require("./webScraper");
const ExcelManager = require("./excelManager");
const scraper = new WebScraper(webpages);
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "./frontend")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "./frontend/index.html"));
});

app.post("/api/start-session", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .send({ success: false, message: "No file uploaded." });
  }
  const url = req.body.url;
  const originalFileName = req.file.originalname;
  const originalFilePath = path.join(
    process.cwd(),
    "uploads",
    originalFileName
  );
  const tempFilePath = path.join(
    process.cwd(),
    "uploads",
    "temp_uploads",
    originalFileName
  );
  const backupFilePath = path.join(
    process.cwd(),
    "uploads",
    "backup",
    originalFileName
  );

  try {
    backupOriginalFile(tempFilePath, backupFilePath);
    logger.info(`Backup created: ${backupFilePath}`);

    await scraper.launchBrowser();
    const scrapeResult = await scraper.navigateAndScrape(url);
    await scraper.closeBrowser();

    if (scrapeResult.error) {
      console.error(scrapeResult.error);
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
    await processAndUpdateFile(tempFilePath, aggregatedData, scrapeResult);
    replaceOriginalWithUpdated(originalFilePath, tempFilePath);
    logger.info(`Updated original file: ${originalFilePath}`);

    exec(`start excel "${originalFilePath}"`, (error) => {
      if (error) {
        console.error(`Could not open Excel file: ${error.message}`);
        res.status(500).send({
          success: false,
          message: `Could not open Excel file: ${error.message}`,
        });
        return;
      }
      res.send({
        success: true,
        message: "Data scraped and saved to Excel successfully.",
        filePath: originalFilePath,
      });
    });
  } catch (error) {
    console.error("Failed to scrape data:", error);
    res.status(500).send({
      success: false,
      message: `Failed to scrape data: ${error.message}`,
    });
  }
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

function backupOriginalFile(tempFilePath, backupFilePath) {
  fs.copyFile(tempFilePath, backupFilePath, (err) => {
    if (err) throw new Error(`Backup failed: ${err}`);
    console.log(`Backup created at: ${backupFilePath}`);
  });
}

async function processAndUpdateFile(
  tempFilePath,
  aggregatedData,
  scrapeResult
) {
  try {
    const excelManager = new ExcelManager(tempFilePath);
    await excelManager.loadTemplate();
    const worksheet = excelManager.getWorksheet(1);
    processAggregatedData(
      worksheet,
      aggregatedData,
      scrapeResult.destinationAndStartDate,
      excelManager
    );
    await excelManager.saveWorkbook();
  } catch (error) {
    console.error(`Failed to process file: ${error}`);
    throw error;
  }
}

function replaceOriginalWithUpdated(originalFilePath, tempFilePath) {
  fs.rename(tempFilePath, originalFilePath, (err) => {
    if (err) throw new Error(`Failed to update original file: ${err}`);
    console.log(`Original file updated successfully.`);
  });
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

  logger.info("Aggregated data: ", {
    offers: hotelOffers,
  });
  return {
    offers: hotelOffers,
  };
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
