const { exec } = require("child_process");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

const WebScraper = require("./webScraper");
const ExcelManager = require("./excelManager");

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

const scraper = new WebScraper(webpages);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "./frontend")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "./frontend/index.html"));
});

app.post("/api/start-session", upload.single("file"), async (req, res) => {
  const url = req.body.url;
  const file = req.file;

  if (!file) {
    return res
      .status(400)
      .send({ success: false, message: "No file uploaded." });
  }

  try {
    const excelManager = new ExcelManager(`uploads/${file.originalname}`);
    console.log(`Received file: ${file.path}`);

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

    // const outputPath = await createAndSaveExcelOld(url, scrapeResult);

    await excelManager.loadTemplate();
    const worksheet = excelManager.getWorksheet(1);
    let aggregatedData = aggregateData(scrapeResult);
    processAggregatedData(
      worksheet,
      aggregatedData,
      scrapeResult.destinationAndStartDate,
      excelManager
    );
    const outputPath = await excelManager.saveWorkbook();

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
    const date = entry.date.split(",")[0].trim();
    if (!hotelOffers[hotel]) {
      hotelOffers[hotel] = {};
    }
    if (!hotelOffers[hotel][date]) {
      hotelOffers[hotel][date] = entry;
    } else {
      if (hotelOffers[hotel][date].price > entry.price) {
        hotelOffers[hotel][date] = entry;
      }
    }
  });

  Object.keys(hotelOffers).forEach((hotel) => {
    hotelOffers[hotel] = Object.values(hotelOffers[hotel]).sort((a, b) => {
      const dateA = new Date(a.date.split(",")[0].trim());
      const dateB = new Date(b.date.split(",")[0].trim());
      return dateA - dateB; // Sort by date ascending
    });
  });

  console.log("Aggregated data: ", {
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
    console.log(
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

// async function createAndSaveExcelOld(url, scrapeResult) {
//   const parsedUrl = new URL(url);
//   const workbook = new excel.Workbook();
//   const worksheet = workbook.addWorksheet("Results");
//   const filenameBase = scrapeResult.destination;

//   worksheet.columns = [
//     { header: "Date", key: "date", width: 15 },
//     { header: "Tour", key: "tour", width: 25 },
//     { header: "Nights", key: "nights", width: 10 },
//     { header: "Hotel", key: "hotel", width: 30 },
//     { header: "Availability", key: "availability", width: 20 },
//     { header: "Meal", key: "meal", width: 10 },
//     { header: "Room", key: "room", width: 10 },
//     { header: "Price", key: "price", width: 10 },
//     { header: "Price Type", key: "priceType", width: 15 },
//     { header: "Transport", key: "transport", width: 15 },
//   ];

//   scrapeResult.data.forEach((item) => {
//     worksheet.addRow(item);
//   });

//   worksheet.autoFilter = {
//     from: "A1",
//     to: "J1",
//   };

//   const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
//   const outputFilename = `${parsedUrl.hostname}-${filenameBase}-${timestamp}.xlsx`;
//   const outputPath = path.join(tempDir, outputFilename);

//   if (!fs.existsSync(__dirname)) {
//     fs.mkdirSync(__dirname, { recursive: true });
//   }
//   await workbook.xlsx.writeFile(outputPath);
//   console.log(`Workbook saved as ${outputPath}`);
//   return outputPath;
// }
