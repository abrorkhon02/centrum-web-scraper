const puppeteer = require("puppeteer");
const fs = require("fs");

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto("https://online-centrum-holidays.com/search_tour");
  await page.waitForSelector("div.checklistbox.HOTELS label");

  const hotelNames = await page.$$eval(
    "div.checklistbox.HOTELS label",
    (labels) => labels.map((label) => label.textContent.trim())
  );

  console.log(hotelNames);

  fs.writeFile(
    "../../assets/hotels.json",
    JSON.stringify(hotelNames, null, 2),
    (err) => {
      if (err) throw err;
      console.log("Hotel data has been saved!");
    }
  );

  await browser.close();
})();
