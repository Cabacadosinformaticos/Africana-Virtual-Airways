const express = require('express');
const router = express.Router();

const { getAllAirports } = require('../repositories/airport-repository');
const { getStats } = require('../repositories/airline-stats-repository');
const { haversineDistance } = require('../utils/distance-utils');

const VATSIM_DATA_URL = 'https://data.vatsim.net/v3/vatsim-data.json';
const METAR_URL = icao => `https://aviationweather.gov/api/data/metar?ids=${icao}&format=json&hours=2`;
const AFV_PREFIX = 'AFV';

// ── Caches ────────────────────────────────────────────────────────────────────
let _vatsimCache = null;
let _vatsimExpiry = 0;
const VATSIM_TTL = 60 * 1000; // 60 s

const _metarCache = new Map(); // icao -> { data, expiry }
const METAR_TTL = 10 * 60 * 1000; // 10 min

// ── Timing helpers ────────────────────────────────────────────────────────────

function parseHHMM(hhmm) {
  if (!hhmm || hhmm.length < 4 || hhmm === '0000') return null;
  const h = parseInt(hhmm.substring(0, 2), 10);
  const m = parseInt(hhmm.substring(2, 4), 10);
  return isNaN(h) || isNaN(m) ? null : h * 60 + m;
}

function formatHHMM(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function hmToDate(depMin, referenceMs) {
  const base = new Date(referenceMs);
  base.setUTCHours(0, 0, 0, 0);
  let d = new Date(base.getTime() + depMin * 60000);
  if (d.getTime() > referenceMs + 6 * 3600000) d = new Date(d.getTime() - 86400000);
  return d;
}

function computeTiming(p, airports) {
  const depMin = parseHHMM(p._deptime);
  const enrMin = parseHHMM(p._enroute);
  if (depMin === null || enrMin === null) return null;

  const now    = Date.now();
  const logonMs = p.logonTime ? new Date(p.logonTime).getTime() : now;

  const scheduledDep = hmToDate(depMin, logonMs);
  const scheduledArr = new Date(scheduledDep.getTime() + enrMin * 60000);

  const rawDepDelay = Math.round((logonMs - scheduledDep.getTime()) / 60000);
  const depDelayMin = Math.abs(rawDepDelay) < 720 ? rawDepDelay : null;

  let eta = null, arrDelayMin = null;
  let distanceRemainingKm = null, distanceTotalKm = null, progress = null;

  const dest = airports[p.to];
  if (dest && p.groundspeed > 50) {
    distanceRemainingKm = haversineDistance(p.lat, p.lon, dest.lat, dest.lon);
    const gsKmh = p.groundspeed * 1.852;
    eta = new Date(now + (distanceRemainingKm / gsKmh) * 3600000);
    arrDelayMin = Math.round((eta.getTime() - scheduledArr.getTime()) / 60000);

    const orig = airports[p.from];
    if (orig) {
      distanceTotalKm = haversineDistance(orig.lat, orig.lon, dest.lat, dest.lon);
      progress = Math.min(100, Math.max(0,
        Math.round((1 - distanceRemainingKm / distanceTotalKm) * 100)
      ));
    }
  }

  return {
    scheduledDep:    scheduledDep.toISOString(),
    scheduledArr:    scheduledArr.toISOString(),
    scheduledDepStr: formatHHMM(depMin),
    scheduledArrStr: formatHHMM((depMin + enrMin) % (24 * 60)),
    eta:             eta ? eta.toISOString() : null,
    etaStr:          eta ? eta.toISOString().substring(11, 16) : null,
    depDelayMin,
    arrDelayMin,
    distanceRemainingKm,
    distanceTotalKm,
    progress
  };
}

// ── METAR weather ─────────────────────────────────────────────────────────────

function degToCompass(deg) {
  if (!deg || deg === 'VRB') return 'Variable';
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(parseInt(deg) / 22.5) % 16];
}

function wxToText(wx) {
  if (!wx) return null;
  if (wx.includes('TS'))   return 'Thunderstorm';
  if (wx.includes('+RA'))  return 'Heavy rain';
  if (wx.includes('-RA'))  return 'Light rain';
  if (wx.includes('RA'))   return 'Rain';
  if (wx.includes('+SN'))  return 'Heavy snow';
  if (wx.includes('-SN'))  return 'Light snow';
  if (wx.includes('SN'))   return 'Snow';
  if (wx.includes('FG'))   return 'Fog';
  if (wx.includes('BR'))   return 'Mist';
  if (wx.includes('HZ'))   return 'Haze';
  if (wx.includes('-DZ'))  return 'Light drizzle';
  if (wx.includes('DZ'))   return 'Drizzle';
  if (wx.includes('SH'))   return 'Showers';
  return null;
}

function cloudDescription(m) {
  const layers = ['cldCvg1','cldCvg2','cldCvg3','cldCvg4'].map((k, i) => ({
    cover: m[k], base: m[`cldBas${i + 1}`]
  })).filter(l => l.cover);

  const sig = layers.find(l => l.cover === 'OVC' || l.cover === 'BKN');
  if (!sig) {
    const sct = layers.find(l => l.cover === 'SCT');
    if (sct) return 'Partly cloudy';
    return layers.length ? 'Few clouds' : 'Clear skies';
  }
  return sig.cover === 'OVC' ? 'Overcast' : 'Mostly cloudy';
}

function parseMetar(raw) {
  if (!raw) return null;
  const temp = raw.temp != null ? Math.round(raw.temp) : null;

  let windText;
  if (!raw.wspd || raw.wspd === 0) {
    windText = 'Calm';
  } else {
    const dir   = degToCompass(raw.wdir);
    const gust  = raw.wgst ? ` gusting ${raw.wgst}` : '';
    windText = `${raw.wspd}${gust} kt ${dir}`;
  }

  const conditions = wxToText(raw.wxString) || cloudDescription(raw);
  const visNum = parseFloat(raw.visib);
  const visPoor = !isNaN(visNum) && visNum < 3;
  const visText = visPoor ? `${visNum} SM vis` : null;

  return { temp, wind: windText, conditions, visText };
}

async function fetchMetar(icao) {
  const now    = Date.now();
  const cached = _metarCache.get(icao);
  if (cached && now < cached.expiry) return cached.data;

  try {
    const res    = await fetch(METAR_URL(icao), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`METAR ${res.status}`);
    const data   = await res.json();
    const parsed = (Array.isArray(data) && data.length) ? parseMetar(data[0]) : null;
    _metarCache.set(icao, { data: parsed, expiry: now + METAR_TTL });
    return parsed;
  } catch {
    return null;
  }
}

// ── Live VATSIM fetch ─────────────────────────────────────────────────────────

async function fetchLivePilots() {
  const now = Date.now();
  if (_vatsimCache && now < _vatsimExpiry) return _vatsimCache;

  try {
    const [res, airports] = await Promise.all([
      fetch(VATSIM_DATA_URL, { signal: AbortSignal.timeout(8000) }),
      getAllAirports()
    ]);

    if (!res.ok) throw new Error(`VATSIM API ${res.status}`);
    const data = await res.json();

    const pilots = (data.pilots || [])
      .filter(p => p.callsign && p.callsign.toUpperCase().startsWith(AFV_PREFIX))
      .map(p => {
        const pilot = {
          callsign:      p.callsign,
          name:          p.name,
          cid:           String(p.cid),
          from:          p.flight_plan?.departure       || '????',
          to:            p.flight_plan?.arrival         || '????',
          aircraft:      p.flight_plan?.aircraft_short  || p.flight_plan?.aircraft || '????',
          altitude:      p.altitude,
          groundspeed:   p.groundspeed,
          lat:           p.latitude,
          lon:           p.longitude,
          heading:       p.heading,
          logonTime:     p.logon_time,
          _deptime:      p.flight_plan?.deptime,
          _enroute:      p.flight_plan?.enroute_time
        };
        pilot.timing = computeTiming(pilot, airports);
        delete pilot._deptime;
        delete pilot._enroute;
        const orig = airports[pilot.from];
        const dest = airports[pilot.to];
        pilot.fromCoords = orig ? [orig.lat, orig.lon] : null;
        pilot.toCoords   = dest ? [dest.lat, dest.lon] : null;
        return pilot;
      });

    // Fetch destination METARs in parallel
    const uniqueDests = [...new Set(pilots.map(p => p.to).filter(Boolean))];
    const metars      = await Promise.all(uniqueDests.map(icao => fetchMetar(icao)));
    const metarMap    = Object.fromEntries(uniqueDests.map((icao, i) => [icao, metars[i]]));
    pilots.forEach(p => { p.destinationWeather = metarMap[p.to] || null; });

    _vatsimCache  = { source: 'live', pilots, updatedAt: new Date().toISOString() };
    _vatsimExpiry = now + VATSIM_TTL;
    return _vatsimCache;
  } catch {
    return null;
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get('/online', async (req, res) => {
  const live = await fetchLivePilots();
  if (live) {
    res.json({ source: 'live', onlinePilots: live.pilots, count: live.pilots.length, updatedAt: live.updatedAt });
  } else {
    res.json({ source: 'live', onlinePilots: [], count: 0, updatedAt: new Date().toISOString() });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await getStats();
    if (!stats) return res.status(404).json({ error: 'Airline stats not found' });
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load airline stats' });
  }
});

module.exports = router;
