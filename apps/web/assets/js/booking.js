/**
 * Africana Airways - Booking Flow Logic
 */

const params = new URLSearchParams(window.location.search);
let selectedSeat = null;
let bookingData = null;

// ─── XSS helper ───────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

bindBookingActions();

async function initBooking() {
  const rawItinerary = readRawItinerary();
  if (!rawItinerary) {
    showToast('Select an itinerary first to continue with booking.', 'error');
    document.getElementById('selectedFlightInfo').textContent = 'No itinerary selected';
    return;
  }

  const passengers    = Number(params.get('passengers') || 1);
  const cabinClass    = params.get('cabin') || 'economy';
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

function readRawReturnItinerary() {
  const encoded = params.get('returnItinerary');
  if (!encoded) return null;
  try { return JSON.parse(decodeURIComponent(escape(atob(encoded)))); } catch { return null; }
}

function renderSummary() {
  const { itinerary, returnItinerary, cabinClass, returnCabinClass,
          passengers, totalPrice, outboundPrice, returnPrice, isRoundTrip } = bookingData;

  const firstSeg   = itinerary.segments[0];
  const lastSeg    = itinerary.segments[itinerary.segments.length - 1];

  setText('summaryRoute',    `${firstSeg.from} → ${lastSeg.to}${isRoundTrip ? ' (Return)' : ''}`);
  setText('summaryFlight',   itinerary.segments.map(s => s.flightNumber).join(' / ')
    + (returnItinerary ? ' / ' + returnItinerary.segments.map(s => s.flightNumber).join(' / ') : ''));
  setText('summaryDate',     formatDate(firstSeg.departureDate));
  setText('summaryDep',      firstSeg.departure);
  setText('summaryArr',      lastSeg.arrival);
  setText('summaryDuration', isRoundTrip ? `${itinerary.duration} + ${returnItinerary?.duration || ''}` : itinerary.duration);
  setText('summaryCabin',    capitalise(cabinClass));
  setText('summaryPax',      `${passengers} passenger${passengers > 1 ? 's' : ''}`);
  const aircraftTypes = Array.from(new Set([
    ...itinerary.segments.map(s => s.aircraft?.type).filter(Boolean),
    ...(returnItinerary?.segments || []).map(s => s.aircraft?.type).filter(Boolean)
  ]));
  setText('summaryAircraft', aircraftTypes.join(' / ') || 'Aircraft TBA');
  setText('summaryTotal',    `$${totalPrice.toFixed(0)}`);

  // Flight info panel
  const outboundLines = itinerary.segments.map(s => `
    <div style="margin-bottom:6px;">
      <span style="color:var(--red-600);font-size:0.9rem;">${escapeHtml(s.flightNumber)}</span>
      &nbsp; ${escapeHtml(s.from)} → ${escapeHtml(s.to)}
      &nbsp; <span style="color:var(--gray-500);font-weight:400;">${escapeHtml(s.departure)} → ${escapeHtml(s.arrival)}</span>
    </div>`).join('');

  let returnLines = '';
  if (returnItinerary) {
    returnLines = `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--gray-200);">
      <div style="font-size:0.7rem;color:var(--gray-500);font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Return Flight</div>
      ${returnItinerary.segments.map(s => `
        <div style="margin-bottom:6px;">
          <span style="color:var(--red-600);font-size:0.9rem;">${escapeHtml(s.flightNumber)}</span>
          &nbsp; ${escapeHtml(s.from)} → ${escapeHtml(s.to)}
          &nbsp; <span style="color:var(--gray-500);font-weight:400;">${escapeHtml(s.departure)} → ${escapeHtml(s.arrival)}</span>
        </div>`).join('')}
    </div>`;
  }

  document.getElementById('selectedFlightInfo').innerHTML = outboundLines + returnLines;
}

async function loadSeatMap() {
  const continueBtn = document.getElementById('continueToPaymentBtn');

  try {
    const response = await fetch('/api/flights/seat-map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itinerary: bookingData.itinerary,
        cabinClass: bookingData.cabinClass
      })
    });

    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Could not load seats');

    generateSeatMap(bookingData.cabinClass, payload.occupiedSeats || []);
  } catch (error) {
    // Don't render an empty seat map — disable the continue button instead
    const map = document.getElementById('seatMap');
    if (map) {
      map.innerHTML = `<div style="grid-column:span 7;padding:24px;text-align:center;color:var(--gray-500);">
        Seat map is temporarily unavailable. You can still proceed without a seat selection.
      </div>`;
    }
    if (continueBtn) {
      // Allow continuing without a seat rather than blocking the user entirely
      continueBtn.title = 'Seat map unavailable — you will be assigned a seat at check-in';
    }
    showToast(error.message || 'Seat map is temporarily unavailable', 'error');
  }
}

function generateSeatMap(cabinClass, occupiedSeats) {
  const occupiedSet = new Set(occupiedSeats);
  const map = document.getElementById('seatMap');
  const rows     = cabinClass === 'economy' ? 20 : cabinClass === 'business' ? 8 : 4;
  const cols     = ['A', '', 'B', 'C', '', 'D', 'E'];
  const rowClass = cabinClass === 'business' ? 'business' : cabinClass === 'first' ? 'first-class' : '';

  let html = `<div class="seat-map-header" style="grid-column:span 7;">
    <span style="display:inline-block;background:var(--red-100);color:var(--red-700);padding:4px 12px;border-radius:100px;margin-bottom:4px;font-size:0.65rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
      ${escapeHtml(capitalise(cabinClass))} Cabin · ${rows} rows
    </span>
  </div>`;

  cols.forEach(col => {
    html += col
      ? `<div style="text-align:center;font-family:var(--font-heading);font-size:0.6rem;font-weight:700;color:var(--gray-400);">${escapeHtml(col)}</div>`
      : '<div></div>';
  });

  for (let row = 1; row <= rows; row += 1) {
    cols.forEach(col => {
      if (!col) { html += '<div class="seat aisle"></div>'; return; }
      const seatId   = `${row}${col}`;
      const occupied = occupiedSet.has(seatId);
      const cls      = occupied ? 'occupied' : rowClass;
      const attr     = occupied ? '' : ` data-seat-id="${escapeHtml(seatId)}"`;
      html += `<div class="seat ${cls}" id="seat-${escapeHtml(seatId)}"${attr}>${escapeHtml(seatId)}</div>`;
    });
  }

  map.innerHTML = html;
}

function selectSeat(seatId) {
  if (selectedSeat) {
    const prev = document.getElementById(`seat-${selectedSeat}`);
    if (prev) prev.classList.remove('selected');
  }
  selectedSeat = seatId;
  const seat = document.getElementById(`seat-${seatId}`);
  if (seat) seat.classList.add('selected');
  document.getElementById('selectedSeatLabel').textContent = `Selected: Seat ${seatId}`;
}

function goToSeats() {
  if (!validatePassengerDetails()) return;
  showStep('stepSeats');
  activateStepIndicator(2);
}

function goToPassengers() {
  showStep('stepPassengers');
  activateStepIndicator(1);
}

function goToPayment() {
  if (!selectedSeat) {
    showToast('Please select a seat to continue', 'error');
    return;
  }
  showStep('stepPayment');
  activateStepIndicator(3);
  renderPaymentSummary();
}

function renderPaymentSummary() {
  const { itinerary, returnItinerary, cabinClass, returnCabinClass,
          passengers, totalPrice, outboundPrice, returnPrice, isRoundTrip } = bookingData;

  function legHtml(itin, cabin, price, label) {
    const seg = itin.segments.map(s =>
      summaryRow(escapeHtml(s.flightNumber),
        `${escapeHtml(s.from)} → ${escapeHtml(s.to)} · ${escapeHtml(s.departure)} → ${escapeHtml(s.arrival)}`)
    ).join('');
    return `
      <div style="background:var(--dark);padding:12px 24px;">
        <div style="font-family:var(--font-heading);font-size:0.6rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.55);margin-bottom:2px;">${label}</div>
        <div style="font-family:var(--font-heading);font-weight:800;color:var(--white);font-size:1rem;">${escapeHtml(itin.from)} → ${escapeHtml(itin.to)}</div>
      </div>
      <div style="padding:12px 24px;">
        ${summaryRow('Date',          formatDate(itin.date))}
        ${summaryRow('Cabin class',   capitalise(cabin))}
        ${summaryRow('Seat',          selectedSeat)}
        ${summaryRow('Passengers',    passengers)}
        ${seg}
        ${isRoundTrip ? summaryRow('Leg price', `$${price.toFixed(0)}`) : ''}
      </div>`;
  }

  let inner = legHtml(itinerary, cabinClass, outboundPrice, isRoundTrip ? 'Outbound Flight' : 'Your Journey');

  if (isRoundTrip && returnItinerary) {
    inner += `<div style="border-top:2px dashed var(--gray-200);"></div>`;
    inner += legHtml(returnItinerary, returnCabinClass, returnPrice, 'Return Flight');
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

function summaryRow(label, value) {
  return `<div style="display:flex;justify-content:space-between;gap:20px;padding:7px 0;border-bottom:1px solid var(--gray-100);font-size:0.85rem;">
    <span style="color:var(--gray-600);">${label}</span>
    <span style="font-weight:600;color:var(--dark);text-align:right;">${value}</span>
  </div>`;
}

function formatCard(input) {
  let value = input.value.replace(/\D/g, '').substring(0, 16);
  input.value = value.replace(/(.{4})/g, '$1  ').trim();
}

function formatExpiry(input) {
  let value = input.value.replace(/\D/g, '').substring(0, 4);
  if (value.length >= 3) value = `${value.substring(0, 2)} / ${value.substring(2)}`;
  input.value = value;
}

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

    // Book outbound leg
    const outboundRes = await fetch('/api/bookings', {
      method: 'POST', headers,
      body: JSON.stringify({
        itinerary:        bookingData.rawItinerary,
        cabinClass:       bookingData.cabinClass,
        passengers:       bookingData.passengers,
        seat:             selectedSeat,
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
          // Attempt same seat on return; ignore conflict silently
          seat:             selectedSeat,
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
        showToast('Your chosen seat was taken on the return flight — you have been assigned a seat at check-in.', '');
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
    seat:            selectedSeat
  };
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

  function legDetails(b, label) {
    const segLines = (b.itinerary?.segments || []).map(s =>
      `<div>${escapeHtml(s.flightNumber)}: ${escapeHtml(s.from)} → ${escapeHtml(s.to)} (${escapeHtml(s.departure)} → ${escapeHtml(s.arrival)})</div>`
    ).join('');
    const firstName = escapeHtml(b.passengerDetails?.[0]?.firstName || '');
    const lastName  = escapeHtml(b.passengerDetails?.[0]?.lastName  || '');
    return `
      <div style="margin-bottom:${returnBooking ? '12px' : '0'};">
        ${returnBooking ? `<div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--gray-500);margin-bottom:4px;">${label}</div>` : ''}
        <strong>${escapeHtml(b.from)} → ${escapeHtml(b.to)}</strong><br/>
        ${segLines}
        ${escapeHtml(capitalise(b.cabinClass))} Class · Seat ${escapeHtml(b.seat || selectedSeat || 'TBD')}<br/>
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
    viewLink.href = `my-bookings.html?ref=${encodeURIComponent(booking.bookingRef)}&email=${email}`;
  }
}

function showStep(stepId) {
  ['stepPassengers', 'stepSeats', 'stepPayment', 'stepConfirm'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', id !== stepId);
  });
  window.scrollTo({ top: 72, behavior: 'smooth' });
}

function activateStepIndicator(step) {
  [1, 2, 3].forEach(currentStep => {
    const indicator = document.getElementById(`step${currentStep}Indicator`);
    if (!indicator) return;
    const number = indicator.querySelector('span');
    if (currentStep <= step) {
      indicator.style.color = 'var(--red-400)';
      if (number) { number.style.background = 'var(--red-600)'; number.style.color = 'var(--white)'; }
    } else {
      indicator.style.color = 'rgba(255,255,255,0.4)';
      if (number) { number.style.background = 'rgba(255,255,255,0.12)'; number.style.color = 'rgba(255,255,255,0.4)'; }
    }
  });
}

function validatePassengerDetails() {
  const firstName = document.getElementById('firstName').value.trim();
  const lastName  = document.getElementById('lastName').value.trim();
  const email     = document.getElementById('passengerEmail').value.trim();

  if (!firstName || !lastName) { showToast('Please enter passenger name', 'error'); return false; }
  if (!email || !email.includes('@')) { showToast('Please enter a valid email address', 'error'); return false; }
  return true;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function capitalise(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
}

function formatDate(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
  });
}

function formatStatus(status) {
  return String(status || 'confirmed').split('_').map(capitalise).join(' ');
}

function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => toast.classList.remove('show'), 3500);
}

function bindBookingActions() {
  document.getElementById('seatMap')?.addEventListener('click', event => {
    const seat = event.target.closest('[data-seat-id]');
    if (!seat) return;
    selectSeat(seat.getAttribute('data-seat-id'));
  });

  document.getElementById('continueToSeatsBtn')?.addEventListener('click',    goToSeats);
  document.getElementById('backToPassengersBtn')?.addEventListener('click',   goToPassengers);
  document.getElementById('continueToPaymentBtn')?.addEventListener('click',  goToPayment);
  document.getElementById('backToSeatsBtn')?.addEventListener('click', () => {
    showStep('stepSeats');
    activateStepIndicator(2);
  });
  document.getElementById('confirmBookingBtn')?.addEventListener('click', confirmBooking);

  document.getElementById('cardNumber')?.addEventListener('input',  event => formatCard(event.target));
  document.getElementById('cardExpiry')?.addEventListener('input',  event => formatExpiry(event.target));
}

initBooking();

window.goToSeats      = goToSeats;
window.goToPassengers = goToPassengers;
window.goToPayment    = goToPayment;
window.confirmBooking = confirmBooking;
window.selectSeat     = selectSeat;
window.formatCard     = formatCard;
window.formatExpiry   = formatExpiry;
