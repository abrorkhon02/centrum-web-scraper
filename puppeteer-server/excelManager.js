const excel = require("exceljs");
const path = require("path");
const fs = require("fs");
const cmpstr = require("cmpstr");
const { logger, hotelMatchLogger, hotelNotMatchLogger } = require("./logger");

class ExcelManager {
  constructor(templatePath) {
    this.templatePath = templatePath;
    this.workbook = new excel.Workbook();
    this.lastUsedRow = 2;
    this.comparisonCache = new Map();
  }

  async loadTemplate() {
    await this.workbook.xlsx.readFile(this.templatePath);
    this.updateLastUsedRow();
  }

  updateLastUsedRow() {
    const worksheet = this.workbook.getWorksheet(1);
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber > this.lastUsedRow) {
        this.lastUsedRow = rowNumber;
      }
    });
  }

  async saveWorkbook(outputFilePath) {
    // Updated saveWorkbook function
    await this.workbook.xlsx.writeFile(outputFilePath);
    logger.info(`Changes saved to: ${outputFilePath}`);
  }

  getWorksheet(name) {
    return this.workbook.getWorksheet(name);
  }

  findOrAddHotelBlock(worksheet, hotelName) {
    const normalizedInputName = this.normalizeHotelName(hotelName);
    let existingNameNormalized;
    let foundRow = null;
    let maxSimilarity = 0;
    let mostSimilarName = "";
    let bestMatchNormalized = "";

    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      if (rowNumber < 3) return; // Skip header rows

      let cell = row.getCell(1);

      // Correct handling of merged cells: check if it's the master cell of a merge
      if (cell.isMerged && cell.master && rowNumber !== cell.master.row) {
        return; // Skip this row as it's not the start of the merge block
      }

      // Only process the row if it's the start of a merge block or a single unmerged cell
      if (cell.value) {
        if (typeof cell.value !== "string") {
          logger.info(
            "Invalid input: Expected a string, received:",
            cell.value
          );
          return;
        }

        existingNameNormalized = this.normalizeHotelName(cell.value);
        if (this.compareHotels(hotelName, cell.value) === 0) {
          return; // If the hotels are the same, skip further processing
        }

        const similarity = this.weightedSimilarity(
          normalizedInputName,
          existingNameNormalized
        );

        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
          mostSimilarName = cell.value;
          bestMatchNormalized = existingNameNormalized;
          foundRow = rowNumber; // Store the row number

          logger.info(
            `New best match found: '${normalizedInputName}' with '${bestMatchNormalized}' - Similarity: ${similarity.toFixed(
              4
            )}`
          );
        }
      }
    });

    if (maxSimilarity >= 0.8) {
      hotelMatchLogger.info(
        `Confirmed best match between: '${hotelName}' and '${mostSimilarName}'; Normalized: '${normalizedInputName} and '${bestMatchNormalized}') at ${
          maxSimilarity * 100
        }% similarity at row ${foundRow}.`
      );
      return foundRow;
    } else {
      hotelNotMatchLogger.info(
        `No sufficient match found for '${hotelName}' and '${mostSimilarName}'; Normalized: '${normalizedInputName}' and ${bestMatchNormalized}') with ${
          maxSimilarity * 100
        }% similarity.`
      );
      return this.createHotelBlock(worksheet, hotelName, this.lastUsedRow + 1);
    }
  }

  weightedSimilarity(inputName, existingName) {
    const initialWordsWeight = 0.1;
    const uniqueWordsWeight = 0.7;
    const overallWordsWeight = 0.2;
    const percentageToExtract = 0.6;

    const initialWordsSimilarity = cmpstr.diceCoefficient(
      this.extractInitialWords(inputName, percentageToExtract),
      this.extractInitialWords(existingName, percentageToExtract)
    );

    const inputUniqueWords = this.extractUniqueWords(inputName);
    const existingUniqueWords = this.extractUniqueWords(existingName);
    const uniqueWordsSimilarity = cmpstr.diceCoefficient(
      inputUniqueWords,
      existingUniqueWords
    );
    const overallSimilarity = cmpstr.diceCoefficient(inputName, existingName);

    return (
      initialWordsWeight * initialWordsSimilarity +
      uniqueWordsWeight * uniqueWordsSimilarity +
      overallWordsWeight * overallSimilarity
    );
  }

  compareHotels(hotelA, hotelB) {
    // logger.info(`Comparing hotels: ${hotelA} vs ${hotelB}`);
    const cityA = this.extractCityName(hotelA) || "";
    const cityB = this.extractCityName(hotelB) || "";
    // logger.info(`Extracted cities: ${cityA}, ${cityB}`);
    let nameA = this.normalizeHotelName(hotelA);
    let nameB = this.normalizeHotelName(hotelB);
    // logger.info(`Normalized names for comparing: ${nameA}, ${nameB}`);

    const starRegex = /(\d+)-star/;
    let starsA = nameA.match(starRegex);
    let starsB = nameB.match(starRegex);
    // logger.info(
    //   `Star ratings: ${starsA ? starsA[1] : "None"} vs ${
    //     starsB ? starsB[1] : "None"
    //   }`
    // );

    // Conditions to handle null or undefined cities or star ratings
    if (
      (cityA && cityB && cityA !== cityB) ||
      (starsA && starsB && starsA[1] !== starsB[1])
    ) {
      // logger.info("Mismatch found. Returning 0 similarity.");
      return 0;
    }

    // Proceed with the name comparison even if one or both star ratings are undefined
    nameA = nameA.replace(starRegex, "").trim();
    nameB = nameB.replace(starRegex, "").trim();
    // logger.info(`Names after removing star ratings: ${nameA}, ${nameB}`);

    // Calculate similarity using diceCoefficient
    const similarity = cmpstr.diceCoefficient
      ? cmpstr.diceCoefficient(nameA, nameB)
      : 0;
    logger.info(`Computed similarity: ${similarity}`);

    return similarity;
  }

  normalizeHotelName(name) {
    let normalized = name.toLowerCase();
    normalized = normalized.replace(/(\d+)\s*\*/g, "$1-star");
    normalized = normalized.replace(
      /\*{1,5}/g,
      (match) => `${match.length}-star`
    );
    normalized = normalized.replace(/\(([^)]+)\)(?![^\(]*\))/g, "");
    normalized = normalized.replace(/\s+/g, " ").trim();
    return normalized;
  }

  extractCityName(hotelName) {
    const match = hotelName.match(/\(([^)]+)\)\s*$/);
    return match ? match[1].trim().toLowerCase() : null;
  }

  extractInitialWords = (text, percentage) => {
    const words = text.split(" ");
    const numberOfWords = Math.round(words.length * percentage);
    return words.slice(0, numberOfWords).join(" ");
  };

  extractUniqueWords(hotelName) {
    let words = hotelName.toLowerCase().split(/\s+/); // Split by spaces after converting to lower case
    let uniqueWords = words.filter(
      (word) => !commonWords.has(word) && isNaN(word)
    ); // Filter out common words and numbers
    return uniqueWords.join(" "); // Return the unique words as a single string
  }

  createHotelBlock(worksheet, hotelName, startRow) {
    let currentRow = Math.max(startRow, this.lastUsedRow + 1);

    // Merge 18 rows for the hotel block
    worksheet.mergeCells(startRow, 1, startRow + 17, 1);
    worksheet.getRow(startRow).getCell(1).value = hotelName;

    this.lastUsedRow = currentRow + 17; // Update last used row
    logger.info(
      `Created new block for ${hotelName} starting at row ${currentRow}`
    );
    return startRow;
  }

  insertHotelData(worksheet, hotel, datesOffers, destination, startDate) {
    const startRow = this.findOrAddHotelBlock(worksheet, hotel);
    this.populateDates(worksheet, startRow, startDate);
    logger.info(`Inserting data for ${hotel}`);
    datesOffers.forEach((offer) => {
      this.insertOfferData(worksheet, startRow, offer, destination);
    });
    this.updateLastUsedRow();
  }

  populateDates(worksheet, startRow, startDate) {
    let currentDate = this.formatDateForExcel(startDate);
    logger.info(
      `Starting to populate dates at row ${startRow} from date ${startDate}`
    );

    // Populate 18 dates
    for (let i = 0; i < 18; i++) {
      const formattedDate = `${currentDate
        .getUTCDate()
        .toString()
        .padStart(2, "0")}.${(currentDate.getUTCMonth() + 1)
        .toString()
        .padStart(2, "0")}`;
      let row = worksheet.getRow(startRow + i);
      row.getCell(2).value = formattedDate;
      logger.info(`Populating row ${startRow + i} with date ${formattedDate}`);
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
  }

  formatDateForExcel(dateStr) {
    const cleanDateStr = dateStr.split(",")[0].trim();
    const [day, month, year] = cleanDateStr.split(".").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  normalizeRoomType(roomType) {
    let normalized = roomType.toLowerCase();

    // Consolidate variations of 'double', 'twin', and related terms
    normalized = normalized.replace(
      /\b(dbl|double|twin|2\s*adl?s?|2adult?|2pax|king|wall)\b/g,
      "double"
    );

    // Consolidate 'economy', 'econom', 'standard', and 'budget' into 'standard'
    normalized = normalized.replace(
      /\b(econom(?:y)?|standard|budget|std)\b/g,
      "standard"
    );

    // Remove the word 'room' completely
    normalized = normalized.replace(/\broom\b/g, "");

    // Handle other room types
    normalized = normalized.replace(/\bsingle\b/g, "single");
    normalized = normalized.replace(/\btriple\b/g, "triple");
    normalized = normalized.replace(/\bquad\b/g, "quad");
    normalized = normalized.replace(/\bexecutive\b/g, "executive");
    normalized = normalized.replace(/\bsuperior\b/g, "superior");

    // Remove unnecessary words and noise
    normalized = normalized.replace(
      /\b(with|and|or|street|view|balcony|city|sea|garden|back|opera|)\b/g,
      ""
    );

    // Trim and reduce multiple spaces to a single space
    normalized = normalized.replace(/\s+/g, " ").trim();

    return normalized;
  }

  insertOfferData(worksheet, startRow, offer, destination) {
    logger.info(
      `Attempting to insert data for date: ${offer.date} and start row: ${startRow}`
    );
    let rowIndex = this.findDateRow(worksheet, startRow, offer.date);
    if (rowIndex === null) {
      logger.info(
        "Date not found in the expected rows, check the date population logic."
      );
      return;
    }

    logger.info(`Date row index found: ${rowIndex}`);
    let row = worksheet.getRow(rowIndex);
    const priceCol = 3 + offer.aggregatorIndex;
    let roomTypeCol;
    // Calculate roomTypeCol based on destination
    // const roomTypeCol = destination.toLowerCase() === "uae" || "оаэ" ? 10 : 9;
    if (
      destination.toLowerCase() === "uae" ||
      destination.toLowerCase() === "оаэ"
    ) {
      roomTypeCol = 10;
    } else if (
      destination.toLowerCase() === "georgia" ||
      destination.toLowerCase() === "грузия"
    ) {
      roomTypeCol = 9;
    }
    console.log(`The Roomtype col is: ${roomTypeCol}`);

    // Fetch existing room type from the correct column
    let existingRoomType = row.getCell(roomTypeCol).value || "";
    logger.info(`Existing room type fetched: '${existingRoomType}'`);

    let normalizedInputRoomType = this.normalizeRoomType(offer.roomType);
    let normalizedExistingRoomType = this.normalizeRoomType(existingRoomType);

    logger.info(`Normalized input room type: '${normalizedInputRoomType}'`);
    logger.info(
      `Normalized existing room type: '${normalizedExistingRoomType}'`
    );

    let similarity = this.compareStrings(
      normalizedInputRoomType,
      normalizedExistingRoomType
    );
    logger.info(`Similarity score between room types: ${similarity}`);

    // If there is no existing room type in the correct column, set it
    if (!existingRoomType) {
      logger.info(
        `Column '${roomTypeCol}' is empty, setting room type: ${offer.roomType}`
      );
      row.getCell(roomTypeCol).value = offer.roomType;
    }

    // Determine whether to display the room type with the price based on similarity
    if (similarity < 0.8 && existingRoomType) {
      logger.info(
        `Low similarity detected (less than 80%). Displaying price with room type: ${offer.price} / ${offer.roomType}`
      );
      row.getCell(priceCol).value = `${offer.price} / ${offer.roomType}`;
    } else {
      logger.info(
        `High similarity detected (80% or more). Displaying only price: ${offer.price}`
      );
      row.getCell(priceCol).value = offer.price;
    }
  }
  findDateRow(worksheet, startRow, date) {
    const targetDateStr = date.split(",")[0].trim().slice(0, 5);

    // Search within 18 rows
    for (let i = 0; i < 18; i++) {
      let row = worksheet.getRow(startRow + i);
      let cellDate = row.getCell(2).value;
      if (cellDate === targetDateStr) {
        return startRow + i;
      }
    }
    logger.info(
      `Date ${targetDateStr} not found in rows starting at ${startRow}`
    );
    return null;
  }

  compareStrings(stringA, stringB) {
    return cmpstr.diceCoefficient(stringA, stringB);
  }

  parseDate(dateInput) {
    if (dateInput instanceof Date) return dateInput;
    const [day, month, year] = dateInput.split(".").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
}

const commonWords = new Set([
  "by",
  "hotel",
  "hotels",
  "suites",
  "residence",
  "resort",
  "lodge",
  "place",
  "house",
  "boutique",
  "spa",
  "b&b",
  "motel",
  "hostel",
  "guesthouse",
  "accommodation",
  "stay",
  "room",
  "rooms",
  "palace",
  "international",
  "national",
  "luxury",
  "budget",
  "economy",
  "apartments",
  "bungalows",
  "palace",
  "line",
  "villa",
  "villas",
  "tbilisi",
  "adjara",
  "gudauri",
  "gurjaani",
  "imereti",
  "kazbegi",
  "kvareli",
  "lagodekhi",
  "mtskheta",
  "samegrelo-upper svaneti",
  "samtskhe-javakheti",
  "shekvetili",
  "кахетия",
  "телави",
  "abu dhabi",
  "ajman",
  "dubai",
  "fujairah",
  "ras al khaimah",
  "sharjah",
  "umm al quwain",
  "al barsha",
  "bur dubai",
  "deira",
  "official,",
]);

module.exports = ExcelManager;
