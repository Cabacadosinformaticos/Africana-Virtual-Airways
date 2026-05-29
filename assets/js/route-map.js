/**
 * route-map.js — Re-exported utility for embedding route arcs in any page
 * The full interactive map logic lives in live-map.js (routes page)
 * This module provides a lightweight version for use in booking/search pages
 */

/**
 * Draw a mini route preview map in a given container element ID
 * @param {string} containerId
 * @param {Array} fromCoords [lat, lon]
 * @param {Array} toCoords [lat, lon]
 * @param {string} fromCity
 * @param {string} toCity
 */
// Connection: reusable mini-map helper used by booking and search-style pages that embed route previews.
function drawRoutePreview(containerId, fromCoords, toCoords, fromCity, toCity) {
  if (typeof L === 'undefined') return;
  const container = document.getElementById(containerId);
  if (!container) return;

  const midLat = (fromCoords[0] + toCoords[0]) / 2;
  const midLon = (fromCoords[1] + toCoords[1]) / 2;

  const map = L.map(containerId, {
    center: [midLat, midLon],
    zoom: 3,
    zoomControl: false,
    scrollWheelZoom: false,
    attributionControl: false
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd'
  }).addTo(map);

  // Great circle arc
  const pts = _gcPoints(fromCoords, toCoords, 40);
  L.polyline(pts, { color: '#cc1f36', weight: 2, opacity: 0.8 }).addTo(map);

  // Markers
  // Connection: reusable mini-map helper used by booking and search-style pages that embed route previews.
  const dotStyle = (color) => L.divIcon({
    className: '',
    html: `<div style="width:10px;height:10px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.5)"></div>`,
    iconSize: [10, 10], iconAnchor: [5, 5]
  });

  L.marker(fromCoords, { icon: dotStyle('#cc1f36') }).addTo(map).bindPopup(fromCity);
  L.marker(toCoords,   { icon: dotStyle('#fff') }).addTo(map).bindPopup(toCity);

  return map;
}

/**
 * Generates great-circle points for the lightweight embedded preview map. This
 * is the math helper used only by drawRoutePreview() so booking/search pages can
 * reuse the same curved route visual without loading the full live-map module.
 * @param {number[]} from - Origin coordinates as [lat, lon]
 * @param {number[]} to - Destination coordinates as [lat, lon]
 * @param {number} steps - Number of interpolated points to generate
 * @returns {number[][]} Array of [lat, lon] points for the preview arc
 */
// Connection: reusable mini-map helper used by booking and search-style pages that embed route previews.
function _gcPoints(from, to, steps) {
  /* Purpose: handles the surrounding callback logic for this expression. Connection: participates in embedded route-preview rendering on booking-style pages. */ const r = d => d * Math.PI / 180;
  /* Purpose: handles the surrounding callback logic for this expression. Connection: participates in embedded route-preview rendering on booking-style pages. */ const d2 = r2 => r2 * 180 / Math.PI;
  const lat1 = r(from[0]), lon1 = r(from[1]);
  const lat2 = r(to[0]),   lon2 = r(to[1]);
  const dist = 2 * Math.asin(Math.sqrt(
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
  ));
  if (!dist) return [from, to];
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * dist) / Math.sin(dist);
    const B = Math.sin(f * dist) / Math.sin(dist);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    pts.push([d2(Math.atan2(z, Math.sqrt(x * x + y * y))), d2(Math.atan2(y, x))]);
  }
  return pts;
}

if (typeof module !== 'undefined') module.exports = { drawRoutePreview };
