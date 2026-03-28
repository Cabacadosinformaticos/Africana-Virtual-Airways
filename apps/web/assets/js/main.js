/**
 * Africana Virtual Airways — Main Site JavaScript
 * Handles: navbar, search form, mini map, auth modal, VATSIM online count
 */

// ─── Navbar scroll effect ─────────────────────────────────────────
const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
}

// ─── Mobile nav toggle ────────────────────────────────────────────
const PUBLIC_NAV_ITEMS = [
  {
    id: 'home',
    href: 'index.html',
    label: 'Home',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>'
  },
  {
    id: 'routes',
    href: 'routes.html',
    label: 'Routes',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>'
  },
  {
    id: 'fleet',
    href: 'fleet.html',
    label: 'Fleet',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>'
  },
  {
    id: 'live',
    href: 'vatsim.html',
    label: 'Live',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.5l-8.2-2.73V6.5a1.8 1.8 0 0 0-3.6 0v7.27L2 16.5v2l8.2-1.3V21l-2.4 1.5V24l4.2-1 4.2 1v-1.5L13.8 21v-3.8l8.2 1.3z"/></svg>'
  },
  {
    id: 'entertainment',
    href: 'ife.html',
    label: 'Entertainment',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>'
  },
  {
    id: 'about',
    href: 'about.html',
    label: 'About',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
  },
  {
    id: 'book',
    href: 'booking.html',
    label: 'Book Now',
    className: 'nav-link-book',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M13 5v2M13 11v2M13 17v2"/></svg>'
  },
  {
    id: 'my-bookings',
    href: 'my-bookings.html',
    label: 'My Bookings',
    className: 'nav-link-portal',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16v14H4z"/><path d="M8 2v8M16 2v8M7 11h10M7 15h6"/></svg>'
  }
];

function getCurrentPageName() {
  const page = window.location.pathname.split('/').pop();
  return page && page.includes('.') ? page : 'index.html';
}

function getActiveNavId() {
  const page = getCurrentPageName();

  if (page === 'routes.html') return 'routes';
  if (page === 'fleet.html') return 'fleet';
  if (page === 'vatsim.html') return 'live';
  if (page === 'ife.html') return 'entertainment';
  if (page === 'about.html') return 'about';
  if (page === 'booking.html' || page === 'search-results.html') return 'book';
  if (page === 'my-bookings.html') return 'my-bookings';
  return 'home';
}

function renderSharedNavbar() {
  const navLinks = document.getElementById('navLinks');
  const navActions = document.querySelector('.nav-actions');
  if (!navLinks) return;

  const activeId = getActiveNavId();
  navLinks.innerHTML = PUBLIC_NAV_ITEMS.map(item => {
    const classes = [item.id === activeId ? 'active' : '', item.className || '']
      .filter(Boolean)
      .join(' ');

    return `
      <li>
        <a href="${item.href}" class="${classes}">
          ${item.icon}
          ${item.label}
        </a>
      </li>
    `;
  }).join('');

  if (navActions) {
    navActions.innerHTML = `
      <button class="nav-toggle" id="navToggle" aria-label="Menu" aria-expanded="false" type="button">
        <span></span><span></span><span></span>
      </button>
    `;
  }
}

function initMobileNavToggle() {
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  if (!navToggle || !navLinks) return;

  navToggle.addEventListener('click', event => {
    event.stopPropagation();
    const isOpen = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('click', event => {
    if (!navToggle.contains(event.target) && !navLinks.contains(event.target)) {
      navLinks.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

// ─── Airport Autocomplete ─────────────────────────────────────────
let _allAirports = [];

async function populateAirports() {
  try {
    const res  = await fetch('/api/flights/airports');
    const data = await res.json();
    _allAirports = Object.values(data).sort((a, b) => a.city.localeCompare(b.city));

    const fromText = document.getElementById('fromAirportText');
    const toText   = document.getElementById('toAirportText');
    if (!fromText || !toText) return;

    initAirportAC(fromText, document.getElementById('fromAirport'), document.getElementById('fromDropdown'));
    initAirportAC(toText,   document.getElementById('toAirport'),   document.getElementById('toDropdown'));

    // Pre-fill from URL params
    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get('from');
    const toParam   = params.get('to');
    if (fromParam) setAirportValue(fromText, document.getElementById('fromAirport'), fromParam);
    if (toParam)   setAirportValue(toText,   document.getElementById('toAirport'),   toParam);
  } catch (err) {
    console.error('Airport load error:', err);
  }
}

function filterAirports(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return _allAirports
    .filter(a =>
      a.icao.toLowerCase().includes(q) ||
      (a.iata && a.iata.toLowerCase().includes(q)) ||
      a.city.toLowerCase().includes(q) ||
      a.country.toLowerCase().includes(q) ||
      (a.name && a.name.toLowerCase().includes(q))
    )
    .sort((a, b) => {
      const aScore = rankAirport(a, q);
      const bScore = rankAirport(b, q);
      return aScore - bScore;
    })
    .slice(0, 8);
}

function rankAirport(a, q) {
  if (a.icao.toLowerCase() === q) return 0;
  if (a.iata && a.iata.toLowerCase() === q) return 1;
  if (a.city.toLowerCase().startsWith(q)) return 2;
  if (a.icao.toLowerCase().startsWith(q)) return 3;
  return 4;
}

function setAirportValue(textEl, hiddenEl, icao) {
  const airport = _allAirports.find(a => a.icao === icao);
  if (airport) {
    textEl.value   = `${airport.city} (${airport.icao})`;
    hiddenEl.value = airport.icao;
  }
}

function initAirportAC(textEl, hiddenEl, dropdownEl) {
  let highlighted = -1;

  function renderDropdown(airports) {
    if (!airports.length) { dropdownEl.classList.remove('open'); return; }
    dropdownEl.innerHTML = airports.map((a, i) => `
      <div class="ac-item" data-icao="${a.icao}" data-idx="${i}">
        <span class="ac-item-icao">${a.icao}</span>
        <div class="ac-item-body">
          <span class="ac-item-city">${a.city}</span>
          <span class="ac-item-country">${a.country}</span>
        </div>
      </div>`).join('');
    highlighted = -1;
    dropdownEl.classList.add('open');

    dropdownEl.querySelectorAll('.ac-item').forEach(item => {
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        selectAirport(item.dataset.icao);
      });
    });
  }

  function selectAirport(icao) {
    const airport = _allAirports.find(a => a.icao === icao);
    if (!airport) return;
    textEl.value   = `${airport.city} (${airport.icao})`;
    hiddenEl.value = airport.icao;
    dropdownEl.classList.remove('open');
    highlighted = -1;
  }

  function updateHighlight(items) {
    items.forEach((el, i) => el.classList.toggle('highlighted', i === highlighted));
    if (highlighted >= 0 && items[highlighted]) {
      items[highlighted].scrollIntoView({ block: 'nearest' });
    }
  }

  textEl.addEventListener('input', () => {
    hiddenEl.value = '';
    renderDropdown(filterAirports(textEl.value));
  });

  textEl.addEventListener('keydown', e => {
    const items = [...dropdownEl.querySelectorAll('.ac-item')];
    if (!dropdownEl.classList.contains('open')) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlighted = Math.min(highlighted + 1, items.length - 1);
      updateHighlight(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlighted = Math.max(highlighted - 1, 0);
      updateHighlight(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlighted >= 0 && items[highlighted]) {
        selectAirport(items[highlighted].dataset.icao);
      }
    } else if (e.key === 'Escape') {
      dropdownEl.classList.remove('open');
    }
  });

  textEl.addEventListener('focus', () => {
    if (textEl.value) renderDropdown(filterAirports(textEl.value));
  });

  textEl.addEventListener('blur', () => {
    setTimeout(() => dropdownEl.classList.remove('open'), 150);
  });
}

// Set minimum date to today
const dateEl = document.getElementById('travelDate');
const returnDateEl = document.getElementById('returnDate');
const returnDateGroup = document.getElementById('returnDateGroup');

if (dateEl) {
  const today = new Date();
  const defaultDate = new Date(today.getTime() + 7 * 86400000);
  const todayStr = today.toISOString().split('T')[0];
  dateEl.min = todayStr;
  dateEl.value = defaultDate.toISOString().split('T')[0];

  if (returnDateEl) {
    returnDateEl.min = dateEl.value;
    // Keep return date min in sync with departure date
    dateEl.addEventListener('change', () => {
      returnDateEl.min = dateEl.value;
      if (returnDateEl.value && returnDateEl.value <= dateEl.value) {
        returnDateEl.value = '';
      }
    });
  }

  // Pre-fill from URL params (used by "Modify Search" link on search results page)
  const _params = new URLSearchParams(window.location.search);
  const _returnDate = _params.get('returnDate');
  if (_returnDate && returnDateEl) returnDateEl.value = _returnDate;
}

// Trip type toggle
let tripType = 'return'; // matches the active tab default

function setTripType(type, btn) {
  tripType = type;
  document.querySelectorAll('.search-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (returnDateGroup) {
    returnDateGroup.style.display = type === 'return' ? 'block' : 'none';
  }
}

// Initialise return date group visibility to match the default active tab
if (returnDateGroup) returnDateGroup.style.display = 'block';

// Handle search submit
function handleSearch(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  const from = document.getElementById('fromAirport')?.value;
  const to   = document.getElementById('toAirport')?.value;
  const date = document.getElementById('travelDate')?.value;
  const cls  = document.getElementById('cabinClass')?.value;
  const pax  = document.getElementById('passengers')?.value || 1;

  if (!from || !to) { showToast('Please select origin and destination', 'error'); return; }
  if (from === to)  { showToast('Origin and destination cannot be the same', 'error'); return; }

  const searchParams = new URLSearchParams({ from, to, date, class: cls, passengers: pax, tripType });

  if (tripType === 'return') {
    const returnDate = document.getElementById('returnDate')?.value;
    if (!returnDate) { showToast('Please select a return date', 'error'); return; }
    if (returnDate <= date) { showToast('Return date must be after departure date', 'error'); return; }
    searchParams.set('returnDate', returnDate);
  }

  window.location.href = `search-results.html?${searchParams.toString()}`;
}

// ─── Mini Home Map ─────────────────────────────────────────────────
let miniMap;

async function initMiniMap() {
  const container = document.getElementById('miniMap');
  if (!container || typeof L === 'undefined') return;

  miniMap = L.map('miniMap', {
    center: [10, 25],
    zoom: 2,
    zoomControl: false,
    scrollWheelZoom: false,
    dragging: false,
    attributionControl: false
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 10
  }).addTo(miniMap);

  try {
    const res = await fetch('/api/flights/routes');
    const routes = await res.json();

    routes.forEach(r => {
      const color = r.hub === 'FQMA' ? '#cc1f36' : '#5bb3e4';
      const pts = geodesicPoints(r.fromCoords, r.toCoords, 30);
      L.polyline(pts, { color, weight: 1.2, opacity: 0.5 }).addTo(miniMap);
    });

    // Hub markers
    L.circleMarker([-25.9208, 32.5725], { radius: 7, fillColor: '#cc1f36', fillOpacity: 1, color: '#fff', weight: 2 })
      .addTo(miniMap).bindPopup('<strong>Maputo Hub</strong><br/>FQMA · Mozambique');
    L.circleMarker([36.6910, 3.2154], { radius: 7, fillColor: '#5bb3e4', fillOpacity: 1, color: '#fff', weight: 2 })
      .addTo(miniMap).bindPopup('<strong>Algiers Hub</strong><br/>DAAG · Algeria');

  } catch (err) {
    console.warn('Mini map route load error:', err);
  }
}

function geodesicPoints(from, to, steps) {
  const toRad = d => d * Math.PI / 180;
  const toDeg = r => r * 180 / Math.PI;
  const lat1 = toRad(from[0]), lon1 = toRad(from[1]);
  const lat2 = toRad(to[0]),   lon2 = toRad(to[1]);
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
    pts.push([toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), toDeg(Math.atan2(y, x))]);
  }
  return pts;
}

// ─── VATSIM Online Count ──────────────────────────────────────────
async function loadVatsimCount() {
  const el = document.getElementById('onlineCount');
  if (!el) return;
  try {
    const res = await fetch('/api/vatsim/online');
    const data = await res.json();
    el.textContent = `${data.count} AFV pilots online right now on VATSIM`;
  } catch {
    el.textContent = 'Connect to VATSIM to see live pilots';
  }
}

// ─── Auth Modal ───────────────────────────────────────────────────
function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('afv_user') || 'null');
  } catch {
    return null;
  }
}

const ADMIN_SECRET_WORD = ['afv', 'admin'].join('');
let adminSecretBuffer = '';

function ensureAdminModal() {
  if (document.getElementById('adminAccessModal')) return;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div id="adminAccessModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.68);z-index:2000;backdrop-filter:blur(6px);align-items:center;justify-content:center;">
      <div style="background:var(--white);border-radius:var(--radius-xl);padding:40px;max-width:430px;width:90%;box-shadow:var(--shadow-xl);position:relative;">
        <button id="closeAdminButton" type="button" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:1.4rem;color:var(--gray-400);cursor:pointer;">x</button>
        <div style="text-align:center;margin-bottom:28px;">
          <div class="section-tag">Restricted Access</div>
          <h2 style="font-size:1.6rem;margin-top:8px;">Admin Sign In</h2>
          <p style="margin:10px 0 0;color:var(--gray-500);font-size:0.9rem;">Type the secret word to unlock this panel, then continue with your admin account.</p>
        </div>
        <div id="adminError" class="hidden" style="background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;padding:10px 14px;border-radius:8px;font-size:0.85rem;margin-bottom:16px;"></div>
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div class="form-group">
            <label>Admin Email</label>
            <input type="email" class="form-control" id="adminEmail" placeholder="admin@africana-airways.com" />
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" class="form-control" id="adminPassword" placeholder="Enter admin password" />
          </div>
          <button class="btn btn-primary" id="submitAdminButton" type="button" style="width:100%;justify-content:center;">Enter Back Office</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(wrapper.firstElementChild);
}

function openAdminModal() {
  ensureAdminModal();
  const modal = document.getElementById('adminAccessModal');
  const errorEl = document.getElementById('adminError');
  const emailInput = document.getElementById('adminEmail');
  const passwordInput = document.getElementById('adminPassword');

  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }
  if (emailInput) emailInput.value = '';
  if (passwordInput) passwordInput.value = '';
  if (modal) modal.style.display = 'flex';
  if (emailInput) emailInput.focus();
}

function closeAdminModal() {
  const modal = document.getElementById('adminAccessModal');
  if (modal) modal.style.display = 'none';
}

function isEditableTarget(target) {
  return target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable;
}

function bindAdminSecretTrigger() {
  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') {
      adminSecretBuffer = '';
      closeAdminModal();
      return;
    }
    if (event.key.length !== 1 || isEditableTarget(event.target)) return;

    adminSecretBuffer = `${adminSecretBuffer}${event.key.toLowerCase()}`.slice(-ADMIN_SECRET_WORD.length);
    if (adminSecretBuffer === ADMIN_SECRET_WORD) {
      adminSecretBuffer = '';
      openAdminModal();
    }
  });
}

async function handleAdminLogin() {
  ensureAdminModal();
  const email = document.getElementById('adminEmail')?.value?.trim();
  const password = document.getElementById('adminPassword')?.value;
  const errorEl = document.getElementById('adminError');
  if (!email || !password) {
    if (errorEl) {
      errorEl.textContent = 'Please fill in both admin fields.';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    if (data.user?.role !== 'admin') throw new Error('This account does not have admin access.');

    localStorage.setItem('afv_token', data.token);
    localStorage.setItem('afv_user', JSON.stringify(data.user));
    closeAdminModal();
    showToast(`Admin access granted, ${data.user.name}.`, 'success');
    setTimeout(() => window.location.href = 'admin.html', 700);
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
    }
  }
}

function openLoginModal() {
  openAdminModal();
}

function closeLoginModal() {
  closeAdminModal();
}

function switchToRegister() {
  closeAdminModal();
}

async function handleLogin() {
  await handleAdminLogin();
}

document.addEventListener('click', event => {
  const modal = document.getElementById('adminAccessModal');
  if (modal && event.target === modal) closeAdminModal();
});

// ─── Toast ────────────────────────────────────────────────────────
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => t.classList.remove('show'), 3500);
}

// ─── Init ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderSharedNavbar();
  initMobileNavToggle();
  ensureAdminModal();
  bindAdminSecretTrigger();

  const searchForm = document.getElementById('searchForm');
  if (searchForm) {
    searchForm.addEventListener('submit', handleSearch);
  }

  document.querySelectorAll('[data-trip-type]').forEach(button => {
    button.addEventListener('click', () => setTripType(button.dataset.tripType, button));
  });

  const closeAdminButton = document.getElementById('closeAdminButton');
  if (closeAdminButton) {
    closeAdminButton.addEventListener('click', closeAdminModal);
  }

  const submitAdminButton = document.getElementById('submitAdminButton');
  if (submitAdminButton) {
    submitAdminButton.addEventListener('click', handleAdminLogin);
  }

  const adminPasswordInput = document.getElementById('adminPassword');
  if (adminPasswordInput) {
    adminPasswordInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleAdminLogin();
      }
    });
  }

  populateAirports();
  initMiniMap();
  loadVatsimCount();
});

// Expose handlers for inline HTML attributes as a fallback.
window.setTripType = setTripType;
window.handleSearch = handleSearch;
window.openLoginModal = openAdminModal;
window.closeLoginModal = closeAdminModal;
window.switchToRegister = switchToRegister;
window.handleLogin = handleAdminLogin;
window.openAdminModal = openAdminModal;
window.closeAdminModal = closeAdminModal;
window.handleAdminLogin = handleAdminLogin;
