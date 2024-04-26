// server.js
const { exec } = require("child_process");
const express = require("express");
const puppeteer = require("puppeteer");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const xlsx = require("xlsx");
const os = require("os");
const tempDir = os.tmpdir();
const excel = require("exceljs");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "./frontend")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "./frontend/index.html"));
});

function formatDate(dateStr) {
  const parts = dateStr.split(".");
  if (parts.length < 2) {
    console.error(`Could not parse date: ${dateStr}`);
    return "Invalid Date";
  }
  return `${parts[0]}.${parts[1]}`; // Return only "DD.MM"
}

function formatDateForExcel(dateStr) {
  const [day, month] = dateStr.split(".").map(Number);
  const currentYear = new Date().getFullYear();
  return new Date(currentYear, month - 1, day);
}

function alreadyExists(set, date, hotel, roomType, price) {
  const key = `${date}-${hotel}-${roomType}-${price}`;
  return set.has(key);
}

function addToSet(set, date, hotel, roomType, price) {
  const key = `${date}-${hotel}-${roomType}-${price}`;
  set.add(key);
}

async function populateTemplateWithScrapedData(scrapedData) {
  const templatePath = path.join("./assets/template.xlsx");
  const workbook = new excel.Workbook();
  await workbook.xlsx.readFile(templatePath);
  const worksheet = workbook.getWorksheet("Исходник сравнение.");
  const hotelRowsMap = new Map();
  const insertedData = new Set();

  console.log("Starting to populate the template with scraped data.");

  // Iterate over scraped data
  for (let data of scrapedData) {
    if (
      !alreadyExists(
        insertedData,
        data.date,
        data.hotel,
        data.roomType,
        data.price
      )
    ) {
      insertDataIntoWorksheet(data, worksheet, hotelRowsMap);
      addToSet(insertedData, data.date, data.hotel, data.roomType, data.price);
    } else {
      console.log(`Duplicate found, skipping: ${data.hotel} on ${data.date}`);
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputFilename = `FilledTemplate-${timestamp}.xlsx`;
  const outputPath = path.join(`./${outputFilename}`);
  await workbook.xlsx.writeFile(outputPath);
  console.log(`Template has been populated and saved as ${outputFilename}`);
  return outputPath;
}

function insertDataIntoWorksheet(data, worksheet, hotelRowsMap) {
  const formattedDate = formatDate(data.date);
  console.log(`Formatted date for entry: ${formattedDate}`);
  const dateCol = 2;
  const priceStartCol = 3;
  const roomTypeCol = 9;
  let hotelRow = hotelRowsMap.get(data.hotel);
  if (!hotelRow) {
    hotelRow = findOrAddHotelRow(worksheet, data.hotel);
    hotelRowsMap.set(data.hotel, hotelRow);
  }

  if (hotelRow) {
    console.log(`Processing data for hotel: ${data.hotel}`);
    let inserted = false;

    for (let i = 0; i < 8; i++) {
      const row = worksheet.getRow(hotelRow.number + i);
      const rowRoomType = row.getCell(roomTypeCol).value; // Use text to get the displayed value
      const rowPrice = row.getCell(priceStartCol + data.aggregatorIndex).value;
      console.log("Room Type and Price found: ", rowPrice, " ", rowRoomType);

      // Here we directly check if room type and price are set by their display values
      if (!rowRoomType || !rowPrice) {
        console.log(`Inserting or updating data at row ${row.number}`);
        const excelDate = formatDateForExcel(formattedDate); // Assuming this function converts "DD.MM" string to Excel date format
        row.getCell(dateCol).value = excelDate;
        row.getCell(dateCol).numFmt = "DD.MM";
        row.getCell(priceStartCol + data.aggregatorIndex).value = data.price;
        row.getCell(roomTypeCol).value = data.roomType;
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      console.log(
        `All rows for hotel ${data.hotel} are occupied, adding a new block`
      );
      hotelRow = addNewHotelBlock(worksheet, data.hotel);
      hotelRowsMap.set(data.hotel, hotelRow);
      const newRow = worksheet.getRow(hotelRow.number);
      const excelDate = formatDateForExcel(formattedDate);
      newRow.getCell(dateCol).value = excelDate;
      newRow.getCell(dateCol).numFmt = "DD.MM";
      newRow.getCell(priceStartCol + data.aggregatorIndex).value = data.price;
      newRow.getCell(roomTypeCol).value = data.roomType;
    }
  } else {
    console.log(`Unable to find or create a row for hotel: ${data.hotel}`);
  }
}

function extractCityName(hotelName) {
  const cityNamePattern = /\(([^)]+)\)$/;
  const matches = hotelName.match(cityNamePattern);
  return matches ? matches[1] : null;
}

function findOrAddHotelRow(worksheet, hotelName) {
  // Extract the city name from the hotel name
  const cityName = extractCityName(hotelName);
  console.log("Extracted city name is: ", cityName);
  let hotelRow;

  if (cityName) {
    // We have a city name, find or add a city block
    let cityRow = findCityBlock(worksheet, cityName);
    if (!cityRow) {
      console.log("city row not found");
      cityRow = addNewCityBlock(worksheet, cityName);
    }
    // Find or add hotel row within the city block
    hotelRow = findHotelInCityBlock(worksheet, hotelName, cityRow);
    if (!hotelRow) {
      console.log(
        "hotel row not found, adding it in the corresponding city row"
      );
      hotelRow = addHotelInCityBlock(worksheet, hotelName, cityRow);
      console.log("new hotel row created? ", hotelRow !== null);
    }
  } else {
    // No city name found, proceed as usual
    console.log("no city name found, fallback");
    hotelRow = findHotelRow(worksheet, hotelName);
    if (!hotelRow) {
      hotelRow = addNewHotelBlock(worksheet, hotelName);
    }
  }

  return hotelRow;
}

function findCityBlock(worksheet, cityName) {
  cityName = cityName.trim();

  for (let i = 1; i <= worksheet.actualRowCount; i++) {
    let row = worksheet.getRow(i);
    if (row.getCell(1).value === cityName) {
      return row;
    }
  }
  return null;
}

function addNewCityBlock(worksheet, cityName) {
  const lastRow = worksheet.lastRow.number;
  const newRowNumber = lastRow + 1;
  let newCityRow = worksheet.getRow(newRowNumber);
  newCityRow.getCell(1).value = cityName;
  console.log("added new city row", newCityRow);
  return newCityRow;
}

function findHotelInCityBlock(worksheet, hotelName, cityRow) {
  const startRowNumber = cityRow.number;
  console.log("start row number of the city", startRowNumber);
  for (let i = startRowNumber; i < startRowNumber + 8; i++) {
    let row = worksheet.getRow(i);
    if (row.getCell(1).value === hotelName) {
      return row;
    }
  }
  return null;
}

function addHotelInCityBlock(worksheet, hotelName, cityRow) {
  const hotelCol = 1;
  let currentRowNumber = cityRow.number + 1;

  while (currentRowNumber <= worksheet.actualRowCount) {
    let blockIsEmpty = true;

    for (let i = 0; i < 8; i++) {
      const row = worksheet.getRow(currentRowNumber + i);
      if (row.getCell(hotelCol).value !== null) {
        blockIsEmpty = false;
        break;
      }
    }

    if (blockIsEmpty) {
      const newRow = worksheet.getRow(currentRowNumber);
      newRow.getCell(hotelCol).value = hotelName;
      console.log("Added new hotel at row: " + currentRowNumber);
      return newRow;
    }

    currentRowNumber += 8;
  }

  console.error(
    "Failed to add new hotel, no empty block found under the city. Will be inserting the data in any empty place"
  );
  hotelRow = findHotelRow(worksheet, hotelName);
  if (!hotelRow) {
    hotelRow = addNewHotelBlock(worksheet, hotelName);
  }
  return null;
}

function findHotelRow(worksheet, hotelName) {
  const hotelCol = 1; // Column A is 1
  const maxRowsToSearch = 5000; // Limit search to the first 5000 rows

  for (let i = 3; i <= maxRowsToSearch; i += 8) {
    let row = worksheet.getRow(i);
    let cellValue = row.getCell(hotelCol).value;
    let cellText = cellValue && cellValue.text ? cellValue.text : cellValue;
    if (cellText === hotelName) {
      console.log("Found hotel at row: " + i);
      return row;
    }
  }
  console.log("Hotel not found in the first " + maxRowsToSearch + " rows.");
  return null;
}

function addNewHotelBlock(worksheet, hotelName) {
  const hotelCol = 1;
  let emptyRow = 3;

  while (emptyRow <= 5000) {
    const cell = worksheet.getRow(emptyRow).getCell(hotelCol);
    if (cell.value === null || cell.value === "") {
      cell.value = hotelName;
      console.log("Added new hotel block at row: " + emptyRow);
      return worksheet.getRow(emptyRow);
    }
    emptyRow += 8;
  }

  console.error(
    "No empty block found within the first 5000 rows for a new hotel."
  );
  return null;
}

function determineAggregatorIndex(pageUrl) {
  const webpages = [
    {
      name: "Centrum",
      url: "https://online-centrum-holidays.com/search_tour",
    },
    { name: "Kompas", url: "https://online.kompastour.kz/search_tour" },
    { name: "EasyBooking", url: "https://tours.easybooking.uz/search_tour" },
    { name: "FunSun", url: "https://b2b.fstravel.asia/search_tour" },
    {
      name: "Kazunion",
      url: "https://uae.kazunion.com/Kazunion/SearchPackage?isFHome=1",
    },
    {
      name: "Prestige",
      url: "http://online.uz-prestige.com/search_tour",
    },
    { name: "AsiaLuxe", url: "https://asialuxe.uz/tours/" },
  ];

  const webpage = webpages.find((webpage) => webpage.url === pageUrl);
  return webpage ? webpages.indexOf(webpage) : -1;
}

const delay = (ms) => new Promise((res) => setTimeout(res, ms));
const ensurePageLoad = async (page, url, timeout = 10000) => {
  try {
    let timeoutHandle;

    const pageLoadPromise = new Promise((resolve, reject) => {
      // Setup navigation promise
      const navigationPromise = page
        .goto(url, {
          waitUntil: "networkidle0",
          timeout: 0,
        })
        .then(() => {
          clearTimeout(timeoutHandle);
          resolve("loaded");
        })
        .catch(reject);

      // Setup timeout
      timeoutHandle = setTimeout(async () => {
        if (page.isClosed()) {
          reject("Page is closed");
        } else {
          console.log(
            `Page load timeout reached (${timeout}ms). Refreshing the page.`
          );
          await page.reload({ waitUntil: "networkidle0" });
          resolve("reloaded");
        }
      }, timeout);
    });

    const result = await pageLoadPromise;
    if (result === "reloaded") {
      console.log(
        "Page was reloaded, checking for stability before proceeding."
      );
      await page.waitForNavigation({
        waitUntil: "networkidle0",
        timeout: 30000,
      });
      console.log("Page reloaded and stable.");
    } else {
      console.log("Page loaded successfully without needing a reload.");
    }
  } catch (error) {
    console.error("Error ensuring page load:", error);
    throw new Error("Failed to ensure the page is loaded");
  }
};

app.post("/api/start-session", async (req, res) => {
  //
  // SETTING THE PUPPETEER UP
  //
  const { url } = req.body;
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: "./chromium/chrome.exe",
      headless: false,
      args: ["--disable-features=site-per-process"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    try {
      await ensurePageLoad(page, url);
    } catch (error) {
      res
        .status(500)
        .send({ success: false, message: "Error during page loading." });
      return;
    }

    //
    // TRYING TO FIND THE RESULT SET HERE
    //
    try {
      console.log(
        "Setting up button click listener and waiting for user click"
      );
      // Set up a promise that resolves when the button is clicked
      const buttonClicked = page.evaluate(() => {
        return new Promise((resolve) => {
          const searchButton = document.querySelector(".load.right");
          if (!searchButton) {
            throw new Error("Search button not found");
          }
          searchButton.addEventListener("click", () => {
            console.log("Search button was clicked");
            resolve();
          });
        });
      });

      // Wait for the button to be clicked
      await buttonClicked;
      console.log("Button click detected, now looking for result set");

      // Function to repeatedly check for the selector
      async function waitForResults() {
        for (let attempts = 0; attempts < 5; attempts++) {
          try {
            await page.waitForSelector(".resultset .res", {
              visible: true,
              timeout: 5000,
            });
            console.log("Result set has loaded, moving on to the scraping");
            return true;
          } catch {
            console.log(`Attempt ${attempts + 1}: Waiting for results to load`);
            await delay(5000); // 5s wait before retrying
          }
        }
        throw new Error(
          "Result set did not load properly after multiple attempts."
        );
      }

      // Execute the function to wait for results
      await waitForResults();

      // Continue with your scraping logic here after the results have loaded
      console.log("Proceeding with data extraction");
    } catch (error) {
      console.error("Error waiting for the selector:", error);
      res
        .status(500)
        .send({ success: false, message: "Error waiting for the selector." });
      return;
    }

    //
    // DATA EXTRACTION / SCRAPING PART
    //

    let allData = [];
    let rawData = [];
    let currentPage = 1;

    while (true) {
      console.log("Scraping the cur page", currentPage++);

      if (
        url ==
        "https://online-centrum-holidays.com/search_hotel?CHECKIN_BEG=20240429&NIGHTS_FROM=7&CHECKIN_END=20240502&NIGHTS_TILL=7&ADULT=2&CURRENCY=2&CHILD=0&TOWNS_ANY=1&STARS_ANY=1&STARS=&hotelsearch=0&HOTELS_ANY=1&HOTELS=&MEALS_ANY=1&MEALS=&ROOMS_ANY=1&ROOMS=&CHILD_IN_BED=0&FREIGHT=1&COMFORTABLE_SEATS=0&FILTER=0&MOMENT_CONFIRM=0&WITHOUT_PROMO=0&UFILTER="
      ) {
        let pageData = await page.evaluate(() => {
          const rows = Array.from(
            document.querySelectorAll(".resultset .res tbody tr")
          );
          return rows
            .map((row) => {
              const cells = row.querySelectorAll("td");
              const availabilityElements = Array.from(
                row.querySelectorAll("td.nw span.hotel_availability")
              );
              const availabilityInfo = availabilityElements
                .map((span) => {
                  if (span.classList.contains("hotel_availability_Y"))
                    return "ЕМ ";
                  if (span.classList.contains("hotel_availability_N"))
                    return "НМ ";
                  if (span.classList.contains("hotel_availability_R"))
                    return "ПЗ ";
                  if (span.classList.contains("hotel_availability_F"))
                    return "МЛ ";
                })
                .join("");

              if (
                availabilityElements.length === 4 &&
                availabilityElements.every((span) =>
                  span.classList.contains("hotel_availability_N")
                )
              ) {
                return null;
              }

              return {
                date: cells[1]?.innerText.trim() || "",
                tour: cells[2]?.innerText.trim() || "",
                nights: cells[3]?.innerText.trim() || "",
                hotel: cells[4]?.innerText.trim() || "",
                availability: availabilityInfo || "Unknown",
                meal: cells[6]?.innerText.trim() || "",
                room: cells[7]?.innerText.trim() || "",
                price: cells[10]?.innerText.match(/\d+[\.\,]?\d*/)
                  ? cells[10]?.innerText.match(/\d+[\.\,]?\d*/)[0]
                  : "",
                priceType: cells[13]?.innerText.trim() || "",
                transport: cells[14]?.innerText.trim() || "",
              };
            })
            .filter((entry) => entry !== null);
        });
        rawData = rawData.concat(pageData);
        console.log("rawdata being created", rawData);
      } else {
        let pageData = await page.evaluate(() => {
          const rows = Array.from(
            document.querySelectorAll(".resultset .res tbody tr")
          );
          return rows.map((row) => {
            const dateCell = row.querySelector("td.sortie");
            const hotelCell = row.querySelector("td.link-hotel");
            const priceCell = row.querySelector("td.td_price span.price");
            const roomTypeCell = row.querySelector("td:nth-child(8)");
            const priceTypeCell = row.querySelector(
              "td.type_price span.link.all_prices"
            );

            const dateText = dateCell ? dateCell.innerText.trim() : "";
            const date = dateText.split("\n")[0].trim();
            const hotel = hotelCell ? hotelCell.innerText.trim() : "";
            const priceText = priceCell ? priceCell.textContent.trim() : "";
            const roomType = roomTypeCell
              ? roomTypeCell.textContent.trim()
              : "";
            const priceType = priceTypeCell
              ? priceTypeCell.textContent.trim()
              : "";

            const price = priceText.match(/\d+[\.,]?\d+/)
              ? parseFloat(priceText.match(/\d+[\.,]?\d+/)[0].replace(/,/g, ""))
              : 0;

            if (date && hotel && price && roomType && priceType) {
              return {
                date,
                hotel,
                price,
                roomType,
                priceType,
              };
            }
            return null;
          });
        });

        let mappedPageData = pageData.map((data) => {
          let dateParts = data.date.split(".");
          let formattedDate =
            dateParts.length === 3
              ? `${dateParts[0]}.${dateParts[1]}`
              : data.date;

          return {
            date: formattedDate,
            hotel: data.hotel,
            price: data.price,
            roomType: data.roomType,
            aggregatorIndex: determineAggregatorIndex(url),
          };
        });
        allData = allData.concat(mappedPageData);
        console.log(mappedPageData);
      }

      // await delay(500);
      console.log("Trying to find the pager");
      let pagesInfo = await page.evaluate(() => {
        const pager = document.querySelector(".pager");
        if (pager) {
          const currentPageElement = document.querySelector(
            ".pager .current_page"
          );
          const currentPageNum = currentPageElement
            ? parseInt(currentPageElement.textContent, 10)
            : 1;
          const pageElements = Array.from(
            document.querySelectorAll(".pager .page")
          );
          const lastPageNum = pageElements.length
            ? Math.max(
                ...pageElements.map((el) => parseInt(el.textContent, 10))
              )
            : 1;
          return { currentPageNum, lastPageNum };
        }
        return { currentPageNum: 1, lastPageNum: 1 };
      });
      await delay(500);
      console.log("Deciding to go the next page or not");
      const { currentPageNum, lastPageNum } = pagesInfo;
      if (currentPageNum < lastPageNum) {
        const nextPageNum = currentPageNum + 1;
        const nextPageButtonSelector = `.pager .page[data-page="${nextPageNum}"]`;
        if (await page.$(nextPageButtonSelector, { visible: true })) {
          await page.click(nextPageButtonSelector);
          await page.waitForSelector(nextPageButtonSelector, { hidden: true });
        }
      } else {
        break;
      }
    }

    if (allData.length == 0 || rawData.length == 0) {
      console.error("No data found on the page.");
    } else {
      console.log("Starting template population of scraped data");
      if (
        url ==
        "https://online-centrum-holidays.com/search_hotel?CHECKIN_BEG=20240429&NIGHTS_FROM=7&CHECKIN_END=20240502&NIGHTS_TILL=7&ADULT=2&CURRENCY=2&CHILD=0&TOWNS_ANY=1&STARS_ANY=1&STARS=&hotelsearch=0&HOTELS_ANY=1&HOTELS=&MEALS_ANY=1&MEALS=&ROOMS_ANY=1&ROOMS=&CHILD_IN_BED=0&FREIGHT=1&COMFORTABLE_SEATS=0&FILTER=0&MOMENT_CONFIRM=0&WITHOUT_PROMO=0&UFILTER="
      ) {
        console.log("creating timestamps and file data for raw hotel data");
        const workbook = new excel.Workbook();
        const worksheet = workbook.addWorksheet("Results");

        worksheet.columns = [
          { header: "Date", key: "date", width: 15 },
          { header: "Tour", key: "tour", width: 25 },
          { header: "Nights", key: "nights", width: 10 },
          { header: "Hotel", key: "hotel", width: 30 },
          { header: "Availability", key: "availability", width: 20 },
          { header: "Meal", key: "meal", width: 10 },
          { header: "Room", key: "room", width: 10 },
          { header: "Price", key: "price", width: 10 },
          { header: "Price Type", key: "priceType", width: 15 },
          { header: "Transport", key: "transport", width: 15 },
        ];

        rawData.forEach((item) => {
          worksheet.addRow(item);
        });

        // Auto filter for all columns
        worksheet.autoFilter = {
          from: "A1",
          to: "J1",
        };

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `ScrapedData-Hotels-${timestamp}.xlsx`;
        // Ensure the directory exists
        if (!fs.existsSync(__dirname)) {
          fs.mkdirSync(__dirname, { recursive: true });
        }
        // Save the workbook
        const newOutputPath = path.join(`./${filename}`);
        await workbook.xlsx.writeFile(newOutputPath);
        console.log(`Data has been written to Excel file at ${newOutputPath}`);

        exec(`start excel "${newOutputPath}"`, (error) => {
          if (error) {
            console.error(`Could not open Excel file: ${error.message}`);
            res.send({
              success: false,
              message: `Could not open Excel file: ${error.message}`,
            });
            return;
          }
          res.send({
            success: true,
            message: "Data scraped successfully and saved to Excel.",
            filePath: newOutputPath,
          });
        });
      } else {
        const newOutputPath = await populateTemplateWithScrapedData(allData);

        exec(`start excel "${newOutputPath}"`, (error) => {
          if (error) {
            console.error(`Could not open Excel file: ${error.message}`);
            res.send({
              success: false,
              message: `Could not open Excel file: ${error.message}`,
            });
            return;
          }
          res.send({
            success: true,
            message: "Data scraped successfully and saved to Excel.",
            filePath: newOutputPath,
          });
        });
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: "Failed to scrape data.",
    });
  } finally {
    if (browser) {
    }
  }
});

const port = 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  open(`http://localhost:${port}`);
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
