<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Live Traffic | Africana Airways</title>
  <meta name="description" content="Track Africana Airways pilots flying live on VATSIM right now." />
  <link rel="stylesheet" href="assets/css/main.css" />
  <link rel="stylesheet" href="assets/css/accessibility.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    /* ── Page layout ── */
    .vatsim-layout {
      display: grid;
      grid-template-columns: 340px 1fr;
      height: calc(100vh - 76px);
      margin-top: 76px;
    }

    /* ── Sidebar ── */
    .vatsim-sidebar {
      background: var(--white);
      border-right: 1px solid var(--gray-200);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .sidebar-header {
      padding: 20px 20px 14px;
      background: var(--dark);
      flex-shrink: 0;
    }

    .sidebar-header-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .sidebar-title {
      font-family: var(--font-heading);
      font-size: 1.05rem;
      font-weight: 800;
      color: var(--white);
    }

    .source-tag {
      font-family: var(--font-heading);
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 20px;
    }
    .source-tag.live { background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); }
    .source-tag.demo { background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3); }

    .sidebar-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 6px;
    }

    #onlineCount {
      font-family: var(--font-heading);
      font-size: 0.78rem;
      font-weight: 600;
      color: rgba(255,255,255,0.6);
    }

    #lastUpdated {
      font-size: 0.68rem;
      color: rgba(255,255,255,0.35);
    }

    /* Pilot list */
    .pilot-list {
      flex: 1;
      overflow-y: auto;
    }

    .pilot-card {
      padding: 14px 16px;
      border-bottom: 1px solid var(--gray-100);
      cursor: pointer;
      transition: var(--transition);
      border-left: 3px solid transparent;
    }

    .pilot-card:hover { background: #fff5f5; }
    .pilot-card.active { background: #fff5f5; border-left-color: #ed2024; }

    .card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }

    .card-callsign {
      font-family: var(--font-heading);
      font-size: 0.95rem;
      font-weight: 800;
      color: var(--dark);
      letter-spacing: 0.04em;
    }

    .card-phase {
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 2px 7px;
      border-radius: 20px;
    }
    .phase-cruise { background: rgba(34,197,94,0.1); color: #16a34a; }
    .phase-climb  { background: rgba(245,158,11,0.1); color: #d97706; }
    .phase-ground { background: var(--gray-100); color: var(--gray-400); }

    .card-route {
      font-family: var(--font-heading);
      font-size: 0.88rem;
      font-weight: 700;
      color: var(--dark);
      margin-bottom: 5px;
    }

    .card-arrow { color: #ed2024; margin: 0 4px; }

    .card-meta {
      display: flex;
      gap: 10px;
      font-size: 0.72rem;
      color: var(--gray-400);
      font-weight: 600;
      margin-bottom: 3px;
    }

    .aircraft-badge {
      background: var(--gray-100);
      color: var(--dark);
      padding: 1px 6px;
      border-radius: 4px;
      font-family: var(--font-heading);
      font-size: 0.68rem;
      font-weight: 700;
    }

    .card-pilot {
      font-size: 0.72rem;
      color: var(--gray-400);
    }

    .card-timing {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 5px;
      margin-bottom: 4px;
    }

    .timing-item {
      font-size: 0.7rem;
      color: var(--gray-400);
    }

    .timing-item strong {
      color: var(--dark);
      font-weight: 700;
    }

    .timing-sep { font-size: 0.65rem; color: var(--gray-300); }

    .timing-badge {
      font-size: 0.62rem;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 20px;
    }

    /* ── Flight progress bar ── */
    .fpb-wrap { margin: 6px 0 5px; }
    .fpb-track {
      position: relative;
      height: 4px;
      background: var(--gray-200);
      border-radius: 2px;
      margin-bottom: 5px;
    }
    .fpb-fill {
      height: 100%;
      background: #ed2024;
      border-radius: 2px;
    }
    .fpb-marker {
      position: absolute;
      top: 50%;
      width: 10px; height: 10px;
      background: var(--dark);
      border: 2px solid white;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    .fpb-labels {
      display: flex;
      justify-content: space-between;
      font-size: 0.62rem;
      font-weight: 700;
      color: var(--gray-400);
      font-family: var(--font-heading);
      letter-spacing: 0.04em;
    }
    .fpb-dist { color: var(--gray-400); font-weight: 400; }

    /* ── Destination weather strip ── */
    .wx-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 5px 8px;
      background: #f0f9ff;
      border-radius: 6px;
      margin-bottom: 5px;
      border: 1px solid #bae6fd;
    }
    .wx-item {
      font-size: 0.68rem;
      font-weight: 600;
      color: #0369a1;
    }
    .wx-poor { color: #dc2626; }

    /* Empty state */
    .no-flights {
      text-align: center;
      padding: 48px 24px;
      color: var(--gray-400);
      font-family: var(--font-heading);
      font-size: 0.88rem;
      font-weight: 600;
    }
    .no-flights-icon { font-size: 2.5rem; margin-bottom: 12px; opacity: 0.3; }
    .no-flights-msg  { font-size: 0.95rem; font-weight: 700; color: var(--dark); margin-bottom: 6px; }
    .no-flights-sub  { font-size: 0.75rem; color: var(--gray-400); font-weight: 400; }

    /* Refresh footer */
    .refresh-bar {
      padding: 9px 16px;
      background: var(--gray-50);
      border-top: 1px solid var(--gray-100);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }

    #refreshCountdown {
      font-size: 0.72rem;
      color: var(--gray-400);
    }

    .refresh-btn {
      font-family: var(--font-heading);
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      background: none;
      border: 1.5px solid var(--gray-200);
      color: var(--gray-400);
      padding: 4px 10px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: var(--transition);
    }
    .refresh-btn:hover { border-color: #ed2024; color: #ed2024; }

    /* ── Map ── */
    #vatsimMap { height: 100%; width: 100%; }
    .leaflet-container { background: #f2f0eb !important; }

    /* Map overlay — legend + callsign prefix info */
    .map-overlay {
      position: absolute;
      bottom: 24px;
      right: 16px;
      z-index: 500;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
    }

    .map-legend {
      background: rgba(13,27,62,0.92);
      border-radius: var(--radius-md);
      padding: 12px 16px;
      backdrop-filter: blur(8px);
      border-left: 3px solid #ed2024;
    }

    .legend-title {
      font-family: var(--font-heading);
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #ed2024;
      margin-bottom: 8px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: var(--font-heading);
      font-size: 0.7rem;
      font-weight: 600;
      color: rgba(255,255,255,0.75);
      margin-bottom: 5px;
    }
    .legend-item:last-child { margin-bottom: 0; }

    .legend-plane {
      width: 14px;
      height: 14px;
      background: #ed2024;
      border: 2px solid rgba(255,255,255,0.2);
      border-radius: 50%;
      flex-shrink: 0;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .vatsim-layout { grid-template-columns: 1fr; height: auto; }
      .vatsim-sidebar { height: 50vh; }
      #vatsimMap { height: 50vh; }
    }
  </style>
</head>
<body>

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
      <li><a href="fleet.php">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        Fleet
      </a></li>
      <li><a href="vatsim.php" class="active">
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

<div class="vatsim-layout">

  <!-- SIDEBAR -->
  <aside class="vatsim-sidebar">

    <div class="sidebar-header">
      <div class="sidebar-header-top">
        <div class="sidebar-title">Live VATSIM Traffic</div>
        <span class="source-tag demo" id="sourceTag">● DEMO</span>
      </div>
      <div class="sidebar-meta">
        <span id="onlineCount">Loading...</span>
        <span id="lastUpdated"></span>
      </div>
    </div>

<div class="pilot-list" id="pilotList">
      <div class="no-flights">
        <div class="no-flights-icon">✈</div>
        <div>Loading pilots...</div>
      </div>
    </div>

    <div class="refresh-bar">
      <span id="refreshCountdown">Refreshing in 30s</span>
      <button class="refresh-btn" onclick="loadPilots()">Refresh now</button>
    </div>

  </aside>

  <!-- MAP -->
  <div style="position:relative; height:100%;">
    <div id="vatsimMap"></div>
    <div class="map-overlay">
      <div class="map-legend">
        <div class="legend-title">Legend</div>
        <div class="legend-item">
          <div class="legend-plane"></div>
          AFV Pilot (heading = arrow direction)
        </div>
        <div class="legend-item" style="font-size:0.65rem;color:rgba(255,255,255,0.45);padding-top:4px;border-top:1px solid rgba(255,255,255,0.08);margin-top:4px;">
          Callsign prefix: <strong style="color:rgba(255,255,255,0.7)">AFV</strong>
        </div>
      </div>
    </div>
  </div>

</div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="assets/js/main.js"></script>
<script src="assets/js/vatsim.js"></script>
</body>
</html>
