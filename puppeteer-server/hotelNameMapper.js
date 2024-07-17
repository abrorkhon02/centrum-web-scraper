const excel = require("exceljs");
const fs = require("fs");
const path = require("path");
const { logger } = require("./logger");

// Define paths for UAE and Georgian mappings
const uaeExcelFilePath = path.join(
  process.cwd(),
  "./assets/UAE_MatchedHotels.xlsx"
);
const georgiaExcelFilePath = path.join(
  process.cwd(),
  "./assets/GEORGIA_MatchedHotels.xlsx"
);
const uaeJsonFilePath = path.join(
  process.cwd(),
  "./assets/hotelMappings/uaeHotelMappings.json"
);
const georgiaJsonFilePath = path.join(
  process.cwd(),
  "./assets/hotelMappings/georgiaHotelMappings.json"
);

async function loadHotelMapping(country, forceOverwrite = true) {
  try {
    const jsonFilePath =
      country === "UAE" ? uaeJsonFilePath : georgiaJsonFilePath;
    const excelFilePath =
      country === "UAE" ? uaeExcelFilePath : georgiaExcelFilePath;

    if (forceOverwrite && fs.existsSync(jsonFilePath)) {
      logger.info(
        `Force overwriting existing ${country} hotel mapping JSON file.`
      );
      await fs.promises.unlink(jsonFilePath);
    }

    if (fs.existsSync(jsonFilePath)) {
      const jsonData = await fs.promises.readFile(jsonFilePath);
      const mapping = JSON.parse(jsonData);
      logger.info(`Loaded ${country} hotel mapping from JSON file.`);
      return mapping;
    } else {
      logger.info(`Loading ${country} hotel mapping from Excel file.`);
      const mapping = await loadFromExcel(excelFilePath);
      await saveHotelMapping(mapping, jsonFilePath);
      return mapping;
    }
  } catch (error) {
    logger.error(`Error loading ${country} hotel mapping:`, error);
    throw error;
  }
}

async function loadFromExcel(excelFilePath) {
  const workbook = new excel.Workbook();
  await workbook.xlsx.readFile(excelFilePath);
  const worksheet = workbook.getWorksheet(1);

  const hotelMapping = {};

  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (rowNumber === 1) return; // Skip the header row

    const rowValues = row.values;

    const templateHotelName = normalizeHotelName(rowValues[1] || "NA"); // Column A - Online Centrum
    const kompastourHotelName = normalizeHotelName(rowValues[2] || "NA"); // Column B - Kompastour
    const funsunHotelName = normalizeHotelName(rowValues[3] || "NA"); // Column C - FunSun
    const easyBookingHotelName = normalizeHotelName(rowValues[4] || "NA"); // Column D - EasyBooking
    const prestigeUZHotelName = normalizeHotelName(rowValues[5] || "NA"); // Column E - PrestigeUZ

    // Function to add mapping
    const addMapping = (websiteName, websiteHotelName) => {
      if (!hotelMapping[websiteName]) {
        hotelMapping[websiteName] = {};
      }
      if (!hotelMapping[websiteName][websiteHotelName]) {
        hotelMapping[websiteName][websiteHotelName] = [];
      }
      hotelMapping[websiteName][websiteHotelName].push(templateHotelName);
    };

    addMapping("Kompastour", kompastourHotelName);
    addMapping("FunSun", funsunHotelName);
    addMapping("EasyBooking", easyBookingHotelName);
    addMapping("PrestigeUZ", prestigeUZHotelName);
  });

  logger.info(
    "Loaded hotel name mapping:",
    JSON.stringify(hotelMapping, null, 2)
  );
  return cleanMapping(hotelMapping);
}

function normalizeHotelName(name) {
  // logger.info(`Original hotel name: ${name}`);

  let normalized = name
    .replace(/^\s*["']\s*|\s*["']\s*$/g, "") // Remove leading/trailing quotes
    .replace(/\(\s*(\d+)\s*\*\s*\)/g, "$1*") // Remove parentheses around star levels
    .replace(/\s*\([^()]*\)\s*/g, " ") // Remove text within single-level parentheses
    .replace(/(\d\s?\*+|\*+\s?\d)/g, (match) => {
      const stars = match.replace(/\D/g, ""); // Extract digit characters
      return ` ${stars}* `; // Ensure space around stars
    })
    .replace(/\bthreestar\b/gi, "3*") // Replace "ThreeStar" with "3*"
    .replace(/\bfourstar\b/gi, "4*") // Replace "FourStar" with "4*"
    .replace(/\bfivestar\b/gi, "5*") // Replace "FiveStar" with "5*"
    .replace(/\s*\([^)]*\)\s*/g, " ") // Remove all text within parentheses (again for nested)
    .replace(/\.\s*\*/g, " *") // Remove periods before stars
    .replace(/\*\s*\./g, "*") // Remove periods after stars
    .replace(/\s*\.$/, "") // Remove trailing periods
    .replace(/\./g, "") // Remove all periods (dots)
    .replace(/\s+/g, " ") // Remove extra spaces
    .trim()
    .toLowerCase(); // Make case-insensitive

  // logger.info(`Normalized hotel name: ${normalized}`);
  return normalized;
}

// Clean the mapping to remove empty "na" objects and redundant "na" values
function cleanMapping(mapping) {
  for (const website in mapping) {
    for (const hotel in mapping[website]) {
      // Remove redundant "na" values
      if (mapping[website][hotel].includes("na")) {
        mapping[website][hotel] = mapping[website][hotel].filter(
          (name) => name !== "na"
        );
      }
      // Remove "na" objects if they are empty
      if (hotel === "na" && mapping[website][hotel].length === 0) {
        delete mapping[website][hotel];
      }
    }
  }
  return mapping;
}

async function saveHotelMapping(mapping, jsonFilePath) {
  try {
    const jsonData = JSON.stringify(mapping, null, 2);
    await fs.promises.writeFile(jsonFilePath, jsonData);
    logger.info(`Hotel mapping saved to: ${jsonFilePath}`);
  } catch (error) {
    logger.error("Error saving hotel mapping:", error);
  }
}

// Function to count the number of hotels in each OTA object
function countHotelsInOTA(mapping, otaName) {
  if (!mapping[otaName]) {
    return 0;
  }
  let count = 0;
  for (const key in mapping[otaName]) {
    if (mapping[otaName].hasOwnProperty(key)) {
      count += mapping[otaName][key].length;
    }
  }
  return count;
}

module.exports = {
  loadHotelMapping,
};

// Execute the function for testing purposes
(async () => {
  try {
    const uaeMapping = await loadHotelMapping("UAE", true);
    const georgiaMapping = await loadHotelMapping("Georgia", true);
    logger.info("Hotel mappings ready for use.");

    const countries = [
      { name: "UAE", mapping: uaeMapping },
      { name: "Georgia", mapping: georgiaMapping },
    ];

    const otas = ["Kompastour", "FunSun", "EasyBooking", "PrestigeUZ"];

    countries.forEach((country) => {
      otas.forEach((ota) => {
        const count = countHotelsInOTA(country.mapping, ota);
        console.log(
          `Total number of hotels in ${ota} (${country.name}): ${count}`
        );
      });
    });
  } catch (error) {
    logger.error("Error during execution:", error);
  }
})();
