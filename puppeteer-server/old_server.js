const { exec } = require("child_process");
const cors = require("cors");
const bodyParser = require("body-parser");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const express = require("express");

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, "./frontend")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "./frontend/index.html"));
});

app.set("port", port);
app.listen(port, () => console.log(`Server running on localhost:${port}`));

app.use(cors());
app.use(bodyParser.json());

app.use(
  cors({
    origin: "http://localhost:4200",
    methods: "GET,POST",
    allowedHeaders: "Content-Type",
  })
);

app.use((req, res, next) => {
  console.log("Incoming Request:", req.method, req.path);
  console.log("Headers:", req.headers);
  next();
});

function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}

// Existing search endpoint
app.post("/api/search", (req, res) => {
  const searchParams = JSON.stringify(req.body);
  console.log("Params erhalten: ", searchParams);
  // Set the search parameters as an environment variable
  const env = process.env;
  env.SEARCH_PARAMS = searchParams;

  // Execute searchData.js without passing arguments
  exec("node searchData.js", { env: env }, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return res.status(500).send(error.message);
    }
    console.log(`stdout: ${stdout}`);
    if (stderr) {
      console.error(`stderr: ${stderr}`);
    }
    res.send(stdout);
  });
});

async function scrapeCityOptions(page, country) {
  const countrySelector = ".STATEINC_chosen a";

  await page.click(countrySelector);
  await page.waitForSelector(".chosen-drop .chosen-results .active-result");
  await delay(500);

  await page.evaluate((country) => {
    const options = Array.from(
      document.querySelectorAll(".chosen-drop .chosen-results .active-result")
    );
    const targetOption = options.find(
      (option) => option.textContent.trim() === country
    );
    if (targetOption) {
      targetOption.click();
    }
  }, country);

  await page.waitForFunction(
    `document.querySelector('.control_townto .checklistbox[name="TOWNS"]').childElementCount > 0`
  );

  const cities = await page.evaluate(() => {
    const cityOptions = [];
    const groupboxes = Array.from(
      document.querySelectorAll(".control_townto .groupbox")
    );
    groupboxes.forEach((groupbox) => {
      const groupName = groupbox
        .querySelector(".groupname")
        ?.textContent.trim();
      if (groupName) {
        const childCities = Array.from(
          groupbox.querySelectorAll(".groupboxChildren label.hidden")
        ).map((label) => label.textContent.trim());
        cityOptions.push({ groupName, childCities });
      }
    });
    return cityOptions;
  });

  console.log("Scraped cities:", cities);
  return cities;
}

app.post("/api/options/cities", async (req, res) => {
  const { country } = req.body;
  if (!country) {
    return res.status(400).send("Country parameter is required");
  }

  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(
      "https://online-centrum-holidays.com/search_tour?LANG=rus",
      {
        waitUntil: "networkidle0",
      }
    );

    const cityOptions = await scrapeCityOptions(page, country);

    await browser.close();
    res.json(cityOptions);
  } catch (error) {
    console.error(`Failed to get city options:`, error);
    res.status(500).send(error.message);
  }
});

// Endpoint for scraping hotels
app.get("/api/scrape-hotels", async (req, res) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto("https://online-centrum-holidays.com/search_tour");
  await page.waitForSelector("div.checklistbox.HOTELS label");

  const hotelNames = await page.$$eval(
    "div.checklistbox.HOTELS label",
    (labels) => labels.map((label) => label.textContent.trim())
  );

  await browser.close();

  // Save the scraped data to a JSON file
  const filePath = path.join(__dirname, "assets/hotels.json");
  fs.writeFile(filePath, JSON.stringify(hotelNames, null, 2), (err) => {
    if (err) {
      console.error("Error saving hotel data:", err);
      res.status(500).send("Error scraping hotels");
    } else {
      console.log(`Hotel data has been saved to ${filePath}`);
      res.status(200).json(hotelNames);
    }
  });
});
