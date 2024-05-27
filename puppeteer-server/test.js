function normalizeHotelName(name) {
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

  return normalized;
}

let mappedName = normalizeHotelName("Rose Park Al Barsha 4*");
let scrapedName = normalizeHotelName("Jumeirah Beach Hotel (5*) (Джумейра)");

console.log(scrapedName);
