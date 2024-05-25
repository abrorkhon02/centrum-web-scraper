const { loadHotelMapping } = require("./hotelNameMapper");
const { logger } = require("./logger");

let hotelMappingPromise = null;

async function getHotelMapping() {
  if (!hotelMappingPromise) {
    hotelMappingPromise = loadHotelMapping()
      .then((mapping) => {
        logger.info("Hotel mapping ready for use.");
        return mapping;
      })
      .catch((error) => {
        logger.error("Error initializing hotel mapping:", error);
        throw error;
      });
  }
  return hotelMappingPromise;
}

module.exports = {
  getHotelMapping,
};
