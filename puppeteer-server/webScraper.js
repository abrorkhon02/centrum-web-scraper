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
    try {
      await this.ensurePageLoad(page, this.url);
      let allData = [];
      await this.handlePageScraping(page, this.url);
      let currentPageNum = 1;
      let lastPageNum = 0;
      do {
        const newData = await this.extractData(page, this.url);
        allData = allData.concat(newData);
        const pagesInfo = await this.findPagerInfo(page);
        currentPageNum = pagesInfo.currentPageNum;
        lastPageNum = pagesInfo.lastPageNum;
        console.log(`Currently on page ${currentPageNum} of ${lastPageNum}`);
        if (currentPageNum < lastPageNum) {
          try {
            await this.goToNextPage(page, currentPageNum + 1);
          } catch (error) {
            console.error(`Error going to next page: ${error}`);
            break;
          }
        }
      } while (currentPageNum < lastPageNum);

      return allData;
    } catch (error) {
      console.error("Error during page navigation and scraping:", error);
      throw error;
    } finally {
      await page.close();
    }
  }

  async findPagerInfo(page) {
    return page.evaluate(() => {
      const pager = document.querySelector(".pager");
      if (pager) {
        const currentPageElement = pager.querySelector(".current_page");
        const currentPageNum = currentPageElement
          ? parseInt(currentPageElement.textContent, 10)
          : 1;
        const pageElements = Array.from(pager.querySelectorAll(".page"));
        const lastPageNum = pageElements.length
          ? Math.max(...pageElements.map((el) => parseInt(el.textContent, 10)))
          : 1;
        return { currentPageNum, lastPageNum };
      }
      return { currentPageNum: 1, lastPageNum: 1 };
    });
  }

  async goToNextPage(page, nextPageNum) {
    const nextPageButtonSelector = `.pager .page[data-page="${nextPageNum}"]`;
    if (await page.$(nextPageButtonSelector)) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle0" }),
        page.click(nextPageButtonSelector),
      ]);
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

  async handlePageScraping(page, url) {
    console.log("Setting up button click listener and waiting for user click");
    const buttonClicked = await page.evaluate(() => {
      return new Promise((resolve, reject) => {
        const searchButton = document.querySelector(".load.right");
        if (!searchButton) {
          reject("Search button not found");
        }
        searchButton.addEventListener("click", () => {
          console.log("Search button was clicked");
          resolve();
        });
      });
    });
    await buttonClicked;
    console.log("Button click detected, now looking for result set");

    return await this.waitForResults(page);
  }

  async waitForResults(page) {
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
