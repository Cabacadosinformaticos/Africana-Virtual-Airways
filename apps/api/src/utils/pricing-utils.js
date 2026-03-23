/**
 * Africana Virtual Airways — Dynamic Pricing Engine
 *
 * Price drivers:
 *  1. Distance-based base fare (tapered rate for long-haul)
 *  2. Cabin class multiplier
 *  3. Region-aware seasonal multiplier  ← hemisphere-correct
 *  4. Fuel / oil-price multiplier        ← live Brent crude
 *  5. Demand multiplier (load-factor)
 *  6. Flat taxes & fees
 */

const { getFuelMultiplier, getOilContext } = require('../services/pricing/oil-service');

// ── Cabin class ───────────────────────────────────────────────────────────────
const CLASS_MULTIPLIERS = {
  economy:  1.0,
  business: 3.2,
  first:    6.5
};

// ── Demand (load-factor) tiers ────────────────────────────────────────────────
const DEMAND_TIERS = [
  { threshold: 0.90, multiplier: 1.45 },
  { threshold: 0.75, multiplier: 1.20 },
  { threshold: 0.50, multiplier: 1.00 },
  { threshold: 0.25, multiplier: 0.85 },
  { threshold: 0.00, multiplier: 0.70 }
];

// ── ICAO prefix → world region ────────────────────────────────────────────────
// Used for hemisphere-aware seasonality.
const AFRICA_PREFIXES  = new Set([
  'FA','FB','FC','FD','FE','FG','FH','FI','FJ','FK','FL','FM',
  'FN','FO','FP','FQ','FS','FT','FV','FW','FX','FY','FZ',
  'DA','DB','DC','DD','DF','DG','DI','DN','DR','DT','DX',
  'GM','GQ','GS','GU','GV',
  'HA','HB','HC','HD','HE','HH','HK','HL','HR','HS','HT','HU'
]);

const EUROPE_PREFIXES  = new Set([
  'ED','EF','EG','EH','EI','EK','EL','EN','EP','ES','ET','EV','EY',
  'LB','LC','LD','LE','LF','LG','LH','LI','LJ','LK','LL','LM',
  'LN','LO','LP','LQ','LR','LS','LT','LU','LV','LW','LX','LY','LZ',
  'UB','UD','UE','UG','UK','UM','UT','UU','UW'
]);

const MIDDLEEAST_PREFIX1 = 'O'; // All ICAO codes starting with O → Middle East

const ASIAPAC_PREFIXES = new Set([
  'VH','YM','YB','RJ','RK','WS','WI','VT','VD','VL','VN',
  'ZS','ZB','ZG','ZH','ZL','ZP','ZU','ZW','ZY',
  'PH','PK','PL','PM','PP','PT','PW'
]);

function getRegion(icao) {
  if (!icao) return 'other';
  const p2 = icao.substring(0, 2).toUpperCase();
  const p1 = icao.substring(0, 1).toUpperCase();

  if (AFRICA_PREFIXES.has(p2))                           return 'africa';
  if (EUROPE_PREFIXES.has(p2))                           return 'europe';
  if (p1 === MIDDLEEAST_PREFIX1)                         return 'middle_east';
  if (ASIAPAC_PREFIXES.has(p2))                          return 'asia_pacific';
  if (p1 === 'K' || p1 === 'C' || p2 === 'SB' || p2 === 'TI' || p2 === 'MD') return 'americas';
  return 'other';
}

/**
 * Region-aware seasonal multiplier.
 *
 * Africa/Southern hemisphere:
 *   Peak    Nov–Feb  (southern summer + Christmas)   × 1.30
 *   High    Jun–Aug  (European visitors)              × 1.05
 *   Shoulder Sep–Oct                                  × 1.00
 *   Off     Mar–May  (end of summer / shoulder)       × 0.85
 *
 * Europe / Northern hemisphere:
 *   Peak    Jun–Aug  (summer holidays)                × 1.40
 *   High    Dec–Jan  (Christmas / New Year)            × 1.20
 *   Shoulder Apr–May, Sep–Oct                          × 1.05
 *   Off     Feb–Mar, Nov                               × 0.85
 *
 * Middle East:
 *   Peak    Nov–Mar  (cool season / tourism)           × 1.25
 *   Shoulder Apr, Oct                                  × 1.00
 *   Off     May–Sep  (extreme heat)                    × 0.78
 *
 * Americas:
 *   Peak    Jun–Aug, Dec–Jan                           × 1.35
 *   Shoulder Apr–May, Sep–Oct                          × 1.00
 *   Off     Feb–Mar, Nov                               × 0.85
 *
 * Asia-Pacific:
 *   Peak    Jul–Aug, Dec–Jan                           × 1.28
 *   Shoulder Apr–May, Oct–Nov                          × 1.05
 *   Off     Feb–Mar, Jun                               × 0.90
 */
function getSeasonMultiplier(date, destinationIcao) {
  const month  = date.getMonth() + 1; // 1-indexed
  const region = getRegion(destinationIcao);

  switch (region) {
    case 'africa':
      if ([11, 12, 1, 2].includes(month)) return 1.30;
      if ([6, 7, 8].includes(month))      return 1.05;
      if ([9, 10].includes(month))        return 1.00;
      return 0.85; // Mar–May

    case 'europe':
      if ([6, 7, 8].includes(month))      return 1.40;
      if ([12, 1].includes(month))        return 1.20;
      if ([4, 5, 9, 10].includes(month))  return 1.05;
      return 0.85; // Feb–Mar, Nov

    case 'middle_east':
      if ([11, 12, 1, 2, 3].includes(month)) return 1.25;
      if ([4, 10].includes(month))            return 1.00;
      return 0.78; // May–Sep

    case 'americas':
      if ([6, 7, 8].includes(month))      return 1.35;
      if ([12, 1].includes(month))        return 1.25;
      if ([4, 5, 9, 10].includes(month))  return 1.00;
      return 0.85; // Feb–Mar, Nov

    case 'asia_pacific':
      if ([7, 8].includes(month))         return 1.28;
      if ([12, 1].includes(month))        return 1.22;
      if ([4, 5, 10, 11].includes(month)) return 1.05;
      if ([2, 3, 6].includes(month))      return 0.90;
      return 1.00;

    default:
      if ([6, 7, 8, 12].includes(month))  return 1.25;
      if ([4, 5, 9, 10].includes(month))  return 1.05;
      return 0.88;
  }
}

/**
 * Human-readable season label for the current month + destination region.
 */
function getSeasonLabel(date, destinationIcao) {
  const multiplier = getSeasonMultiplier(date, destinationIcao);
  if (multiplier >= 1.30) return 'peak';
  if (multiplier >= 1.10) return 'high';
  if (multiplier >= 0.95) return 'shoulder';
  return 'low';
}

// ── Base fare ─────────────────────────────────────────────────────────────────
function baseFare(distanceKm) {
  const BASE_RATE   = 0.065;
  const MIN_FARE    = 45;
  const YIELD_TAPER = distanceKm > 5000 ? 0.80 : 1.0;
  return Math.max(MIN_FARE, Math.round(distanceKm * BASE_RATE * YIELD_TAPER));
}

// ── Demand multiplier ─────────────────────────────────────────────────────────
function getDemandMultiplier(loadFactor) {
  for (const tier of DEMAND_TIERS) {
    if (loadFactor >= tier.threshold) return tier.multiplier;
  }
  return 0.70;
}

// ── Main price calculator ─────────────────────────────────────────────────────
/**
 * @param {number}  distanceKm
 * @param {string}  cabinClass   'economy' | 'business' | 'first'
 * @param {Date}    travelDate
 * @param {number}  loadFactor   0–1
 * @param {number}  passengers
 * @param {string}  [destinationIcao]  Used for region-aware seasonality
 */
function calculatePrice(distanceKm, cabinClass, travelDate, loadFactor = 0.6, passengers = 1, destinationIcao = null) {
  const base            = baseFare(distanceKm);
  const classMultiplier = CLASS_MULTIPLIERS[cabinClass] || 1.0;
  const seasonMultiplier = getSeasonMultiplier(travelDate || new Date(), destinationIcao);
  const demandMultiplier = getDemandMultiplier(loadFactor);
  const fuelMultiplier   = getFuelMultiplier();
  const taxes            = 45;

  // Fuel affects ~30% of base cost
  const fuelAdjustedBase = base * (0.70 + 0.30 * fuelMultiplier);
  const perPerson        = Math.round(fuelAdjustedBase * classMultiplier * seasonMultiplier * demandMultiplier + taxes);
  const total            = perPerson * passengers;

  return {
    perPerson,
    total,
    breakdown: {
      base,
      fuelAdjustedBase: Math.round(fuelAdjustedBase),
      classMultiplier,
      seasonMultiplier,
      demandMultiplier,
      fuelMultiplier: Math.round(fuelMultiplier * 1000) / 1000,
      taxes,
      passengers,
      season: getSeasonLabel(travelDate || new Date(), destinationIcao),
      region: getRegion(destinationIcao)
    }
  };
}

/**
 * Generate price tiers for all three cabin classes.
 */
function allClassPrices(distanceKm, travelDate, loadFactor = 0.6, destinationIcao = null) {
  return {
    economy:  calculatePrice(distanceKm, 'economy',  travelDate, loadFactor, 1, destinationIcao),
    business: calculatePrice(distanceKm, 'business', travelDate, loadFactor, 1, destinationIcao),
    first:    calculatePrice(distanceKm, 'first',    travelDate, loadFactor, 1, destinationIcao)
  };
}

/**
 * Return all active pricing factors for the /pricing-factors endpoint.
 */
function getPricingFactors(date = new Date()) {
  const regions = ['africa', 'europe', 'middle_east', 'americas', 'asia_pacific'];
  const seasonal = {};
  regions.forEach(r => {
    // Fake ICAO per region to get multiplier
    const probe = { africa: 'FQMA', europe: 'LFPG', middle_east: 'OMDB', americas: 'KORD', asia_pacific: 'WSSS' }[r];
    seasonal[r] = {
      multiplier: getSeasonMultiplier(date, probe),
      label:      getSeasonLabel(date, probe)
    };
  });

  return {
    oil:      getOilContext(),
    seasonal,
    updatedAt: new Date().toISOString()
  };
}

module.exports = { calculatePrice, allClassPrices, baseFare, getPricingFactors, getRegion, getSeasonMultiplier };
