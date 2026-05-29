<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Our Fleet | Africana Airways</title>
  <meta name="description" content="Explore Africana Airways' fleet of 17 aircraft across two hubs in Maputo and Algiers." />
  <link rel="stylesheet" href="assets/css/main.css" />
  <link rel="stylesheet" href="assets/css/accessibility.css" />
  <link rel="stylesheet" href="assets/css/fleet.css" />
</head>
<body>

<!-- NAVBAR (shared) -->
<nav class="navbar scrolled" id="navbar">
  <div class="nav-inner">
    <a href="index.php" class="nav-logo">
      <img src="assets/img/Africana Airways With Logo.png" alt="Africana Airways" class="logo-img" />
    </a>
    <ul class="nav-links" id="navLinks">
      <li><a href="index.php">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
        Home
      </a></li>
      <li><a href="routes.php">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>
        Routes
      </a></li>
      <li><a href="fleet.php" class="active">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        Fleet
      </a></li>
      <li><a href="vatsim.php">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.5l-8.2-2.73V6.5a1.8 1.8 0 0 0-3.6 0v7.27L2 16.5v2l8.2-1.3V21l-2.4 1.5V24l4.2-1 4.2 1v-1.5L13.8 21v-3.8l8.2 1.3z"/></svg>
        Live
      </a></li>
      <li><a href="ife.php">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
        Entertainment
      </a></li>
      <li><a href="about.php">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        About
      </a></li>
      <li><a href="booking.php" class="nav-link-book">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
        Book Now
      </a></li>
      <li><a href="my-bookings.php" class="nav-link-portal">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16v14H4z"/><path d="M8 2v8M16 2v8M7 11h10M7 15h6"/></svg>
        My Bookings
      </a></li>
    </ul>
    <div class="nav-actions">
      <button class="nav-toggle" id="navToggle" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
</nav>

<!-- PAGE HERO -->
<div class="page-hero">
  <div class="container">
    <span class="section-tag">The AFV Fleet</span>
    <h1>Aircraft That <span style="color:var(--red-400)">Define Us</span></h1>
    <p>17 meticulously configured aircraft across two hubs, from agile regional turboprops to iconic superjumbos.</p>
  </div>
</div>

<!-- MAIN CONTENT -->
<section class="section">
  <div class="container">

    <!-- Fleet Stats Bar -->
    <div class="fleet-stats-bar">
      <div class="fleet-stat">
        <span class="fleet-stat-num">17</span>
        <span class="fleet-stat-label">Aircraft</span>
      </div>
      <div class="fleet-stat">
        <span class="fleet-stat-num">2</span>
        <span class="fleet-stat-label">Hubs</span>
      </div>
      <div class="fleet-stat">
        <span class="fleet-stat-num">7</span>
        <span class="fleet-stat-label">Aircraft Types</span>
      </div>
      <div class="fleet-stat">
        <span class="fleet-stat-num" id="totalSeats">-</span>
        <span class="fleet-stat-label">Total Seats</span>
      </div>
      <div class="fleet-stat">
        <span class="fleet-stat-num" id="avgRange">-</span>
        <span class="fleet-stat-label">Avg Range (km)</span>
      </div>
    </div>

    <!-- Category Filter -->
    <div class="category-filter surface-tabs surface-tabs--compact" id="categoryFilter">
      <button class="cat-btn surface-tab active" data-category="all">All Aircraft</button>
      <button class="cat-btn surface-tab" data-category="Regional">Regional</button>
      <button class="cat-btn surface-tab" data-category="Short Range">Short Range</button>
      <button class="cat-btn surface-tab" data-category="Long Range">Long Range</button>
    </div>

    <!-- MAPUTO HUB -->
    <div class="hub-section" id="maputoSection">
      <div class="hub-header">
        <div class="hub-icon maputo">FQMA</div>
        <div class="hub-info">
          <h3>Maputo Hub (FQMA)</h3>
          <p>Maputo International Airport, Mozambique · Primary Hub · Est. 2020</p>
        </div>
        <div class="hub-aircraft-count" id="maputoCount">13 Aircraft</div>
      </div>

      <!-- Regional -->
      <div class="category-section" id="maputo-regional">
        <div class="category-label"><h4>Regional Airliners</h4></div>
        <div class="aircraft-grid" id="maputoRegionalGrid"></div>
      </div>

      <!-- Short Range -->
      <div class="category-section" id="maputo-short">
        <div class="category-label"><h4>Short Range Airliners</h4></div>
        <div class="aircraft-grid" id="maputoShortGrid"></div>
      </div>

      <!-- Long Range -->
      <div class="category-section" id="maputo-long">
        <div class="category-label"><h4>Long Range Airliners</h4></div>
        <div class="aircraft-grid" id="maputoLongGrid"></div>
      </div>
    </div>

    <!-- ALGIERS HUB -->
    <div class="hub-section" id="algiersSection">
      <div class="hub-header">
        <div class="hub-icon algiers">DAAG</div>
        <div class="hub-info">
          <h3>Algiers Hub (DAAG)</h3>
          <p>Houari Boumediene Airport, Algeria · Secondary Hub · Est. 2022</p>
        </div>
        <div class="hub-aircraft-count" id="algiersCount">4 Aircraft</div>
      </div>

      <div class="category-section" id="algiers-regional">
        <div class="category-label"><h4>Regional Airliners</h4></div>
        <div class="aircraft-grid" id="algiersRegionalGrid"></div>
      </div>

      <div class="category-section" id="algiers-long">
        <div class="category-label"><h4>Long Range Airliners</h4></div>
        <div class="aircraft-grid" id="algiersLongGrid"></div>
      </div>
    </div>

  </div>
</section>

<!-- AIRCRAFT DETAIL MODAL -->
<div class="modal-overlay" id="aircraftModal">
  <div class="modal-card">
    <div class="modal-hero">
      <img id="modalImage" src="" alt="" />
      <button class="modal-close" id="modalCloseBtn">×</button>
      <div class="modal-hero-overlay">
        <div>
          <div class="modal-reg" id="modalReg"></div>
          <div class="modal-type" id="modalType"></div>
        </div>
      </div>
    </div>
    <div class="modal-body">
      <div class="modal-specs-grid">
        <div class="modal-spec">
          <div class="modal-spec-label">Range</div>
          <div class="modal-spec-value" id="modalRange">-</div>
        </div>
        <div class="modal-spec">
          <div class="modal-spec-label">Cruise Speed</div>
          <div class="modal-spec-value" id="modalSpeed">-</div>
        </div>
        <div class="modal-spec">
          <div class="modal-spec-label">Hub</div>
          <div class="modal-spec-value" id="modalHub">-</div>
        </div>
      </div>

      <p class="modal-desc" id="modalDesc"></p>

      <h4 style="font-family:var(--font-heading);font-size:0.72rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--gray-400);margin-bottom:16px;">Cabin Configuration</h4>
      <div class="modal-seating" id="modalSeating"></div>

      <div style="margin-top:28px;">
        <h4 style="font-family:var(--font-heading);font-size:0.72rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--gray-400);margin-bottom:14px;">Seat Map</h4>
        <div id="modalSeatMap"></div>
      </div>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script src="assets/js/main.js"></script>
<script>
const SEAT_MAPS = <?php
  $fleet = json_decode(file_get_contents(__DIR__ . '/data/aircraft.json'), true) ?? [];
  $maps = [];
  foreach ($fleet as $a) $maps[$a['id']] = $a['seatMap'];
  echo json_encode($maps);
?>;
</script>
<script>
  let allAircraft = [];
  let activeCategory = 'all';

  /* Purpose: implements the loadFleet helper used by this file. Connection: participates in the fleet page load, filtering, and modal flow. */ async function loadFleet() {
    try {
      const res = await fetch('/api/fleet');
      allAircraft = await res.json();
      renderFleet(allAircraft);
      computeStats(allAircraft);
    } catch {
      // Fallback: load embedded data
      /* Purpose: handles the surrounding callback logic for this expression. Connection: participates in the fleet page load, filtering, and modal flow. */ const fallback = await fetch('/api/fleet').catch(() => null);
      if (!fallback) showToast('Could not load fleet data', 'error');
    }
  }

  /* Purpose: implements the computeStats helper used by this file. Connection: participates in the fleet page load, filtering, and modal flow. */ function computeStats(aircraft) {
    /* Purpose: accumulates collection values into the summary used by the surrounding step. Connection: feeds the surrounding collection pipeline inside the fleet page load, filtering, and modal flow. */ const totalSeats = aircraft.reduce((s, a) => s + a.seats.economy + a.seats.business + a.seats.first, 0);
    /* Purpose: accumulates collection values into the summary used by the surrounding step. Connection: feeds the surrounding collection pipeline inside the fleet page load, filtering, and modal flow. */ const avgRange = Math.round(aircraft.reduce((s, a) => s + a.range_km, 0) / aircraft.length);
    document.getElementById('totalSeats').textContent = totalSeats.toLocaleString();
    document.getElementById('avgRange').textContent = avgRange.toLocaleString();
  }

  /* Purpose: implements the renderFleet helper used by this file. Connection: participates in the fleet page load, filtering, and modal flow. */ function renderFleet(aircraft) {
    /* Purpose: filters the current collection down to the items needed by the surrounding step. Connection: feeds the surrounding collection pipeline inside the fleet page load, filtering, and modal flow. */ const maputoRegional = aircraft.filter(a => a.hub === 'FQMA' && a.category === 'Regional');
    /* Purpose: filters the current collection down to the items needed by the surrounding step. Connection: feeds the surrounding collection pipeline inside the fleet page load, filtering, and modal flow. */ const maputoShort    = aircraft.filter(a => a.hub === 'FQMA' && a.category === 'Short Range');
    /* Purpose: filters the current collection down to the items needed by the surrounding step. Connection: feeds the surrounding collection pipeline inside the fleet page load, filtering, and modal flow. */ const maputoLong     = aircraft.filter(a => a.hub === 'FQMA' && a.category === 'Long Range');
    /* Purpose: filters the current collection down to the items needed by the surrounding step. Connection: feeds the surrounding collection pipeline inside the fleet page load, filtering, and modal flow. */ const algiersRegional= aircraft.filter(a => a.hub === 'DAAG' && a.category === 'Regional');
    /* Purpose: filters the current collection down to the items needed by the surrounding step. Connection: feeds the surrounding collection pipeline inside the fleet page load, filtering, and modal flow. */ const algiersLong    = aircraft.filter(a => a.hub === 'DAAG' && (a.category === 'Long Range' || a.category === 'Short Range'));

    document.getElementById('maputoCount').textContent = `${maputoRegional.length + maputoShort.length + maputoLong.length} Aircraft`;
    document.getElementById('algiersCount').textContent = `${algiersRegional.length + algiersLong.length} Aircraft`;

    renderGrid('maputoRegionalGrid', maputoRegional);
    renderGrid('maputoShortGrid', maputoShort);
    renderGrid('maputoLongGrid', maputoLong);
    renderGrid('algiersRegionalGrid', algiersRegional);
    renderGrid('algiersLongGrid', algiersLong);

    toggleEmptyCategories();
  }

  /* Purpose: implements the renderGrid helper used by this file. Connection: participates in the fleet page load, filtering, and modal flow. */ function renderGrid(gridId, aircraft) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    const section = grid.closest('.category-section');

    // Always clear first so toggleEmptyCategories reads the correct state
    grid.innerHTML = aircraft.map(a => aircraftCardHTML(a)).join('');
    section.style.display = aircraft.length ? '' : 'none';

    if (!aircraft.length) return;

    // Set onerror BEFORE src to avoid the race condition where the image
    // fails before the handler is attached (data-src is used in the template).
    grid.querySelectorAll('img[data-src]').forEach(img => {
      const path = img.getAttribute('data-src');
      img.removeAttribute('data-src');
      img.onerror = function() {
        if (this.src.endsWith('.jpg')) {
          this.src = this.src.replace('.jpg', '.png');
        } else {
          this.onerror = null;
          this.src = 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=600&q=60';
        }
      };
      img.src = path; // trigger load only after handler is ready
    });

    // Setup click handlers for newly rendered Details buttons
    grid.querySelectorAll('.btn-details').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const aircraftId = parseInt(btn.getAttribute('data-aircraft-id'));
        openModal(aircraftId);
        e.stopPropagation();
      });
    });
  }

  /* Purpose: implements the aircraftCardHTML helper used by this file. Connection: participates in the fleet page load, filtering, and modal flow. */ function aircraftCardHTML(a) {
    const badgeClass = a.category === 'Regional' ? 'badge-regional' : a.category === 'Short Range' ? 'badge-short' : 'badge-long';
    const seats = [];
    if (a.seats.economy) seats.push(`<span class="seat-chip chip-eco">${a.seats.economy} Eco</span>`);
    if (a.seats.business) seats.push(`<span class="seat-chip chip-biz">${a.seats.business} Biz</span>`);
    if (a.seats.first) seats.push(`<span class="seat-chip chip-first">${a.seats.first} First</span>`);

    return `<div class="aircraft-card">
      <div class="aircraft-img-wrap">
        <img data-src="${a.image}" alt="${a.type}" loading="lazy" data-reg="${a.registration}" />
        <span class="aircraft-category-badge ${badgeClass}">${a.category}</span>
        <span class="aircraft-hub-badge">${a.hub}</span>
      </div>
      <div class="aircraft-body">
        <div class="aircraft-reg">${a.registration}</div>
        <div class="aircraft-type">${a.type}</div>
        <p class="aircraft-desc">${a.description}</p>
        <div class="aircraft-specs">
          <div class="spec-item">
            <span class="spec-label">Range</span>
            <span class="spec-value">${a.range_km.toLocaleString()} km</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Cruise</span>
            <span class="spec-value">${a.cruise_speed_kmh} km/h</span>
          </div>
        </div>
      </div>
      <div class="aircraft-footer">
        <div class="seat-chips">${seats.join('')}</div>
        <button class="btn-details" data-aircraft-id="${a.id}">Details</button>
      </div>
    </div>`;
  }

  /* Purpose: implements the openModal helper used by this file. Connection: participates in the fleet page load, filtering, and modal flow. */ function openModal(id) {
    /* Purpose: checks each candidate until the surrounding lookup finds its match. Connection: feeds the surrounding collection pipeline inside the fleet page load, filtering, and modal flow. */ const a = allAircraft.find(x => x.id === id);
    if (!a) return;
    const modalImg = document.getElementById('modalImage');
    modalImg.alt = a.type;
    modalImg.onerror = function() {
      if (this.src.endsWith('.jpg')) {
        this.src = this.src.replace('.jpg', '.png');
      } else {
        this.onerror = null;
        this.src = 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=600&q=60';
      }
    };
    modalImg.src = a.image;
    document.getElementById('modalReg').textContent = a.registration;
    document.getElementById('modalType').textContent = a.type;
    document.getElementById('modalRange').textContent = `${a.range_km.toLocaleString()} km`;
    document.getElementById('modalSpeed').textContent = `${a.cruise_speed_kmh} km/h`;
    document.getElementById('modalHub').textContent = a.hub_name;
    document.getElementById('modalDesc').textContent = a.description;

    const seatingEl = document.getElementById('modalSeating');
    seatingEl.innerHTML = '';
    if (a.seats.economy) seatingEl.innerHTML += `<div class="seating-class economy"><span class="seating-count">${a.seats.economy}</span><div class="seating-name">Economy</div></div>`;
    if (a.seats.business) seatingEl.innerHTML += `<div class="seating-class business"><span class="seating-count">${a.seats.business}</span><div class="seating-name">Business</div></div>`;
    if (a.seats.first) seatingEl.innerHTML += `<div class="seating-class first"><span class="seating-count">${a.seats.first}</span><div class="seating-name">First Class</div></div>`;

    const total = a.seats.economy + a.seats.business + a.seats.first;
    seatingEl.innerHTML += `<div class="seating-class" style="border-color:var(--gray-200)"><span class="seating-count" style="color:var(--dark)">${total}</span><div class="seating-name">Total Seats</div></div>`;

    renderSeatMap(a, SEAT_MAPS[a.id] ?? null);
    document.getElementById('aircraftModal').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  /* Purpose: implements the closeModal helper used by this file. Connection: participates in the fleet page load, filtering, and modal flow. */ function closeModal() {
    document.getElementById('aircraftModal').classList.remove('open');
    document.body.style.overflow = '';
  }

  function renderSeatMap(aircraft, seatMap) {
    const container = document.getElementById('modalSeatMap');
    if (!container) return;
    if (!seatMap) { container.innerHTML = ''; return; }

    const classOrder = ['first', 'business', 'economy'];
    const classLabels = { first: 'First Class', business: 'Business', economy: 'Economy' };
    const LETTERS = 'ABCDEFGHJKLMNOPQRSTUVWXYZ';

    const hasDecks = classOrder.some(c => seatMap[c] && seatMap[c].deck);
    const activeCabins = classOrder.filter(c => seatMap[c]);
    if (!activeCabins.length) { container.innerHTML = ''; return; }

    const deckGroups = {};
    classOrder.forEach(c => {
      if (!seatMap[c]) return;
      const deck = (hasDecks && seatMap[c].deck) ? seatMap[c].deck : 'main';
      if (!deckGroups[deck]) deckGroups[deck] = [];
      deckGroups[deck].push(c);
    });

    const deckOrder = hasDecks ? ['upper', 'main'] : ['main'];
    const deckLabel = { upper: 'Upper Deck', main: 'Main Deck' };

    let html = '<div class="seatmap-legend">';
    activeCabins.forEach(c => {
      html += `<span class="sml-item sml-${c}">${classLabels[c]}</span>`;
    });
    html += '</div>';

    deckOrder.forEach(deck => {
      const classes = deckGroups[deck];
      if (!classes || !classes.length) return;

      if (hasDecks) {
        html += `<div class="seatmap-deck-lbl">${deckLabel[deck]}</div>`;
      }

      html += '<div class="sm-rows">';
      let globalRow = 1;

      classes.forEach(c => {
        if (!seatMap[c]) return;
        const { rows, config } = seatMap[c];
        const grps = config.split('-').map(Number);

        html += `<div class="sm-class-divider sm-divider-${c}">`;
        html += `<span class="sm-div-label">${classLabels[c]}</span>`;
        html += '<div class="sm-col-hdr"><span class="sm-rnum"></span>';
        let li = 0;
        grps.forEach((count, gi) => {
          if (gi > 0) html += '<span class="sm-aisle"></span>';
          for (let s = 0; s < count; s++) html += `<span class="sm-hdr">${LETTERS[li++]}</span>`;
        });
        html += '</div></div>';

        for (let r = 0; r < rows; r++) {
          const rn = globalRow++;
          const showNum = (r === 0 || (r + 1) % 5 === 0 || r === rows - 1) ? rn : '';
          html += `<div class="sm-row"><span class="sm-rnum">${showNum}</span>`;
          grps.forEach((count, gi) => {
            if (gi > 0) html += '<span class="sm-aisle"></span>';
            for (let s = 0; s < count; s++) html += `<span class="sm-seat sm-seat-${c}"></span>`;
          });
          html += '</div>';
        }
      });

      html += '</div>';
    });

    container.innerHTML = html;
  }

  /* Purpose: implements the filterCategory helper used by this file. Connection: participates in the fleet page load, filtering, and modal flow. */ function filterCategory(cat) {
    console.log('filterCategory called with:', cat);
    activeCategory = cat;

    /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the fleet page load, filtering, and modal flow. */ document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-category="${cat}"]`).classList.add('active');

    let filtered = allAircraft;
    if (cat !== 'all') {
      filtered = allAircraft.filter(a => a.category === cat);
    }

    console.log('Filtered aircraft count:', filtered.length, 'Category:', cat);

    // Re-render with filtered aircraft
    renderFleet(filtered);
  }

  /* Purpose: implements the toggleEmptyCategories helper used by this file. Connection: participates in the fleet page load, filtering, and modal flow. */ function toggleEmptyCategories() {
    // Hide entire hub section if all its category sections are hidden
    ['maputoSection', 'algiersSection'].forEach(hubId => {
      const hub = document.getElementById(hubId);
      if (!hub) return;
      const allSections = hub.querySelectorAll('.category-section');
      const hasVisible = Array.from(allSections).some(s => s.style.display !== 'none');
      hub.style.display = hasVisible ? '' : 'none';
    });
  }

  /* Purpose: implements the showToast helper used by this file. Connection: participates in the fleet page load, filtering, and modal flow. */ function showToast(msg, type='') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `toast show ${type}`;
    /* Purpose: runs delayed follow-up logic after the surrounding timeout expires. Connection: continues the fleet page load, filtering, and modal flow after a controlled delay. */ setTimeout(() => t.classList.remove('show'), 3500);
  }

  // Close modal on overlay click
  /* Purpose: responds to the click event for the surrounding DOM element. Connection: wires the surrounding UI element into the fleet page load, filtering, and modal flow. */ document.getElementById('aircraftModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('aircraftModal')) closeModal();
  });

  // Close modal on close button click
  document.getElementById('modalCloseBtn').addEventListener('click', closeModal);

  // Setup category filter buttons
  document.getElementById('categoryFilter').addEventListener('click', (e) => {
    const btn = e.target.closest('.cat-btn');
    if (btn) {
      const category = btn.getAttribute('data-category');
      filterCategory(category);
    }
  });

  loadFleet();
</script>
</body>
</html>
