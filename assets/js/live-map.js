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

/**
 * Boots the route map page by creating the Leaflet map instance, defining the
 * hub and destination marker icons, adding the tile layer, and kicking off the
 * first route-data fetch through loadRoutes().
 * @returns {void}
 */
// Connection: part of the public route-map page and called by the map render/filter/sidebar flow here.
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

/**
 * Fetches the public route network from /api/flights/routes, then fans the data
 * into renderRoutes(), renderSidebar(), and placeAirports() so the map and list
 * stay in sync.
 * @returns {Promise<void>}
 */
// Connection: part of the public route-map page and called by the map render/filter/sidebar flow here.
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

/**
 * Draws the visible route arcs for the currently active hub filter. This is the
 * map-rendering entry point used after loadRoutes() and every time filterHub()
 * changes the visible subset.
 * @param {Object[]} routes - Route records returned by the public flights API
 * @returns {void}
 */
// Connection: part of the public route-map page and called by the map render/filter/sidebar flow here.
function renderRoutes(routes) {
  // Clear existing
  /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the public route map render and filter flow. */ routeLines.forEach(l => map.removeLayer(l));
  routeLines = [];

  /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the public route map render and filter flow. */ routes.forEach(route => {
    const color = route.hub === 'FQMA' ? '#cc1f36' : '#5bb3e4';
    const line = drawArc(route.fromCoords, route.toCoords, color);
    if (line) {
      routeLines.push(line);
      /* Purpose: handles the surrounding callback logic for this expression. Connection: participates in the public route map render and filter flow. */ line.on('mouseover', () => highlightRouteInSidebar(route));
      /* Purpose: handles the surrounding callback logic for this expression. Connection: participates in the public route map render and filter flow. */ line.on('click', () => focusRoute(route));
    }
  });
}

/**
 * Creates one Leaflet polyline arc between an origin and destination coordinate
 * pair. renderRoutes() uses this helper for every visible route in the network.
 * @param {number[]} from - Origin coordinates as [lat, lon]
 * @param {number[]} to - Destination coordinates as [lat, lon]
 * @param {string} color - Stroke color based on the route hub
 * @returns {L.Polyline} Added Leaflet polyline layer
 */
// Connection: part of the public route-map page and called by the map render/filter/sidebar flow here.
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
// Connection: part of the public route-map page and called by the map render/filter/sidebar flow here.
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

/**
 * Converts map math from degrees to radians for geodesicPoints(), which uses
 * spherical calculations to bend route arcs accurately on the globe.
 * @param {number} d - Angle in degrees
 * @returns {number} Angle in radians
 */
// Connection: part of the public route-map page and called by the map render/filter/sidebar flow here.
function toRad(d) { return d * Math.PI / 180; }

/**
 * Converts map math from radians back to degrees so geodesicPoints() can return
 * Leaflet-friendly latitude/longitude pairs for drawArc().
 * @param {number} r - Angle in radians
 * @returns {number} Angle in degrees
 */
// Connection: part of the public route-map page and called by the map render/filter/sidebar flow here.
function toDeg(r) { return r * 180 / Math.PI; }

/**
 * Places hub and destination markers for the currently visible route set. This
 * is kept separate from renderRoutes() so filterHub() can rebuild markers and
 * route lines together from the same filtered data.
 * @param {Object[]} routes - Route records currently being displayed
 * @returns {void}
 */
// Connection: part of the public route-map page and called by the map render/filter/sidebar flow here.
function placeAirports(routes) {
  Object.values(airportMarkers).forEach(m => map.removeLayer(m));
  airportMarkers = {};

  const placed = new Set();
  const HUB_AIRPORTS = ['FQMA', 'DAAG'];

  // First pass: place hub airports using the first outbound route for each hub,
  // so they always get the correct hub popup regardless of route order.
  const hubRouteMap = {};
  routes.forEach(route => {
    if (HUB_AIRPORTS.includes(route.from) && !hubRouteMap[route.from]) {
      hubRouteMap[route.from] = route;
    }
  });
  Object.entries(hubRouteMap).forEach(([icao, route]) => {
    placed.add(icao);
    const icon = icao === 'FQMA' ? HUB_ICON_MAPUTO : HUB_ICON_ALGIERS;
    const marker = L.marker(route.fromCoords, { icon, zIndexOffset: 1000 })
      .addTo(map)
      .bindPopup(hubPopupHTML(route));
    airportMarkers[icao] = marker;
  });

  // Second pass: place all other airports
  routes.forEach(route => {
    if (!placed.has(route.from)) {
      placed.add(route.from);
      const marker = L.marker(route.fromCoords, { icon: DEST_ICON })
        .addTo(map)
        .bindPopup(airportPopupHTML(route.from, route.fromCity, route.fromIata));
      airportMarkers[route.from] = marker;
    }
    if (!placed.has(route.to)) {
      placed.add(route.to);
      const marker = L.marker(route.toCoords, { icon: DEST_ICON })
        .addTo(map)
        .bindPopup(destPopupHTML(route));
      airportMarkers[route.to] = marker;
    }
  });
}

/**
 * Builds the popup markup for a hub-airport marker, including a CTA into the
 * booking flow. placeAirports() uses this for origin hub markers on the map.
 * @param {Object} route - Route record whose hub metadata should be displayed
 * @returns {string} Popup HTML string for the hub marker
 */
// Connection: part of the public route-map page and called by the map render/filter/sidebar flow here.
function hubPopupHTML(route) {
  const hubName = route.hub === 'FQMA' ? 'Maputo' : 'Algiers';
  const hubColor = route.hub === 'FQMA' ? '#cc1f36' : '#5bb3e4';
  return `<div style="font-family:Montserrat,sans-serif;min-width:180px;">
    <div style="font-size:0.65rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${hubColor};margin-bottom:4px;">Hub Airport · ${route.hubIata || route.hub}</div>
    <div style="font-size:1rem;font-weight:800;color:#1c1c1e;">${hubName} International</div>
    <div style="font-size:0.75rem;color:#6b7a99;margin-top:2px;">Africana Airways Hub</div>
    <a href="index.php?from=${route.hub}" style="display:block;margin-top:10px;background:${hubColor};color:#ffffff;text-align:center;padding:6px;border-radius:6px;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;text-decoration:none;">Book from ${hubName}</a>
  </div>`;
}

/**
 * Builds the popup markup for a destination marker with route distance and a
 * direct booking link. placeAirports() uses this for non-hub airport markers.
 * @param {Object} route - Route record used to describe the destination airport
 * @returns {string} Popup HTML string for the destination marker
 */
// Connection: part of the public route-map page and called by the map render/filter/sidebar flow here.
function destPopupHTML(route) {
  return `<div style="font-family:Montserrat,sans-serif;min-width:160px;">
    <div style="font-size:0.65rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9aa3b8;margin-bottom:4px;">Destination · ${route.toIata || route.to}</div>
    <div style="font-size:1rem;font-weight:800;color:#1c1c1e;">${route.toCity}</div>
    <div style="font-size:0.75rem;color:#6b7a99;margin-top:2px;">${route.distanceKm.toLocaleString()} km from hub</div>
    <a href="index.php?to=${route.to}" style="display:block;margin-top:10px;background:#cc1f36;color:#ffffff;text-align:center;padding:6px;border-radius:6px;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;text-decoration:none;">Book to ${route.toCity}</a>
  </div>`;
}

function airportPopupHTML(icao, city, iata) {
  return `<div style="font-family:Montserrat,sans-serif;min-width:160px;">
    <div style="font-size:0.65rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9aa3b8;margin-bottom:4px;">Airport · ${iata || icao}</div>
    <div style="font-size:1rem;font-weight:800;color:#1c1c1e;">${city}</div>
    <a href="index.php?to=${icao}" style="display:block;margin-top:10px;background:#cc1f36;color:#ffffff;text-align:center;padding:6px;border-radius:6px;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;text-decoration:none;">Book to ${city}</a>
  </div>`;
}

/**
 * Rebuilds the sidebar route list for the current route subset, grouped by hub,
 * and wires each list item back into focusRoute() so the map and list interact.
 * loadRoutes() and filterHub() both feed their visible routes through here.
 * @param {Object[]} routes - Route records to render in the sidebar
 * @returns {void}
 */
// Connection: part of the public route-map page and called by the map render/filter/sidebar flow here.
function renderSidebar(routes) {
  const list = document.getElementById('routeList');
  const countEl = document.getElementById('routeCount');
  countEl.textContent = `${routes.length} routes across 2 hubs`;

  // Group by hub
  /* Purpose: filters the current collection down to the items needed by the surrounding step. Connection: feeds the surrounding collection pipeline inside the public route map render and filter flow. */ const maputoRoutes = routes.filter(r => r.hub === 'FQMA');
  /* Purpose: filters the current collection down to the items needed by the surrounding step. Connection: feeds the surrounding collection pipeline inside the public route map render and filter flow. */ const algiersRoutes = routes.filter(r => r.hub === 'DAAG');

  let html = '';

  if (maputoRoutes.length) {
    html += `<div class="route-group-label">🔴 Maputo Hub (MPM) (${maputoRoutes.length} routes)</div>`;
    /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the public route map render and filter flow. */ maputoRoutes.forEach(r => { html += routeItemHTML(r); });
  }

  if (algiersRoutes.length) {
    html += `<div class="route-group-label">🔵 Algiers Hub (ALG) (${algiersRoutes.length} routes)</div>`;
    /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the public route map render and filter flow. */ algiersRoutes.forEach(r => { html += routeItemHTML(r); });
  }

  list.innerHTML = html;

  /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the public route map render and filter flow. */ list.querySelectorAll('.route-item').forEach(item => {
    /* Purpose: responds to the click event for the surrounding DOM element. Connection: wires the surrounding UI element into the public route map render and filter flow. */ item.addEventListener('click', () => {
      const from = item.dataset.from;
      const to = item.dataset.to;
      /* Purpose: checks each candidate until the surrounding lookup finds its match. Connection: feeds the surrounding collection pipeline inside the public route map render and filter flow. */ const route = allRoutes.find(r => r.from === from && r.to === to);
      if (route) focusRoute(route);
    });
  });
}

/**
 * Produces the sidebar card markup for a single route row. renderSidebar() uses
 * this helper while grouping the visible network into Maputo and Algiers sections.
 * @param {Object} r - Route record to describe in the sidebar
 * @returns {string} HTML string for one sidebar route item
 */
// Connection: part of the public route-map page and called by the map render/filter/sidebar flow here.
function routeItemHTML(r) {
  const dotClass = r.hub === 'FQMA' ? 'dot-maputo' : 'dot-algiers';
  const km = r.distanceKm.toLocaleString();
  const cat = r.distanceKm < 1500 ? 'Regional' : r.distanceKm < 5000 ? 'Short Range' : 'Long Haul';
  return `<div class="route-item" data-from="${r.from}" data-to="${r.to}" id="route-${r.from}-${r.to}">
    <div class="route-hub-dot ${dotClass}"></div>
    <div class="route-info">
      <div class="route-cities">${r.fromCity} → ${r.toCity}</div>
      <div class="route-meta">${r.fromIata || r.from} → ${r.toIata || r.to} · ${cat}</div>
    </div>
    <div class="route-dist">${km} km</div>
  </div>`;
}

/**
 * Moves the map camera to the selected route, opens its destination popup, and
 * synchronises the highlighted sidebar row. Sidebar clicks and arc clicks both
 * route through this shared interaction handler.
 * @param {Object} route - Route record chosen by the user
 * @returns {void}
 */
// Connection: part of the public route-map page and called by the map render/filter/sidebar flow here.
function focusRoute(route) {
  // Pan to midpoint
  const midLat = (route.fromCoords[0] + route.toCoords[0]) / 2;
  const midLon = (route.fromCoords[1] + route.toCoords[1]) / 2;
  map.flyTo([midLat, midLon], 4, { duration: 1.2 });

  // Open destination popup
  const marker = airportMarkers[route.to];
  /* Purpose: runs delayed follow-up logic after the surrounding timeout expires. Connection: continues the public route map render and filter flow after a controlled delay. */ if (marker) setTimeout(() => marker.openPopup(), 1000);

  // Highlight in sidebar
  /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the public route map render and filter flow. */ document.querySelectorAll('.route-item').forEach(el => el.classList.remove('highlighted'));
  const el = document.getElementById(`route-${route.from}-${route.to}`);
  if (el) { el.classList.add('highlighted'); el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
}

/**
 * Applies the temporary sidebar highlight that follows map hover events. The
 * route arc mouseover handler calls this so the matching list row stands out.
 * @param {Object} route - Route record currently being hovered
 * @returns {void}
 */
// Connection: part of the public route-map page and called by the map render/filter/sidebar flow here.
function highlightRouteInSidebar(route) {
  /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the public route map render and filter flow. */ document.querySelectorAll('.route-item').forEach(el => el.classList.remove('highlighted'));
  const el = document.getElementById(`route-${route.from}-${route.to}`);
  if (el) el.classList.add('highlighted');
}

/**
 * Switches the active hub filter, updates the filter-button styling, and then
 * re-renders the lines, markers, and sidebar from the filtered route subset.
 * This powers the hub toggle controls on the route map page.
 * @param {string} hub - Selected hub code or 'all'
 * @param {HTMLButtonElement} btn - Button element that triggered the filter
 * @returns {void}
 */
// Connection: part of the public route-map page and called by the map render/filter/sidebar flow here.
function filterHub(hub, btn) {
  activeHub = hub;
  /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the public route map render and filter flow. */ document.querySelectorAll('.hub-btn').forEach(b => {
    b.className = 'hub-btn';
  });
  if (hub === 'all') btn.classList.add('active-all');
  else if (hub === 'FQMA') btn.classList.add('active-maputo');
  else btn.classList.add('active-algiers');

  /* Purpose: filters the current collection down to the items needed by the surrounding step. Connection: feeds the surrounding collection pipeline inside the public route map render and filter flow. */ const filtered = hub === 'all' ? allRoutes : allRoutes.filter(r => r.hub === hub);
  renderRoutes(filtered);
  renderSidebar(filtered);
  placeAirports(filtered);
}

// Init
/* Purpose: responds to the DOMContentLoaded event for the surrounding DOM element. Connection: wires the surrounding UI element into the public route map render and filter flow. */ window.addEventListener('DOMContentLoaded', () => {
  initMap();

  // Search filter — attached after DOM is ready
  const searchInput = document.getElementById('routeSearchInput');
  if (searchInput) {
    /* Purpose: responds to the input event for the surrounding DOM element. Connection: wires the surrounding UI element into the public route map render and filter flow. */ searchInput.addEventListener('input', function() {
      const q = this.value.toLowerCase();
      /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the public route map render and filter flow. */ document.querySelectorAll('.route-item').forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  }
});
