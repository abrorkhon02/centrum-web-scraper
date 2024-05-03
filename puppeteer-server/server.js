const { exec } = require("child_process");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const WebScraper = require("./webScraper");
const ExcelManager = require("./excelManager");

const webpages = [
  { name: "Centrum", url: "https://online-centrum-holidays.com/search_tour" },
  { name: "Kompas", url: "https://online.kompastour.kz/search_tour" },
  { name: "EasyBooking", url: "https://tours.easybooking.uz/search_tour" },
  { name: "FunSun", url: "https://b2b.fstravel.asia/search_tour" },
  {
    name: "Kazunion",
    url: "https://uae.kazunion.com/Kazunion/SearchPackage?isFHome=1",
  },
  { name: "Prestige", url: "http://online.uz-prestige.com/search_tour" },
  { name: "AsiaLuxe", url: "https://asialuxe.uz/tours/" },
];

const scraper = new WebScraper(webpages);
const excelManager = new ExcelManager("./assets/template.xlsx");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "./frontend")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "./frontend/index.html"));
});

app.post("/api/start-session", async (req, res) => {
  const url = req.body.url;

  try {
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

    await excelManager.loadTemplate();
    const worksheet = excelManager.getWorksheet(1);
    let aggregatedData = aggregateData(scrapeResult);
    processAggregatedData(worksheet, aggregatedData);

    const outputPath = await excelManager.saveWorkbook(
      `output_${scrapeResult.destination || "no_destination"}.xlsx`
    );

    exec(`start excel "${outputPath}"`, (error) => {
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
        filePath: outputPath,
        partialSuccess: scrapeResult.partialSuccess,
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

function aggregateData(scrapedResults) {
  let hotelOffers = {};

  scrapedResults.data.forEach((entry) => {
    const hotel = entry.hotel;
    const date = entry.date.split(",")[0].trim(); // Get the date without the day of the week
    if (!hotelOffers[hotel]) {
      hotelOffers[hotel] = {};
    }
    if (!hotelOffers[hotel][date]) {
      hotelOffers[hotel][date] = entry; // Initialize with the first entry
    } else {
      if (hotelOffers[hotel][date].price > entry.price) {
        hotelOffers[hotel][date] = entry;
      }
    }
  });

  // Convert nested objects to arrays of their values for easier processing later
  Object.keys(hotelOffers).forEach((hotel) => {
    hotelOffers[hotel] = Object.values(hotelOffers[hotel]).sort((a, b) => {
      const dateA = new Date(a.date.split(",")[0].trim());
      const dateB = new Date(b.date.split(",")[0].trim());
      return dateA - dateB; // Sort by date ascending
    });
  });

  console.log("Aggregated data: ", {
    offers: hotelOffers,
    destination: scrapedResults.destination,
  });
  return { offers: hotelOffers, destination: scrapedResults.destination };
}

function processAggregatedData(worksheet, aggregatedData) {
  const { offers, destination } = aggregatedData;

  Object.entries(offers).forEach(([hotel, datesOffers]) => {
    console.log("Processing all offers for hotel:", hotel);
    excelManager.insertHotelData(worksheet, hotel, datesOffers, destination);
  });
}

const port = 3000;
const localURL = "http://localhost:";
app.listen(port, () => {
  console.log(`Server running on ${localURL}${port}`);
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
