function normalizeHotelName(name) {
  // logger.info(`Original hotel name: ${name}`);

  let normalized = name
    .replace(/^\s*["']\s*|\s*["']\s*$/g, "") // Remove leading/trailing quotes
    .replace(/\(\s*(\d+)\s*\*\s*\)/g, "$1*") // Remove parentheses around star levels
    .replace(/\s*\([^()]*\)\s*/g, " ") // Remove text within single-level parentheses
    .replace(/(\d\s?\*+|\*+\s?\d)/g, (match) => {
      const stars = match.replace(/\D/g, ""); // Extract digit characters
      return ` ${stars}* `; // Ensure space around stars
    })
    .replace(/\bthreestar\b/gi, "3*") // Replace "ThreeStar" with "3*"
    .replace(/\bfourstar\b/gi, "4*") // Replace "FourStar" with "4*"
    .replace(/\bfivestar\b/gi, "5*") // Replace "FiveStar" with "5*"
    .replace(/\s*\([^)]*\)\s*/g, " ") // Remove all text within parentheses (again for nested)
    .replace(/\.\s*\*/g, " *") // Remove periods before stars
    .replace(/\*\s*\./g, "*") // Remove periods after stars
    .replace(/\s*\.$/, "") // Remove trailing periods
    .replace(/\./g, "") // Remove all periods (dots)
    .replace(/\s+/g, " ") // Remove extra spaces
    .trim()
    .toLowerCase(); // Make case-insensitive

  // logger.info(`Normalized hotel name: ${normalized}`);
  return normalized;
}

let testName1 = normalizeHotelName("Rose. Park. Al Barsha .4*");
let testName2 = normalizeHotelName(".Jumeirah Beach Hotel. (5*) (Джумейра)");
let testName3 = normalizeHotelName(
  "Mercure Hotel Apartments (ex. Yassat Gloria) Aprt (Al Barsha)"
);

console.log(testName1);
console.log(testName2);
console.log(testName3);
