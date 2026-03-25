/**
 * Africana Virtual Airways — Oil Price Service
 * Fetches Brent crude price from Alpha Vantage and caches it for 24 hours.
 * Falls back to the historical average ($80/barrel) if the API is unavailable.
 *
 * Fuel accounts for ~30% of airline costs, so the oil multiplier adjusts
 * only that portion of the base fare:
 *   adjustedBase = base × (0.70 + 0.30 × (oilPrice / OIL_BASELINE))
 */

const ALPHA_VANTAGE_URL = 'https://www.alphavantage.co/query';
const OIL_BASELINE      = 80;   // USD/barrel — our 1.0× reference price
const CACHE_TTL         = 24 * 60 * 60 * 1000; // 24 hours

let _cachedPrice      = OIL_BASELINE;
let _cachedMultiplier = 1.0;
let _lastFetchAt      = 0;
let _source           = 'fallback'; // 'live' | 'fallback'

/**
 * Fetch the latest monthly Brent crude price from Alpha Vantage.
 * Silently falls back to the cached/baseline value on any error.
 */
async function refreshOilPrice() {
  const apiKey = process.env.ALPHA_VANTAGE_KEY;
  if (!apiKey) {
    console.log('[Oil] No ALPHA_VANTAGE_KEY set — using baseline $80/barrel');
    return;
  }

  try {
    const url = `${ALPHA_VANTAGE_URL}?function=BRENT&interval=monthly&apikey=${encodeURIComponent(apiKey)}`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    const entries = json?.data;
    if (!Array.isArray(entries) || !entries.length) throw new Error('Empty data');

    const latest = parseFloat(entries[0].value);
    if (isNaN(latest) || latest <= 0) throw new Error('Invalid price');

    _cachedPrice      = latest;
    // Fuel is ~30% of cost; cap multiplier between 0.70× and 1.50×
    const raw         = latest / OIL_BASELINE;
    _cachedMultiplier = Math.max(0.70, Math.min(1.50, 0.70 + 0.30 * raw));
    _lastFetchAt      = Date.now();
    _source           = 'live';

    console.log(`[Oil] Brent crude: $${latest.toFixed(2)}/bbl → fare multiplier ${_cachedMultiplier.toFixed(3)}×`);
  } catch (err) {
    console.warn(`[Oil] Price fetch failed (${err.message}) — retaining $${_cachedPrice.toFixed(2)}/bbl`);
  }
}

/**
 * Returns the fuel-cost multiplier to apply to the base fare.
 * Also kicks off a background refresh if the cache has expired.
 */
function getFuelMultiplier() {
  if (Date.now() - _lastFetchAt > CACHE_TTL) {
    refreshOilPrice(); // fire-and-forget; next request after refresh will pick it up
  }
  return _cachedMultiplier;
}

/** Returns current oil context for the pricing-factors endpoint. */
function getOilContext() {
  return {
    priceUSD:   _cachedPrice,
    baseline:   OIL_BASELINE,
    multiplier: _cachedMultiplier,
    source:     _source,
    cachedAt:   _lastFetchAt ? new Date(_lastFetchAt).toISOString() : null
  };
}

module.exports = { refreshOilPrice, getFuelMultiplier, getOilContext };
