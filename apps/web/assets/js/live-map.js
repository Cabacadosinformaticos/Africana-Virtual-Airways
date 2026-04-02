/**
 * Africana Virtual Airways — Interactive Route Map
 * Uses Leaflet.js with CartoDB dark tiles + great-circle route arcs
 * GIS requirement: visualises the full AFV network with geographic accuracy
 */

let map;
let routeLines = [];
let airportMarkers = {};
let allRoutes = [];
let activeHub = 'all';

// Icon definitions — created inside initMap() to guarantee L is ready
let HUB_ICON_MAPUTO, HUB_ICON_ALGIERS, DEST_ICON;

function initMap() {
  // Build icons now that Leaflet is confirmed loaded
  HUB_ICON_MAPUTO = L.divIcon({
    className: '',
    html: `<div style="
      width:18px;height:18px;border-radius:50%;
      background:#cc1f36;
      border:3px solid #fff;
      box-shadow:0 0 0 3px rgba(204,31,54,0.4), 0 2px 8px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [18, 18], iconAnchor: [9, 9]
  });

  HUB_ICON_ALGIERS = L.divIcon({
    className: '',
    html: `<div style="
      width:18px;height:18px;border-radius:50%;
      background:#5bb3e4;
      border:3px solid #fff;
      box-shadow:0 0 0 3px rgba(91,179,228,0.4), 0 2px 8px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [18, 18], iconAnchor: [9, 9]
  });

  DEST_ICON = L.divIcon({
    className: '',
    html: `<div style="
      width:10px;height:10px;border-radius:50%;
      background:#ffffff;
      border:2px solid rgba(255,255,255,0.6);
      box-shadow:0 1px 4px rgba(0,0,0,0.5);
    "></div>`,
    iconSize: [10, 10], iconAnchor: [5, 5]
  });

  map = L.map('mainMap', {
    center: [10, 20],
    zoom: 3,
    zoomControl: true,
    attributionControl: true
  });

  // CartoDB Positron (light) tiles
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  loadRoutes();
}

async function loadRoutes() {
  try {
    const res = await fetch('/api/flights/routes');
    allRoutes = await res.json();
    renderRoutes(allRoutes);
    renderSidebar(allRoutes);
    placeAirports(allRoutes);
  } catch (err) {
    console.error('Route load error:', err);
  }
}

function renderRoutes(routes) {
  // Clear existing
  routeLines.forEach(l => map.removeLayer(l));
  routeLines = [];

  routes.forEach(route => {
    const color = route.hub === 'FQMA' ? '#cc1f36' : '#5bb3e4';
    const line = drawArc(route.fromCoords, route.toCoords, color);
    if (line) {
      routeLines.push(line);
      line.on('mouseover', () => highlightRouteInSidebar(route));
      line.on('click', () => focusRoute(route));
    }
  });
}

function drawArc(from, to, color) {
  // Generate intermediate points for a geodesic arc effect
  const points = geodesicPoints(from, to, 50);
  const line = L.polyline(points, {
    color: color,
    weight: 1.4,
    opacity: 0.55,
    smoothFactor: 1,
    className: 'route-line'
  }).addTo(map);
  return line;
}

/**
 * Compute N intermediate points along a great-circle path
 * This gives accurate geodesic representation (GIS requirement)
 */
function geodesicPoints(from, to, steps) {
  const lat1 = toRad(from[0]), lon1 = toRad(from[1]);
  const lat2 = toRad(to[0]), lon2 = toRad(to[1]);
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
  ));
  if (d === 0) return [from, to];

  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)));
    const lon = toDeg(Math.atan2(y, x));
    pts.push([lat, lon]);
  }
  return pts;
}

function toRad(d) { return d * Math.PI / 180; }
function toDeg(r) { return r * 180 / Math.PI; }

function placeAirports(routes) {
  // Remove old markers
  Object.values(airportMarkers).forEach(m => map.removeLayer(m));
  airportMarkers = {};

  const placed = new Set();

  routes.forEach(route => {
    // Origin hub
    if (!placed.has(route.from)) {
      placed.add(route.from);
      const icon = route.hub === 'FQMA' ? HUB_ICON_MAPUTO : HUB_ICON_ALGIERS;
      const marker = L.marker(route.fromCoords, { icon, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup(hubPopupHTML(route));
      airportMarkers[route.from] = marker;
    }
    // Destination
    if (!placed.has(route.to)) {
      placed.add(route.to);
      const marker = L.marker(route.toCoords, { icon: DEST_ICON })
        .addTo(map)
        .bindPopup(destPopupHTML(route));
      airportMarkers[route.to] = marker;
    }
  });
}

function hubPopupHTML(route) {
  const hubName = route.hub === 'FQMA' ? 'Maputo' : 'Algiers';
  const hubColor = route.hub === 'FQMA' ? '#cc1f36' : '#5bb3e4';
  return `<div style="font-family:Montserrat,sans-serif;min-width:180px;">
    <div style="font-size:0.65rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${hubColor};margin-bottom:4px;">Hub Airport · ${route.hub}</div>
    <div style="font-size:1rem;font-weight:800;color:#1c1c1e;">${hubName} International</div>
    <div style="font-size:0.75rem;color:#6b7a99;margin-top:2px;">Africana Airways Hub</div>
    <a href="booking.html?from=${route.hub}" style="display:block;margin-top:10px;background:${hubColor};color:#ffffff;text-align:center;padding:6px;border-radius:6px;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;text-decoration:none;">Book from ${hubName}</a>
  </div>`;
}

function destPopupHTML(route) {
  return `<div style="font-family:Montserrat,sans-serif;min-width:160px;">
    <div style="font-size:0.65rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9aa3b8;margin-bottom:4px;">Destination</div>
    <div style="font-size:1rem;font-weight:800;color:#1c1c1e;">${route.toCity}</div>
    <div style="font-size:0.75rem;color:#6b7a99;margin-top:2px;">${route.distanceKm.toLocaleString()} km from ${route.fromCity}</div>
    <a href="booking.html?from=${route.from}&to=${route.to}" style="display:block;margin-top:10px;background:#cc1f36;color:#ffffff;text-align:center;padding:6px;border-radius:6px;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;text-decoration:none;">Book this route</a>
  </div>`;
}

function renderSidebar(routes) {
  const list = document.getElementById('routeList');
  const countEl = document.getElementById('routeCount');
  countEl.textContent = `${routes.length} routes across 2 hubs`;

  // Group by hub
  const maputoRoutes = routes.filter(r => r.hub === 'FQMA');
  const algiersRoutes = routes.filter(r => r.hub === 'DAAG');

  let html = '';

  if (maputoRoutes.length) {
    html += `<div class="route-group-label">🔴 Maputo Hub — FQMA (${maputoRoutes.length} routes)</div>`;
    maputoRoutes.forEach(r => { html += routeItemHTML(r); });
  }

  if (algiersRoutes.length) {
    html += `<div class="route-group-label">🔵 Algiers Hub — DAAG (${algiersRoutes.length} routes)</div>`;
    algiersRoutes.forEach(r => { html += routeItemHTML(r); });
  }

  list.innerHTML = html;

  list.querySelectorAll('.route-item').forEach(item => {
    item.addEventListener('click', () => {
      const from = item.dataset.from;
      const to = item.dataset.to;
      const route = allRoutes.find(r => r.from === from && r.to === to);
      if (route) focusRoute(route);
    });
  });
}

function routeItemHTML(r) {
  const dotClass = r.hub === 'FQMA' ? 'dot-maputo' : 'dot-algiers';
  const km = r.distanceKm.toLocaleString();
  const cat = r.distanceKm < 1500 ? 'Regional' : r.distanceKm < 5000 ? 'Short Range' : 'Long Haul';
  return `<div class="route-item" data-from="${r.from}" data-to="${r.to}" id="route-${r.from}-${r.to}">
    <div class="route-hub-dot ${dotClass}"></div>
    <div class="route-info">
      <div class="route-cities">${r.fromCity} → ${r.toCity}</div>
      <div class="route-meta">${r.from} → ${r.to} · ${cat}</div>
    </div>
    <div class="route-dist">${km} km</div>
  </div>`;
}

function focusRoute(route) {
  // Pan to midpoint
  const midLat = (route.fromCoords[0] + route.toCoords[0]) / 2;
  const midLon = (route.fromCoords[1] + route.toCoords[1]) / 2;
  map.flyTo([midLat, midLon], 4, { duration: 1.2 });

  // Open destination popup
  const marker = airportMarkers[route.to];
  if (marker) setTimeout(() => marker.openPopup(), 1000);

  // Highlight in sidebar
  document.querySelectorAll('.route-item').forEach(el => el.classList.remove('highlighted'));
  const el = document.getElementById(`route-${route.from}-${route.to}`);
  if (el) { el.classList.add('highlighted'); el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
}

function highlightRouteInSidebar(route) {
  document.querySelectorAll('.route-item').forEach(el => el.classList.remove('highlighted'));
  const el = document.getElementById(`route-${route.from}-${route.to}`);
  if (el) el.classList.add('highlighted');
}

function filterHub(hub, btn) {
  activeHub = hub;
  document.querySelectorAll('.hub-btn').forEach(b => {
    b.className = 'hub-btn';
  });
  if (hub === 'all') btn.classList.add('active-all');
  else if (hub === 'FQMA') btn.classList.add('active-maputo');
  else btn.classList.add('active-algiers');

  const filtered = hub === 'all' ? allRoutes : allRoutes.filter(r => r.hub === hub);
  renderRoutes(filtered);
  renderSidebar(filtered);
  placeAirports(filtered);
}

// Init
window.addEventListener('DOMContentLoaded', () => {
  initMap();

  // Search filter — attached after DOM is ready
  const searchInput = document.getElementById('routeSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      const q = this.value.toLowerCase();
      document.querySelectorAll('.route-item').forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  }
});
