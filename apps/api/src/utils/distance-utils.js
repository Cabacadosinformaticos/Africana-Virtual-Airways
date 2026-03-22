/**
 * Geographic utility functions for Africana Virtual Airways
 * Implements Haversine formula for great-circle distance calculation
 */

const EARTH_RADIUS_KM = 6371;

/**
 * Convert degrees to radians
 */
function toRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Calculate great-circle distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1 (degrees)
 * @param {number} lon1 - Longitude of point 1 (degrees)
 * @param {number} lat2 - Latitude of point 2 (degrees)
 * @param {number} lon2 - Longitude of point 2 (degrees)
 * @returns {number} Distance in kilometres
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_KM * c);
}

/**
 * Estimate flight duration based on distance
 * Assumes average block speed of 820 km/h including climb/descent
 * @param {number} distanceKm
 * @returns {number} Duration in minutes
 */
function estimateDurationMinutes(distanceKm) {
  const blockSpeedKmh = 820;
  const groundTimeMinutes = 45; // taxi + approach overhead for short flights
  const extra = distanceKm < 1000 ? groundTimeMinutes : 30;
  return Math.round((distanceKm / blockSpeedKmh) * 60) + extra;
}

/**
 * Estimate flight duration based on distance
 * @param {number} distanceKm
 * @returns {string} Formatted duration string e.g. "2h 35m"
 */
function estimateDuration(distanceKm) {
  const totalMinutes = estimateDurationMinutes(distanceKm);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

/**
 * Determine appropriate aircraft category for a route distance
 * @param {number} distanceKm
 * @returns {string} 'Regional' | 'Short Range' | 'Long Range'
 */
function routeCategory(distanceKm) {
  if (distanceKm < 1500) return 'Regional';
  if (distanceKm < 5000) return 'Short Range';
  return 'Long Range';
}

module.exports = {
  estimateDuration,
  estimateDurationMinutes,
  haversineDistance,
  routeCategory
};
