/**
 * Africana Airways - Booking Flow Logic
 */

const params = new URLSearchParams(window.location.search);
let selectedSeats = {}; // Object: segmentKey -> seatId  e.g. { 'outbound-0': '4C' }
let bookingData = null;
let seatMapAvailable = true;

// Returns the IATA code for a given ICAO code, falling back to the ICAO code itself.
// Relies on window._icaoToIataMap populated by main.js after airport load.
function toIata(icao) {
  return (window._icaoToIataMap && window._icaoToIataMap[icao]) || icao;
}

/**
 * Escapes special HTML characters in a string to prevent XSS.
 * @param {*} str - Value to escape (coerced to string)
 * @returns {string} HTML-safe escaped string
 */
// Connection: part of the public booking checkout flow from itinerary load through confirmation.
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

bindBookingActions();

/**
 * Entry point for the booking page. Reads the itinerary from the URL,
 * fetches hydrated itinerary data from the API, calculates total prices,
 * renders the booking summary, and loads the seat map.
 * For round-trips, both outbound and return itineraries are fetched in parallel.
 * @returns {Promise<void>}
 */
// Connection: part of the public booking checkout flow from itinerary load through confirmation.
async function initBooking() {
  document.body.style.visibility = 'visible';

  const passengers  = Number(params.get('passengers') || 1);
  const cabinClass  = params.get('cabin') || 'economy';
  const isMultiCity = params.get('tripType') === 'multi' && !!params.get('legs');

  // ── Multi-city path ─────────────────────────────────────────────
  if (isMultiCity) {
    let legsPayload;
    try {
      legsPayload = JSON.parse(decodeURIComponent(escape(atob(params.get('legs')))));
    } catch {
      window.location.href = 'index.php';
      return;
    }

    const decodedLegs = legsPayload.map(leg => ({
      rawItinerary: JSON.parse(decodeURIComponent(escape(atob(leg.itinerary)))),
      cabinClass:   leg.cabin || cabinClass
    }));

    try {
      const hydratedLegs = await Promise.all(
        decodedLegs.map(leg => fetchItinerary(leg.rawItinerary, passengers))
      );
      let totalPrice = 0;
      const processedLegs = decodedLegs.map((leg, i) => {
        const itin  = hydratedLegs[i];
        const price = itin.prices?.[leg.cabinClass] || 0;
        totalPrice += price;
        return { rawItinerary: leg.rawItinerary, itinerary: itin, cabinClass: leg.cabinClass, price };
      });

      bookingData = {
        isMultiCity: true,
        legs:        processedLegs,
        passengers,
        totalPrice,
        // Single-leg compat for shared helpers
        rawItinerary:  processedLegs[0]?.rawItinerary,
        itinerary:     processedLegs[0]?.itinerary,
        cabinClass:    processedLegs[0]?.cabinClass || cabinClass,
        isRoundTrip:   false
      };

      renderSummary();
      await loadSeatMap();
    } catch (error) {
      showToast(error.message || 'Could not load itinerary details', 'error');
      document.getElementById('selectedFlightInfo').textContent = 'Could not load itinerary details';
    }
    return;
  }

  // ── One-way / round-trip path ───────────────────────────────────
  const rawItinerary = readRawItinerary();
  if (!rawItinerary) {
    window.location.href = 'index.php';
    return;
  }

  const isRoundTrip   = !!params.get('returnItinerary');
  const rawReturn     = isRoundTrip ? readRawReturnItinerary() : null;
  const returnCabin   = params.get('returnCabin') || cabinClass;

  try {
    // Fetch both itineraries in parallel when round-trip
    const [itinerary, returnItinerary] = await Promise.all([
      fetchItinerary(rawItinerary, passengers),
      rawReturn ? fetchItinerary(rawReturn, passengers) : Promise.resolve(null)
    ]);

    const outboundPrice = itinerary.prices?.[cabinClass] || 0;
    const returnPrice   = returnItinerary ? (returnItinerary.prices?.[returnCabin] || 0) : 0;

    bookingData = {
      rawItinerary,
      itinerary,
      cabinClass,
      passengers,
      totalPrice: outboundPrice + returnPrice,
      // Round-trip extras
      isRoundTrip,
      rawReturnItinerary: rawReturn,
      returnItinerary,
      returnCabinClass: returnCabin,
      outboundPrice,
      returnPrice
    };

    renderSummary();
    await loadSeatMap();
  } catch (error) {
    showToast(error.message || 'Could not load itinerary details', 'error');
    document.getElementById('selectedFlightInfo').textContent = 'Could not load itinerary details';
  }
}

/**
 * Sends a raw itinerary to the /api/flights/itinerary endpoint and returns
 * the fully hydrated itinerary with prices for the given passenger count.
 * @param {Object} rawItinerary - Minimal itinerary object with segments
 * @param {number} passengers - Number of passengers
 * @returns {Promise<Object>} Hydrated itinerary object with prices
 */
// Connection: part of the public booking checkout flow from itinerary load through confirmation.
async function fetchItinerary(rawItinerary, passengers) {
  const response = await fetch('/api/flights/itinerary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itinerary: rawItinerary, passengers })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load itinerary');
  return data;
}

/**
 * Reads and decodes the outbound itinerary from the URL search params.
 * Supports both base64-encoded full itineraries and legacy flat flight params.
 * Returns null if no valid itinerary can be read.
 * @returns {Object|null} Raw itinerary object or null
 */
// Connection: part of the public booking checkout flow from itinerary load through confirmation.
function readRawItinerary() {
  const encoded = params.get('itinerary');
  if (encoded) {
    try { return JSON.parse(decodeURIComponent(escape(atob(encoded)))); } catch { return null; }
  }

  const flight = params.get('flight');
  const from   = params.get('from');
  const to     = params.get('to');
  const date   = params.get('date');
  if (!flight || !from || !to || !date) return null;

  return { itineraryId: `${flight}_${date}`, segments: [{ flightNumber: flight, departureDate: date }] };
}

/**
 * Reads and decodes the return itinerary from the 'returnItinerary' URL param.
 * Returns null if the param is missing or decoding fails.
 * @returns {Object|null} Raw return itinerary object or null
 */
// Connection: part of the public booking checkout flow from itinerary load through confirmation.
function readRawReturnItinerary() {
  const encoded = params.get('returnItinerary');
  if (!encoded) return null;
  try { return JSON.parse(decodeURIComponent(escape(atob(encoded)))); } catch { return null; }
}

/**
 * Renders the booking summary panel with route, flight numbers, dates, times,
 * duration, cabin class, passenger count, aircraft type, and total price.
 * Also builds the inline flight info block for both outbound and return legs.
 */
// Connection: part of the public booking checkout flow from itinerary load through confirmation.
function renderSummary() {
  // ── Multi-city summary ──────────────────────────────────────────
  if (bookingData.isMultiCity) {
    const { legs, passengers, totalPrice } = bookingData;
    const row = (label, value) => `<div class="summary-row">
      <span class="summary-label">${label}</span>
      <span class="summary-value">${value}</span>
    </div>`;
    const legLabel = s => `<div style="font-family:var(--font-heading);font-size:0.58rem;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:var(--red-600);padding:8px 0 4px;border-bottom:1px solid var(--gray-100);margin-bottom:4px;">${s}</div>`;

    let bodyHtml = '';
    legs.forEach((leg, i) => {
      const first = leg.itinerary.segments[0];
      const last  = leg.itinerary.segments[leg.itinerary.segments.length - 1];
      bodyHtml +=
        legLabel(`Flight ${i + 1}`) +
        row('Route',     `${escapeHtml(toIata(first.from))} → ${escapeHtml(toIata(last.to))}`) +
        row('Date',      formatDate(first.departureDate)) +
        row('Departure', escapeHtml(first.departure)) +
        row('Arrival',   escapeHtml(last.arrival)) +
        row('Duration',  escapeHtml(leg.itinerary.duration || '')) +
        row('Cabin',     capitalise(leg.cabinClass)) +
        row('Leg price', `$${leg.price.toFixed(0)}`);
    });
    bodyHtml += row('Passengers', `${passengers} passenger${passengers > 1 ? 's' : ''}`);
    document.querySelector('.summary-body').innerHTML = bodyHtml;

    const routeParts = legs.map(l => toIata(l.itinerary.segments[0].from));
    routeParts.push(toIata(legs[legs.length - 1].itinerary.segments.at(-1).to));
    setText('summaryRoute', routeParts.join(' → '));
    setText('summaryTotal', `$${totalPrice.toFixed(0)}`);

    let infoHtml = '';
    legs.forEach((leg, i) => {
      infoHtml += `<div style="font-size:0.65rem;color:var(--gray-400);font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:${i > 0 ? '10px' : '0'} 0 6px;">Flight ${i + 1}</div>`;
      leg.itinerary.segments.forEach(s => {
        infoHtml += `<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:6px;flex-wrap:wrap;">
          <span style="color:var(--red-600);font-family:var(--font-heading);font-size:0.88rem;font-weight:700;min-width:70px;">${escapeHtml(s.flightNumber)}</span>
          <span style="font-weight:700;">${escapeHtml(toIata(s.from))} → ${escapeHtml(toIata(s.to))}</span>
          <span style="color:var(--gray-500);font-size:0.85rem;">${escapeHtml(s.departure)} → ${escapeHtml(s.arrival)}</span>
        </div>`;
      });
      if (i < legs.length - 1) infoHtml += `<div style="margin:8px 0;border-top:1px dashed var(--gray-200);"></div>`;
    });
    document.getElementById('selectedFlightInfo').innerHTML = infoHtml;
    return;
  }

  // ── One-way / round-trip summary ────────────────────────────────
  const { itinerary, returnItinerary, cabinClass, returnCabinClass,
          passengers, totalPrice, outboundPrice, returnPrice, isRoundTrip } = bookingData;

  const firstSeg = itinerary.segments[0];
  const lastSeg  = itinerary.segments[itinerary.segments.length - 1];

  setText('summaryRoute', `${toIata(firstSeg.from)} → ${toIata(lastSeg.to)}${isRoundTrip ? ' (Return)' : ''}`);
  setText('summaryTotal', `$${totalPrice.toFixed(0)}`);

  if (isRoundTrip && returnItinerary) {
    // Replace the summary body with a two-leg breakdown
    const retFirst = returnItinerary.segments[0];
    const retLast  = returnItinerary.segments[returnItinerary.segments.length - 1];

    const legLabel = s => `<div style="
        font-family:var(--font-heading);font-size:0.58rem;font-weight:800;
        letter-spacing:0.12em;text-transform:uppercase;color:var(--red-600);
        padding:8px 0 4px;border-bottom:1px solid var(--gray-100);margin-bottom:4px;">
      ${s}
    </div>`;

    const row = (label, value) => `<div class="summary-row">
      <span class="summary-label">${label}</span>
      <span class="summary-value">${value}</span>
    </div>`;

    const outboundAircraft = Array.from(new Set(itinerary.segments.map(s => s.aircraft?.type).filter(Boolean))).join(' / ') || 'TBA';
    const returnAircraft   = Array.from(new Set(returnItinerary.segments.map(s => s.aircraft?.type).filter(Boolean))).join(' / ') || 'TBA';

    document.querySelector('.summary-body').innerHTML =
      legLabel('Outbound') +
      row('Flight',    itinerary.segments.map(s => escapeHtml(s.flightNumber)).join(' / ')) +
      row('Date',      formatDate(firstSeg.departureDate)) +
      row('Departure', escapeHtml(firstSeg.departure)) +
      row('Arrival',   escapeHtml(lastSeg.arrival)) +
      row('Duration',  escapeHtml(itinerary.duration)) +
      row('Cabin',     capitalise(cabinClass)) +
      row('Aircraft',  escapeHtml(outboundAircraft)) +
      legLabel('Return') +
      row('Flight',    returnItinerary.segments.map(s => escapeHtml(s.flightNumber)).join(' / ')) +
      row('Date',      formatDate(retFirst.departureDate)) +
      row('Departure', escapeHtml(retFirst.departure)) +
      row('Arrival',   escapeHtml(retLast.arrival)) +
      row('Duration',  escapeHtml(returnItinerary.duration)) +
      row('Cabin',     capitalise(returnCabinClass)) +
      row('Aircraft',  escapeHtml(returnAircraft)) +
      row('Passengers', `${passengers} passenger${passengers > 1 ? 's' : ''}`);
  } else {
    setText('summaryFlight',   itinerary.segments.map(s => s.flightNumber).join(' / '));
    setText('summaryDate',     formatDate(firstSeg.departureDate));
    setText('summaryDep',      firstSeg.departure);
    setText('summaryArr',      lastSeg.arrival);
    setText('summaryDuration', itinerary.duration);
    setText('summaryCabin',    capitalise(cabinClass));
    setText('summaryPax',      `${passengers} passenger${passengers > 1 ? 's' : ''}`);
    const aircraftTypes = Array.from(new Set(itinerary.segments.map(s => s.aircraft?.type).filter(Boolean)));
    setText('summaryAircraft', aircraftTypes.join(' / ') || 'Aircraft TBA');
  }

  // Flight info panel — segment-by-segment breakdown
  const segmentBlock = (segments, label) => {
    const lines = segments.map(s => `
      <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:6px;flex-wrap:wrap;">
        <span style="color:var(--red-600);font-family:var(--font-heading);font-size:0.88rem;font-weight:700;min-width:70px;">${escapeHtml(s.flightNumber)}</span>
        <span style="font-weight:700;">${escapeHtml(toIata(s.from))} → ${escapeHtml(toIata(s.to))}</span>
        <span style="color:var(--gray-500);font-weight:400;font-size:0.85rem;">${escapeHtml(s.departure)} → ${escapeHtml(s.arrival)}</span>
      </div>`).join('');
    if (!label) return lines;
    return `<div style="font-size:0.65rem;color:var(--gray-400);font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">${label}</div>${lines}`;
  };

  let infoHtml = segmentBlock(itinerary.segments, isRoundTrip ? 'Outbound' : '');

  if (isRoundTrip && returnItinerary) {
    infoHtml += `<div style="margin:10px 0;border-top:1px solid var(--gray-200);"></div>`;
    infoHtml += segmentBlock(returnItinerary.segments, 'Return');
  }

  document.getElementById('selectedFlightInfo').innerHTML = infoHtml;
}

/**
 * Fetches occupied seats for all segments and renders seat maps for each.
 * Supports multi-segment itineraries (connecting flights) and round-trips.
 * @returns {Promise<void>}
 */
// Connection: part of the public booking checkout flow from itinerary load through confirmation.
async function loadSeatMap() {
  const container   = document.getElementById('segmentSeatsContainer');
  const continueBtn = document.getElementById('continueToPaymentBtn');

  try {
    let html = '';

    if (bookingData.isMultiCity) {
      // Multi-city: seat map per leg
      for (let legIdx = 0; legIdx < bookingData.legs.length; legIdx++) {
        const leg    = bookingData.legs[legIdx];
        const legKey = `leg${legIdx}`;
        if (legIdx > 0) {
          const f = leg.itinerary.segments[0];
          const l = leg.itinerary.segments[leg.itinerary.segments.length - 1];
          html += `<div style="margin:32px 0;padding:20px 0;border-top:2px solid var(--gray-200);border-bottom:2px solid var(--gray-200);text-align:center;font-family:var(--font-heading);font-weight:700;color:var(--gray-600);">Flight ${legIdx + 1} · ${toIata(f.from)} → ${toIata(l.to)}</div>`;
        }
        const maps = await Promise.all(
          leg.itinerary.segments.map((seg, idx) =>
            fetchSeatMapForSegment(seg, leg.cabinClass, idx, legKey)
          )
        );
        maps.forEach((mapData, idx) => {
          html += generateSegmentSeatMap(mapData, idx, legKey, leg.cabinClass);
        });
      }
    } else {
      // One-way / round-trip
      const outboundMaps = await Promise.all(
        bookingData.itinerary.segments.map((seg, idx) =>
          fetchSeatMapForSegment(seg, bookingData.cabinClass, idx, 'outbound')
        )
      );
      outboundMaps.forEach((mapData, idx) => {
        html += generateSegmentSeatMap(mapData, idx, 'outbound', bookingData.cabinClass);
      });

      if (bookingData.returnItinerary) {
        html += '<div style="margin:32px 0;padding:20px 0;border-top:2px solid var(--gray-200);border-bottom:2px solid var(--gray-200);text-align:center;font-family:var(--font-heading);font-weight:700;color:var(--gray-600);">Return Flight</div>';
        const returnMaps = await Promise.all(
          bookingData.returnItinerary.segments.map((seg, idx) =>
            fetchSeatMapForSegment(seg, bookingData.returnCabinClass, idx, 'return')
          )
        );
        returnMaps.forEach((mapData, idx) => {
          html += generateSegmentSeatMap(mapData, idx, 'return', bookingData.returnCabinClass);
        });
      }
    }

    container.innerHTML = html;
    updateSelectedSeatsLabel();
  } catch (error) {
    seatMapAvailable = false;
    container.innerHTML = `<div style="padding:24px;text-align:center;color:var(--gray-500);">
      Seat map is temporarily unavailable. You can still proceed without a seat selection.
    </div>`;
    if (continueBtn) {
      continueBtn.title = 'Seat map unavailable. You will be assigned a seat at check-in.';
    }
    showToast(error.message || 'Seat map is temporarily unavailable', 'error');
  }
}

/**
 * Fetches seat map data for a specific segment from the API.
 */
async function fetchSeatMapForSegment(segment, cabinClass, segmentIdx, legType) {
  const response = await fetch('/api/flights/seat-map', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      itinerary: { segments: [segment] },
      cabinClass
    })
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Could not load seats');

  return {
    segment,
    cabinClass,
    segmentIdx,
    legType,
    occupiedSeats: payload.occupiedSeats || [],
    layout: payload.layout || null
  };
}

/**
 * Converts an aircraft seat config string (e.g. "2-2", "3-3-3", "1-2-1")
 * into a columns array where empty strings represent aisle gaps.
 * Letters are assigned A-Z from left to right across all groups.
 */
function configToColumns(config) {
  const groups = config.split('-').map(Number);
  const cols = [];
  let code = 65; // 'A'
  groups.forEach((count, idx) => {
    if (idx > 0) cols.push(''); // aisle
    for (let i = 0; i < count; i++) cols.push(String.fromCharCode(code++));
  });
  return cols;
}

/**
 * Generates HTML for a single segment's seat map.
 * Uses layout from the API (config string, rows, rowOffset) so each aircraft
 * shows its real aisle/column configuration and rows are numbered correctly
 * relative to the full cabin stack (e.g. economy starts at row 9 if business
 * occupies rows 1-8).
 */
function generateSegmentSeatMap(mapData, segmentIdx, legType, cabinClass) {
  const { segment, occupiedSeats, layout } = mapData;
  const occupiedSet = new Set(occupiedSeats);

  const rows      = layout?.rows      ?? (cabinClass === 'economy' ? 20 : cabinClass === 'business' ? 8 : 4);
  const config    = layout?.config    ?? (cabinClass === 'economy' ? '3-3-3' : cabinClass === 'business' ? '2-2-2' : '1-2-1');
  const rowOffset = layout?.rowOffset ?? 0;
  const deck      = layout?.deck      ?? null;

  const cols     = configToColumns(config);
  const rowClass = cabinClass === 'business' ? 'business' : cabinClass === 'first' ? 'first-class' : '';
  const segmentKey = `${legType}-${segmentIdx}`;

  let html = `<div style="border:1px solid var(--gray-200);border-radius:var(--radius-lg);padding:20px;">`;
  html += `<div class="seat-map-header" style="margin-bottom:16px;">
    <div style="display:inline-block;background:var(--red-100);color:var(--red-700);padding:4px 12px;border-radius:100px;margin-bottom:8px;font-size:0.65rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
      ${escapeHtml(segment.flightNumber)} · ${escapeHtml(segment.aircraft?.type || 'Aircraft')} · ${escapeHtml(capitalise(cabinClass))}${deck ? ` · ${deck === 'upper' ? 'Upper Deck' : 'Main Deck'}` : ''} · ${rows} rows
    </div>
    <div style="font-size:0.75rem;color:var(--gray-500);">${escapeHtml(segment.departure)} ${escapeHtml(segment.from)} → ${escapeHtml(segment.arrival)} ${escapeHtml(segment.to)}</div>
  </div>`;

  html += `<div class="seat-map" id="seatMap-${segmentKey}" style="display:grid;grid-template-columns:repeat(${cols.length},1fr);gap:6px;margin-bottom:16px;">`;

  // Column header letters
  cols.forEach(col => {
    html += col
      ? `<div style="text-align:center;font-family:var(--font-heading);font-size:0.6rem;font-weight:700;color:var(--gray-400);">${escapeHtml(col)}</div>`
      : '<div></div>';
  });

  // Seat rows — numbered from (rowOffset+1) so economy follows business/first
  for (let row = rowOffset + 1; row <= rowOffset + rows; row++) {
    cols.forEach(col => {
      if (!col) { html += '<div class="seat aisle"></div>'; return; }
      const seatId  = `${row}${col}`;
      const occupied = occupiedSet.has(seatId);
      const cls  = occupied ? 'occupied' : rowClass;
      const attr = occupied ? '' : ` data-seat-id="${escapeHtml(seatId)}" data-segment-key="${segmentKey}"`;
      html += `<div class="seat ${cls}" id="seat-${segmentKey}-${escapeHtml(seatId)}"${attr}>${escapeHtml(seatId)}</div>`;
    });
  }

  html += '</div>';
  html += `<p id="selectedSeatLabel-${segmentKey}" style="text-align:center;font-size:0.8rem;color:var(--gray-600);margin:0;">No seat selected</p>`;
  html += '</div>';

  return html;
}

/**
 * Updates the overall "selected seats" label showing all selected seats across all segments.
 */
function updateSelectedSeatsLabel() {
  const label = document.getElementById('selectedSeatsLabel');
  const seatList = Object.entries(selectedSeats)
    .map(([key, seat]) => `${key}: ${seat}`)
    .join(' · ');
  label.textContent = seatList ? `Selected: ${seatList}` : 'Select your seat(s)';
}

/**
 * Marks a seat as selected in the seat map UI for a specific segment.
 * @param {string} seatId - Seat ID string e.g. '4C'
 * @param {string} segmentKey - Segment identifier e.g. 'outbound-0'
 */
// Connection: part of the public booking checkout flow from itinerary load through confirmation.
function selectSeat(seatId, segmentKey) {
  if (selectedSeats[segmentKey]) {
    const prev = document.getElementById(`seat-${segmentKey}-${selectedSeats[segmentKey]}`);
    if (prev) prev.classList.remove('selected');
  }
  selectedSeats[segmentKey] = seatId;
  const seat = document.getElementById(`seat-${segmentKey}-${seatId}`);
  if (seat) seat.classList.add('selected');
  const label = document.getElementById(`selectedSeatLabel-${segmentKey}`);
  if (label) {
    label.textContent = `✓ Seat ${seatId} selected`;
    label.style.color = 'var(--success)';
    label.style.fontWeight = '700';
    label.style.fontSize = '0.88rem';
    label.style.fontFamily = 'var(--font-heading)';
  }
  updateSelectedSeatsLabel();
}

/**
 * Validates passenger details and advances the booking flow to the seat selection step.
 */
// Connection: part of the public booking checkout flow from itinerary load through confirmation.
function goToSeats() {
  if (!validatePassengerDetails()) return;
  showStep('stepSeats');
  activateStepIndicator(2);
}

/**
 * Navigates back to the passenger details step from the seat selection step.
 */
// Connection: part of the public booking checkout flow from itinerary load through confirmation.
function goToPassengers() {
  showStep('stepPassengers');
  activateStepIndicator(1);
}

/**
 * Validates that a seat has been selected, then advances to the payment step
 * and renders the payment summary panel.
 */
// Connection: part of the public booking checkout flow from itinerary load through confirmation.
function goToPayment() {
  const hasSeats = Object.keys(selectedSeats).length > 0;
  if (!hasSeats && seatMapAvailable) {
    showToast('Please select a seat to continue', 'error');
    return;
  }
  showStep('stepPayment');
  activateStepIndicator(3);
  renderPaymentSummary();
}

/**
 * Renders the pre-payment order summary panel with per-leg details,
 * cabin class, seat, passenger count, individual flight segments, and total due.
 * Supports both one-way and round-trip layouts.
 */
// Connection: part of the public booking checkout flow from itinerary load through confirmation.
function renderPaymentSummary() {
  if (bookingData.isMultiCity) {
    const { legs, passengers, totalPrice } = bookingData;
    let inner = '';
    legs.forEach((leg, i) => {
      const first = leg.itinerary.segments[0];
      const last  = leg.itinerary.segments[leg.itinerary.segments.length - 1];
      inner += `
        <div style="background:var(--dark);padding:12px 24px;">
          <div style="font-family:var(--font-heading);font-size:0.6rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.55);margin-bottom:2px;">Flight ${i + 1}</div>
          <div style="font-family:var(--font-heading);font-weight:800;color:var(--white);font-size:1rem;">${escapeHtml(toIata(first.from))} → ${escapeHtml(toIata(last.to))}</div>
        </div>
        <div style="padding:12px 24px;">
          ${summaryRow('Date',       formatDate(first.departureDate))}
          ${summaryRow('Cabin',      capitalise(leg.cabinClass))}
          ${summaryRow('Seat',       selectedSeats[`leg${i}-0`] || 'TBD')}
          ${summaryRow('Passengers', passengers)}
          ${leg.itinerary.segments.map(s => summaryRow(escapeHtml(s.flightNumber), `${escapeHtml(toIata(s.from))} → ${escapeHtml(toIata(s.to))} · ${escapeHtml(s.departure)} → ${escapeHtml(s.arrival)}`)).join('')}
          ${summaryRow('Leg price', `$${leg.price.toFixed(0)}`)}
        </div>
        ${i < legs.length - 1 ? '<div style="border-top:2px dashed var(--gray-200);"></div>' : ''}`;
    });
    inner += `
      <div style="padding:0 24px 16px;">
        <div style="border-top:2px solid var(--gray-200);padding-top:14px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-family:var(--font-heading);font-weight:700;color:var(--gray-600);font-size:0.82rem;text-transform:uppercase;letter-spacing:0.06em;">Total Due</span>
          <span style="font-family:var(--font-heading);font-size:1.5rem;font-weight:800;color:var(--dark);">$${totalPrice.toFixed(0)}</span>
        </div>
      </div>`;
    document.getElementById('paymentSummary').innerHTML =
      `<div style="background:var(--white);border-radius:var(--radius-lg);border:1px solid var(--gray-100);overflow:hidden;margin-bottom:0;">${inner}</div>`;
    return;
  }

  const { itinerary, returnItinerary, cabinClass, returnCabinClass,
          passengers, totalPrice, outboundPrice, returnPrice, isRoundTrip } = bookingData;

  /**
   * Builds the HTML block for a single booking leg (outbound or return).
   * @param {Object} itin - Hydrated itinerary object for this leg
   * @param {string} cabin - Cabin class for this leg
   * @param {number} price - Price for this leg
   * @param {string} label - Section label e.g. 'Outbound Flight'
   * @returns {string} HTML string for the leg summary
   */
  // Connection: part of the public booking checkout flow from itinerary load through confirmation.
  function legHtml(itin, cabin, price, label, legType) {
    /* Purpose: transforms each item in the current collection for the surrounding render or data step. Connection: feeds the surrounding collection pipeline inside the booking checkout flow on the public site. */ const seg = itin.segments.map(s =>
      summaryRow(escapeHtml(s.flightNumber),
        `${escapeHtml(toIata(s.from))} → ${escapeHtml(toIata(s.to))} · ${escapeHtml(s.departure)} → ${escapeHtml(s.arrival)}`)
    ).join('');
    return `
      <div style="background:var(--dark);padding:12px 24px;">
        <div style="font-family:var(--font-heading);font-size:0.6rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.55);margin-bottom:2px;">${label}</div>
        <div style="font-family:var(--font-heading);font-weight:800;color:var(--white);font-size:1rem;">${escapeHtml(toIata(itin.from))} → ${escapeHtml(toIata(itin.to))}</div>
      </div>
      <div style="padding:12px 24px;">
        ${summaryRow('Date',          formatDate(itin.date))}
        ${summaryRow('Cabin class',   capitalise(cabin))}
        ${summaryRow('Seat',          selectedSeats[`${legType}-0`] || 'TBD')}
        ${summaryRow('Passengers',    passengers)}
        ${seg}
        ${isRoundTrip ? summaryRow('Leg price', `$${price.toFixed(0)}`) : ''}
      </div>`;
  }

  let inner = legHtml(itinerary, cabinClass, outboundPrice, isRoundTrip ? 'Outbound Flight' : 'Your Journey', 'outbound');

  if (isRoundTrip && returnItinerary) {
    inner += `<div style="border-top:2px dashed var(--gray-200);"></div>`;
    inner += legHtml(returnItinerary, returnCabinClass, returnPrice, 'Return Flight', 'return');
  }

  inner += `
    <div style="padding:0 24px 16px;">
      <div style="border-top:2px solid var(--gray-200);padding-top:14px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-family:var(--font-heading);font-weight:700;color:var(--gray-600);font-size:0.82rem;text-transform:uppercase;letter-spacing:0.06em;">Total Due</span>
        <span style="font-family:var(--font-heading);font-size:1.5rem;font-weight:800;color:var(--dark);">$${totalPrice.toFixed(0)}</span>
      </div>
    </div>`;

  document.getElementById('paymentSummary').innerHTML =
    `<div style="background:var(--white);border-radius:var(--radius-lg);border:1px solid var(--gray-100);overflow:hidden;margin-bottom:0;">${inner}</div>`;
}

/**
 * Builds a single key-value row HTML string for the payment summary table.
 * @param {string} label - Row label text
 * @param {string|number} value - Row value text
 * @returns {string} HTML string for one summary row
 */
// Connection: part of the public booking checkout flow from itinerary load through confirmation.
function summaryRow(label, value) {
  return `<div style="display:flex;justify-content:space-between;gap:20px;padding:7px 0;border-bottom:1px solid var(--gray-100);font-size:0.85rem;">
    <span style="color:var(--gray-600);">${label}</span>
    <span style="font-weight:600;color:var(--dark);text-align:right;">${value}</span>
  </div>`;
}

/**
 * Formats a credit card number input by inserting double spaces every 4 digits
 * and capping input at 16 digits.
 * @param {HTMLInputElement} input - The card number input element
 */
// Connection: part of the public booking checkout flow from itinerary load through confirmation.
function formatCard(input) {
  let value = input.value.replace(/\D/g, '').substring(0, 16);
  input.value = value.replace(/(.{4})/g, '$1  ').trim();
}

/**
 * Formats a card expiry input as "MM / YY" while capping at 4 digits.
 * @param {HTMLInputElement} input - The expiry input element
 */
// Connection: part of the public booking checkout flow from itinerary load through confirmation.
function formatExpiry(input) {
  let value = input.value.replace(/\D/g, '').substring(0, 4);
  if (value.length >= 3) value = `${value.substring(0, 2)} / ${value.substring(2)}`;
  input.value = value;
}

/**
 * Submits the confirmed booking to the API. Books the outbound leg first,
 * then the return leg for round-trips (with automatic seat fallback on conflict).
 * On success, advances to the confirmation step and shows booking references.
 * Disables the confirm button during processing to prevent double-submission.
 * @returns {Promise<void>}
 */
// Connection: part of the public booking checkout flow from itinerary load through confirmation.
async function confirmBooking() {
  if (!bookingData) {
    showToast('Your itinerary could not be loaded.', 'error');
    return;
  }

  const passenger = collectPassengerDetails();
  if (!passenger) return;

  const button = document.querySelector('#stepPayment .btn-primary');
  const originalText = button ? button.innerHTML : '';
  if (button) { button.disabled = true; button.innerHTML = 'Processing…'; }

  try {
    const token = localStorage.getItem('afv_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    // ── Multi-city: book each leg sequentially ───────────────────
    if (bookingData.isMultiCity) {
      const bookingResults = [];
      for (let i = 0; i < bookingData.legs.length; i++) {
        const leg = bookingData.legs[i];
        const res = await fetch('/api/bookings', {
          method: 'POST', headers,
          body: JSON.stringify({
            itinerary:        leg.rawItinerary,
            cabinClass:       leg.cabinClass,
            passengers:       bookingData.passengers,
            seat:             selectedSeats[`leg${i}-0`] || null,
            passengerDetails: [passenger]
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Booking failed for Flight ${i + 1}`);
        bookingResults.push(data);
      }
      showMultiCityConfirmation(bookingResults);
      return;
    }

    // Book outbound leg
    const outboundRes = await fetch('/api/bookings', {
      method: 'POST', headers,
      body: JSON.stringify({
        itinerary:        bookingData.rawItinerary,
        cabinClass:       bookingData.cabinClass,
        passengers:       bookingData.passengers,
        seat:             selectedSeats['outbound-0'] || null,
        passengerDetails: [passenger]
      })
    });
    const outboundData = await outboundRes.json();
    if (!outboundRes.ok) throw new Error(outboundData.error || 'Outbound booking failed');

    // Book return leg (if round-trip)
    let returnData = null;
    if (bookingData.isRoundTrip && bookingData.rawReturnItinerary) {
      const returnRes = await fetch('/api/bookings', {
        method: 'POST', headers,
        body: JSON.stringify({
          itinerary:        bookingData.rawReturnItinerary,
          cabinClass:       bookingData.returnCabinClass,
          passengers:       bookingData.passengers,
          seat:             selectedSeats['return-0'] || null,
          passengerDetails: [passenger]
        })
      });
      const rd = await returnRes.json();
      if (returnRes.ok) {
        returnData = rd;
      } else if (returnRes.status === 409) {
        // Seat taken on return — rebook without seat preference
        const retryRes = await fetch('/api/bookings', {
          method: 'POST', headers,
          body: JSON.stringify({
            itinerary:        bookingData.rawReturnItinerary,
            cabinClass:       bookingData.returnCabinClass,
            passengers:       bookingData.passengers,
            seat:             null,
            passengerDetails: [passenger]
          })
        });
        const retryData = await retryRes.json();
        if (!retryRes.ok) throw new Error(retryData.error || 'Return booking failed');
        returnData = retryData;
        showToast('Your chosen seat was taken on the return flight. You have been assigned a seat at check-in.', '');
      } else {
        throw new Error(rd.error || 'Return booking failed');
      }
    }

    showConfirmation(outboundData, returnData);
  } catch (error) {
    showToast(error.message || 'Could not complete booking', 'error');
  } finally {
    if (button) { button.disabled = false; button.innerHTML = originalText; }
  }
}

/**
 * Reads and validates passenger details from the form fields.
 * Returns null (and shows a toast) if validation fails.
 * @returns {Object|null} Passenger details object or null
 */
// Connection: part of the public booking checkout flow from itinerary load through confirmation.
function collectPassengerDetails() {
  if (!validatePassengerDetails()) return null;
  return {
    firstName:       document.getElementById('firstName').value.trim(),
    lastName:        document.getElementById('lastName').value.trim(),
    email:           document.getElementById('passengerEmail').value.trim(),
    phone:           document.getElementById('phone').value.trim(),
    nationality:     document.getElementById('nationality').value.trim(),
    documentNumber:  document.getElementById('passportNumber').value.trim(),
    specialRequests: document.getElementById('specialRequests').value.trim(),
    seat:            selectedSeats['outbound-0'] || null
  };
}

/**
 * Renders the booking confirmation step with reference numbers and full
 * journey details for both outbound and return legs (if applicable).
 * Also sets the "View My Bookings" deep-link href.
 * @param {Object} booking - Confirmed outbound booking response from the API
 * @param {Object|null} [returnBooking=null] - Confirmed return booking response or null
 */
// Connection: part of the public booking checkout flow from itinerary load through confirmation.
function showMultiCityConfirmation(bookings) {
  showStep('stepConfirm');

  const refEl = document.getElementById('bookingRefDisplay');
  if (refEl) refEl.textContent = bookings[0]?.bookingRef || '—';

  const detailsEl = document.getElementById('confirmDetails');
  if (!detailsEl) return;

  const totalPaid = bookings.reduce((s, b) => s + Number(b.totalPrice || 0), 0);
  const legsHtml  = bookings.map((b, i) => {
    const segLines = (b.itinerary?.segments || []).map(s =>
      `<div>${escapeHtml(s.flightNumber)}: ${escapeHtml(toIata(s.from))} → ${escapeHtml(toIata(s.to))} (${escapeHtml(s.departure)} → ${escapeHtml(s.arrival)})</div>`
    ).join('');
    return `
      <div style="margin-bottom:12px;">
        <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--gray-500);margin-bottom:4px;">Flight ${i + 1}</div>
        <strong>${escapeHtml(toIata(b.from))} → ${escapeHtml(toIata(b.to))}</strong><br/>
        ${segLines}
        ${escapeHtml(capitalise(b.cabinClass))} · Ref: <strong>${escapeHtml(b.bookingRef)}</strong><br/>
        Seat: ${escapeHtml(b.seat || selectedSeats[`leg${i}-0`] || 'TBD')}<br/>
        Paid: $${Number(b.totalPrice || 0).toFixed(0)}
      </div>
      ${i < bookings.length - 1 ? '<div style="border-top:1px dashed var(--gray-200);margin:10px 0;"></div>' : ''}`;
  }).join('');

  detailsEl.innerHTML = legsHtml +
    `<div style="margin-top:12px;border-top:2px solid var(--gray-200);padding-top:12px;">
      <strong>Total paid: $${totalPaid.toFixed(0)}</strong> · ${bookings.length} flights booked
    </div>`;

  const viewLink = document.getElementById('viewBookingLink');
  if (viewLink) {
    const email = encodeURIComponent(bookings[0]?.passengerDetails?.[0]?.email || '');
    viewLink.href = `my-bookings.php?ref=${encodeURIComponent(bookings[0]?.bookingRef || '')}&email=${email}`;
  }
}

function showConfirmation(booking, returnBooking = null) {
  showStep('stepConfirm');

  // Primary booking ref
  const refEl = document.getElementById('bookingRefDisplay');
  if (refEl) {
    refEl.textContent = booking.bookingRef;
    if (returnBooking) {
      refEl.insertAdjacentHTML('afterend',
        `<div style="margin-top:6px;font-size:0.85rem;color:var(--gray-500);">
          Return: <strong style="color:var(--dark);">${escapeHtml(returnBooking.bookingRef)}</strong>
        </div>`
      );
    }
  }

  /**
   * Builds HTML for a single booking leg in the confirmation panel.
   * @param {Object} b - Booking response object
   * @param {string} label - Section label e.g. 'Outbound'
   * @returns {string} HTML string for the leg confirmation block
   */
  // Connection: part of the public booking checkout flow from itinerary load through confirmation.
  function legDetails(b, label) {
    /* Purpose: transforms each item in the current collection for the surrounding render or data step. Connection: feeds the surrounding collection pipeline inside the booking checkout flow on the public site. */ const segLines = (b.itinerary?.segments || []).map(s =>
      `<div>${escapeHtml(s.flightNumber)}: ${escapeHtml(toIata(s.from))} → ${escapeHtml(toIata(s.to))} (${escapeHtml(s.departure)} → ${escapeHtml(s.arrival)})</div>`
    ).join('');
    const firstName = escapeHtml(b.passengerDetails?.[0]?.firstName || '');
    const lastName  = escapeHtml(b.passengerDetails?.[0]?.lastName  || '');
    return `
      <div style="margin-bottom:${returnBooking ? '12px' : '0'};">
        ${returnBooking ? `<div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--gray-500);margin-bottom:4px;">${label}</div>` : ''}
        <strong>${escapeHtml(toIata(b.from))} → ${escapeHtml(toIata(b.to))}</strong><br/>
        ${segLines}
        ${escapeHtml(capitalise(b.cabinClass))} Class · Seat ${escapeHtml(b.seat || selectedSeats['outbound-0'] || 'TBD')}<br/>
        Passenger: ${firstName} ${lastName}<br/>
        Status: <strong>${escapeHtml(formatStatus(b.status))}</strong><br/>
        <span style="color:var(--dark);font-weight:700;">Total paid: $${Number(b.totalPrice || 0).toFixed(0)}</span>
      </div>`;
  }

  let html = legDetails(booking, 'Outbound');
  if (returnBooking) {
    html += `<div style="border-top:1px dashed var(--gray-200);margin:12px 0;"></div>`;
    html += legDetails(returnBooking, 'Return');
  }

  document.getElementById('confirmDetails').innerHTML = html;

  const viewLink = document.getElementById('viewBookingLink');
  if (viewLink) {
    const email = encodeURIComponent(booking.passengerEmail || booking.passengerDetails?.[0]?.email || '');
    viewLink.href = `my-bookings.php?ref=${encodeURIComponent(booking.bookingRef)}&email=${email}`;
  }
}

/**
 * Shows a specific booking step and hides all others. Scrolls to the top of the page.
 * @param {string} stepId - ID of the step element to show e.g. 'stepPassengers'
 */
// Connection: part of the public booking checkout flow from itinerary load through confirmation.
function showStep(stepId) {
  /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the booking checkout flow on the public site. */ ['stepPassengers', 'stepSeats', 'stepPayment', 'stepConfirm'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', id !== stepId);
  });
  window.scrollTo({ top: 72, behavior: 'smooth' });
}

/**
 * Updates the visual step indicator bar to highlight all completed and current steps.
 * Steps numbered 1–3 are supported; any step at or below the current one is highlighted.
 * @param {number} step - The current active step number (1, 2, or 3)
 */
// Connection: part of the public booking checkout flow from itinerary load through confirmation.
function activateStepIndicator(step) {
  [1, 2, 3].forEach(currentStep => {
    const indicator = document.getElementById(`step${currentStep}Indicator`);
    if (!indicator) return;
    const number = indicator.querySelector('span');
    indicator.classList.remove('is-active', 'is-done');

    if (currentStep < step) {
      indicator.classList.add('is-done');
      if (number) { number.style.background = 'var(--red-700)'; number.style.color = 'var(--white)'; number.textContent = '✓'; }
    } else if (currentStep === step) {
      indicator.classList.add('is-active');
      if (number) { number.style.background = 'var(--red-600)'; number.style.color = 'var(--white)'; number.textContent = currentStep; }
    } else {
      if (number) { number.style.background = 'rgba(255,255,255,0.12)'; number.style.color = 'rgba(255,255,255,0.4)'; number.textContent = currentStep; }
    }

    const line = document.getElementById(`progressLine${currentStep}`);
    if (line) line.classList.toggle('is-done', currentStep < step);
  });
}

/**
 * Validates the passenger details form. Shows a toast and returns false
 * if first name, last name, or a valid email address is missing.
 * @returns {boolean} True if validation passes
 */
// Connection: part of the public booking checkout flow from itinerary load through confirmation.
function validatePassengerDetails() {
  const firstName = document.getElementById('firstName').value.trim();
  const lastName  = document.getElementById('lastName').value.trim();
  const email     = document.getElementById('passengerEmail').value.trim();

  if (!firstName || !lastName) { showToast('Please enter passenger name', 'error'); return false; }
  if (!email || !email.includes('@')) { showToast('Please enter a valid email address', 'error'); return false; }
  return true;
}

/**
 * Sets the text content of a DOM element by ID. Does nothing if the element is not found.
 * @param {string} id - Element ID
 * @param {string|number} value - Text content to set
 */
// Connection: part of the public booking checkout flow from itinerary load through confirmation.
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/**
 * Capitalises the first letter of a string.
 * @param {string} value - Input string
 * @returns {string} String with the first character upper-cased
 */
// Connection: part of the public booking checkout flow from itinerary load through confirmation.
function capitalise(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
}

/**
 * Formats a YYYY-MM-DD date string as a localised long-form date (e.g. "Mon, 20 Apr 2026").
 * @param {string} value - Date string in YYYY-MM-DD format
 * @returns {string} Formatted date string
 */
// Connection: part of the public booking checkout flow from itinerary load through confirmation.
function formatDate(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
  });
}

/**
 * Converts a snake_case or lower-case booking status string to a human-readable
 * title-case label (e.g. 'on_time' → 'On Time').
 * @param {string} status - Raw status string
 * @returns {string} Formatted status label
 */
// Connection: part of the public booking checkout flow from itinerary load through confirmation.
function formatStatus(status) {
  return String(status || 'confirmed').split('_').map(capitalise).join(' ');
}

/**
 * Displays a transient toast notification message. The toast fades after 3.5 seconds.
 * @param {string} message - Message to display
 * @param {string} [type=''] - Optional CSS modifier class e.g. 'error'
 */
// Connection: part of the public booking checkout flow from itinerary load through confirmation.
function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  /* Purpose: runs delayed follow-up logic after the surrounding timeout expires. Connection: continues the booking checkout flow on the public site after a controlled delay. */ setTimeout(() => toast.classList.remove('show'), 3500);
}

/**
 * Attaches all booking page event listeners: seat map clicks, step navigation buttons,
 * confirm button, and payment input formatters. Called once on page load.
 */
// Connection: part of the public booking checkout flow from itinerary load through confirmation.
function bindBookingActions() {
  // Use event delegation on the seat container instead of a single element
  document.getElementById('segmentSeatsContainer')?.addEventListener('click', event => {
    const seat = event.target.closest('[data-seat-id]');
    if (!seat) return;
    const seatId = seat.getAttribute('data-seat-id');
    const segmentKey = seat.getAttribute('data-segment-key');
    selectSeat(seatId, segmentKey);
  });

  document.getElementById('continueToSeatsBtn')?.addEventListener('click',    goToSeats);
  document.getElementById('backToPassengersBtn')?.addEventListener('click',   goToPassengers);
  document.getElementById('continueToPaymentBtn')?.addEventListener('click',  goToPayment);
  /* Purpose: responds to the click event for the surrounding DOM element. Connection: wires the surrounding UI element into the booking checkout flow on the public site. */ document.getElementById('backToSeatsBtn')?.addEventListener('click', () => {
    showStep('stepSeats');
    activateStepIndicator(2);
  });
  document.getElementById('confirmBookingBtn')?.addEventListener('click', confirmBooking);

  /* Purpose: responds to the input event for the surrounding DOM element. Connection: wires the surrounding UI element into the booking checkout flow on the public site. */ document.getElementById('cardNumber')?.addEventListener('input',  event => formatCard(event.target));
  /* Purpose: responds to the input event for the surrounding DOM element. Connection: wires the surrounding UI element into the booking checkout flow on the public site. */ document.getElementById('cardExpiry')?.addEventListener('input',  event => formatExpiry(event.target));
}

initBooking();

window.goToSeats      = goToSeats;
window.goToPassengers = goToPassengers;
window.goToPayment    = goToPayment;
window.confirmBooking = confirmBooking;
window.selectSeat     = selectSeat;
window.formatCard     = formatCard;
window.formatExpiry   = formatExpiry;
