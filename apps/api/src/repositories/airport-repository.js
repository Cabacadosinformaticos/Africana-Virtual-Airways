/**
 * Airport Repository
 *
 * Source of truth: `airports` MySQL table.
 * An in-memory cache is populated on first request so callers get
 * O(1) map lookups without hitting the DB on every request.
 */

const { getPool } = require('./database');

/** @type {Record<string, Airport> | null} */
let _cache = null;

/**
 * Return all airports as an ICAO-keyed object map.
 * Cached in memory after the first DB load.
 */
async function getAllAirports() {
  if (_cache) return _cache;

  const [rows] = await getPool().query('SELECT * FROM airports ORDER BY icao ASC');
  _cache = {};
  for (const row of rows) {
    _cache[row.icao] = {
      icao:    row.icao,
      iata:    row.iata,
      name:    row.name,
      city:    row.city,
      country: row.country,
      lat:     parseFloat(row.lat),
      lon:     parseFloat(row.lon),
      hub:     row.hub === 1 || row.hub === true
    };
  }
  return _cache;
}

/**
 * Return a single airport by ICAO code, or null if not found.
 */
async function getAirport(icao) {
  const airports = await getAllAirports();
  return airports[String(icao).toUpperCase()] || null;
}

/**
 * Invalidate the in-memory cache (e.g. after an admin update).
 */
function invalidateAirportCache() {
  _cache = null;
}

module.exports = { getAllAirports, getAirport, invalidateAirportCache };
