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
const exceljs = require("exceljs");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "./frontend")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "./frontend/index.html"));
});

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

app.post("/api/start-session", async (req, res) => {
  const { url } = req.body;
  let browser;
  try {
    let retries = 5;
    let success = false;
    browser = await puppeteer.launch({
      executablePath: "./chromium/chrome.exe",
      headless: false,
      args: ["--disable-features=site-per-process"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    try {
      console.log("waiting for page to finish loading");
      await page.goto(url, { waitUntil: "networkidle0", timeout: 0 });
      console.log("page loaded");
    } catch (error) {
      console.error("Error during page navigation:", error);
      res
        .status(500)
        .send({ success: false, message: "Error during page navigation." });
      return;
    }
    try {
      console.log("waiting for the result selector to load");
      await page.waitForSelector(".resultset .res", {
        visible: true,
        timeout: 0,
      });
    } catch (error) {
      console.error("Error waiting for the selector:", error);
      res
        .status(500)
        .send({ success: false, message: "Error waiting for the selector." });
      return;
    }

    let allData = [];
    let currentPage = 1;
    let lastPageNumber = null;
    let isLastPage = false;

    while (true) {
      console.log("scraping the cur page", currentPage++);
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

      allData = allData.concat(pageData);
      // await delay(500);
      console.log("trying to find the pager");
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
      console.log("deciding to go the next page or not");
      const { currentPageNum, lastPageNum } = pagesInfo;
      if (currentPageNum < lastPageNum) {
        const nextPageNum = currentPageNum + 1;
        const nextPageButtonSelector = `.pager .page[data-page="${nextPageNum}"]`;
        if (await page.$(nextPageButtonSelector)) {
          await page.click(nextPageButtonSelector);
          await page.waitForSelector(nextPageButtonSelector, { hidden: true });
          // await delay(500);
        }
      } else {
        break;
      }
    }

    if (allData.length === 0) {
      console.error("No data found on the page.");
    } else {
      console.log(
        "Data has been scraped successfully, wait for excel sheet to open."
      );

      console.log("creating timestamps and file data");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `ScrapedData-${timestamp}.xlsx`;
      const filePath = path.join(tempDir, filename);

      // Ensure the directory exists
      if (!fs.existsSync(__dirname)) {
        fs.mkdirSync(__dirname, { recursive: true });
      }
      // Create an Excel workbook and write the data
      console.log("writing data to the excel sheet");
      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.json_to_sheet(allData);
      xlsx.utils.book_append_sheet(wb, ws, "Results");
      xlsx.writeFile(wb, filePath);
      console.log("Data has been written to Excel file.");

      exec(`start excel "${filePath}"`, (error) => {
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
          filePath: filePath,
        });
      });
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
