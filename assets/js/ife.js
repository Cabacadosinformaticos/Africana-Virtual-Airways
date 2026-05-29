/**
 * Africana Airways — In-Flight Entertainment
 * Handles login (booking ref + email), tab switching, and movie data.
 */

// ── Movie / Video catalogue ───────────────────────────────────────
const MOVIES = [
  {
    title:  'Africana Promotional Video',
    year:   2024,
    genre:  'Promo',
    poster: 'linear-gradient(135deg, #7a0d1e 0%, #c41e3a 50%, #1c1c1e 100%)',
    flag:   '✈️',
    src:    'assets/video/africana-promo.mp4'
  },
  {
    title:  'Africana IADE',
    year:   2024,
    genre:  'Academic',
    poster: 'linear-gradient(135deg, #0d1b2a 0%, #1b3a5c 40%, #2e6ea8 100%)',
    flag:   '🎓',
    src:    'assets/video/africana-iade.mp4'
  },
  {
    title:  'Never Gonna Give You Up',
    year:   1987,
    genre:  'Music Video',
    poster: 'linear-gradient(135deg, #1a0d2e 0%, #3d1a66 50%, #6b2fa0 100%)',
    flag:   '🎵',
    src:    'assets/video/never-gonna-give-you-up.mp4'
  }
];

// ── Music catalogue ───────────────────────────────────────────────
const MUSIC_TRACKS = [
  {
    title:    'Never Gonna Give You Up',
    artist:   'Rick Astley',
    album:    'Whenever You Need Somebody',
    duration: '3:33',
    genre:    'Pop',
    gradient: 'linear-gradient(135deg, #1a0d2e 0%, #3d1a66 50%, #6b2fa0 100%)',
    src:      'assets/audio/never-gonna-give-you-up.mp3'
  },
  {
    title:    'Power Of Noise',
    artist:   'Triode Illusion',
    album:    'Triode Illusion',
    duration: '',
    genre:    'Electronic',
    gradient: 'linear-gradient(135deg, #001428 0%, #002d66 50%, #0066cc 100%)',
    src:      'assets/audio/power-of-noise.mp3'
  },
  {
    title:    'As Water Collides',
    artist:   'Triode Illusion',
    album:    'Triode Illusion',
    duration: '',
    genre:    'Electronic',
    gradient: 'linear-gradient(135deg, #001a1a 0%, #003d3d 50%, #007373 100%)',
    src:      'assets/audio/as-water-collides.mp3'
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

  // Render content panels
  renderMovies();
  renderMusic();

  // Load game scripts once each
  if (!document.getElementById('flappyScript')) {
    const s = document.createElement('script');
    s.id  = 'flappyScript';
    s.src = 'assets/js/flappy-plane.js';
    document.body.appendChild(s);
  }
  if (!document.getElementById('angryScript')) {
    const s = document.createElement('script');
    s.id  = 'angryScript';
    s.src = 'assets/js/angry-planes.js';
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

// ── Movies / Video Modal ──────────────────────────────────────────

function renderMovies() {
  const grid = document.getElementById('ifeMoviesGrid');
  if (!grid) return;
  grid.innerHTML = MOVIES.map((m, i) => `
    <div class="ife-movie-card" data-index="${i}" style="cursor:pointer;">
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
          <span class="ife-movie-runtime">${m.genre}</span>
        </div>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.ife-movie-card').forEach(card => {
    card.addEventListener('click', () => {
      openVideoModal(MOVIES[parseInt(card.dataset.index, 10)].src);
    });
  });
}

function openVideoModal(src) {
  const modal  = document.getElementById('ifeVideoModal');
  const player = document.getElementById('ifeVideoPlayer');
  if (!modal || !player) return;
  player.src = src;
  modal.classList.add('visible');
  player.play().catch(() => {});
}

function closeVideoModal() {
  const modal  = document.getElementById('ifeVideoModal');
  const player = document.getElementById('ifeVideoPlayer');
  if (!modal || !player) return;
  player.pause();
  player.removeAttribute('src');
  player.load();
  modal.classList.remove('visible');
}

function initVideoModal() {
  document.getElementById('ifeVideoModalClose')?.addEventListener('click', closeVideoModal);
  document.getElementById('ifeVideoModal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeVideoModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeVideoModal();
  });
}

// ── Music Player (HTML5 Audio) ────────────────────────────────────

const ifeAudio    = new Audio();
ifeAudio.preload  = 'none';
const musicState  = { current: -1 };

function fmtTime(secs) {
  if (!isFinite(secs) || secs < 0) return '--:--';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function updateMusicUI() {
  const t       = MUSIC_TRACKS[musicState.current];
  const playing = !ifeAudio.paused && !!ifeAudio.src;

  if (t) {
    const art = document.getElementById('ifeMusicArt');
    if (art) {
      art.style.background = t.gradient;
      art.classList.toggle('playing', playing);
    }
    const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    set('ifeMusicTitle',    t.title);
    set('ifeMusicArtist',   t.artist);
    set('ifeMusicAlbum',    `${t.album} · ${t.genre}`);
    set('ifeMusicDuration', isFinite(ifeAudio.duration) ? fmtTime(ifeAudio.duration) : (t.duration || '--:--'));
    set('ifeMusicCurrent',  fmtTime(ifeAudio.currentTime || 0));

    const dur  = ifeAudio.duration;
    const pct  = (isFinite(dur) && dur > 0) ? (ifeAudio.currentTime / dur) * 100 : 0;
    const fill = document.getElementById('ifeMusicProgress');
    if (fill) fill.style.width = pct + '%';
  }

  const playBtn = document.getElementById('ifePlayBtn');
  if (playBtn) {
    playBtn.innerHTML = playing
      ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  }

  document.querySelectorAll('.ife-track-item').forEach((el, i) => {
    const active = i === musicState.current;
    el.classList.toggle('active', active);
    el.classList.toggle('paused', active && !playing);
  });
}

function playTrack(index) {
  musicState.current = index;
  ifeAudio.src = MUSIC_TRACKS[index].src;
  ifeAudio.play().catch(() => {});
  updateMusicUI();
}

function togglePlay() {
  if (musicState.current < 0) { playTrack(0); return; }
  if (ifeAudio.paused) { ifeAudio.play().catch(() => {}); }
  else { ifeAudio.pause(); }
}

ifeAudio.addEventListener('timeupdate',     updateMusicUI);
ifeAudio.addEventListener('loadedmetadata', updateMusicUI);
ifeAudio.addEventListener('play',           updateMusicUI);
ifeAudio.addEventListener('pause',          updateMusicUI);
ifeAudio.addEventListener('ended', () => playTrack((musicState.current + 1) % MUSIC_TRACKS.length));

function renderMusic() {
  const playlist = document.getElementById('ifeMusicPlaylist');
  if (!playlist) return;

  playlist.innerHTML = MUSIC_TRACKS.map((t, i) => `
    <div class="ife-track-item" data-index="${i}">
      <div class="ife-track-num">
        <span class="ife-track-num-text">${i + 1}</span>
        <div class="ife-track-bars"><span></span><span></span><span></span></div>
      </div>
      <div class="ife-track-art" style="background:${t.gradient};"></div>
      <div class="ife-track-info">
        <div class="ife-track-title">${t.title}</div>
        <div class="ife-track-artist">${t.artist}</div>
      </div>
      <div class="ife-track-right">
        <span class="ife-track-genre">${t.genre}</span>
        <span class="ife-track-duration">${t.duration || '—'}</span>
      </div>
    </div>
  `).join('');

  playlist.querySelectorAll('.ife-track-item').forEach(el => {
    el.addEventListener('click', () => {
      const i = parseInt(el.dataset.index, 10);
      if (i === musicState.current) { togglePlay(); } else { playTrack(i); }
    });
  });

  document.getElementById('ifePlayBtn')?.addEventListener('click', togglePlay);
  document.getElementById('ifePrevBtn')?.addEventListener('click', () => {
    playTrack((musicState.current - 1 + MUSIC_TRACKS.length) % MUSIC_TRACKS.length);
  });
  document.getElementById('ifeNextBtn')?.addEventListener('click', () => {
    playTrack((musicState.current + 1) % MUSIC_TRACKS.length);
  });

  musicState.current = 0;
  updateMusicUI();
}

// ── Tabs ──────────────────────────────────────────────────────────

function initTabs() {
  document.querySelectorAll('.ife-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.ife-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === target));
      document.querySelectorAll('.ife-panel').forEach(p => p.classList.toggle('active', p.id === `ifePanel_${target}`));
    });
  });
}

// ── Login form ────────────────────────────────────────────────────

function initLogin() {
  const form = document.getElementById('ifeLoginForm');
  if (!form) return;

  form.addEventListener('submit', async e => {
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

document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  initLogin();
  initVideoModal();
  await restoreSessionOrQueryAccess();
});
