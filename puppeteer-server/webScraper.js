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
      args: ["--disable-features=site-per-process"],
    });
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async navigateAndScrape(url) {
    this.url = url;
    const page = await this.browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    let allData = [];
    let errorOccurred = null;
    let destination;

    try {
      await this.ensurePageLoad(page, this.url);
      destination = await this.handlePageScraping(page);

      let currentPageNum = 1;
      let lastPageNum = await this.findLastPageNumber(page);

      do {
        const newData = await this.extractData(page, this.url);
        allData = allData.concat(newData);
        console.log(`Currently on page ${currentPageNum} of ${lastPageNum}`);

        if (currentPageNum >= lastPageNum) {
          console.log("Reached the last page or there's a single page.");
          break;
        }

        currentPageNum++;
        await this.goToNextPage(page, currentPageNum);
        lastPageNum = await this.findLastPageNumber(page); // Refresh last page number
      } while (currentPageNum <= lastPageNum);
    } catch (error) {
      console.error("Error during page navigation and scraping:", error);
      errorOccurred = error;
    } finally {
      await page.close();
    }

    if (errorOccurred) {
      return {
        error: `An error occurred during scraping: ${errorOccurred}`,
        data: allData,
        destination,
        partialSuccess: true,
      };
    }

    return {
      error: null,
      data: allData,
      destination,
      partialSuccess: false,
    };
  }

  async findLastPageNumber(page) {
    return page.evaluate(() => {
      const pageElements = Array.from(
        document.querySelectorAll(".pager .page")
      );
      const pageNumbers = pageElements.map((el) =>
        parseInt(el.getAttribute("data-page"), 10)
      );

      if (pageNumbers.length === 0) return 1;

      const lastPageNum = Math.max(...pageNumbers);
      return lastPageNum;
    });
  }

  async findPagerInfo(page) {
    return page.evaluate(() => {
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
          ? Math.max(...pageElements.map((el) => parseInt(el.textContent, 10)))
          : 1;
        return { currentPageNum, lastPageNum };
      }
      return { currentPageNum: 1, lastPageNum: 1 };
    });
  }

  async goToNextPage(page, nextPageNum) {
    try {
      await delay(500);
      console.log("Deciding to go the next page or not");
      const nextPageButtonSelector = `.pager .page[data-page="${nextPageNum}"]`;
      if (await page.$(nextPageButtonSelector, { visible: true })) {
        await page.click(nextPageButtonSelector);
        await page.waitForSelector(nextPageButtonSelector, { hidden: true });
      } else {
        throw new Error("break while changing pages");
      }
    } catch (error) {
      console.error(`Error while navigating to page ${nextPageNum}: ${error}`);
      throw error;
    }
  }

  async ensurePageLoad(page, url, timeout = 10000) {
    try {
      let timeoutHandle;
      const pageLoadPromise = new Promise((resolve, reject) => {
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
  }

  async handlePageScraping(page) {
    console.log("Setting up button click listener and waiting for user click");
    await page.evaluate(() => {
      return new Promise((resolve, reject) => {
        const searchButton = document.querySelector(".load.right");
        if (!searchButton) reject("Search button not found");

        searchButton.addEventListener("click", () => {
          console.log("Search button was clicked");
          resolve();
        });
      });
    });

    console.log("Button click detected, now looking for result set");
    await this.waitForResults(page);
    console.log("Result set has loaded, scraping destination");

    const destination = await this.scrapeDestination(page);
    console.log(`Destination scraped: ${destination}`);

    return destination;
  }

  async scrapeDestination(page) {
    return await page.evaluate(() => {
      const selectedDestination = document.querySelector(
        ".STATEINC_chosen .chosen-single span"
      );
      return selectedDestination
        ? selectedDestination.textContent.trim()
        : undefined;
    });
  }

  async waitForResults(page) {
    for (let attempts = 0; attempts < 10; attempts++) {
      try {
        await page.waitForSelector(".resultset .res", {
          visible: true,
          timeout: 5000,
        });
        console.log("Result set has loaded, moving on to the scraping");
        return true;
      } catch {
        console.log(`Attempt ${attempts + 1}: Waiting for results to load`);
      }
    }
    throw new Error(
      "Result set did not load properly after multiple attempts."
    );
  }

  async extractData(page, url) {
    const webpages = this.webpages;
    return await page.evaluate(
      (pageUrl, webpages) => {
        function determineAggregatorIndex(pageUrl) {
          return webpages.findIndex((webpage) => webpage.url === pageUrl);
        }

        const aggregatorIndex = determineAggregatorIndex(pageUrl);
        const rows = Array.from(
          document.querySelectorAll(".resultset .res tbody tr")
        );
        return rows
          .map((row) => {
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

            return {
              date,
              hotel,
              price,
              roomType,
              priceType,
              aggregatorIndex,
            };
          })
          .filter((entry) => entry !== null);
      },
      url,
      webpages
    );
  }

  determineAggregatorIndex(pageUrl) {
    const webpage = webpages.find((webpage) => webpage.url === pageUrl);
    return webpage ? webpages.indexOf(webpage) : -1;
  }
}

module.exports = WebScraper;
