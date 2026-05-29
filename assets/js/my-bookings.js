// Returns the IATA code for a given ICAO code, falling back to the ICAO code itself.
function toIata(icao) {
  return (window._icaoToIataMap && window._icaoToIataMap[icao]) || icao;
}

// ─── XSS helper ───────────────────────────────────────────────────
/**
 * Escapes a string for safe insertion into HTML by replacing special characters
 * with their HTML entity equivalents. Prevents XSS attacks.
 * @param {*} str - Value to escape (coerced to string)
 * @returns {string} HTML-safe string
 */
// Connection: part of the booking portal lookup, account sync, tab, and card-render flow on this page.
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const bookingGroups = ['confirmed', 'on_time', 'delayed', 'cancelled'];

let accountBookings = [];
let lookedUpBookings = [];
let activePortalTab = 'bookings';

try {
  localStorage.removeItem('afv_recent_bookings');
} catch {
  // Ignore storage access issues.
}

/**
 * Initialises the My Bookings portal page. Reads URL query parameters to pre-fill
 * the lookup form, loads account bookings for signed-in users, performs an automatic
 * lookup if ref and email params are present, and renders all combined bookings.
 * @returns {Promise<void>}
 */
// Connection: part of the booking portal lookup, account sync, tab, and card-render flow on this page.
async function initMyBookings() {
  const params = new URLSearchParams(window.location.search);
  const ref = String(params.get('ref') || '').trim().toUpperCase();
  const email = String(params.get('email') || '').trim().toLowerCase();
  const requestedTab = String(params.get('tab') || 'bookings').trim().toLowerCase();
  activePortalTab = requestedTab === 'ife' ? 'ife' : 'bookings';

  document.getElementById('lookupRef').value = ref;
  document.getElementById('lookupEmail').value = email;

  bindActions();
  bindPortalTabs();
  setPortalTab(activePortalTab, false);
  await loadAccountBookings();

  if (ref && email) {
    await lookupBooking(false);
    return;
  }

  renderAllBookings();
}

/**
 * Attaches click event listeners for the booking lookup button.
 */
// Connection: part of the booking portal lookup, account sync, tab, and card-render flow on this page.
function bindActions() {
  /* Purpose: responds to the click event for the surrounding DOM element. Connection: wires the surrounding UI element into the booking portal lookup, account, and render flow. */ document.getElementById('lookupButton')?.addEventListener('click', () => lookupBooking());
}

/**
 * Attaches click event listeners to all portal tab buttons, wiring them to
 * the setPortalTab function via the data-portal-tab attribute.
 */
// Connection: part of the booking portal lookup, account sync, tab, and card-render flow on this page.
function bindPortalTabs() {
  /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the booking portal lookup, account, and render flow. */ document.querySelectorAll('[data-portal-tab]').forEach(button => {
    /* Purpose: responds to the click event for the surrounding DOM element. Connection: wires the surrounding UI element into the booking portal lookup, account, and render flow. */ button.addEventListener('click', () => setPortalTab(button.dataset.portalTab));
  });
}

/**
 * Loads the authenticated user's bookings from the API using the stored JWT token.
 * Populates the accountBanner with the user's name and email on success.
 * Sets accountBookings to an empty array if no token is present or the request fails.
 * @returns {Promise<void>}
 */
// Connection: part of the booking portal lookup, account sync, tab, and card-render flow on this page.
async function loadAccountBookings() {
  const token = localStorage.getItem('afv_token');
  const banner = document.getElementById('accountBanner');

  if (!token) {
    accountBookings = [];
    banner.textContent = 'Use your booking reference and email, or sign in to load all bookings linked to your account.';
    return;
  }

  try {
    const [meResponse, bookingsResponse] = await Promise.all([
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/bookings/my', { headers: { Authorization: `Bearer ${token}` } })
    ]);

    const me = await meResponse.json();
    const bookings = await bookingsResponse.json();

    if (!meResponse.ok) throw new Error(me.error || 'Could not load your account');
    if (!bookingsResponse.ok) throw new Error(bookings.error || 'Could not load your bookings');

    accountBookings = Array.isArray(bookings) ? bookings : [];
    banner.textContent = `Signed in as ${me.name}. Showing all database bookings linked to ${me.email}.`;
  } catch (error) {
    accountBookings = [];
    banner.textContent = 'Your account could not be loaded right now. You can still use booking ref and email lookup.';
    showToast(error.message || 'Could not load account bookings', 'error');
  }
}

/**
 * Reads the lookup form inputs, fetches the booking by reference and email,
 * merges it with any previously looked-up bookings (deduped), and re-renders.
 * Optionally updates the page URL query string with the ref and email values.
 * @param {boolean} [updateQuery=true] - Whether to push the ref/email into the URL
 * @returns {Promise<void>}
 */
// Connection: part of the booking portal lookup, account sync, tab, and card-render flow on this page.
async function lookupBooking(updateQuery = true) {
  const ref = document.getElementById('lookupRef').value.trim().toUpperCase();
  const email = document.getElementById('lookupEmail').value.trim().toLowerCase();

  if (!ref || !email) {
    showToast('Enter both booking reference and email address.', 'error');
    return;
  }

  try {
    const booking = await fetchBookingLookup(ref, email);
    lookedUpBookings = dedupeBookings([booking, ...lookedUpBookings]);

    if (updateQuery) {
      const params = new URLSearchParams(window.location.search);
      params.set('ref', ref);
      params.set('email', email);
      window.history.replaceState({}, '', `my-bookings.php?${params.toString()}`);
    }

    renderAllBookings(`Booking ${booking.bookingRef} loaded from the database.`);
  } catch (error) {
    renderAllBookings();
    showToast(error.message || 'Booking not found', 'error');
  }
}

/**
 * Fetches a single booking from the API by reference code and passenger email.
 * Throws an error with the API's message if the response is not OK.
 * @param {string} ref - Booking reference code e.g. "AFVX3K9T2R"
 * @param {string} email - Passenger email address
 * @returns {Promise<Object>} The booking object from the API
 */
// Connection: part of the booking portal lookup, account sync, tab, and card-render flow on this page.
async function fetchBookingLookup(ref, email) {
  const response = await fetch(`/api/bookings/lookup?ref=${encodeURIComponent(ref)}&email=${encodeURIComponent(email)}`);
  const booking = await response.json();

  if (!response.ok) {
    throw new Error(booking.error || 'Booking not found');
  }

  return booking;
}

/**
 * Combines looked-up and account bookings (deduped), then renders the full list
 * and the IFE access panel. Accepts an optional override message for the results banner.
 * @param {string} [message=''] - Optional message to display above the results
 */
// Connection: part of the booking portal lookup, account sync, tab, and card-render flow on this page.
function renderAllBookings(message = '') {
  const bookings = combineBookings();
  renderBookings(bookings, message || buildResultsMessage(bookings));
  renderIfeAccess(bookings);
}

/**
 * Merges lookedUpBookings and accountBookings into a single deduplicated array,
 * with looked-up bookings appearing first.
 * @returns {Object[]} Combined, deduped list of booking objects
 */
// Connection: part of the booking portal lookup, account sync, tab, and card-render flow on this page.
function combineBookings() {
  return dedupeBookings([
    ...lookedUpBookings,
    ...accountBookings
  ]);
}

/**
 * Removes duplicate bookings from the list using bookingRef as the unique key.
 * Preserves the order of first occurrence.
 * @param {Object[]} bookings - Array of booking objects, possibly with duplicates
 * @returns {Object[]} Array with duplicates removed
 */
// Connection: part of the booking portal lookup, account sync, tab, and card-render flow on this page.
function dedupeBookings(bookings) {
  const seen = new Set();
  const uniqueBookings = [];

  /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the booking portal lookup, account, and render flow. */ bookings.forEach(booking => {
    const bookingRef = String(booking?.bookingRef || '').trim().toUpperCase();
    if (!bookingRef || seen.has(bookingRef)) return;
    seen.add(bookingRef);
    uniqueBookings.push(booking);
  });

  return uniqueBookings;
}

/**
 * Builds a human-readable message summarising where the displayed bookings came from
 * (account, lookup, or both). Returns an empty-state message if no bookings are present.
 * @param {Object[]} bookings - The combined list of bookings being displayed
 * @returns {string} Summary message string
 */
// Connection: part of the booking portal lookup, account sync, tab, and card-render flow on this page.
function buildResultsMessage(bookings) {
  if (!bookings.length) {
    return 'No bookings found yet. Once a booking is saved, it will appear here from the database.';
  }

  const sources = [];
  if (lookedUpBookings.length) sources.push('the booking you searched for');
  if (accountBookings.length) sources.push('your account');

  if (!sources.length) {
    return `Showing ${bookings.length} booking${bookings.length === 1 ? '' : 's'}.`;
  }

  return `Showing ${bookings.length} booking${bookings.length === 1 ? '' : 's'} from ${joinLabels(sources)}.`;
}

/**
 * Joins an array of label strings into a natural-language list with "and" before
 * the last item (e.g. "a, b, and c" or "a and b").
 * @param {string[]} values - Array of label strings to join
 * @returns {string} Joined string
 */
// Connection: part of the booking portal lookup, account sync, tab, and card-render flow on this page.
function joinLabels(values) {
  if (values.length <= 1) return values[0] || '';
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
}

/**
 * Renders all bookings grouped by status (confirmed, on_time, delayed, cancelled)
 * into their respective section containers. Hides empty sections.
 * @param {Object[]} bookings - Deduplicated list of booking objects to render
 * @param {string} message - Message to display above the booking list
 */
// Connection: part of the booking portal lookup, account sync, tab, and card-render flow on this page.
function renderBookings(bookings, message) {
  clearGroups();
  document.getElementById('resultsMessage').textContent = message || '';

  if (!Array.isArray(bookings) || !bookings.length) {
    return;
  }

  /* Purpose: accumulates collection values into the summary used by the surrounding step. Connection: feeds the surrounding collection pipeline inside the booking portal lookup, account, and render flow. */ const grouped = bookings.reduce((accumulator, booking) => {
    const status = booking.status || 'confirmed';
    const collection = accumulator[status] || [];
    collection.push(booking);
    accumulator[status] = collection;
    return accumulator;
  }, {});

  /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the booking portal lookup, account, and render flow. */ bookingGroups.forEach(status => {
    const container = document.getElementById(`group-${status}`);
    const section = document.getElementById(`section-${status}`);
    const items = grouped[status] || [];

    if (!items.length) {
      container.innerHTML = '';
      section.style.display = 'none';
      return;
    }

    section.style.display = '';
    container.innerHTML = items.map(renderBookingCard).join('');
  });
}

/**
 * Renders the Africana IFE access panel with cards for each non-cancelled booking.
 * Each card links to ife.html with the booking ref and passenger email pre-filled.
 * @param {Object[]} bookings - Combined list of bookings; cancelled ones are excluded
 */
// Connection: part of the booking portal lookup, account sync, tab, and card-render flow on this page.
function renderIfeAccess(bookings) {
  const list = document.getElementById('ifeAccessList');
  const message = document.getElementById('ifeAccessMessage');
  if (!list || !message) return;

  /* Purpose: filters the current collection down to the items needed by the surrounding step. Connection: feeds the surrounding collection pipeline inside the booking portal lookup, account, and render flow. */ const accessibleBookings = (bookings || []).filter(booking => booking.status !== 'cancelled');

  if (!accessibleBookings.length) {
    list.innerHTML = '';
    message.textContent = 'Load a confirmed booking to unlock Africana IFE from the database.';
    return;
  }

  message.textContent = `Africana IFE is ready for ${accessibleBookings.length} booking${accessibleBookings.length === 1 ? '' : 's'}.`;
  /* Purpose: transforms each item in the current collection for the surrounding render or data step. Connection: feeds the surrounding collection pipeline inside the booking portal lookup, account, and render flow. */ list.innerHTML = accessibleBookings.map(booking => {
    const email = booking.passengerEmail || booking.passengerDetails?.[0]?.email || '';
    const href = `ife.php?ref=${encodeURIComponent(booking.bookingRef)}&email=${encodeURIComponent(email)}`;
    const passengerName = [
      booking.passengerDetails?.[0]?.firstName || '',
      booking.passengerDetails?.[0]?.lastName || ''
    ].join(' ').trim() || booking.userName || 'Passenger';

    return `
      <article class="ife-access-card">
        <span class="ife-access-label">${escapeHtml(formatStatus(booking.status))}</span>
        <h2 class="ife-access-title">${escapeHtml(booking.bookingRef)}</h2>
        <p class="ife-access-copy">${escapeHtml(passengerName)} on ${escapeHtml(toIata(booking.from))} → ${escapeHtml(toIata(booking.to))} in ${escapeHtml(capitalise(booking.cabinClass))}.</p>
        <a class="btn btn-primary" href="${href}">Open Africana IFE</a>
      </article>
    `;
  }).join('');
}

/**
 * Builds the HTML string for a single booking card, including PNR, status pill,
 * passenger name, route, date, cabin/seat, total price, and per-segment flight details.
 * @param {Object} booking - Booking object from the API
 * @returns {string} HTML string for the booking card element
 */
// Connection: part of the booking portal lookup, account sync, tab, and card-render flow on this page.
function renderBookingCard(booking) {
  /* Purpose: transforms each item in the current collection for the surrounding render or data step. Connection: feeds the surrounding collection pipeline inside the booking portal lookup, account, and render flow. */ const segments = (booking.itinerary?.segments || []).map(segment => `
    <div class="booking-meta-row">
      <span>${escapeHtml(segment.flightNumber)}</span>
      <span>${escapeHtml(toIata(segment.from))} → ${escapeHtml(toIata(segment.to))} | ${escapeHtml(segment.departure)} → ${escapeHtml(segment.arrival)}</span>
    </div>
  `).join('');

  const firstName = escapeHtml(booking.passengerDetails?.[0]?.firstName || '');
  const lastName  = escapeHtml(booking.passengerDetails?.[0]?.lastName  || '');

  return `<div class="booking-card">
    <div class="booking-card-head">
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;">
        <div>
          <div style="font-family:var(--font-heading);font-size:0.74rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.55);margin-bottom:6px;">PNR</div>
          <div style="font-family:var(--font-heading);font-size:1.2rem;font-weight:800;">${escapeHtml(booking.bookingRef)}</div>
        </div>
        <span class="status-pill status-${escapeHtml(booking.status)}">${escapeHtml(formatStatus(booking.status))}</span>
      </div>
    </div>
    <div class="booking-card-body">
      <div class="booking-meta-row">
        <span>Passenger</span>
        <span>${firstName} ${lastName}</span>
      </div>
      <div class="booking-meta-row">
        <span>Route</span>
        <span>${escapeHtml(toIata(booking.from))} → ${escapeHtml(toIata(booking.to))}</span>
      </div>
      <div class="booking-meta-row">
        <span>Date</span>
        <span>${escapeHtml(formatDate(booking.date))}</span>
      </div>
      <div class="booking-meta-row">
        <span>Cabin / Seat</span>
        <span>${escapeHtml(capitalise(booking.cabinClass))} / ${escapeHtml(booking.seat || 'Seat TBD')}</span>
      </div>
      <div class="booking-meta-row">
        <span>Total</span>
        <span>$${Number(booking.totalPrice || 0).toFixed(0)}</span>
      </div>
      ${segments}
    </div>
  </div>`;
}

/**
 * Switches the active portal tab between 'bookings' and 'ife', updates button
 * active states, shows/hides the corresponding panels, and optionally updates
 * the URL query string with the new tab value.
 * @param {string} tab - The tab to activate: 'bookings' or 'ife'
 * @param {boolean} [updateQuery=true] - Whether to update the URL query string
 */
// Connection: part of the booking portal lookup, account sync, tab, and card-render flow on this page.
function setPortalTab(tab, updateQuery = true) {
  activePortalTab = tab === 'ife' ? 'ife' : 'bookings';

  /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the booking portal lookup, account, and render flow. */ document.querySelectorAll('[data-portal-tab]').forEach(button => {
    button.classList.toggle('active', button.dataset.portalTab === activePortalTab);
  });

  document.getElementById('portalPanelBookings')?.classList.toggle('hidden', activePortalTab !== 'bookings');
  document.getElementById('portalPanelIfe')?.classList.toggle('hidden', activePortalTab !== 'ife');

  if (updateQuery) {
    const params = new URLSearchParams(window.location.search);
    params.set('tab', activePortalTab);
    const nextQuery = params.toString();
    window.history.replaceState({}, '', nextQuery ? `my-bookings.php?${nextQuery}` : 'my-bookings.php');
  }
}

/**
 * Clears all booking group containers and hides their parent sections,
 * resetting the UI before a fresh render pass.
 */
// Connection: part of the booking portal lookup, account sync, tab, and card-render flow on this page.
function clearGroups() {
  /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the booking portal lookup, account, and render flow. */ bookingGroups.forEach(status => {
    document.getElementById(`group-${status}`).innerHTML = '';
    document.getElementById(`section-${status}`).style.display = 'none';
  });
}

/**
 * Capitalises the first character of a string and returns the rest unchanged.
 * Returns an empty string for falsy input.
 * @param {string} value - Input string
 * @returns {string} String with first letter capitalised
 */
// Connection: part of the booking portal lookup, account sync, tab, and card-render flow on this page.
function capitalise(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
}

/**
 * Converts a raw booking status string (e.g. "on_time") into a human-readable
 * label (e.g. "On Time") by splitting on underscores and capitalising each word.
 * @param {string} status - Raw status string from the API
 * @returns {string} Display-friendly status label
 */
// Connection: part of the booking portal lookup, account sync, tab, and card-render flow on this page.
function formatStatus(status) {
  return String(status || 'confirmed')
    .split('_')
    .map(capitalise)
    .join(' ');
}

/**
 * Formats a date string (e.g. "2025-06-15") into a human-readable date using
 * the en-GB locale with weekday, month, day, and year components.
 * @param {string} value - ISO date string or partial date e.g. "2025-06-15"
 * @returns {string} Formatted date string e.g. "Sun, 15 Jun 2025"
 */
// Connection: part of the booking portal lookup, account sync, tab, and card-render flow on this page.
function formatDate(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Displays a toast notification with the given message and optional type class.
 * The toast is automatically hidden after 3.5 seconds.
 * @param {string} message - The text to display in the toast
 * @param {string} [type=''] - Optional CSS class to apply (e.g. 'error', 'success')
 */
// Connection: part of the booking portal lookup, account sync, tab, and card-render flow on this page.
function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast show ${type}`;
  /* Purpose: runs delayed follow-up logic after the surrounding timeout expires. Connection: continues the booking portal lookup, account, and render flow after a controlled delay. */ setTimeout(() => toast.classList.remove('show'), 3500);
}

initMyBookings();

window.lookupBooking = lookupBooking;
