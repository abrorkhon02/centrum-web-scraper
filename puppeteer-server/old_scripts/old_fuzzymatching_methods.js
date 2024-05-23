
  weightedSimilarity(inputName, existingName) {
    const initialWordsWeight = 0.1;
    const uniqueWordsWeight = 0.7;
    const overallWordsWeight = 0.2;
    const percentageToExtract = 0.6;

    const initialWordsSimilarity = cmpstr.diceCoefficient(
      this.extractInitialWords(inputName, percentageToExtract),
      this.extractInitialWords(existingName, percentageToExtract)
    );

    const inputUniqueWords = this.extractUniqueWords(inputName);
    const existingUniqueWords = this.extractUniqueWords(existingName);
    const uniqueWordsSimilarity = cmpstr.diceCoefficient(
      inputUniqueWords,
      existingUniqueWords
    );
    const overallSimilarity = cmpstr.diceCoefficient(inputName, existingName);

    return (
      initialWordsWeight * initialWordsSimilarity +
      uniqueWordsWeight * uniqueWordsSimilarity +
      overallWordsWeight * overallSimilarity
    );
  }

  compareHotels(hotelA, hotelB) {
    logger.info(`Comparing hotels: ${hotelA} vs ${hotelB}`);
    const cityA = this.extractCityName(hotelA) || "";
    const cityB = this.extractCityName(hotelB) || "";
    // logger.info(`Extracted cities: ${cityA}, ${cityB}`);
    let nameA = this.normalizeHotelNameAndStars(hotelA);
    let nameB = this.normalizeHotelNameAndStars(hotelB);
    // logger.info(`Normalized names for comparing: ${nameA}, ${nameB}`);

    const starRegex = /(\d+)-star/;
    let starsA = nameA.match(starRegex);
    let starsB = nameB.match(starRegex);
    // logger.info(
    //   `Star ratings: ${starsA ? starsA[1] : "None"} vs ${
    //     starsB ? starsB[1] : "None"
    //   }`
    // );

    // Conditions to handle null or undefined cities or star ratings
    if (
      (cityA && cityB && cityA !== cityB) ||
      (starsA && starsB && starsA[1] !== starsB[1])
    ) {
      // logger.info("Mismatch found. Returning 0 similarity.");
      return 0;
    }

    // Proceed with the name comparison even if one or both star ratings are undefined
    nameA = nameA.replace(starRegex, "").trim();
    nameB = nameB.replace(starRegex, "").trim();
    // logger.info(`Names after removing star ratings: ${nameA}, ${nameB}`);

    const similarity = cmpstr.diceCoefficient(nameA, nameB);
    logger.info(`Computed similarity: ${similarity}`);

    return similarity;
  }

  normalizeHotelNameAndStars(name) {
    let normalized = name.toLowerCase();
    normalized = normalized.replace(/(\d+)\s*\*/g, "$1-star");
    normalized = normalized.replace(
      /\*{1,5}/g,
      (match) => `${match.length}-star`
    );
    normalized = normalized.replace(/\(([^)]+)\)(?![^\(]*\))/g, "");
    normalized = normalized.replace(/\s+/g, " ").trim();
    return normalized;
  }

  extractCityName(hotelName) {
    const match = hotelName.match(/\(([^)]+)\)\s*$/);
    return match ? match[1].trim().toLowerCase() : null;
  }

  extractInitialWords = (text, percentage) => {
    const words = text.split(" ");
    const numberOfWords = Math.round(words.length * percentage);
    return words.slice(0, numberOfWords).join(" ");
  };

  extractUniqueWords(hotelName) {
    let words = hotelName.toLowerCase().split(/\s+/);
    let uniqueWords = words.filter(
      (word) => !commonWords.has(word) && isNaN(word)
    );
    return uniqueWords.join(" ");
  }

const commonWords = new Set([
  "by",
  "hotel",
  "hotels",
  "suites",
  "residence",
  "resort",
  "lodge",
  "place",
  "house",
  "boutique",
  "spa",
  "b&b",
  "motel",
  "hostel",
  "guesthouse",
  "accommodation",
  "stay",
  "room",
  "rooms",
  "palace",
  "international",
  "national",
  "luxury",
  "budget",
  "economy",
  "apartments",
  "bungalows",
  "palace",
  "line",
  "villa",
  "villas",
  "tbilisi",
  "adjara",
  "gudauri",
  "gurjaani",
  "imereti",
  "kazbegi",
  "kvareli",
  "lagodekhi",
  "mtskheta",
  "samegrelo-upper svaneti",
  "samtskhe-javakheti",
  "shekvetili",
  "кахетия",
  "телави",
  "abu dhabi",
  "ajman",
  "dubai",
  "fujairah",
  "ras al khaimah",
  "sharjah",
  "umm al quwain",
  "al barsha",
  "bur dubai",
  "deira",
  "official,",
]);


