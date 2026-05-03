/**
 * Africana Virtual Airways — Live VATSIM Traffic
 * Shows AFV pilots currently online, auto-refreshes every 30 seconds
 */

let map;
let pilotMarkers = {};
let routeArcs = {};     // callsign -> [Leaflet layer, ...]
let selectedCallsign = null;

// ── Airport coordinate cache ──────────────────────────────────────────────────
let _airports = null;
async function getAirports() {
  if (_airports) return _airports;
  try {
    const res = await fetch('/api/flights/airports');
    _airports = await res.json();
  } catch { _airports = {}; }
  return _airports;
}

// ── Geodesic helpers (great-circle arcs) ─────────────────────────────────────

// Connection: part of the live-VATSIM page map, sidebar, popup, selection, and refresh flow.
function toRad(d) { return d * Math.PI / 180; }
/**
 * Converts radians back to degrees for geodesicPoints(), which returns Leaflet-
 * ready coordinates for the planned and completed flight arcs on the map.
 * @param {number} r - Angle in radians
 * @returns {number} Angle in degrees
 */
// Connection: part of the live-VATSIM page map, sidebar, popup, selection, and refresh flow.
function toDeg(r) { return r * 180 / Math.PI; }

/**
 * Interpolates a great-circle path between two coordinate pairs so renderMap()
 * can draw both the full planned route and the completed portion of each flight.
 * @param {number[]} from - Origin coordinates as [lat, lon]
 * @param {number[]} to - Destination coordinates as [lat, lon]
 * @param {number} steps - Number of intermediate points to generate
 * @returns {number[][]} Array of [lat, lon] points along the route
 */
// Connection: part of the live-VATSIM page map, sidebar, popup, selection, and refresh flow.
function geodesicPoints(from, to, steps) {
  const lat1 = toRad(from[0]), lon1 = toRad(from[1]);
  const lat2 = toRad(to[0]),   lon2 = toRad(to[1]);
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((lat2-lat1)/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin((lon2-lon1)/2)**2
  ));
  if (d === 0) return [from, to];
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1-f)*d)/Math.sin(d), B = Math.sin(f*d)/Math.sin(d);
    const x = A*Math.cos(lat1)*Math.cos(lon1) + B*Math.cos(lat2)*Math.cos(lon2);
    const y = A*Math.cos(lat1)*Math.sin(lon1) + B*Math.cos(lat2)*Math.sin(lon2);
    const z = A*Math.sin(lat1) + B*Math.sin(lat2);
    pts.push([toDeg(Math.atan2(z, Math.sqrt(x*x+y*y))), toDeg(Math.atan2(y, x))]);
  }
  return pts;
}

const REFRESH_INTERVAL = 30; // seconds
let countdown = REFRESH_INTERVAL;

// ── Map init ──────────────────────────────────────────────────────────────────

// Connection: part of the live-VATSIM page map, sidebar, popup, selection, and refresh flow.
function initMap() {
  map = L.map('vatsimMap', {
    center: [10, 20],
    zoom: 3,
    zoomControl: true,
    attributionControl: true
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  loadPilots();
  startCountdown();
}

// ── Aircraft icon — gold circle with heading arrow ────────────────────────────

// Connection: part of the live-VATSIM page map, sidebar, popup, selection, and refresh flow.
function planeIcon(heading, isSelected) {
  const ring = isSelected ? '#ed2024' : 'rgba(13,27,62,0.18)';
  const fill = isSelected ? '#ed2024' : '#0D1B3E';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38" style="overflow:visible;">
    <defs>
      <filter id="afv-plane-shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.28)"/>
      </filter>
    </defs>
    <circle cx="19" cy="19" r="15" fill="rgba(255,255,255,0.92)" stroke="${ring}" stroke-width="1.8"/>
    <g transform="rotate(${heading} 19 19)" filter="url(#afv-plane-shadow)">
      <path d="M19 6l3.15 8.45 8.35 1.7v2.4l-8.35-.1-1.6 4.35 3.6 2.55v1.95L19 25.4l-5.15 1.95V25.4l3.6-2.55-1.6-4.35-8.35.1v-2.4l8.35-1.7L19 6z" fill="${fill}"/>
      <circle cx="19" cy="19" r="1.7" fill="#ffffff"/>
    </g>
  </svg>`;
  return L.divIcon({ className: '', html: svg, iconSize: [38, 38], iconAnchor: [19, 19] });
}

// ── Haversine distance & client-side timing ───────────────────────────────────

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeTimingClient(p, airports) {
  const parseHHMM = s => {
    if (!s || s.length < 4 || s === '0000') return null;
    return parseInt(s.slice(0, 2)) * 60 + parseInt(s.slice(2, 4));
  };
  const depMin = parseHHMM(p.flight_plan?.deptime);
  const enrMin = parseHHMM(p.flight_plan?.enroute_time);
  if (depMin === null || enrMin === null) return null;

  const now = Date.now() / 1000;
  const logonTs = p.logon_time ? new Date(p.logon_time).getTime() / 1000 : now;
  const logonDay = new Date(p.logon_time || Date.now());
  const baseTs = Date.UTC(logonDay.getUTCFullYear(), logonDay.getUTCMonth(), logonDay.getUTCDate()) / 1000;

  let scheduledDep = baseTs + depMin * 60;
  if (scheduledDep > logonTs + 6 * 3600) scheduledDep -= 86400;
  const scheduledArr = scheduledDep + enrMin * 60;

  const rawDepDelay = Math.round((logonTs - scheduledDep) / 60);
  const depDelayMin = Math.abs(rawDepDelay) < 720 ? rawDepDelay : null;

  let eta = null, arrDelayMin = null, distRemKm = null, distTotalKm = null, progress = null;
  const dest = airports[p.flight_plan?.arrival];
  if (dest && p.groundspeed > 50) {
    distRemKm = Math.round(haversineKm(p.latitude, p.longitude, dest.lat, dest.lon));
    const gsKmh = p.groundspeed * 1.852;
    eta = now + (distRemKm / gsKmh) * 3600;
    arrDelayMin = Math.round((eta - scheduledArr) / 60);
    const orig = airports[p.flight_plan?.departure];
    if (orig) {
      distTotalKm = haversineKm(orig.lat, orig.lon, dest.lat, dest.lon);
      progress = Math.max(0, Math.min(100, Math.round((1 - distRemKm / distTotalKm) * 100)));
    }
  }

  const fmtUTC = ts => new Date(ts * 1000).toISOString().slice(11, 16);
  return {
    scheduledDepStr:     fmtUTC(scheduledDep),
    scheduledArrStr:     fmtUTC(scheduledArr),
    etaStr:              eta ? fmtUTC(eta) : null,
    depDelayMin,
    arrDelayMin,
    distanceRemainingKm: distRemKm,
    distanceTotalKm:     distTotalKm ? Math.round(distTotalKm) : null,
    progress,
  };
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadPilots() {
  try {
    const [vatsimRes, airports] = await Promise.all([
      fetch('https://data.vatsim.net/v3/vatsim-data.json'),
      getAirports(),
    ]);
    const raw = await vatsimRes.json();

    const afvPilots = (raw.pilots || [])
      .filter(p => p.callsign?.toUpperCase().startsWith('AFV'))
      .map(p => {
        const fp  = p.flight_plan ?? {};
        const from = fp.departure ?? '????';
        const to   = fp.arrival   ?? '????';
        return {
          callsign:           p.callsign,
          name:               p.name,
          cid:                String(p.cid),
          from, to,
          aircraft:           fp.aircraft_short ?? fp.aircraft ?? '????',
          altitude:           p.altitude,
          groundspeed:        p.groundspeed,
          lat:                p.latitude,
          lon:                p.longitude,
          heading:            p.heading,
          logonTime:          p.logon_time,
          fromCoords:         airports[from] ? [airports[from].lat, airports[from].lon] : null,
          toCoords:           airports[to]   ? [airports[to].lat,   airports[to].lon]   : null,
          timing:             computeTimingClient(p, airports),
          destinationWeather: null,
        };
      });

    renderMap(afvPilots);
    renderSidebar({
      source:       'live',
      onlinePilots: afvPilots,
      count:        afvPilots.length,
      updatedAt:    new Date().toISOString(),
    });
  } catch (err) {
    console.error('VATSIM load error:', err);
    document.getElementById('sourceTag').textContent = '● ERROR';
    document.getElementById('sourceTag').className = 'source-tag error';
  }
}

// ── Map rendering ─────────────────────────────────────────────────────────────

// Connection: part of the live-VATSIM page map, sidebar, popup, selection, and refresh flow.
function renderMap(pilots) {
  // Remove old markers and arcs
  /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the live VATSIM map, sidebar, and refresh flow. */ Object.values(pilotMarkers).forEach(m => map.removeLayer(m));
  /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the live VATSIM map, sidebar, and refresh flow. */ Object.values(routeArcs).forEach(layers => layers.forEach(l => map.removeLayer(l)));
  pilotMarkers = {};
  routeArcs = {};

  /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the live VATSIM map, sidebar, and refresh flow. */ pilots.forEach(p => {
    // ── Route arcs ──
    if (p.fromCoords && p.toCoords) {
      const layers = [];
      // Full planned route — light dashed
      const fullPts = geodesicPoints(p.fromCoords, p.toCoords, 80);
      layers.push(L.polyline(fullPts, {
        color: '#9aa3b8', weight: 1.5, opacity: 0.35, dashArray: '6 5', smoothFactor: 1
      }).addTo(map));
      // Completed portion — gold solid
      const donePts = geodesicPoints(p.fromCoords, [p.lat, p.lon], 40);
      layers.push(L.polyline(donePts, {
        color: '#ed2024', weight: 2.5, opacity: 0.75, smoothFactor: 1
      }).addTo(map));
      routeArcs[p.callsign] = layers;
    }

    // ── Aircraft marker ──
    const isSelected = p.callsign === selectedCallsign;
    const marker = L.marker([p.lat, p.lon], { icon: planeIcon(p.heading || 0, isSelected) })
      .addTo(map)
      .bindPopup(popupHTML(p), { maxWidth: 260 });

    /* Purpose: responds to the click event for the surrounding map marker. Connection: wires map interaction into the live VATSIM map, sidebar, and refresh flow. */ marker.on('click', () => selectPilot(p.callsign, pilots));
    pilotMarkers[p.callsign] = marker;
  });
}

/**
 * Converts a delay value in minutes into a styled label used by popupHTML() and
 * cardHTML() to describe whether a live flight is early, on time, or delayed.
 * @param {number|null} delayMin - Delay in minutes relative to schedule
 * @returns {{text:string,color:string,bg:string}|null} Badge metadata or null
 */
// Connection: part of the live-VATSIM page map, sidebar, popup, selection, and refresh flow.
function delayLabel(delayMin) {
  if (delayMin === null || delayMin === undefined) return null;
  if (Math.abs(delayMin) <= 5)  return { text: 'On time', color: '#16a34a', bg: 'rgba(34,197,94,0.1)' };
  if (delayMin > 0)             return { text: `+${delayMin} min`, color: delayMin > 30 ? '#dc2626' : '#d97706', bg: delayMin > 30 ? 'rgba(220,38,38,0.08)' : 'rgba(245,158,11,0.1)' };
  return                               { text: `${delayMin} min`, color: '#2563eb', bg: 'rgba(37,99,235,0.08)' };
}

/**
 * Builds the rich Leaflet popup shown when a pilot marker is opened. renderMap()
 * binds this markup to each marker so the map exposes route, timing, and weather
 * details for the selected AFV flight.
 * @param {Object} p - Pilot record returned by /api/vatsim/online
 * @returns {string} Popup HTML string
 */
// Connection: part of the live-VATSIM page map, sidebar, popup, selection, and refresh flow.
function popupHTML(p) {
  const alt = p.altitude ? `FL${Math.round(p.altitude / 100)}` : 'N/A';
  const spd = p.groundspeed ? `${p.groundspeed} kt` : 'N/A';
  const hdg = p.heading != null ? `${p.heading}°` : 'N/A';
  const t = p.timing;

  let timingBlock = '';
  if (t) {
    const depBadge = delayLabel(t.depDelayMin);
    const arrBadge = delayLabel(t.arrDelayMin);
    timingBlock = `
    <div style="margin-top:10px;padding:9px 10px;background:#f5f6fa;border-radius:8px;display:grid;grid-template-columns:1fr 1fr;gap:6px;">
      <div>
        <div style="font-size:0.58rem;text-transform:uppercase;color:#9aa3b8;font-weight:600;letter-spacing:0.06em;margin-bottom:2px;">Scheduled Dep</div>
        <div style="font-size:0.88rem;font-weight:700;color:#0D1B3E;">${t.scheduledDepStr} <span style="font-size:0.62rem;color:#9aa3b8;">UTC</span></div>
        ${depBadge ? `<div style="font-size:0.65rem;font-weight:700;color:${depBadge.color};margin-top:2px;">${depBadge.text}</div>` : ''}
      </div>
      <div>
        <div style="font-size:0.58rem;text-transform:uppercase;color:#9aa3b8;font-weight:600;letter-spacing:0.06em;margin-bottom:2px;">${t.etaStr ? 'Live ETA' : 'Sched. Arr'}</div>
        <div style="font-size:0.88rem;font-weight:700;color:#0D1B3E;">${t.etaStr || t.scheduledArrStr} <span style="font-size:0.62rem;color:#9aa3b8;">UTC</span></div>
        ${arrBadge ? `<div style="font-size:0.65rem;font-weight:700;color:${arrBadge.color};margin-top:2px;">${arrBadge.text}</div>` : ''}
      </div>
    </div>`;
  }

  return `<div style="font-family:Montserrat,sans-serif;min-width:210px;">
    <div style="font-size:0.62rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#22c55e;margin-bottom:4px;">● On VATSIM</div>
    <div style="font-size:1.1rem;font-weight:800;color:#0D1B3E;margin-bottom:2px;">${p.callsign}</div>
    <div style="font-size:0.78rem;color:#6b7a99;margin-bottom:10px;">${p.name} &nbsp;·&nbsp; CID ${p.cid}</div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
      <span style="font-size:1rem;font-weight:800;color:#0D1B3E;">${p.from}</span>
      <span style="color:#D4A843;font-weight:700;">→</span>
      <span style="font-size:1rem;font-weight:800;color:#0D1B3E;">${p.to}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:4px;background:#f5f6fa;border-radius:8px;padding:8px;">
      ${statCell('Type', p.aircraft)}
      ${statCell('Alt', alt)}
      ${statCell('GS', spd)}
      ${statCell('HDG', hdg)}
    </div>
    ${timingBlock}
    ${weatherPopupBlock(p.destinationWeather, p.to)}
  </div>`;
}

/**
 * Produces the destination-weather strip appended to marker popups when the API
 * has METAR data. popupHTML() calls this to keep the weather block isolated.
 * @param {Object|null} wx - Parsed weather summary for the destination airport
 * @param {string} icao - Destination ICAO code used in the label
 * @returns {string} Weather block HTML or an empty string
 */
// Connection: part of the live-VATSIM page map, sidebar, popup, selection, and refresh flow.
function weatherPopupBlock(wx, icao) {
  if (!wx) return '';
  const tempStr = wx.temp != null ? `${wx.temp}°C` : '';
  return `<div style="margin-top:8px;padding:8px 10px;background:#f0f9ff;border-radius:8px;border:1px solid #bae6fd;">
    <div style="font-size:0.58rem;text-transform:uppercase;color:#0369a1;font-weight:700;letter-spacing:0.06em;margin-bottom:5px;">Weather at ${icao}</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:0.75rem;font-weight:600;color:#0D1B3E;">
      ${tempStr ? `<span>${tempStr}</span>` : ''}
      <span>${wx.wind}</span>
      <span>${wx.conditions}</span>
      ${wx.visText ? `<span style="color:#dc2626;">${wx.visText}</span>` : ''}
    </div>
  </div>`;
}

/**
 * Builds one compact stat cell used inside the pilot popup grid for aircraft,
 * altitude, groundspeed, and heading values. popupHTML() composes several of
 * these cells into the summary block.
 * @param {string} label - Short label for the stat
 * @param {string} value - Display value for the stat
 * @returns {string} HTML string for one popup stat cell
 */
// Connection: part of the live-VATSIM page map, sidebar, popup, selection, and refresh flow.
function statCell(label, value) {
  return `<div style="text-align:center;">
    <div style="font-size:0.58rem;text-transform:uppercase;color:#9aa3b8;font-weight:600;letter-spacing:0.06em;">${label}</div>
    <div style="font-size:0.8rem;font-weight:700;color:#0D1B3E;margin-top:1px;">${value}</div>
  </div>`;
}

// ── Sidebar rendering ─────────────────────────────────────────────────────────

// Connection: part of the live-VATSIM page map, sidebar, popup, selection, and refresh flow.
function renderSidebar(data) {
  const pilots = data.onlinePilots || [];

  // Source / status badge
  const tag = document.getElementById('sourceTag');
  tag.textContent = '● LIVE';
  tag.className = 'source-tag live';
  document.getElementById('onlineCount').textContent =
    `${pilots.length} pilot${pilots.length !== 1 ? 's' : ''} online`;
  document.getElementById('lastUpdated').textContent =
    'Updated ' + new Date(data.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const list = document.getElementById('pilotList');

  if (pilots.length === 0) {
    list.innerHTML = `<div class="no-flights">
      <div class="no-flights-icon">✈</div>
      <div class="no-flights-msg">No AFV pilots online</div>
      <div class="no-flights-sub">Check back during peak hours (06:00–22:00 UTC)</div>
    </div>`;
    return;
  }

  /* Purpose: transforms each item in the current collection for the surrounding render or data step. Connection: feeds the surrounding collection pipeline inside the live VATSIM map, sidebar, and refresh flow. */ list.innerHTML = pilots.map(p => cardHTML(p)).join('');

  /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the live VATSIM map, sidebar, and refresh flow. */ list.querySelectorAll('.pilot-card').forEach(card => {
    /* Purpose: responds to the click event for the surrounding DOM element. Connection: wires the surrounding UI element into the live VATSIM map, sidebar, and refresh flow. */ card.addEventListener('click', () => {
      selectPilot(card.dataset.callsign, pilots);
      const marker = pilotMarkers[card.dataset.callsign];
      if (marker) {
        map.flyTo(marker.getLatLng(), 5, { duration: 1.1 });
        /* Purpose: runs delayed follow-up logic after the surrounding timeout expires. Connection: continues the live VATSIM map, sidebar, and refresh flow after a controlled delay. */ setTimeout(() => marker.openPopup(), 1000);
      }
    });
  });

  // Re-apply highlight if one was selected
  if (selectedCallsign) {
    document.querySelector(`.pilot-card[data-callsign="${selectedCallsign}"]`)?.classList.add('active');
  }
}

/**
 * Builds the route-progress bar shown inside each sidebar pilot card. cardHTML()
 * calls this when timing progress is available from the VATSIM API payload.
 * @param {Object} p - Pilot record with timing/progress metadata
 * @returns {string} Progress-bar HTML or an empty string
 */
// Connection: part of the live-VATSIM page map, sidebar, popup, selection, and refresh flow.
function progressBarHTML(p) {
  const t = p.timing;
  if (!t || t.progress === null || t.progress === undefined) return '';
  const pct = t.progress;
  const distText = t.distanceRemainingKm
    ? `${t.distanceRemainingKm.toLocaleString()} km remaining`
    : `${pct}% complete`;
  return `<div class="fpb-wrap">
    <div class="fpb-track">
      <div class="fpb-fill" style="width:${pct}%"></div>
      <div class="fpb-marker" style="left:${Math.min(pct, 97)}%"></div>
    </div>
    <div class="fpb-labels">
      <span>${p.from}</span>
      <span class="fpb-dist">${distText}</span>
      <span>${p.to}</span>
    </div>
  </div>`;
}

/**
 * Builds the destination-weather summary strip shown in the sidebar pilot card.
 * cardHTML() uses this to mirror the popup weather info in the list view.
 * @param {Object|null} wx - Parsed destination weather object
 * @returns {string} Weather strip HTML or an empty string
 */
// Connection: part of the live-VATSIM page map, sidebar, popup, selection, and refresh flow.
function weatherCardHTML(wx) {
  if (!wx) return '';
  const tempStr = wx.temp != null ? `${wx.temp}°C` : '';
  return `<div class="wx-strip">
    ${tempStr ? `<span class="wx-item">${tempStr}</span>` : ''}
    <span class="wx-item">${wx.wind}</span>
    <span class="wx-item">${wx.conditions}</span>
    ${wx.visText ? `<span class="wx-item wx-poor">${wx.visText}</span>` : ''}
  </div>`;
}

/**
 * Produces the full sidebar card markup for one online AFV pilot, including live
 * phase, timing, progress, and weather details. renderSidebar() maps every pilot
 * through this helper before wiring selection behaviour.
 * @param {Object} p - Pilot record returned by /api/vatsim/online
 * @returns {string} HTML string for one sidebar pilot card
 */
// Connection: part of the live-VATSIM page map, sidebar, popup, selection, and refresh flow.
function cardHTML(p) {
  const alt = p.altitude ? `FL${Math.round(p.altitude / 100)}` : '-';
  const spd = p.groundspeed ? `${p.groundspeed} kt` : '-';
  let phase, phaseClass;
  if (p.altitude > 10000)     { phase = 'Cruise';          phaseClass = 'phase-cruise'; }
  else if (p.altitude > 2000) { phase = 'Climb / Descent'; phaseClass = 'phase-climb'; }
  else                        { phase = 'Ground';           phaseClass = 'phase-ground'; }

  const t = p.timing;
  let timingRow = '';
  if (t) {
    const arrBadge = delayLabel(t.arrDelayMin);
    const etaDisplay = t.etaStr || t.scheduledArrStr;
    timingRow = `<div class="card-timing">
      <span class="timing-item">Dep <strong>${t.scheduledDepStr}</strong> UTC</span>
      <span class="timing-sep">·</span>
      <span class="timing-item">ETA <strong>${etaDisplay}</strong> UTC</span>
      ${arrBadge ? `<span class="timing-badge" style="color:${arrBadge.color};background:${arrBadge.bg};">${arrBadge.text}</span>` : ''}
    </div>`;
  }

  return `<div class="pilot-card${p.callsign === selectedCallsign ? ' active' : ''}" data-callsign="${p.callsign}">
    <div class="card-top">
      <span class="card-callsign">${p.callsign}</span>
      <span class="card-phase ${phaseClass}">${phase}</span>
    </div>
    <div class="card-route">${p.from} <span class="card-arrow">→</span> ${p.to}</div>
    <div class="card-meta">
      <span class="aircraft-badge">${p.aircraft}</span>
      <span>${alt}</span>
      <span>${spd}</span>
    </div>
    ${timingRow}
    ${progressBarHTML(p)}
    ${weatherCardHTML(p.destinationWeather)}
    <div class="card-pilot">${p.name}</div>
  </div>`;
}

// ── Selection ─────────────────────────────────────────────────────────────────

// Connection: part of the live-VATSIM page map, sidebar, popup, selection, and refresh flow.
function selectPilot(callsign, pilots) {
  selectedCallsign = callsign;
  // Update card highlights
  /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the live VATSIM map, sidebar, and refresh flow. */ document.querySelectorAll('.pilot-card').forEach(c =>
    c.classList.toggle('active', c.dataset.callsign === callsign)
  );
  // Refresh icon on previously selected / newly selected marker
  /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the live VATSIM map, sidebar, and refresh flow. */ Object.entries(pilotMarkers).forEach(([cs, marker]) => {
    /* Purpose: checks each candidate until the surrounding lookup finds its match. Connection: feeds the surrounding collection pipeline inside the live VATSIM map, sidebar, and refresh flow. */ const p = pilots.find(x => x.callsign === cs);
    if (p) marker.setIcon(planeIcon(p.heading || 0, cs === callsign));
  });
}

// ── Auto-refresh countdown ────────────────────────────────────────────────────

// Connection: part of the live-VATSIM page map, sidebar, popup, selection, and refresh flow.
function startCountdown() {
  /* Purpose: runs recurring logic on the surrounding timer interval. Connection: keeps the live VATSIM map, sidebar, and refresh flow refreshing on a timer. */ setInterval(() => {
    countdown--;
    const el = document.getElementById('refreshCountdown');
    if (el) el.textContent = `Refreshing in ${countdown}s`;
    if (countdown <= 0) {
      countdown = REFRESH_INTERVAL;
      loadPilots();
    }
  }, 1000);
}

// ── Boot ──────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', initMap);
