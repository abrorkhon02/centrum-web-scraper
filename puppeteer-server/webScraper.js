const puppeteer = require("puppeteer");
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

class WebScraper {
  constructor(webpages) {
    this.url = null;
    this.browser = null;
    this.webpages = webpages;
  }

  async launchBrowser(executablePath) {
    this.browser = await puppeteer.launch({
      executablePath: executablePath || "./chromium/chrome.exe",
      headless: false,
      defaultViewport: null,
      args: ["--disable-features=site-per-process", "--start-maximized"],
    });
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async navigateAndScrape(url) {
    this.url = url;
    const pages = await this.browser.pages();
    const page = pages[0];
    let allData = [];
    let errorOccurred = null;
    let destinationAndStartDate;

    try {
      await this.ensurePageLoad(page, this.url);
      destinationAndStartDate = await this.handlePageScraping(page);

      let currentPageNum = 1;
      let lastPageNum = await this.findLastPageNumber(page);

      while (currentPageNum <= lastPageNum) {
        console.log(`Currently on page ${currentPageNum} of ${lastPageNum}`);
        const newData = await this.extractData(page, this.url);
        allData = allData.concat(newData);

        if (currentPageNum >= lastPageNum) {
          console.log("Reached the last page or there's a single page.");
          break;
        }
        lastPageNum = await this.findLastPageNumber(page); // Refresh last page number
        currentPageNum++;
        await this.goToNextPage(page, currentPageNum);
      }
    } catch (error) {
      console.error("Error during page navigation and scraping:", error);
      errorOccurred = error;
    } finally {
      // await page.close();
    }

    if (errorOccurred) {
      return {
        error: `An error occurred during scraping: ${errorOccurred}`,
        data: allData,
        destinationAndStartDate,
        partialSuccess: true,
      };
    }

    return {
      error: null,
      data: allData,
      destinationAndStartDate,
      partialSuccess: false,
    };
  }

  async findLastPageNumber(page) {
    const nextPageSelector = ".pager .page";
    const maxRetries = 3;
    const retryDelay = 2000;
    let lastKnownPageNumber = 1;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Finding last page number (attempt ${attempt})...`);

        // Check for the presence of .pager
        const pager = await page.$(".pager");
        if (!pager) {
          console.log("WARNING: No pager found, but still proceeding");
        }

        await page.waitForSelector(nextPageSelector, {
          timeout: retryDelay,
        });

        const lastPageNum = await page.evaluate((selector) => {
          const pageElements = Array.from(document.querySelectorAll(selector));
          const pageNumbers = pageElements.map((el) =>
            parseInt(el.getAttribute("data-page"), 10)
          );

          if (pageNumbers.length === 0) return 1;
          return Math.max(...pageNumbers);
        }, nextPageSelector);

        console.log(`Last page number found: ${lastPageNum}`);
        lastKnownPageNumber = lastPageNum;
        return lastPageNum;
      } catch (error) {
        console.error(
          `Error while finding last page number (attempt ${attempt}):`,
          error
        );
        if (attempt < maxRetries) {
          console.log(`Retrying in ${retryDelay} ms...`);
          await delay(retryDelay);
        } else {
          console.log(
            "Falling back to last known page number:",
            lastKnownPageNumber
          );
          return lastKnownPageNumber;
        }
      }
    }
  }

  async goToNextPage(page, nextPageNum) {
    const maxRetries = 10;
    let attempt = 0;
    const retryDelay = 4000;

    while (attempt < maxRetries) {
      try {
        console.log(
          `Navigating to page ${nextPageNum} (attempt ${attempt + 1})...`
        );
        const nextPageButtonSelector = `.pager .page[data-page="${nextPageNum}"]`;

        // Click and wait for the next page button
        const nextPageButton = await page.$(nextPageButtonSelector);
        if (nextPageButton) {
          await nextPageButton.click();
          await page.waitForSelector(nextPageButtonSelector, { hidden: true });

          // Short delay to allow the page to stabilize
          await delay(500);
        } else {
          throw new Error(`Next page button not found for page ${nextPageNum}`);
        }

        console.log(`Successfully navigated to page ${nextPageNum}.`);
        return;
      } catch (error) {
        attempt += 1;
        console.error(
          `Error while navigating to page ${nextPageNum} (attempt ${attempt}):`,
          error
        );

        if (attempt < maxRetries) {
          logger.info(
            `Retrying in ${
              retryDelay / 1000
            } seconds... If the Excel sheet is opened, please close it.`
          );
          await delay(retryDelay);
        } else {
          throw new Error(
            `Failed to navigate to page ${nextPageNum} after ${maxRetries} attempts`
          );
        }
      }
    }
  }

  async ensurePageLoad(page, url, retryInterval = 10000) {
    const startTime = Date.now();
    let loaded = false;

    while (!loaded) {
      try {
        // Attempt to navigate to the page
        await page.goto(url, {
          timeout: retryInterval, // Use retryInterval for the timeout
        });
        loaded = true; // If navigation succeeds, set loaded to true
        console.log("Page loaded successfully.");
      } catch (error) {
        console.log(`Page load timeout (${retryInterval}ms). Retrying...`);
        await page.reload({
          waitUntil: "networkidle0",
          timeout: retryInterval,
        });
      }

      if (!loaded) {
        await new Promise((resolve) => setTimeout(resolve, retryInterval));
      }
    }
  }

  async handlePageScraping(page) {
    while (true) {
      if (page.isClosed()) {
        console.log("Page is closed, exiting scraping loop.");
        return;
      }

      try {
        await this.monitorSearchButtonClick(page);

        if (page.isClosed()) {
          console.log(
            "Page closed before waiting for results, exiting scraping loop."
          );
          return;
        }

        await this.waitForResults(page);

        if (page.isClosed()) {
          console.log(
            "Page closed before scraping destination and startDate, exiting scraping loop."
          );
          return;
        }

        const destinationAndStartDate =
          await this.scrapeDestinationAndStartDate(page);
        console.log(
          `Destination scraped: ${destinationAndStartDate.destination}, StartDate scraped: ${destinationAndStartDate.startDate}`
        );
        return destinationAndStartDate;
      } catch (error) {
        if (page.isClosed()) {
          console.log(
            "Page closed during error handling, exiting scraping loop."
          );
          return;
        }

        console.error("Error while handling page scraping:", error);
        console.log("Refreshing the page to try again...");
        await page.reload();
      }
    }
  }

  async monitorSearchButtonClick(page) {
    console.log("Monitoring the search button for clicks...");

    while (true) {
      try {
        if (page.isClosed()) {
          console.log("Page is closed, exiting monitoring loop.");
          return;
        }

        await page.waitForSelector(".load.right", { timeout: 20000 });
        console.log("Search button found!");

        await page.evaluate(() => {
          return new Promise((resolve, reject) => {
            const searchButton = document.querySelector(".load.right");
            if (!searchButton) {
              reject("Search button not found");
              return;
            }

            const listener = () => {
              console.log("Search button was clicked");
              resolve();
              searchButton.removeEventListener("click", listener);
            };

            searchButton.addEventListener("click", listener);
          });
        });

        console.log("Search button was clicked, waiting for results...");
        return;
      } catch (error) {
        console.error("Error while monitoring search button:", error);
        console.log("Retrying to find the search button...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  async scrapeDestinationAndStartDate(page) {
    return await page.evaluate(() => {
      // Scrape the destination
      const destinationSelector = ".STATEINC_chosen .chosen-single span";
      const selectedDestination = document.querySelector(destinationSelector);
      const destination = selectedDestination
        ? selectedDestination.textContent.trim()
        : undefined;

      // Scrape the start date from the input field
      const startDateSelector = 'input[name="CHECKIN_BEG"]';
      const startDateInput = document.querySelector(startDateSelector);
      const startDate = startDateInput ? startDateInput.value : undefined;

      return {
        destination,
        startDate,
      };
    });
  }

  async waitForResults(page) {
    const resultsSelector = ".resultset .res";
    const maxRetries = 10;
    const retryDelay = 4000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (page.isClosed()) {
          console.log("Page is closed, exiting wait for results.");
          return;
        }

        console.log(`Attempt ${attempt}: Waiting for results to load`);
        await page.waitForSelector(resultsSelector, {
          visible: true,
          timeout: retryDelay * attempt,
        });

        console.log("Result set has loaded, moving on to the scraping");
        return;
      } catch (error) {
        if (page.isClosed()) {
          console.log("Page closed during error, exiting wait for results.");
          return;
        }

        console.error(`Attempt ${attempt} failed: ${error}`);
        if (attempt < maxRetries) {
          console.log(`Retrying in ${retryDelay} ms...`);
          await delay(retryDelay);
        } else {
          console.error("Exceeded max retries, exiting wait for results.");
          throw new Error("Failed to wait for results");
        }
      }
    }
  }

  async extractData(page, url) {
    const webpages = this.webpages;
    return await page.evaluate(
      (pageUrl, webpages) => {
        function determineAggregator(pageUrl) {
          const webpage = webpages.find((webpage) => webpage.url === pageUrl);
          return webpage ? webpage.name : "Unknown Webpage";
        }

        const aggregator = determineAggregator(pageUrl);
        const rows = Array.from(
          document.querySelectorAll(".resultset .res tbody tr")
        );
        return rows
          .map((row) => {
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

            const dateCell = row.querySelector("td.sortie");
            const hotelCell = row.querySelector("td.link-hotel");
            const priceCell = row.querySelector(".td_price span.price");
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

            return {
              date,
              hotel,
              price,
              roomType,
              priceType,
              aggregator,
            };
          })
          .filter((entry) => entry !== null);
      },
      url,
      webpages
    );
  }
}

module.exports = WebScraper;
