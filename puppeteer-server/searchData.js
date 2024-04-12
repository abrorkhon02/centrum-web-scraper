const { exec } = require("child_process");
const puppeteer = require("puppeteer");
const xlsx = require("xlsx");
const path = require("path");

function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  console.log(`${day}.${month}.${year}`);
  return `${day}.${month}.${year}`;
}

const cityMapping = {
  "abu-dhabi": { english: "ABU DHABI", russian: "Абу-Даби" },
  ajman: { english: "AJMAN", russian: "Аджман" },
  dubai: { english: "DUBAI", russian: "Дубай" },
  fujairah: { english: "FUJAIRAH", russian: "Фуджейра" },
  "ras-al-khaimah": { english: "RAS AL KHAIMAH", russian: "Рас-аль-Хайма" },
  sharjah: { english: "SHARJAH", russian: "Шарджа" },
  "umm-al-quwain": { english: "UMM AL QUWAIN", russian: "Умм-аль-Кувейн" },
};

function getCityNames(cityValues) {
  return cityValues.reduce((acc, cityValue) => {
    const cityPair = cityMapping[cityValue];
    if (cityPair) {
      acc.push(cityPair.english, cityPair.russian);
    }
    return acc;
  }, []);
}

(async () => {
  const {
    destinationCountry,
    destinationCities,
    departureDate,
    returnDate,
    nights,
    adults,
    children,
    childrenAges,
    hotelStars,
    selectedHotels,
    mealTypes,
    roomTypes,
    priceRange,
    filters,
  } = JSON.parse(process.env.SEARCH_PARAMS);

  const cityNames = getCityNames(destinationCities);

  let browser = null;
  try {
    browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    await page.setViewport({ width: 1366, height: 768 });
    await page.goto(
      "https://online-centrum-holidays.com/search_tour?LANG=rus",
      { waitUntil: "networkidle0" }
    );

    const departureCitySelector = ".TOWNFROMINC_chosen a";
    const countrySelector = ".STATEINC_chosen a";
    const tourSelector = ".TOURINC_chosen a";
    const departureDateSelector = 'input[name="CHECKIN_BEG"]';
    const nightsFromDropdownSelector = ".NIGHTS_FROM_chosen a";
    const nightsFromOptionSelector = ".NIGHTS_FROM_chosen .chosen-results li";
    const returnDateSelector = 'input[name="CHECKIN_END"]';
    const nightsTillDropdownSelector = ".NIGHTS_TILL_chosen a";
    const nightsTillOptionSelector = ".NIGHTS_TILL_chosen .chosen-results li";

    async function selectDepartureCity(city) {
      await page.click(departureCitySelector);
      await page.waitForSelector(".chosen-drop .chosen-results .active-result");
      await delay(500);

      await page.evaluate((city) => {
        const options = Array.from(
          document.querySelectorAll(
            ".chosen-drop .chosen-results .active-result"
          )
        );
        const targetOption = options.find(
          (option) => option.textContent.trim() === city
        );
        if (targetOption) {
          targetOption.dispatchEvent(
            new MouseEvent("mousedown", { bubbles: true, cancelable: true })
          );
          targetOption.dispatchEvent(
            new MouseEvent("mouseup", { bubbles: true, cancelable: true })
          );
          targetOption.click();
        }
      }, city);
    }

    async function selectCountry(country) {
      await page.click(countrySelector);
      await page.waitForSelector(".chosen-drop .chosen-results .active-result");
      await delay(500);

      await page.evaluate((country) => {
        const options = Array.from(
          document.querySelectorAll(
            ".chosen-drop .chosen-results .active-result"
          )
        );
        const targetOption = options.find(
          (option) => option.textContent.trim() === country
        );
        if (targetOption) {
          targetOption.dispatchEvent(
            new MouseEvent("mousedown", { bubbles: true, cancelable: true })
          );
          targetOption.dispatchEvent(
            new MouseEvent("mouseup", { bubbles: true, cancelable: true })
          );
          targetOption.click();
        }
      }, country);
    }

    async function selectTour(tour) {
      await page.click(tourSelector);
      await page.waitForSelector(".chosen-drop .chosen-results .active-result");
      await delay(500);

      await page.evaluate((tour) => {
        const options = Array.from(
          document.querySelectorAll(
            ".chosen-drop .chosen-results .active-result"
          )
        );
        const targetOption = options.find((option) =>
          option.textContent.trim().includes(tour)
        );
        if (targetOption) {
          targetOption.dispatchEvent(
            new MouseEvent("mousedown", { bubbles: true, cancelable: true })
          );
          targetOption.dispatchEvent(
            new MouseEvent("mouseup", { bubbles: true, cancelable: true })
          );
          targetOption.click();
        }
      }, tour);
    }

    async function setDepartureDate(date) {
      await delay(3000);
      await page.click(departureDateSelector, { clickCount: 3 });
      await page.keyboard.press("Backspace");
      for (const char of date) {
        await page.keyboard.press(char);
        await delay(100);
      }
      await page.keyboard.press("Tab");
      await delay(100);
      await page.keyboard.press("Escape");
      await delay(500);
    }

    async function selectNightsFrom(nights) {
      await delay(2000);

      await page.click(nightsFromDropdownSelector);
      await page.waitForSelector(nightsFromOptionSelector);

      await page.evaluate(
        (optionSelector, nightsText) => {
          const options = Array.from(document.querySelectorAll(optionSelector));
          const targetOption = options.find((option) =>
            option.innerText.trim().startsWith(nightsText)
          );
          if (targetOption) {
            targetOption.dispatchEvent(
              new MouseEvent("mousedown", { bubbles: true, cancelable: true })
            );
            targetOption.dispatchEvent(
              new MouseEvent("mouseup", { bubbles: true, cancelable: true })
            );
            targetOption.click();
          }
        },
        nightsFromOptionSelector,
        nights.toString()
      );
    }

    async function setReturnDate(date) {
      await page.click(returnDateSelector, { clickCount: 3 });
      await page.keyboard.press("Backspace");

      for (const char of date) {
        await page.keyboard.press(char);
        await delay(100);
      }
      await page.keyboard.press("Tab");
      await delay(100);
      await page.keyboard.press("Escape");
      await delay(500);
    }

    async function selectNightsTill(nights) {
      await delay(2000);
      await page.click(nightsTillDropdownSelector);
      await page.waitForSelector(nightsTillOptionSelector);
      await page.evaluate(
        (optionSelector, nightsText) => {
          const options = Array.from(document.querySelectorAll(optionSelector));
          const targetOption = options.find((option) =>
            option.innerText.trim().startsWith(nightsText)
          );
          if (targetOption) {
            targetOption.dispatchEvent(
              new MouseEvent("mousedown", { bubbles: true, cancelable: true })
            );
            targetOption.dispatchEvent(
              new MouseEvent("mouseup", { bubbles: true, cancelable: true })
            );
            targetOption.click();
          }
        },
        nightsTillOptionSelector,
        nights.toString()
      );
    }

    async function selectNumberOfAdults(adults) {
      const adultsDropdownSelector = ".ADULT_chosen a";
      const adultsOptionSelector = ".ADULT_chosen .chosen-results li";

      await page.click(adultsDropdownSelector);
      await page.waitForSelector(adultsOptionSelector);

      await page.evaluate(
        (selector, adultsText) => {
          const options = Array.from(document.querySelectorAll(selector));
          const targetOption = options.find(
            (option) => option.innerText.trim() === adultsText
          );
          if (targetOption) {
            targetOption.dispatchEvent(
              new MouseEvent("mousedown", { bubbles: true, cancelable: true })
            );
            targetOption.dispatchEvent(
              new MouseEvent("mouseup", { bubbles: true, cancelable: true })
            );
            targetOption.click();
          }
        },
        adultsOptionSelector,
        adults.toString()
      );

      await delay(3000);
    }

    async function setCurrencyToUSD() {
      const currencyDropdownSelector = ".CURRENCY_chosen a";
      const currencyOptionSelector = ".CURRENCY_chosen .chosen-results li";

      await page.click(currencyDropdownSelector);
      await page.waitForSelector(currencyOptionSelector);

      await page.evaluate((selector) => {
        const options = Array.from(document.querySelectorAll(selector));
        const targetOption = options.find(
          (option) => option.innerText.trim() === "USD"
        );
        if (targetOption) {
          targetOption.dispatchEvent(
            new MouseEvent("mousedown", { bubbles: true, cancelable: true })
          );
          targetOption.dispatchEvent(
            new MouseEvent("mouseup", { bubbles: true, cancelable: true })
          );
          targetOption.click();
        }
      }, currencyOptionSelector);

      await delay(3000);
    }

    async function selectNumberOfChildren(childrenCount) {
      const childrenDropdownSelector = ".CHILD_chosen a";
      const childrenOptionSelector = ".CHILD_chosen .chosen-results li";

      await page.click(childrenDropdownSelector);
      await page.waitForSelector(childrenOptionSelector, { visible: true });

      await page.evaluate((count) => {
        const options = Array.from(
          document.querySelectorAll(".CHILD_chosen .chosen-results li")
        );
        const targetOption = options.find(
          (option) => option.innerText.trim() === count.toString()
        );
        if (targetOption) {
          targetOption.dispatchEvent(
            new MouseEvent("mousedown", { bubbles: true, cancelable: true })
          );
          targetOption.dispatchEvent(
            new MouseEvent("mouseup", { bubbles: true, cancelable: true })
          );
          targetOption.click();
        }
      }, childrenCount);

      await delay(2000);
    }

    async function setChildrenAges(childrenAges) {
      await page.waitForSelector(".child_ages a", { visible: true });

      const ageDropdowns = await page.$$(".child_ages a");

      for (let i = 0; i < childrenAges.length && i < ageDropdowns.length; i++) {
        await ageDropdowns[i].click();
        await page.waitForSelector(
          ".child_ages .chosen-drop .chosen-results li",
          {
            visible: true,
          }
        );

        await page.evaluate(
          (age, index) => {
            const dropdown = document.querySelectorAll(
              ".child_ages .chosen-container"
            )[index];
            const options = Array.from(
              dropdown.querySelectorAll(".chosen-results li")
            );
            const targetOption = options.find(
              (option) => option.textContent.trim() === age.toString()
            );
            if (targetOption) {
              targetOption.dispatchEvent(
                new MouseEvent("mousedown", { bubbles: true, cancelable: true })
              );
              targetOption.dispatchEvent(
                new MouseEvent("mouseup", { bubbles: true, cancelable: true })
              );
              targetOption.click();
            }
          },
          childrenAges[i],
          i
        );

        await delay(2000);
      }
    }

    async function setMinimumPrice(value) {
      const minPriceSelector = 'input[name="COSTMIN"]';
      await page.click(minPriceSelector, { clickCount: 3 });
      await page.keyboard.press("Backspace");
      await page.type(minPriceSelector, value.toString());
    }

    async function setMaxCost(maxCost) {
      const maxCostSelector = 'input[name="COSTMAX"]';
      await page.click(maxCostSelector, { clickCount: 3 });
      await page.keyboard.type(maxCost.toString());
      await delay(2000);
    }

    async function selectCity(possibleCityNames) {
      console.log("Attempting to select cities:", possibleCityNames);
      await page.waitForSelector('.control_townto .checklistbox[name="TOWNS"]');

      for (const name of possibleCityNames) {
        const result = await page.evaluate((name) => {
          const groups = document.querySelectorAll(
            ".control_townto .groupbox .groupname"
          );
          for (const group of groups) {
            if (group.textContent.trim() === name) {
              const checkbox = group.querySelector('input[type="checkbox"]');
              if (checkbox && !checkbox.checked) {
                checkbox.click();
                return true;
              }
            }
          }
          return false;
        }, name);

        if (!result) {
          console.log(`City name "${name}" not found or already selected.`);
        } else {
          console.log(`City "${name}" selected.`);
        }

        await delay(500);
      }
    }

    async function selectHotelStars(starRatings) {
      await page.waitForSelector('.control_stars .checklistbox[name="STARS"]');

      const isAnyStarsChecked = await page.evaluate(() => {
        const anyStarsCheckbox = document.querySelector(
          ".control_stars .STARS_ANY"
        );
        if (anyStarsCheckbox && anyStarsCheckbox.checked) {
          anyStarsCheckbox.click();
          return true;
        }
        return false;
      });

      if (isAnyStarsChecked) {
        await delay(500);
      }

      for (const stars of starRatings) {
        const starString = `${stars}*`;
        const result = await page.evaluate((starString) => {
          const starElements = Array.from(
            document.querySelectorAll(
              ".control_stars .groupboxChildren .star span"
            )
          );
          let success = false;
          starElements.forEach((element) => {
            if (element.textContent.includes(starString)) {
              const checkbox = element.querySelector('input[type="checkbox"]');
              if (checkbox && !checkbox.checked) {
                checkbox.click();
                success = true;
              }
            }
          });
          return success;
        }, starString);

        if (!result) {
          console.log(
            `Star rating "${starString}" not found or already selected.`
          );
        }

        await delay(100);
      }
    }

    async function selectHotels(hotelNames) {
      await page.waitForSelector(".checklistbox.HOTELS");

      for (const hotelName of hotelNames) {
        const result = await page.evaluate((hotelName) => {
          const labels = Array.from(
            document.querySelectorAll(".checklistbox.HOTELS label")
          );
          let success = false;
          for (const label of labels) {
            if (label.textContent.trim().includes(hotelName)) {
              const checkbox = label.querySelector('input[type="checkbox"]');
              if (checkbox && !checkbox.checked) {
                checkbox.click();
                success = true;
                break;
              }
            }
          }
          return success;
        }, hotelName);

        if (!result) {
          console.log(`Hotel "${hotelName}" not found or already selected.`);
        }

        await delay(100);
      }
    }

    async function selectMealTypes(mealTypes) {
      await page.waitForSelector(".checklistbox.MEALS");

      for (const mealType of mealTypes) {
        const result = await page.evaluate((mealType) => {
          const labels = Array.from(
            document.querySelectorAll(".checklistbox.MEALS label")
          );
          let success = false;
          for (const label of labels) {
            if (label.textContent.trim().includes(mealType)) {
              const checkbox = label.querySelector('input[type="checkbox"]');
              if (checkbox && !checkbox.checked) {
                checkbox.click();
                success = true;
                break;
              }
            }
          }
          return success;
        }, mealType);

        if (!result) {
          console.log(`Meal type "${mealType}" not found or already selected.`);
        }

        await delay(100);
      }
    }

    async function selectRoomTypes(roomTypes) {
      await page.waitForSelector(".checklistbox.ROOMS");

      for (const roomType of roomTypes) {
        const result = await page.evaluate((roomType) => {
          const labels = Array.from(
            document.querySelectorAll(".checklistbox.ROOMS label")
          );
          let success = false;
          for (const label of labels) {
            if (
              label.textContent
                .trim()
                .toUpperCase()
                .includes(roomType.toUpperCase())
            ) {
              const checkbox = label.querySelector('input[type="checkbox"]');
              if (checkbox && !checkbox.checked) {
                checkbox.click();
                success = true;
                break;
              }
            }
          }
          return success;
        }, roomType);

        if (!result) {
          console.log(`Room type "${roomType}" not found or already selected.`);
        }

        await delay(100);
      }
    }

    async function setFiltersByLabel(filterDescriptions) {
      await page.waitForSelector(".checklistbox label.left");

      for (const description of filterDescriptions) {
        await page.waitForFunction(
          (text) =>
            [
              ...document.querySelectorAll(".checklistbox label.left[title]"),
            ].some((label) => label.title.includes(text)),
          {},
          description
        );

        const result = await page.evaluate((description) => {
          const labels = Array.from(
            document.querySelectorAll(".checklistbox label.left[title]")
          );
          let success = false;
          for (const label of labels) {
            if (label.title.includes(description)) {
              const checkbox = label.querySelector('input[type="checkbox"]');
              if (checkbox && !checkbox.checked) {
                checkbox.click();
                success = true;
                break;
              }
            }
          }
          return success;
        }, description);

        if (!result) {
          console.log(`Filter "${description}" not found or already checked.`);
        }

        await delay(500);
      }
    }

    async function clickSearchButton() {
      try {
        await page.waitForSelector("button.load.right", {
          visible: true,
          timeout: 5000,
        });

        const clicked = await page.evaluate(() => {
          const btn = document.querySelector("button.load.right");
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        });

        if (clicked) {
          console.log("Search initiated using JS click.");
        } else {
          console.log("Failed to find button using JS click.");
          await page.screenshot({ path: "debug_search_button.png" });
        }
      } catch (error) {
        console.error("Error clicking search button: ", error.message);
        await page.screenshot({ path: "error_search_button.png" });
      }
    }

    try {
      await selectDepartureCity("Ташкент");
      await selectCountry("ОАЭ");
      await setDepartureDate(formatDate(departureDate));
      await selectNightsFrom(nights.from.toString());
      await setReturnDate(formatDate(returnDate));
      await selectNightsTill(nights.to.toString());
      await selectNumberOfAdults(adults.toString());
      await setCurrencyToUSD(page);
      if (priceRange.min !== null) {
        await setMinimumPrice(priceRange.min.toString());
      }
      if (priceRange.max !== null) {
        await setMaxCost(priceRange.max.toString());
      }
      if (children !== null) {
        await selectNumberOfChildren(children);
      }
      if (childrenAges.length !== 0) {
        await setChildrenAges(childrenAges);
      }
      await selectCity(cityNames);
      await selectHotelStars(hotelStars);
      await selectHotels(selectedHotels.filter(Boolean));
      await selectMealTypes(mealTypes);
      await selectRoomTypes(roomTypes);
      // if (filters !== null) {
      //   await setFiltersByLabel(filters);
      // }
      await clickSearchButton();
    } catch (operationError) {
      console.error(`Error during operation: ${operationError.message}`);
    }

    await page.waitForSelector(".resultset", { visible: true, timeout: 20000 });
    await delay(3000);
    await page.waitForFunction(
      () => document.querySelectorAll(".resultset .res tbody tr").length > 0,
      { timeout: 20000 }
    );

    // Scrape the data
    const data = await page.evaluate(() => {
      const rows = Array.from(
        document.querySelectorAll(".resultset .res tbody tr")
      );
      return rows.map((row) => {
        const cells = row.querySelectorAll("td");
        return {
          date: cells[1]?.innerText.trim() || "",
          tour: cells[2]?.innerText.trim() || "",
          nights: cells[3]?.innerText.trim() || "",
          hotel: cells[4]?.innerText.trim() || "",
          availability: cells[5]?.innerText.trim() || "",
          meal: cells[6]?.innerText.trim() || "",
          room: cells[7]?.innerText.trim() || "",
          price: cells[10]?.innerText.trim() || "",
          priceType: cells[13]?.innerText.trim() || "",
          transport: cells[14]?.innerText.trim() || "",
        };
      });
    });

    if (data.length === 0) {
      console.error("No data found on the page.");
    } else {
      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.json_to_sheet(data);
      xlsx.utils.book_append_sheet(wb, ws, "Results");
      const filePath = path.join(__dirname, "ScrapedData.xlsx");
      xlsx.writeFile(wb, filePath);
      console.log("Data has been written to Excel file.");

      // Open the Excel file
      exec(`start excel "${filePath}"`, (error) => {
        if (error) {
          console.error(`Could not open Excel file: ${error.message}`);
        }
      });
    }

    console.log(data);
  } catch (e) {
    console.error(`Error in the scraping process: ${e.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
