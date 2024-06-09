const cmpstr = require("cmpstr");
const excel = require("exceljs");
const { logger, hotelMatchLogger, hotelNotMatchLogger } = require("./logger");

class ExcelManager {
  constructor(templatePath, hotelMapping) {
    this.templatePath = templatePath;
    this.hotelMapping = hotelMapping;
    this.workbook = new excel.Workbook();
    this.lastUsedRow = 2;
  }

  async loadTemplate() {
    await this.workbook.xlsx.readFile(this.templatePath);
    this.updateLastUsedRow();
    logger.info("Template loaded successfully.");
  }

  updateLastUsedRow() {
    const worksheet = this.workbook.getWorksheet(1);
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber > this.lastUsedRow) {
        this.lastUsedRow = rowNumber;
      }
    });
    logger.info(`Last used row updated to: ${this.lastUsedRow}`);
  }

  async saveWorkbook(outputFilePath) {
    await this.workbook.xlsx.writeFile(outputFilePath);
    logger.info(`Changes saved to: ${outputFilePath}`);
  }

  getWorksheet(name) {
    logger.info(`Retrieving worksheet: ${name}`);
    return this.workbook.getWorksheet(name);
  }

  findOrAddHotelBlock(worksheet, hotelName, destination, aggregatorIndex) {
    const pageNames = [
      "Online-Centrum",
      "Kompastour",
      "FunSun",
      "Kazunion",
      "PrestigeUZ",
      "AsiaLuxe",
      "EasyBooking",
    ];

    const currentAggregator = pageNames[aggregatorIndex];
    logger.info(
      `Processing hotel: ${hotelName} for destination: ${destination} on page: ${currentAggregator}`
    );

    if (currentAggregator !== "Online-Centrum") {
      logger.info(`Performing name mapping for ${currentAggregator}`);
      return this.findHotelInMapping(worksheet, hotelName, currentAggregator);
    }

    logger.info("Current OTA is Online-Centrum, skipping hotel mapping");
    return this.findHotelInTemplate(worksheet, hotelName);
  }

  findHotelInMapping(worksheet, hotelName, currentAggregator) {
    const normalizedHotelName = this.normalizeHotelName(hotelName);
    logger.info(
      `Searching for hotel in mapping: ${hotelName} (normalized: ${normalizedHotelName}) for aggregator: ${currentAggregator}`
    );

    const hotelMapping = this.hotelMapping[currentAggregator];

    if (hotelMapping) {
      const templateHotelName = hotelMapping[normalizedHotelName]
        ? hotelMapping[normalizedHotelName][0]
        : null;

      if (templateHotelName) {
        logger.info(
          `Match found in mapping for hotel: ${hotelName} -> ${templateHotelName}`
        );

        let foundRow = null;
        worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
          if (rowNumber === 1) return;

          let cell = row.getCell(1);
          if (cell.isMerged && cell.master && rowNumber !== cell.master.row) {
            return;
          }

          if (
            cell.value &&
            this.normalizeHotelName(cell.value) ===
              this.normalizeHotelName(templateHotelName)
          ) {
            foundRow = rowNumber;
            logger.info(`Hotel found in worksheet at row: ${foundRow}`);
          }
        });

        if (foundRow) {
          hotelMatchLogger.info(
            `Matched hotel: ${hotelName} (normalized: ${normalizedHotelName}) to row: ${foundRow}`
          );
          return foundRow;
        }
      }
    }

    hotelNotMatchLogger.info(
      `Hotel not found in mapping for ${currentAggregator}, normalized: ${normalizedHotelName}. Adding it to the bottom.`
    );
    return this.createHotelBlock(worksheet, hotelName, this.lastUsedRow + 1);
  }

  findHotelInTemplate(worksheet, hotelName) {
    const normalizedInputName = this.normalizeHotelName(hotelName);
    let foundRow = null;

    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      let cell = row.getCell(1);
      if (cell.isMerged && cell.master && rowNumber !== cell.master.row) {
        return;
      }
      const normalizedTemplateName = this.normalizeHotelName(cell.value);

      if (cell.value && normalizedTemplateName === normalizedInputName) {
        foundRow = rowNumber;
        logger.info(
          `Match found in template: scraped hotel name "${normalizedInputName}" matched with template hotel name "${normalizedTemplateName}" at row: ${foundRow}`
        );
      }
    });

    if (foundRow) {
      hotelMatchLogger.info(`Matched hotel: ${hotelName} to row: ${foundRow}`);
      return foundRow;
    } else {
      hotelNotMatchLogger.info(
        `No match found for hotel: ${hotelName}, normalized: ${normalizedInputName}. Adding it to the bottom.`
      );
      return this.createHotelBlock(worksheet, hotelName, this.lastUsedRow + 1);
    }
  }

  normalizeHotelName(name) {
    logger.info(`Original hotel name: ${name}`);

    let normalized = name
      .replace(/^\s*["']\s*|\s*["']\s*$/g, "") // Remove leading/trailing quotes
      .replace(/\(\s*(\d+)\s*\*\s*\)/g, "$1*") // Remove parentheses around star levels
      .replace(/\s*\([^()]*\)\s*/g, "") // Remove text within single-level parentheses
      .replace(/(\d\s?\*+|\*+\s?\d)/g, (match) => {
        const stars = match.replace(/\D/g, ""); // Extract digit characters
        return ` ${stars}* `; // Ensure space around stars
      })
      .replace(/\bthreestar\b/gi, "3*") // Replace "ThreeStar" with "3*"
      .replace(/\bfourstar\b/gi, "4*") // Replace "FourStar" with "4*"
      .replace(/\bfivestar\b/gi, "5*") // Replace "FiveStar" with "5*"
      .replace(/\s*\([^)]*\)\s*/g, "") // Remove all text within parentheses (again for nested)
      .replace(/\.\s*\*/g, " *") // Remove periods before stars
      .replace(/\*\s*\./g, "*") // Remove periods after stars
      .replace(/\s*\.$/, "") // Remove trailing periods
      .replace(/\s+/g, " ") // Remove extra spaces
      .trim()
      .toLowerCase(); // Make case-insensitive

    logger.info(`Normalized hotel name: ${normalized}`);
    return normalized;
  }

  createHotelBlock(worksheet, hotelName, startRow) {
    let currentRow = Math.max(startRow, this.lastUsedRow + 1);

    worksheet.mergeCells(startRow, 1, startRow + 17, 1);
    worksheet.getRow(startRow).getCell(1).value = hotelName;

    this.lastUsedRow = currentRow + 17;
    logger.info(
      `Created new block for ${hotelName} starting at row ${currentRow}`
    );
    return startRow;
  }

  populateDates(worksheet, startRow, startDate) {
    let currentDate = this.formatDateForExcel(startDate);
    logger.info(
      `Starting to populate dates at row ${startRow} from date ${startDate}`
    );

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
    // Remove HTML tags
    let normalized = roomType.replace(/<[^>]*>/g, "");

    // Normalize the room type
    normalized = normalized
      .toLowerCase()
      .replace(
        /\b(dbl|double|twin|2\s*adl?s?|2adult?|2pax|king|wall)\b/g,
        "double"
      )
      .replace(/\b(econom(?:y)?|standard|budget|std)\b/g, "standard")
      .replace(/\broom\b/g, "")
      .replace(/\bsingle\b/g, "single")
      .replace(/\btriple\b/g, "triple")
      .replace(/\bquad\b/g, "quad")
      .replace(/\bexecutive\b/g, "executive")
      .replace(/\bsuperior\b/g, "superior")
      .replace(
        /\b(with|and|or|street|view|balcony|city|sea|garden|back|opera|high|floor|partial|sea)\b/g,
        ""
      )
      .replace(/\s+/g, " ") // Remove extra spaces
      .trim();

    return normalized;
  }

  insertHotelData(
    worksheet,
    hotel,
    datesOffers,
    destination,
    startDate,
    updateMode
  ) {
    const startRow = this.findOrAddHotelBlock(
      worksheet,
      hotel,
      destination,
      datesOffers[0].aggregatorIndex
    );

    // Populate dates only if not in update mode or dates are not already populated
    if (!updateMode || !this.areDatesPopulated(worksheet, startRow)) {
      this.populateDates(worksheet, startRow, startDate);
    }

    logger.info(`Inserting data for ${hotel}`);
    datesOffers.forEach((offer) => {
      this.insertOfferData(worksheet, startRow, offer, destination, updateMode);
    });

    this.updateLastUsedRow();
  }

  insertOfferData(worksheet, startRow, offer, destination, updateMode) {
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
    const priceCol = 3 + offer.aggregatorIndex; // Ensure correct column for OTA
    let roomTypeCol;

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
    logger.info(`The Roomtype col is: ${roomTypeCol}`);

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

    if (!existingRoomType) {
      logger.info(
        `Column '${roomTypeCol}' is empty, setting room type: ${offer.roomType}`
      );
      row.getCell(roomTypeCol).value = offer.roomType;
    }

    const currentPriceValue = row.getCell(priceCol).value;
    const newPriceValue = offer.price;

    if (updateMode) {
      // Only update the price if it is different from the existing price
      if (currentPriceValue !== newPriceValue) {
        row.getCell(priceCol).value = newPriceValue;
      }
    } else {
      if (similarity < 0.8 && existingRoomType) {
        logger.info(
          `Low similarity detected (less than 80%). Displaying price with room type: ${newPriceValue} / ${offer.roomType}`
        );
        row.getCell(priceCol).value = `${newPriceValue} / ${offer.roomType}`;
      } else {
        logger.info(
          `High similarity detected (80% or more). Displaying only price: ${newPriceValue}`
        );
        row.getCell(priceCol).value = newPriceValue;
      }
    }
  }

  findDateRow(worksheet, startRow, date) {
    const targetDateStr = date.split(",")[0].trim().slice(0, 5);

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

  areDatesPopulated(worksheet, startRow) {
    for (let i = 0; i < 18; i++) {
      const cellValue = worksheet.getRow(startRow + i).getCell(2).value;
      if (!cellValue) {
        return false;
      }
    }
    return true;
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

module.exports = ExcelManager;
