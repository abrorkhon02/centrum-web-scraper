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

// New endpoint for scraping hotels
app.get("/api/scrape-hotels", async (req, res) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto("https://online-centrum-holidays.com/search_tour");
  await page.waitForSelector("div.checklistbox.HOTELS label");
  const hotelNames = await page.$$eval(
    "div.checklistbox.HOTELS label",
    (labels) =>
      labels.map(
        (label) =>
          label.getAttribute("title")?.trim() || label.textContent.trim()
      )
  );
  await browser.close();

  fs.writeFile(
    path.join(__dirname, "assets/hotels.json"),
    JSON.stringify(hotelNames, null, 2),
    (err) => {
      if (err) {
        console.error("Error saving hotel data:", err);
        res.status(500).send("Error scraping hotels");
      } else {
        console.log("Hotel data has been saved!");
        res.status(200).json(hotelNames);
      }
    }
  );
});
