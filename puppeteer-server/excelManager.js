const excel = require("exceljs");
const path = require("path");
const fs = require("fs");
const cmpstr = require("cmpstr");
const logger = require("./logger");

class ExcelManager {
  constructor(templatePath, outputPath = null) {
    this.templatePath = templatePath;
    this.outputPath = outputPath;
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

  async saveWorkbook(customFileName = null) {
    await this.workbook.xlsx.writeFile(this.templatePath);
    console.log(
      `Changes saved back to the original file: ${this.templatePath}`
    );
    return this.templatePath;
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
        existingNameNormalized = this.normalizeHotelName(cell.value);

        if (
          this.compareHotels(normalizedInputName, existingNameNormalized) === 0
        ) {
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
      logger.info(
        `Confirmed best match: '${mostSimilarName}' (Normalized: '${bestMatchNormalized}') with ${
          maxSimilarity * 100
        }% similarity at row ${foundRow}.`
      );
      return foundRow;
    } else {
      logger.info(
        `No sufficient match found for '${hotelName}' (Normalized: '${normalizedInputName}'), closest was '${mostSimilarName}' (Normalized: '${bestMatchNormalized}') with ${
          maxSimilarity * 100
        }% similarity.`
      );
      return this.createHotelBlock(worksheet, hotelName, this.lastUsedRow + 1);
    }
  }

  weightedSimilarity(inputName, existingName) {
    const initialWordsWeight = 0.5;
    const overallWordsWeight = 0.5;

    // Function to extract the first N words from a string
    const extractInitialWords = (text, numberOfWords) => {
      return text.split(" ").slice(0, numberOfWords).join(" ");
    };

    // Adjust the number of words to compare here
    const numberOfWordsToCompare = 3;

    // Extract the first two or three words
    const inputInitialWords = extractInitialWords(
      inputName,
      numberOfWordsToCompare
    );
    const existingInitialWords = extractInitialWords(
      existingName,
      numberOfWordsToCompare
    );

    // Compute similarity for the initial words using Dice Coefficient
    const initialWordsSimilarity = cmpstr.diceCoefficient(
      inputInitialWords,
      existingInitialWords
    );

    // Compute overall similarity for the entire strings
    const overallSimilarity = cmpstr.diceCoefficient(inputName, existingName);

    // Combine the similarities with respective weights
    return (
      initialWordsWeight * initialWordsSimilarity +
      overallWordsWeight * overallSimilarity
    );
  }

  compareHotels(hotelA, hotelB) {
    const cacheKey = `${hotelA}|${hotelB}`;
    if (this.comparisonCache.has(cacheKey)) {
      return this.comparisonCache.get(cacheKey);
    }

    let nameA = this.normalizeHotelName(hotelA);
    let nameB = this.normalizeHotelName(hotelB);

    // Regex to extract the numerical star rating explicitly stated as '-star'
    const starRegex = /(\d+)-star/; // This matches '4-star' and captures '4'
    let starsA = nameA.match(starRegex);
    let starsB = nameB.match(starRegex);

    let similarity = 0;
    if (starsA && starsB && starsA[1] !== starsB[1]) {
      // logger.info(`Star level mismatch: ${starsA[1]} vs ${starsB[1]}`);
      similarity = 0; // Explicitly set similarity to 0 if star levels differ
    } else {
      // Remove star ratings from names to compare names only
      nameA = nameA.replace(starRegex, "").trim();
      nameB = nameB.replace(starRegex, "").trim();
      similarity = cmpstr.diceCoefficient(nameA, nameB);
    }

    this.comparisonCache.set(cacheKey, similarity);
    return similarity;
  }

  normalizeHotelName(name) {
    let normalized = name.toLowerCase();

    // Remove any parenthetical content
    normalized = normalized.replace(/\s*\([^)]*\)/g, "");

    // Remove common hotel-related keywords and star levels to simplify the name
    normalized = normalized.replace(
      /\b(international|1-star|2-star|3-star|4-star|5-star)\b/g,
      ""
    );

    // Correctly handle and convert asterisks or stars into numeric star ratings
    // First, handle cases like '5*' to '5-star'
    normalized = normalized.replace(/(\d+)\s*\*/g, "$1-star");

    // Then handle multiple asterisks like '****'
    normalized = normalized.replace(
      /\*{1,5}/g,
      (match) => `${match.length}-star`
    );

    // Normalize other numeric star ratings to have '-star' suffix if not already done
    normalized = normalized.replace(/(\d+)\s*star/g, "$1-star");
    normalized = normalized.replace(/(\d+)\s*stars/g, "$1-star");

    // Normalize spaces
    normalized = normalized.replace(/\s+/g, " ").trim();

    return normalized;
  }

  createHotelBlock(worksheet, hotelName, startRow) {
    let currentRow = Math.max(startRow, this.lastUsedRow + 1);
    // Check each row in the 9-row range for merges or empty cells
    for (let i = 0; i < 9; i++) {
      let row = worksheet.getRow(startRow + i);
      let cell = row.getCell(1);

      if (cell.isMerged) {
        // Since the block is merged, we only need to set the hotel name in the master cell
        let masterRow = worksheet.getRow(
          worksheet.getCell(cell.master.address).row
        );
        masterRow.getCell(1).value = hotelName;
        return masterRow.number; // Return the master row number of the merged block
      }

      // If no merges are found and this is the first row of the loop, set the hotel name and merge
      if (i === 0 && !cell.value) {
        worksheet.getRow(startRow).getCell(1).value = hotelName;
        worksheet.mergeCells(startRow, 1, startRow + 8, 1);
      }
    }

    this.lastUsedRow = currentRow + 8; // Update last used row after creating a new block
    logger.info(
      `Created new block for ${hotelName} starting at row ${currentRow}`
    );
    return startRow;
  }

  insertHotelData(worksheet, hotel, datesOffers, destination, startDate) {
    const startRow = this.findOrAddHotelBlock(worksheet, hotel);
    this.populateDates(
      worksheet,
      startRow,
      startDate,
      this.getWeekDaysByDestination(destination)
    );
    logger.info(`Inserting data for ${hotel}`);
    datesOffers.forEach((offer) => {
      this.insertOfferData(worksheet, startRow, offer);
    });
    this.updateLastUsedRow(); // Update lastUsedRow after modifying the sheet
  }

  populateDates(worksheet, startRow, startDate, weekDays) {
    let currentDate = this.formatDateForExcel(startDate);
    logger.info(
      `Starting to populate dates at row ${startRow} from date ${startDate}`
    );

    let daysAdded = 0;
    while (daysAdded < 9) {
      // Ensure exactly 9 dates are populated
      if (weekDays.includes(currentDate.getUTCDay())) {
        const formattedDate = `${currentDate
          .getUTCDate()
          .toString()
          .padStart(2, "0")}.${(currentDate.getUTCMonth() + 1)
          .toString()
          .padStart(2, "0")}`;
        let row = worksheet.getRow(startRow + daysAdded);
        row.getCell(2).value = formattedDate;
        logger.info(
          `Populating row ${startRow + daysAdded} with date ${formattedDate}`
        );
        daysAdded++;
      }
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

    // Normalize basic room types and their common variations
    normalized = normalized.replace(/\bstandard room\b/g, "standard");
    normalized = normalized.replace(/\bdouble room\b/g, "double");
    normalized = normalized.replace(/\bdeluxe room\b/g, "deluxe");
    normalized = normalized.replace(/\bexecutive room\b/g, "executive");
    normalized = normalized.replace(
      /\b(junior suite|jnr suite|executive suite)\b/g,
      "suite"
    );

    normalized = normalized.replace(/\superior room\b/g, "superior");

    normalized = normalized.replace(/\bsingle room\b/g, "single");
    normalized = normalized.replace(/\btwin room\b/g, "twin");
    normalized = normalized.replace(/\btriple room\b/g, "triple");
    normalized = normalized.replace(/\bquad room\b/g, "quad");

    // Normalize each specific keyword separately to prevent overlapping issues
    normalized = normalized.replace(/\bstandard\b/g, "standard");
    normalized = normalized.replace(/\bdouble\b/g, "double");
    normalized = normalized.replace(/\bdeluxe\b/g, "deluxe");
    normalized = normalized.replace(/\bexecutive\b/g, "executive");
    normalized = normalized.replace(/\bsuite\b/g, "suite");
    normalized = normalized.replace(/\bsingle\b/g, "single");
    normalized = normalized.replace(/\btwin\b/g, "twin");
    normalized = normalized.replace(/\btriple\b/g, "triple");
    normalized = normalized.replace(/\bquad\b/g, "quad");

    // Normalize numbers and abbreviations
    normalized = normalized.replace(/\b2adl?\b/g, "2 adult");

    // Remove descriptions that usually do not impact the room type matching
    normalized = normalized.replace(/\bwith [^,]*\b/g, ""); // removes any phrases starting with 'with'
    normalized = normalized.replace(/\bview\b/g, ""); // removes variations of view descriptors
    normalized = normalized.replace(/\bbalcony\b/g, ""); // removes word 'balcony'
    normalized = normalized.replace(/\bcity\b/g, ""); // removes city related descriptions
    normalized = normalized.replace(/\bsea\b/g, ""); // removes sea related descriptions
    normalized = normalized.replace(/\bgarden\b/g, ""); // removes garden related descriptions

    // Trim and reduce multiple spaces to a single space
    normalized = normalized.replace(/\s+/g, " ").trim();

    return normalized;
  }

  insertOfferData(worksheet, startRow, offer) {
    logger.info(
      `Attempting to insert data for date: ${offer.date} and start row: ${startRow}`
    );
    let rowIndex = this.findDateRow(worksheet, startRow, offer.date);

    if (rowIndex === null) {
      logger.error(
        "Date not found in the expected rows, check the date population logic."
      );
      return;
    }

    logger.info(`Date row index found: ${rowIndex}`);
    let row = worksheet.getRow(rowIndex);
    const priceCol = 3 + offer.aggregatorIndex;

    // Fetch existing room type from column 'I' which is index 9
    let existingRoomType = row.getCell(9).value || "";
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

    // If there is no existing room type in column 'I', set it
    if (!existingRoomType) {
      logger.info(`Column 'I' is empty, setting room type: ${offer.roomType}`);
      row.getCell(9).value = offer.roomType;
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
    for (let i = 0; i < 9; i++) {
      let row = worksheet.getRow(startRow + i);
      let cellDate = row.getCell(2).value;
      if (cellDate === targetDateStr) {
        return startRow + i;
      }
    }
    logger.error(
      `Date ${targetDateStr} not found in rows starting at ${startRow}`
    );
    return null;
  }

  compareStrings(stringA, stringB) {
    return cmpstr.diceCoefficient(stringA, stringB);
  }

  getWeekDaysByDestination(destination) {
    if (!destination) return [1, 2, 4, 5, 6];
    return destination.toLowerCase() === "грузия" ? [1, 2, 4, 5] : [2, 6];
  }

  parseDate(dateInput) {
    if (dateInput instanceof Date) return dateInput;
    const [day, month, year] = dateInput.split(".").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
}

module.exports = ExcelManager;
