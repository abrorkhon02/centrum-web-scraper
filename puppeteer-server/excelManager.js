const excel = require("exceljs");
const path = require("path");
const fs = require("fs");

class ExcelManager {
  constructor(templatePath) {
    this.templatePath = templatePath;
    this.workbook = new excel.Workbook();
    this.insertedData = new Map();
    this.hotelRowsMap = new Map();
  }

  async loadTemplate() {
    await this.workbook.xlsx.readFile(this.templatePath);
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

  insertData(worksheet, data) {
    const formattedDate = this.formatDate(data.date);
    console.log(`Formatted date for entry: ${formattedDate}`);
    const dateCol = 2;
    const priceStartCol = 3;
    const roomTypeCol = 9;
    if (this.alreadyExists(data.hotel, formattedDate)) {
      console.log(
        `Cheapest offer for hotel ${data.hotel} on ${formattedDate} is already inserted.`
      );
      return;
    }
    let hotelRow = this.hotelRowsMap.get(data.hotel);
    if (!hotelRow) {
      hotelRow = this.findOrAddHotelRow(worksheet, data.hotel);
      this.hotelRowsMap.set(data.hotel, hotelRow);
    }

    if (hotelRow) {
      this.processRow(
        worksheet,
        hotelRow,
        data,
        dateCol,
        priceStartCol,
        roomTypeCol
      );
    } else {
      console.log(
        `Unable to find or create a row for hotel: ${data.hotel}, adding in next available 8 row block`
      );
      this.addNewHotelBlock(worksheet, data.hotel);
    }
    this.addToInsertedData(data.hotel, formattedDate, data.price);
  }

  alreadyExists(hotel, date) {
    return this.insertedData.has(`${hotel}-${date}`);
  }

  addToInsertedData(hotel, date, price) {
    const key = `${hotel}-${date}`;
    if (
      !this.alreadyExists(hotel, date) ||
      this.insertedData.get(key) > price
    ) {
      this.insertedData.set(key, price);
    }
  }

  formatDate(dateStr) {
    const parts = dateStr.split(".");
    if (parts.length < 2) {
      console.error(`Could not parse date: ${dateStr}`);
      return "Invalid Date";
    }
    return `${parts[0]}.${parts[1]}`;
  }

  formatDateForExcel(dateStr) {
    const [day, month] = dateStr.split(".").map(Number);
    const currentYear = new Date().getFullYear();
    return new Date(currentYear, month - 1, day);
  }

  processRow(worksheet, hotelRow, data, dateCol, priceStartCol, roomTypeCol) {
    const formattedDate = this.formatDate(data.date);
    const excelDate = this.formatDateForExcel(formattedDate);
    let inserted = false;

    for (let i = 0; i < 8; i++) {
      const row = worksheet.getRow(hotelRow.number + i);
      const rowRoomType = row.getCell(roomTypeCol).value;
      const rowPrice = row.getCell(priceStartCol + data.aggregatorIndex).value;

      if (!rowRoomType || !rowPrice) {
        console.log(`Inserting or updating data at row ${row.number}`);
        row.getCell(dateCol).value = excelDate;
        row.getCell(dateCol).numFmt = "DD.MM";
        row.getCell(priceStartCol + data.aggregatorIndex).value = data.price;
        row.getCell(roomTypeCol).value = data.roomType;
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      console.log(
        `All rows for hotel ${data.hotel} are occupied, adding a new block`
      );
      this.addNewHotelBlock(worksheet, data.hotel);
    }
  }

  findOrAddHotelRow(worksheet, hotelName) {
    const cityName = this.extractCityName(hotelName);
    console.log("Extracted city name is: ", cityName);
    let hotelRow;

    if (cityName) {
      let cityRow = this.findCityBlock(worksheet, cityName);
      if (!cityRow) {
        console.log(
          `City row for ${cityName} not found, adding hotel in next free 8 row block.`
        );
        return this.addNewHotelBlock(worksheet, hotelName);
      }
      hotelRow = this.findHotelInCityBlock(worksheet, hotelName, cityRow);
      if (!hotelRow) {
        console.log(
          "Hotel row not found, adding it in the corresponding city row"
        );
        hotelRow = this.addHotelInCityBlock(worksheet, hotelName, cityRow);
      }
    } else {
      console.log(
        "No city name found, attempting to find or add hotel in general hotel block"
      );
      hotelRow = this.findHotelRow(worksheet, hotelName);
      if (!hotelRow) {
        console.log("Adding new hotel in the next free 8 row block");
        hotelRow = this.addNewHotelBlock(worksheet, hotelName);
      }
    }
    return hotelRow;
  }

  extractCityName(hotelName) {
    const cityNamePattern = /\(([^)]+)\)$/;
    const matches = hotelName.match(cityNamePattern);
    return matches ? matches[1] : null;
  }

  findCityBlock(worksheet, cityName) {
    cityName = cityName.trim();

    for (let i = 1; i <= worksheet.actualRowCount; i++) {
      let row = worksheet.getRow(i);
      if (row.getCell(1).value === cityName) {
        return row;
      }
    }
    return null;
  }

  findHotelInCityBlock(worksheet, hotelName, cityRow) {
    const startRowNumber = cityRow ? cityRow.number : 1;
    for (let i = startRowNumber; i < startRowNumber + 8; i++) {
      let row = worksheet.getRow(i);
      if (row.getCell(1).value === hotelName) {
        return row;
      }
    }
    return null;
  }

  addHotelInCityBlock(worksheet, hotelName, cityRow) {
    if (!cityRow) {
      console.error("Cannot add hotel in a non-existent city block.");
      return null;
    }

    const hotelCol = 1;
    let currentRowNumber = cityRow.number + 1;

    while (currentRowNumber <= worksheet.actualRowCount) {
      let blockIsEmpty = true;

      for (let i = 0; i < 8; i++) {
        const row = worksheet.getRow(currentRowNumber + i);
        if (row.getCell(hotelCol).value !== null) {
          blockIsEmpty = false;
          break;
        }
      }

      if (blockIsEmpty) {
        const newRow = worksheet.getRow(currentRowNumber);
        newRow.getCell(hotelCol).value = hotelName;
        console.log("Added new hotel at row: " + currentRowNumber);
        return newRow;
      }

      currentRowNumber += 8;
    }

    console.error(
      "Failed to add new hotel, no empty block found under the city."
    );
    return null;
  }

  findHotelRow(worksheet, hotelName) {
    const hotelCol = 1;
    const maxRowsToSearch = 5000;

    for (let i = 1; i <= maxRowsToSearch; i++) {
      let row = worksheet.getRow(i);
      if (row.getCell(hotelCol).value === hotelName) {
        return row;
      }
    }
    return null;
  }

  addNewHotelBlock(worksheet, hotelName) {
    const hotelCol = 1;
    let emptyRow = this.findNextEmptyHotelBlock(worksheet);

    if (emptyRow === -1) {
      console.error("No empty hotel block found.");
      return null;
    }

    const newRow = worksheet.getRow(emptyRow);
    newRow.getCell(hotelCol).value = hotelName;
    console.log("Added new hotel block at row: " + emptyRow);

    worksheet.mergeCells(emptyRow, hotelCol, emptyRow + 7, hotelCol);

    return newRow;
  }

  findNextEmptyHotelBlock(worksheet) {
    const hotelCol = 1;
    let emptyRow = worksheet.actualRowCount + 1;

    for (let i = 3; i <= emptyRow; i += 8) {
      let blockIsEmptyAndUnmerged = true;
      for (let j = 0; j < 8; j++) {
        const currentRow = i + j;
        const cell = worksheet.getRow(currentRow).getCell(hotelCol);
        const isMerged = cell.isMerged;
        if (cell.value || isMerged) {
          blockIsEmptyAndUnmerged = false;
          break;
        }
      }
      if (blockIsEmptyAndUnmerged) {
        return i;
      }
    }

    return emptyRow;
  }
}

module.exports = ExcelManager;
