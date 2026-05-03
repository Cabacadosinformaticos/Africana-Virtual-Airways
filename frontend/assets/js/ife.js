/**
 * Africana Airways — In-Flight Entertainment
 * Handles login (booking ref + email), tab switching, and movie data.
 */

// ── Movie catalogue ───────────────────────────────────────────────
const MOVIES = [
  {
    title:   'Black Panther',
    year:    2018,
    runtime: '2h 14m',
    rating:  7.3,
    genre:   'Action',
    poster:  'linear-gradient(135deg, #1a0533 0%, #2d1b4e 40%, #6b21a8 100%)',
    flag:    '🌍'
  },
  {
    title:   'Tsotsi',
    year:    2005,
    runtime: '1h 34m',
    rating:  7.6,
    genre:   'Drama',
    poster:  'linear-gradient(135deg, #0d1f0d 0%, #1a3a1a 50%, #2d5a2d 100%)',
    flag:    '🇿🇦'
  },
  {
    title:   'Hotel Rwanda',
    year:    2004,
    runtime: '2h 01m',
    rating:  8.1,
    genre:   'Drama',
    poster:  'linear-gradient(135deg, #1a0000 0%, #3d0000 50%, #7a1a00 100%)',
    flag:    '🇷🇼'
  },
  {
    title:   'Atlantics',
    year:    2019,
    runtime: '1h 46m',
    rating:  6.8,
    genre:   'Drama',
    poster:  'linear-gradient(135deg, #001220 0%, #002744 50%, #004080 100%)',
    flag:    '🇸🇳'
  },
  {
    title:   'Timbuktu',
    year:    2014,
    runtime: '1h 37m',
    rating:  7.4,
    genre:   'Drama',
    poster:  'linear-gradient(135deg, #1a1200 0%, #3d2b00 50%, #8a6000 100%)',
    flag:    '🇲🇱'
  },
  {
    title:   'The Gods Must Be Crazy',
    year:    1980,
    runtime: '1h 49m',
    rating:  7.3,
    genre:   'Comedy',
    poster:  'linear-gradient(135deg, #2a1a06 0%, #6b440a 50%, #c07a1a 100%)',
    flag:    '🌍'
  },
  {
    title:   'Lionheart',
    year:    2018,
    runtime: '1h 35m',
    rating:  6.3,
    genre:   'Comedy',
    poster:  'linear-gradient(135deg, #0d0d1a 0%, #1a1a3d 50%, #2d2d7a 100%)',
    flag:    '🇳🇬'
  },
  {
    title:   'Capernaum',
    year:    2018,
    runtime: '2h 06m',
    rating:  8.4,
    genre:   'Drama',
    poster:  'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
    flag:    '🇱🇧'
  },
  {
    title:   'Soul',
    year:    2020,
    runtime: '1h 41m',
    rating:  8.1,
    genre:   'Animation',
    poster:  'linear-gradient(135deg, #001a2e 0%, #003d6b 50%, #0077b6 100%)',
    flag:    '🎵'
  },
  {
    title:   'Coming 2 America',
    year:    2021,
    runtime: '1h 50m',
    rating:  5.3,
    genre:   'Comedy',
    poster:  'linear-gradient(135deg, #2d1500 0%, #6b3300 50%, #c46200 100%)',
    flag:    '🌍'
  },
  {
    title:   'The Woman King',
    year:    2022,
    runtime: '2h 15m',
    rating:  7.0,
    genre:   'Action',
    poster:  'linear-gradient(135deg, #1a0a0a 0%, #3d1515 50%, #7a2a2a 100%)',
    flag:    '🇧🇯'
  },
  {
    title:   'Maborosi',
    year:    1995,
    runtime: '1h 50m',
    rating:  7.8,
    genre:   'Drama',
    poster:  'linear-gradient(135deg, #101020 0%, #1e1e40 50%, #2a2a60 100%)',
    flag:    '🎌'
  }
];

// ── Auth ──────────────────────────────────────────────────────────

const SESSION_KEY = 'afv_ife_session';

/**
 * Stores the verified booking in sessionStorage so restoreSessionOrQueryAccess()
 * can reopen the IFE experience without forcing the passenger to log in again
 * during the same browser session.
 * @param {Object} booking - Verified booking payload returned by the lookup API
 * @returns {void}
 */
// Connection: part of the IFE login, session restore, and tab/content flow on the entertainment page.
function saveSession(booking) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(booking));
}

/**
 * Reads the cached IFE booking session created by saveSession(). This is used by
 * restoreSessionOrQueryAccess() before falling back to URL-based verification.
 * @returns {Object|null} Parsed booking session or null when unavailable/invalid
 */
// Connection: part of the IFE login, session restore, and tab/content flow on the entertainment page.
function loadSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; }
}

/**
 * Verifies a booking reference and email against the guest booking lookup API.
 * Both the login form and the auto-restore flow call this before entering the
 * entertainment interface.
 * @param {string} ref - Booking reference entered by the passenger
 * @param {string} email - Passenger email used for booking lookup
 * @returns {Promise<Object>} Verified booking payload for the IFE session
 */
// Connection: part of the IFE login, session restore, and tab/content flow on the entertainment page.
async function loginWithBooking(ref, email) {
  const res = await fetch(`/api/bookings/lookup?ref=${encodeURIComponent(ref)}&email=${encodeURIComponent(email)}`);
  if (!res.ok) throw new Error(res.status === 404 ? 'Booking not found. Please check your reference and email.' : 'Unable to verify booking. Please try again.');
  return res.json();
}

// ── DOM helpers ───────────────────────────────────────────────────

// Connection: part of the IFE login, session restore, and tab/content flow on the entertainment page.
function showError(msg) {
  const el = document.getElementById('ifeLoginError');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
}

/**
 * Clears the visible login error banner before a new verification attempt.
 * initLogin() and restoreSessionOrQueryAccess() call this to reset the overlay UI.
 * @returns {void}
 */
// Connection: part of the IFE login, session restore, and tab/content flow on the entertainment page.
function hideError() {
  document.getElementById('ifeLoginError')?.classList.remove('visible');
}

/**
 * Switches the page from the login overlay into the main IFE experience. It fills
 * the passenger/flight header, renders the movie catalogue, and lazy-loads the
 * flappy-plane mini-game script the first time access is granted.
 * @param {Object} booking - Verified booking used to personalise the IFE header
 * @returns {void}
 */
// Connection: part of the IFE login, session restore, and tab/content flow on the entertainment page.
function enterIFE(booking) {
  document.getElementById('ifeLoginOverlay').style.display = 'none';
  const content = document.getElementById('ifeContent');
  content.classList.add('visible');

  // Populate flight header
  const firstName = (booking.passengerDetails?.[0]?.firstName || booking.userName || 'Passenger').split(' ')[0];
  document.getElementById('ifePassengerName').textContent = firstName;
  document.getElementById('ifeFrom').textContent = booking.from || '-';
  document.getElementById('ifeTo').textContent   = booking.to   || '-';
  document.getElementById('ifeFlightNo').textContent  = booking.flightNumber || '-';
  document.getElementById('ifeCabin').textContent     = (booking.cabinClass || 'Economy').charAt(0).toUpperCase() + (booking.cabinClass || 'Economy').slice(1);
  document.getElementById('ifeRef').textContent       = booking.bookingRef  || '-';

  // Render movies
  renderMovies();

  // Load the game script once
  if (!document.getElementById('flappyScript')) {
    const s = document.createElement('script');
    s.id  = 'flappyScript';
    s.src = 'assets/js/flappy-plane.js';
    document.body.appendChild(s);
  }
}

/**
 * Restores access to the IFE page from either URL query parameters or a cached
 * session. This is the boot-time gate called on DOMContentLoaded before the user
 * interacts with the page manually.
 * @returns {Promise<void>}
 */
// Connection: part of the IFE login, session restore, and tab/content flow on the entertainment page.
async function restoreSessionOrQueryAccess() {
  const params = new URLSearchParams(window.location.search);
  const ref = String(params.get('ref') || '').trim().toUpperCase();
  const email = String(params.get('email') || '').trim().toLowerCase();

  if (!ref || !email) {
    const session = loadSession();
    if (session) {
      enterIFE(session);
      return;
    }

    return;
  }

  const refInput = document.getElementById('ifeRef_input');
  const emailInput = document.getElementById('ifeEmail_input');
  if (refInput) refInput.value = ref;
  if (emailInput) emailInput.value = email;

  const button = document.getElementById('ifeLoginBtn');
  if (button) {
    button.classList.add('loading');
    button.textContent = 'Verifying...';
  }

  try {
    const booking = await loginWithBooking(ref, email);
    saveSession(booking);
    enterIFE(booking);
  } catch (error) {
    showError(error.message || 'Booking not found');
    if (button) {
      button.classList.remove('loading');
      button.textContent = 'Board Now';
    }
  }
}

// ── Movies ────────────────────────────────────────────────────────

// Connection: part of the IFE login, session restore, and tab/content flow on the entertainment page.
function renderMovies() {
  const grid = document.getElementById('ifeMoviesGrid');
  if (!grid) return;

  /* Purpose: transforms each item in the current collection for the surrounding render or data step. Connection: feeds the surrounding collection pipeline inside the IFE login, restore, and content flow. */ grid.innerHTML = MOVIES.map(m => `
    <div class="ife-movie-card">
      <div class="ife-movie-poster" style="background:${m.poster};">
        <div class="ife-movie-play">
          <div class="ife-movie-play-btn">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
        <span class="ife-movie-poster-label">${m.flag}</span>
      </div>
      <div class="ife-movie-info">
        <div class="ife-movie-title">${m.title}</div>
        <div class="ife-movie-meta-row">
          <span class="ife-movie-year">${m.year}</span>
          <span class="ife-movie-rating">★ ${m.rating}</span>
        </div>
        <div class="ife-movie-runtime">${m.runtime} &nbsp;·&nbsp; ${m.genre}</div>
      </div>
    </div>
  `).join('');
}

// ── Tabs ──────────────────────────────────────────────────────────

// Connection: part of the IFE login, session restore, and tab/content flow on the entertainment page.
function initTabs() {
  /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the IFE login, restore, and content flow. */ document.querySelectorAll('.ife-tab').forEach(btn => {
    /* Purpose: responds to the click event for the surrounding DOM element. Connection: wires the surrounding UI element into the IFE login, restore, and content flow. */ btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the IFE login, restore, and content flow. */ document.querySelectorAll('.ife-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === target));
      /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the IFE login, restore, and content flow. */ document.querySelectorAll('.ife-panel').forEach(p => p.classList.toggle('active', p.id === `ifePanel_${target}`));
    });
  });
}

// ── Login form ────────────────────────────────────────────────────

// Connection: part of the IFE login, session restore, and tab/content flow on the entertainment page.
function initLogin() {
  const form = document.getElementById('ifeLoginForm');
  if (!form) return;

  /* Purpose: responds to the submit event for the surrounding DOM element. Connection: wires the surrounding UI element into the IFE login, restore, and content flow. */ form.addEventListener('submit', async e => {
    e.preventDefault();
    hideError();

    const ref   = document.getElementById('ifeRef_input').value.trim().toUpperCase();
    const email = document.getElementById('ifeEmail_input').value.trim().toLowerCase();

    if (!ref || !email) { showError('Please enter both your booking reference and email.'); return; }

    const btn = document.getElementById('ifeLoginBtn');
    btn.classList.add('loading');
    btn.textContent = 'Verifying…';

    try {
      const booking = await loginWithBooking(ref, email);
      saveSession(booking);
      enterIFE(booking);
    } catch (err) {
      showError(err.message);
      btn.classList.remove('loading');
      btn.textContent = 'Board Now';
    }
  });
}

// ── Boot ──────────────────────────────────────────────────────────

/* Purpose: responds to the DOMContentLoaded event for the surrounding DOM element. Connection: wires the surrounding UI element into the IFE login, restore, and content flow. */ document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  initLogin();
  await restoreSessionOrQueryAccess();
});
