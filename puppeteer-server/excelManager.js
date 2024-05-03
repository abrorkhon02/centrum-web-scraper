const excel = require("exceljs");
const path = require("path");
const fs = require("fs");

class ExcelManager {
  constructor(templatePath) {
    this.templatePath = templatePath;
    this.workbook = new excel.Workbook();
    this.lastUsedRow = 2;
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

  async saveWorkbook(filenameBase) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputFilename = `${filenameBase}-${timestamp}.xlsx`;
    const outputPath = path.join(__dirname, "output", outputFilename);
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    await this.workbook.xlsx.writeFile(outputPath);
    console.log(`Workbook saved as ${outputPath}`);
    return outputPath;
  }

  getWorksheet(name) {
    return this.workbook.getWorksheet(name);
  }

  findOrAddHotelBlock(worksheet, hotelName) {
    const hotelCol = 1;
    let foundRow = null;
    let firstEmptyBlockStart = null;

    // Iterate over rows to find the hotel or identify the first empty block
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      if (rowNumber < 3) return; // Skip header

      let cell = row.getCell(hotelCol);
      if (
        cell.isMerged &&
        worksheet.getCell(cell.master.address).text === hotelName
      ) {
        foundRow = parseInt(cell.master.address.replace(/\D/g, ""));
        return;
      } else if (cell.value === hotelName) {
        foundRow = rowNumber;
        return;
      }

      // Track the start of the first empty block large enough to hold a hotel block
      if (
        !cell.value &&
        !firstEmptyBlockStart &&
        rowNumber + 7 <= worksheet.actualRowCount
      ) {
        let empty = true;
        for (let i = 0; i < 8; i++) {
          // Check the next 8 rows to ensure they are all empty
          if (worksheet.getRow(rowNumber + i).getCell(hotelCol).value) {
            empty = false;
            break;
          }
        }
        if (empty) firstEmptyBlockStart = rowNumber;
      }
    });

    if (foundRow) return foundRow; // Return the row if the hotel was found

    // Use the first empty block if available, otherwise, use the row after the last used row
    return this.createHotelBlock(
      worksheet,
      hotelName,
      firstEmptyBlockStart || this.lastUsedRow + 1
    );
  }

  createHotelBlock(worksheet, hotelName, startRow) {
    // Check each row in the 8-row range for merges or empty cells
    for (let i = 0; i < 8; i++) {
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
        worksheet.mergeCells(startRow, 1, startRow + 7, 1);
      }
    }

    // If the loop completes without returning (all cells were empty and now merged), return the startRow
    return startRow;
  }

  insertHotelData(worksheet, hotel, datesOffers, destination) {
    const startRow = this.findOrAddHotelBlock(worksheet, hotel);
    // Immediately populate dates upon creating a new block
    this.populateDates(
      worksheet,
      startRow,
      datesOffers[0].date,
      this.getWeekDaysByDestination(destination)
    );
    console.log(`Inserting data for ${hotel}`);
    datesOffers.forEach((offer) => {
      this.insertOfferData(worksheet, startRow, offer);
    });
  }

  populateDates(worksheet, startRow, startDate, weekDays) {
    let currentDate = this.formatDateForExcel(startDate);
    console.log(
      `Starting to populate dates at row ${startRow} from date ${startDate}`
    );

    let daysAdded = 0;
    while (daysAdded < 8) {
      // Ensure exactly 8 dates are populated
      if (weekDays.includes(currentDate.getUTCDay())) {
        const formattedDate = `${currentDate
          .getUTCDate()
          .toString()
          .padStart(2, "0")}.${(currentDate.getUTCMonth() + 1)
          .toString()
          .padStart(2, "0")}`;
        let row = worksheet.getRow(startRow + daysAdded);
        row.getCell(2).value = formattedDate;
        console.log(
          `Populating row ${startRow + daysAdded} with date ${formattedDate}`
        );
        daysAdded++;
      }
      currentDate.setUTCDate(currentDate.getUTCDate() + 1); // Increment the day for the next loop iteration regardless
    }
  }

  insertOfferData(worksheet, startRow, offer) {
    let rowIndex = this.findDateRow(worksheet, startRow, offer.date);
    if (rowIndex === null) {
      console.error(
        "Date not found in the expected rows, check the date population logic."
      );
      return;
    }

    let row = worksheet.getRow(rowIndex);
    const priceCol = 3 + offer.aggregatorIndex;
    row.getCell(priceCol).value = offer.price;
    row.getCell(9).value = offer.roomType;
  }

  formatDateForExcel(dateStr) {
    const cleanDateStr = dateStr.split(",")[0].trim();
    const [day, month, year] = cleanDateStr.split(".").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  findDateRow(worksheet, startRow, date) {
    const targetDateStr = date.split(",")[0].trim().slice(0, 5); // Gets "DD.MM"
    console.log(
      `Looking for date ${targetDateStr} starting at row ${startRow}`
    );

    for (let i = 0; i < 8; i++) {
      let row = worksheet.getRow(startRow + i);
      let cellDate = row.getCell(2).value;
      console.log(`Row ${startRow + i} has date ${cellDate}`);

      if (cellDate === targetDateStr) {
        console.log(`Match found at row ${startRow + i}`);
        return startRow + i;
      }
    }
    console.error(
      `Date ${targetDateStr} not found in rows starting at ${startRow}`
    );
    return null; // Date not found
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
