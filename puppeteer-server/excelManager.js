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

  insertData(worksheet, data, destination) {
    const weekDays = this.getWeekDaysByDestination(destination);
    const formattedDate = this.formatDate(data.date);
    console.log(`Formatted date for entry: ${formattedDate}`);
    if (this.alreadyExists(data.hotel, formattedDate, data.price)) {
      console.log(
        `Cheaper or equal offer for hotel ${data.hotel} on ${formattedDate} is already inserted.`
      );
      return;
    }
    let hotelRow = this.hotelRowsMap.get(data.hotel);
    if (!hotelRow) {
      hotelRow = this.findOrAddHotelRow(worksheet, data.hotel);
      this.hotelRowsMap.set(data.hotel, hotelRow);
      if (hotelRow) {
        this.populateDates(worksheet, hotelRow, data.date, weekDays);
        this.processRow(worksheet, hotelRow, data, 2, 3, 9); // B for date, C-H for prices, I for room type
      }
    } else {
      this.populateDates(worksheet, hotelRow, data.date, weekDays);
      this.processRow(worksheet, hotelRow, data, 2, 3, 9); // B for date, C-H for prices, I for room type
    }

    this.addToInsertedData(data.hotel, formattedDate, data.price);
  }

  populateDates(worksheet, hotelRow, startDate, weekDays) {
    let currentDate = this.parseDate(startDate);
    let datesAdded = 0;

    while (datesAdded < 8) {
      if (weekDays.includes(currentDate.getUTCDay())) {
        const formattedDate = `${currentDate
          .getUTCDate()
          .toString()
          .padStart(2, "0")}.${(currentDate.getUTCMonth() + 1)
          .toString()
          .padStart(2, "0")}`;
        const row = worksheet.getRow(hotelRow.number + datesAdded);
        row.getCell(2).value = formattedDate;
        datesAdded++;
      }
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
  }

  getWeekDaysByDestination(destination) {
    if (!destination) {
      console.error("Destination is undefined!");
      return [];
    }

    switch (destination.toLowerCase()) {
      case "грузия":
        return [1, 2, 4, 5]; // Monday, Tuesday, Thursday, Friday
      case "оаэ":
        return [2, 6]; // Tuesday, Saturday
      default:
        return [];
    }
  }
  parseDate(dateInput) {
    console.log(dateInput);
    if (dateInput instanceof Date) {
      return dateInput;
    }

    if (typeof dateInput === "string") {
      const dateString = dateInput.split(",")[0].trim();
      const [day, month, year] = dateString.split(".").map(Number);
      return new Date(Date.UTC(year, month - 1, day));
    }

    throw new TypeError("Expected dateInput to be a string or Date object");
  }

  alreadyExists(hotel, date, newPrice) {
    const key = `${hotel}-${date}`;
    if (this.insertedData.has(key)) {
      return this.insertedData.get(key).price <= newPrice;
    }
    return false;
  }

  addToInsertedData(hotel, date, price) {
    const key = `${hotel}-${date}`;
    if (!this.alreadyExists(hotel, date, price)) {
      this.insertedData.set(key, { price, hotel });
    }
  }

  formatDate(dateValue) {
    if (dateValue instanceof Date) {
      return dateValue
        .toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })
        .replace(/\//g, ".");
    } else if (typeof dateValue === "string" && dateValue.includes(".")) {
      const parts = dateValue.split(".");
      if (parts.length < 2) {
        console.error(`Could not parse date: ${dateValue}`);
        return "Invalid Date";
      }
      return `${parts[0]}.${parts[1]}`;
    } else {
      return "";
    }
  }

  formatDateForExcel(dateStr) {
    const [day, month] = dateStr.split(".").map(Number);
    const currentYear = new Date().getFullYear();
    return new Date(currentYear, month - 1, day);
  }

  processRow(worksheet, hotelRow, data, dateCol, priceStartCol, roomTypeCol) {
    const formattedInputDate = this.formatDate(data.date);
    let inserted = false;

    for (let i = 0; i < 8; i++) {
      const row = worksheet.getRow(hotelRow.number + i);
      const cellValue = row.getCell(dateCol).value;
      const formattedCellValue = this.formatDate(cellValue);
      console.log("Hotel block values: ", cellValue, formattedCellValue);

      if (formattedCellValue === formattedInputDate) {
        const currentPrice = row.getCell(
          priceStartCol + data.aggregatorIndex
        ).value;
        if (!currentPrice || data.price < currentPrice) {
          console.log(`Inserting or updating data at row ${row.number}`);
          row.getCell(dateCol).value = new Date(
            formattedInputDate.split(".").reverse().join("-")
          );
          row.getCell(dateCol).numFmt = "DD.MM";
          row.getCell(priceStartCol + data.aggregatorIndex).value = data.price;
          row.getCell(roomTypeCol).value = data.roomType;
          inserted = true;
        }
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

    if (emptyRow !== -1) {
      const newRow = worksheet.getRow(emptyRow);
      newRow.getCell(1).value = hotelName;
      this.hotelRowsMap.set(hotelName, newRow);
      console.log(`Added new hotel block at row: ${emptyRow}`);
      return newRow;
    } else {
      console.error("No empty hotel block found.");
      return null;
    }
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
