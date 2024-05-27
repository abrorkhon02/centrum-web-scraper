const excel = require("exceljs");
const fs = require("fs");
const path = require("path");
const { logger } = require("./logger");

const excelFilePath = path.join(
  process.cwd(),
  "./assets/UAE_MatchedHotels.xlsx"
);
const jsonFilePath = path.join(
  process.cwd(),
  "./assets/hotelMappings/hotelMappings.json"
);

async function loadHotelMapping(forceOverwrite = true) {
  try {
    if (forceOverwrite && fs.existsSync(jsonFilePath)) {
      logger.info("Force overwriting existing hotelMapping.json file.");
      await fs.promises.unlink(jsonFilePath);
    }

    if (fs.existsSync(jsonFilePath)) {
      const jsonData = await fs.promises.readFile(jsonFilePath);
      const mapping = JSON.parse(jsonData);
      logger.info("Loaded hotel mapping from JSON file.");
      return mapping;
    } else {
      logger.info("Loading hotel mapping from Excel file.");
      const mapping = await loadFromExcel();
      await saveHotelMapping(mapping);
      return mapping;
    }
  } catch (error) {
    logger.error("Error loading hotel mapping:", error);
    throw error;
  }
}

async function loadFromExcel() {
  const workbook = new excel.Workbook();
  await workbook.xlsx.readFile(excelFilePath);
  const worksheet = workbook.getWorksheet(1);

  const hotelMapping = {};

  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (rowNumber === 1) return; // Skip the header row

    const rowValues = row.values;
    // logger.info(`Row ${rowNumber} values: ${JSON.stringify(rowValues)}`);

    const templateHotelName = (rowValues[1] || "NA").toLowerCase(); // Column A - Online Centrum
    const kompastourHotelName = (rowValues[2] || "NA").toLowerCase(); // Column B - Kompastour
    const funsunHotelName = (rowValues[3] || "NA").toLowerCase(); // Column C - FunSun
    const easyBookingHotelName = (rowValues[4] || "NA").toLowerCase(); // Column D - EasyBooking
    const prestigeUZHotelName = (rowValues[5] || "NA").toLowerCase(); // Column E - PrestigeUZ

    // Function to add mapping
    const addMapping = (websiteName, websiteHotelName) => {
      if (!hotelMapping[websiteName]) {
        hotelMapping[websiteName] = {};
      }
      if (!hotelMapping[websiteName][websiteHotelName]) {
        hotelMapping[websiteName][websiteHotelName] = [];
      }
      hotelMapping[websiteName][websiteHotelName].push(templateHotelName);
      // logger.info(
      //   `Added mapping for ${websiteName}: ${websiteHotelName} -> ${templateHotelName}`
      // );
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

async function saveHotelMapping(mapping) {
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
    const mapping = await loadHotelMapping(true);
    logger.info("Hotel mapping ready for use.");

    const kompastourCount = countHotelsInOTA(mapping, "Kompastour");
    const funsunCount = countHotelsInOTA(mapping, "FunSun");
    const easyBookingCount = countHotelsInOTA(mapping, "EasyBooking");
    const prestigeUZCount = countHotelsInOTA(mapping, "PrestigeUZ");

    console.log(`Total number of hotels in Kompastour: ${kompastourCount}`);
    console.log(`Total number of hotels in FunSun: ${funsunCount}`);
    console.log(`Total number of hotels in EasyBooking: ${easyBookingCount}`);
    console.log(`Total number of hotels in PrestigeUZ: ${prestigeUZCount}`);
  } catch (error) {
    logger.error("Error during execution:", error);
  }
})();
