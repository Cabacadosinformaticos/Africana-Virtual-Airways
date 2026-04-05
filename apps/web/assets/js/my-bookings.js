// ─── XSS helper ───────────────────────────────────────────────────
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

function bindActions() {
  document.getElementById('lookupButton')?.addEventListener('click', () => lookupBooking());
}

function bindPortalTabs() {
  document.querySelectorAll('[data-portal-tab]').forEach(button => {
    button.addEventListener('click', () => setPortalTab(button.dataset.portalTab));
  });
}

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
      window.history.replaceState({}, '', `my-bookings.html?${params.toString()}`);
    }

    renderAllBookings(`Booking ${booking.bookingRef} loaded from the database.`);
  } catch (error) {
    renderAllBookings();
    showToast(error.message || 'Booking not found', 'error');
  }
}

async function fetchBookingLookup(ref, email) {
  const response = await fetch(`/api/bookings/lookup?ref=${encodeURIComponent(ref)}&email=${encodeURIComponent(email)}`);
  const booking = await response.json();

  if (!response.ok) {
    throw new Error(booking.error || 'Booking not found');
  }

  return booking;
}

function renderAllBookings(message = '') {
  const bookings = combineBookings();
  renderBookings(bookings, message || buildResultsMessage(bookings));
  renderIfeAccess(bookings);
}

function combineBookings() {
  return dedupeBookings([
    ...lookedUpBookings,
    ...accountBookings
  ]);
}

function dedupeBookings(bookings) {
  const seen = new Set();
  const uniqueBookings = [];

  bookings.forEach(booking => {
    const bookingRef = String(booking?.bookingRef || '').trim().toUpperCase();
    if (!bookingRef || seen.has(bookingRef)) return;
    seen.add(bookingRef);
    uniqueBookings.push(booking);
  });

  return uniqueBookings;
}

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

function joinLabels(values) {
  if (values.length <= 1) return values[0] || '';
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
}

function renderBookings(bookings, message) {
  clearGroups();
  document.getElementById('resultsMessage').textContent = message || '';

  if (!Array.isArray(bookings) || !bookings.length) {
    return;
  }

  const grouped = bookings.reduce((accumulator, booking) => {
    const status = booking.status || 'confirmed';
    const collection = accumulator[status] || [];
    collection.push(booking);
    accumulator[status] = collection;
    return accumulator;
  }, {});

  bookingGroups.forEach(status => {
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

function renderIfeAccess(bookings) {
  const list = document.getElementById('ifeAccessList');
  const message = document.getElementById('ifeAccessMessage');
  if (!list || !message) return;

  const accessibleBookings = (bookings || []).filter(booking => booking.status !== 'cancelled');

  if (!accessibleBookings.length) {
    list.innerHTML = '';
    message.textContent = 'Load a confirmed booking to unlock Africana IFE from the database.';
    return;
  }

  message.textContent = `Africana IFE is ready for ${accessibleBookings.length} booking${accessibleBookings.length === 1 ? '' : 's'}.`;
  list.innerHTML = accessibleBookings.map(booking => {
    const email = booking.passengerEmail || booking.passengerDetails?.[0]?.email || '';
    const href = `ife.html?ref=${encodeURIComponent(booking.bookingRef)}&email=${encodeURIComponent(email)}`;
    const passengerName = [
      booking.passengerDetails?.[0]?.firstName || '',
      booking.passengerDetails?.[0]?.lastName || ''
    ].join(' ').trim() || booking.userName || 'Passenger';

    return `
      <article class="ife-access-card">
        <span class="ife-access-label">${escapeHtml(formatStatus(booking.status))}</span>
        <h2 class="ife-access-title">${escapeHtml(booking.bookingRef)}</h2>
        <p class="ife-access-copy">${escapeHtml(passengerName)} on ${escapeHtml(booking.from)} -> ${escapeHtml(booking.to)} in ${escapeHtml(capitalise(booking.cabinClass))}.</p>
        <a class="btn btn-primary" href="${href}">Open Africana IFE</a>
      </article>
    `;
  }).join('');
}

function renderBookingCard(booking) {
  const segments = (booking.itinerary?.segments || []).map(segment => `
    <div class="booking-meta-row">
      <span>${escapeHtml(segment.flightNumber)}</span>
      <span>${escapeHtml(segment.from)} → ${escapeHtml(segment.to)} | ${escapeHtml(segment.departure)} → ${escapeHtml(segment.arrival)}</span>
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
        <span>${escapeHtml(booking.from)} → ${escapeHtml(booking.to)}</span>
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

function setPortalTab(tab, updateQuery = true) {
  activePortalTab = tab === 'ife' ? 'ife' : 'bookings';

  document.querySelectorAll('[data-portal-tab]').forEach(button => {
    button.classList.toggle('active', button.dataset.portalTab === activePortalTab);
  });

  document.getElementById('portalPanelBookings')?.classList.toggle('hidden', activePortalTab !== 'bookings');
  document.getElementById('portalPanelIfe')?.classList.toggle('hidden', activePortalTab !== 'ife');

  if (updateQuery) {
    const params = new URLSearchParams(window.location.search);
    params.set('tab', activePortalTab);
    const nextQuery = params.toString();
    window.history.replaceState({}, '', nextQuery ? `my-bookings.html?${nextQuery}` : 'my-bookings.html');
  }
}

function clearGroups() {
  bookingGroups.forEach(status => {
    document.getElementById(`group-${status}`).innerHTML = '';
    document.getElementById(`section-${status}`).style.display = 'none';
  });
}

function capitalise(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
}

function formatStatus(status) {
  return String(status || 'confirmed')
    .split('_')
    .map(capitalise)
    .join(' ');
}

function formatDate(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => toast.classList.remove('show'), 3500);
}

initMyBookings();

window.lookupBooking = lookupBooking;
