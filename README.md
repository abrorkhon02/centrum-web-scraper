# Centrum Web Scraper

Centrum Web Scraper is a comprehensive web scraping tool designed to extract and process data from various travel websites. The project consists of a frontend built with Angular and a backend powered by Node.js and Puppeteer.

## Table of Contents
- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Dependencies](#dependencies)
- [Contributing](#contributing)
- [License](#license)

## Features

- Scrapes data from multiple travel websites
- Processes and aggregates scraped data
- Provides a user-friendly interface for uploading files and initiating scraping sessions
- Supports mapping of hotel names for accurate data analysis
- Generates output files compatible with standard data formats

## Architecture

The project is divided into two main parts:

### Frontend

- Built with **Angular 17**
- Provides a web interface for users to interact with the scraper
- Allows users to upload files, select options, and initiate scraping sessions

### Backend

- Built with **Node.js** and **Express**
- Uses **Puppeteer** for web scraping automation
- Handles file processing, data aggregation, and output generation
- Includes logging mechanisms for monitoring and troubleshooting

## Prerequisites

- **Node.js** (version 18 or higher recommended)
- **npm** (Node Package Manager)
- **Angular CLI** (for frontend development)

## Installation

Clone the repository:

```bash
git clone https://github.com/yourusername/centrum-web-scraper.git
```

### Backend Setup

Navigate to the backend directory and install dependencies:

```bash
cd centrum-web-scraper/puppeteer-server
npm install
```

### Frontend Setup

Navigate to the frontend directory and install dependencies:

```bash
cd centrum-web-scraper/centrum-web-scraper
npm install
```

## Configuration

### Backend Configuration

- **Hotel Mappings**: Ensure that the hotel mapping files are placed in the `assets/hotelMappings` directory
- **Logging**: Configure the logging settings in `logger.js` as needed
- **Webpages**: The list of target webpages is defined in `assets/webpages.js`. Update this file to add or modify scraping targets

### Frontend Configuration

- Styles and themes are defined in `styles.scss`
- The frontend can be configured using Angular's environment files if necessary

## Usage

### Running the Backend Server

Start the backend server:

```bash
cd centrum-web-scraper/puppeteer-server
node server.js
```

This will start the Express server and launch the Puppeteer scraper.

### Running the Frontend Application

In a new terminal window, start the Angular frontend:

```bash
cd centrum-web-scraper/centrum-web-scraper
ng serve
```

The frontend application will be available at `http://localhost:4200`.

### Interacting with the Application

1. Access the frontend interface in your web browser
2. Upload the required file using the provided form
3. Select the desired options (e.g., target website, update mode)
4. Click the button to initiate the scraping session
5. The backend will process the request, scrape data, and return the results

## Project Structure

```
centrum-web-scraper/
├── centrum-web-scraper/       # Angular frontend application
│   ├── src/
│   │   ├── app/
│   │   ├── assets/
│   │   ├── styles.scss
│   │   └── index.html
│   ├── angular.json
│   ├── package.json
│   └── tsconfig.json
└── puppeteer-server/          # Node.js backend server
    ├── assets/
    │   ├── hotelMappings/
    │   └── webpages.js
    ├── logger.js
    ├── server.js
    ├── package.json
    └── tsconfig.json
```

## Dependencies

### Backend Dependencies

- **Node.js**: JavaScript runtime environment
- **Express**: Web framework for Node.js
- **Puppeteer**: Headless Chrome Node.js API for web scraping
- **Multer**: Middleware for handling `multipart/form-data`
- **ExcelJS**: Library for reading and writing Excel files
- **Winston**: Logging library
- **Moment-Timezone**: Timezone utilities

### Frontend Dependencies

- **Angular**: Frontend web application framework
- **Angular Material**: UI component library for Angular
- **Bootstrap**: CSS framework for responsive design
- **RxJS**: Reactive Extensions for JavaScript
- **Zone.js**: Execution context library for Angular

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License.
