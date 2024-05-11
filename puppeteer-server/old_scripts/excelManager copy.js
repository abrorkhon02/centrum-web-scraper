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
    if (
      this.alreadyExists(data.hotel, formattedDate, data.price, data.roomType)
    ) {
      console.log(
        `Cheaper or equal offer for hotel ${data.hotel} on ${formattedDate} is already inserted.`
      );
      return;
    }

    let hotelRow = this.hotelRowsMap.get(data.hotel);
    if (!hotelRow) {
      hotelRow = this.findOrAddHotelRow(worksheet, data.hotel);
      this.hotelRowsMap.set(data.hotel, hotelRow);
    }
    this.updateHotelBlock(worksheet, hotelRow, data, weekDays);
  }

  updateHotelBlock(worksheet, hotelRow, data, weekDays) {
    const inputDate = this.parseDate(data.date);
    if (!inputDate) {
      console.error("Invalid input date, skipping:", data.date);
      return;
    }

    let found = false;
    for (let i = 0; i < 8; i++) {
      let row = worksheet.getRow(hotelRow.number + i);
      const cellDateStr = row.getCell(2).text;
      const cellDate = this.parseDate(cellDateStr);

      if (cellDate && inputDate.getTime() === cellDate.getTime()) {
        this.updateRowIfNeeded(row, data);
        found = true;
        break;
      }
    }

    if (!found) {
      this.populateDates(worksheet, hotelRow, data.date, weekDays);
      this.processRow(worksheet, hotelRow, data, 2, 3, 9);
    }
  }

  updateRowIfNeeded(row, data) {
    const priceCell = row.getCell(2 + data.aggregatorIndex);
    const roomTypeCell = row.getCell(8);

    if (
      roomTypeCell.text === data.roomType &&
      (!priceCell.value || priceCell.value > data.price)
    ) {
      priceCell.value = data.price;
      console.log(
        `Updated price for ${data.hotel} on date ${data.date} to ${data.price}`
      );
    }
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
          .padStart(2, "0")}.${currentDate.getUTCFullYear()}`;
        const row = worksheet.getRow(hotelRow.number + datesAdded);
        row.getCell(2).value = formattedDate; // Set date
        row.getCell(2).numFmt = "dd.mm.yyyy"; // Format date
        datesAdded++;
      }
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
  }

  getWeekDaysByDestination(destination) {
    if (!destination) {
      console.error("Destination is undefined!");
      return [0, 1, 2, 3, 4, 5, 6];
    }

    switch (destination.toLowerCase()) {
      case "грузия":
        return [1, 2, 4, 5]; // Monday, Tuesday, Thursday, Friday
      case "оаэ":
        return [2, 6]; // Tuesday, Saturday
      default:
        return [0, 1, 2, 3, 4, 5, 6];
    }
  }

  parseDate(dateInput) {
    console.log("Original date input:", dateInput);
    const regex = /(\d{2})\.(\d{2})\.(\d{4})/;
    const matches = dateInput.match(regex);
    if (matches) {
      const [_, day, month, year] = matches.map(Number);
      return new Date(Date.UTC(year, month - 1, day));
    }
    console.error("Failed to parse date:", dateInput);
    return null;
  }

  alreadyExists(hotel, date, price, roomType) {
    const key = `${hotel}-${date}-${roomType}`;
    if (this.insertedData.has(key)) {
      return this.insertedData.get(key).price <= price;
    }
    return false;
  }

  addToInsertedData(hotel, date, price, roomType) {
    const key = `${hotel}-${date}-${roomType}`;
    this.insertedData.set(key, { price: price, roomType: roomType });
  }

  formatDate(dateValue) {
    if (typeof dateValue === "string" && dateValue.includes(".")) {
      return dateValue.split(",")[0];
    }
    return dateValue;
  }

  processRow(worksheet, hotelRow, data, dateCol, priceStartCol, roomTypeCol) {
    const formattedInputDate = this.formatDate(data.date);
    let inserted = false;

    for (let i = 0; i < 8; i++) {
      const row = worksheet.getRow(hotelRow.number + i);
      if (row.getCell(dateCol).text === formattedInputDate) {
        this.updateRowIfNeeded(row, data, priceStartCol, roomTypeCol);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      this.addNewHotelBlock(worksheet, hotelRow, data);
    }
  }

  findOrAddHotelRow(worksheet, hotelName) {
    let hotelRow = this.hotelRowsMap.get(hotelName);
    if (hotelRow) {
      return hotelRow;
    } else {
      return this.addNewHotelBlock(worksheet, hotelName);
    }
  }

  addNewHotelBlock(worksheet, hotelName) {
    const lastRow = worksheet.lastRow;
    let newRowNumber = lastRow ? lastRow.number + 1 : 1;
    const newRow = worksheet.getRow(newRowNumber);
    newRow.getCell(1).value = hotelName;
    this.hotelRowsMap.set(hotelName, newRow);
    console.log(
      `New hotel block added for ${hotelName} at row: ${newRowNumber}`
    );
    return newRow;
  }
}

module.exports = ExcelManager;
