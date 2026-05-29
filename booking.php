<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Book Your Flight - Africana Airways</title>
  <link rel="stylesheet" href="assets/css/main.css" />
  <link rel="stylesheet" href="assets/css/accessibility.css" />
  <link rel="stylesheet" href="assets/css/booking.css" />
</head>
<body style="visibility:hidden">
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
      <li><a href="booking.php" class="nav-link-book active">
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

<div class="booking-topbar">
  <div class="container">
    <div class="booking-progress">
      <div id="step1Indicator" class="booking-progress-step is-active">
        <span class="booking-progress-index">1</span>
        Passenger Details
      </div>
      <div class="booking-progress-line" id="progressLine1"></div>
      <div id="step2Indicator" class="booking-progress-step">
        <span class="booking-progress-index">2</span>
        Seat Selection
      </div>
      <div class="booking-progress-line" id="progressLine2"></div>
      <div id="step3Indicator" class="booking-progress-step">
        <span class="booking-progress-index">3</span>
        Payment
      </div>
    </div>
  </div>
</div>

<div class="container">
  <div id="stepPassengers" class="booking-layout">
    <div>
      <div id="flightSummaryCard" style="background:var(--white);border-radius:var(--radius-lg);border:1px solid var(--gray-100);padding:20px 24px;margin-bottom:20px;">
        <div style="font-family:var(--font-heading);font-size:0.65rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--gray-400);margin-bottom:8px;">Selected Flight</div>
        <div id="selectedFlightInfo" style="font-family:var(--font-heading);color:var(--dark);font-size:1rem;font-weight:800;">Select a flight from search results</div>
      </div>

      <div class="booking-form-section">
        <div class="form-section-header">
          <div class="step-number">1</div>
          <div class="step-title">Passenger Details</div>
        </div>
        <div class="form-section-body">
          <div class="form-group">
            <label for="firstName" style="font-family:var(--font-heading);font-size:0.68rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--gray-600);">First Name</label>
            <input type="text" class="form-control" id="firstName" placeholder="Joao" required />
          </div>
          <div class="form-group">
            <label for="lastName" style="font-family:var(--font-heading);font-size:0.68rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--gray-600);">Last Name</label>
            <input type="text" class="form-control" id="lastName" placeholder="Silva" required />
          </div>
          <div class="form-group">
            <label for="passengerEmail" style="font-family:var(--font-heading);font-size:0.68rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--gray-600);">Email Address</label>
            <input type="email" class="form-control" id="passengerEmail" placeholder="joao@example.com" required />
          </div>
          <div class="form-group">
            <label for="phone" style="font-family:var(--font-heading);font-size:0.68rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--gray-600);">Phone Number</label>
            <input type="tel" class="form-control" id="phone" placeholder="+258 84 000 0000" />
          </div>
          <div class="form-group">
            <label for="nationality" style="font-family:var(--font-heading);font-size:0.68rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--gray-600);">Nationality</label>
            <input type="text" class="form-control" id="nationality" placeholder="Mozambican" />
          </div>
          <div class="form-group">
            <label for="passportNumber" style="font-family:var(--font-heading);font-size:0.68rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--gray-600);">Passport / ID Number</label>
            <input type="text" class="form-control" id="passportNumber" placeholder="AB123456" />
          </div>
          <div class="form-group form-group-full">
            <label for="specialRequests" style="font-family:var(--font-heading);font-size:0.68rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--gray-600);">Special Requests</label>
            <textarea class="form-control" id="specialRequests" rows="2" placeholder="Dietary requirements, wheelchair assistance, meal preference..."></textarea>
          </div>
        </div>
        <div style="padding:0 28px 28px;">
          <button class="btn btn-primary" id="continueToSeatsBtn" type="button">Continue to Seat Selection -></button>
        </div>
      </div>
    </div>

    <div class="booking-summary">
      <div class="summary-header">
        <div class="summary-title">Booking Summary</div>
        <div class="summary-route" id="summaryRoute">-</div>
      </div>
      <div class="summary-body">
        <div class="summary-row">
          <span class="summary-label">Flight</span>
          <span class="summary-value" id="summaryFlight">-</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Date</span>
          <span class="summary-value" id="summaryDate">-</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Departure</span>
          <span class="summary-value" id="summaryDep">-</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Arrival</span>
          <span class="summary-value" id="summaryArr">-</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Duration</span>
          <span class="summary-value" id="summaryDuration">-</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Cabin Class</span>
          <span class="summary-value" id="summaryCabin">-</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Passengers</span>
          <span class="summary-value" id="summaryPax">1</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Aircraft</span>
          <span class="summary-value" id="summaryAircraft">-</span>
        </div>
      </div>
      <div class="summary-total">
        <span class="total-label">Total</span>
        <span class="total-price" id="summaryTotal">-</span>
      </div>
    </div>
  </div>

  <div id="stepSeats" class="hidden" style="padding:40px 0;">
    <div class="booking-form-section">
      <div class="form-section-header">
        <div class="step-number">2</div>
        <div class="step-title">Select Your Seats</div>
      </div>
      <div style="padding:24px;">
        <div style="display:flex;gap:16px;justify-content:center;margin-bottom:20px;flex-wrap:wrap;">
          <span style="display:flex;align-items:center;gap:6px;font-size:0.75rem;color:var(--gray-600);"><span style="width:16px;height:16px;border-radius:3px;background:var(--white);border:1.5px solid var(--gray-200);display:inline-block;"></span>Available</span>
          <span style="display:flex;align-items:center;gap:6px;font-size:0.75rem;color:var(--gray-600);"><span style="width:16px;height:16px;border-radius:3px;background:var(--red-600);display:inline-block;"></span>Selected</span>
          <span style="display:flex;align-items:center;gap:6px;font-size:0.75rem;color:var(--gray-600);"><span style="width:16px;height:16px;border-radius:3px;background:var(--gray-100);display:inline-block;"></span>Occupied</span>
        </div>
        <div id="segmentSeatsContainer" style="display:flex;flex-direction:column;gap:32px;"></div>
        <p id="selectedSeatsLabel" style="text-align:center;margin-top:24px;font-family:var(--font-heading);font-size:0.85rem;color:var(--gray-600);">Select your seat(s)</p>
        <div style="display:flex;gap:12px;margin-top:24px;">
          <button class="btn btn-outline-red" id="backToPassengersBtn" type="button"><- Back</button>
          <button class="btn btn-primary" id="continueToPaymentBtn" type="button">Continue to Payment -></button>
        </div>
      </div>
    </div>
  </div>

  <div id="stepPayment" class="hidden" style="padding:40px 0;">
    <div style="max-width:660px;margin:0 auto;">
      <div id="paymentSummary" style="margin-bottom:20px;"></div>

      <div class="booking-form-section">
        <div class="form-section-header">
          <div class="step-number">3</div>
          <div class="step-title">Payment Details</div>
          <div style="margin-left:auto;display:flex;gap:8px;align-items:center;">
            <span style="font-family:var(--font-heading);font-size:0.6rem;font-weight:800;color:#1a1f71;padding:3px 8px;border:1px solid var(--gray-200);border-radius:4px;">VISA</span>
            <span style="font-family:var(--font-heading);font-size:0.6rem;font-weight:800;color:#eb001b;padding:3px 8px;border:1px solid var(--gray-200);border-radius:4px;">MC</span>
            <span style="font-family:var(--font-heading);font-size:0.6rem;font-weight:800;color:#007bc1;padding:3px 8px;border:1px solid var(--gray-200);border-radius:4px;">AMEX</span>
          </div>
        </div>
        <div class="form-section-body">
          <div class="form-group form-group-full">
            <label for="cardName" style="font-family:var(--font-heading);font-size:0.68rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--gray-600);">Cardholder Name</label>
            <input type="text" class="form-control" id="cardName" placeholder="JOAO SILVA" autocomplete="cc-name" />
          </div>
          <div class="form-group form-group-full">
            <label for="cardNumber" style="font-family:var(--font-heading);font-size:0.68rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--gray-600);">Card Number</label>
            <input type="text" class="form-control" id="cardNumber" placeholder="1234  5678  9012  3456" maxlength="19" autocomplete="cc-number" />
          </div>
          <div class="form-group">
            <label for="cardExpiry" style="font-family:var(--font-heading);font-size:0.68rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--gray-600);">Expiry Date</label>
            <input type="text" class="form-control" id="cardExpiry" placeholder="MM / YY" maxlength="7" autocomplete="cc-exp" />
          </div>
          <div class="form-group">
            <label for="cardCvv" style="font-family:var(--font-heading);font-size:0.68rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--gray-600);">CVV</label>
            <input type="text" class="form-control" id="cardCvv" placeholder="..." maxlength="4" autocomplete="cc-csc" />
          </div>
          <div class="form-group form-group-full">
            <label for="billingCountry" style="font-family:var(--font-heading);font-size:0.68rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--gray-600);">Billing Country</label>
            <select class="form-control" id="billingCountry">
              <option value="MZ">Mozambique</option>
              <option value="ZA">South Africa</option>
              <option value="DZ">Algeria</option>
              <option value="KE">Kenya</option>
              <option value="NG">Nigeria</option>
              <option value="GB">United Kingdom</option>
              <option value="FR">France</option>
              <option value="PT">Portugal</option>
              <option value="US">United States</option>
              <option value="AE">United Arab Emirates</option>
              <option value="SG">Singapore</option>
              <option value="BR">Brazil</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>
        <div style="padding:0 28px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;padding:12px 16px;background:var(--gray-50);border-radius:var(--radius-sm);border:1px solid var(--gray-100);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#166534" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span style="font-size:0.78rem;color:var(--gray-600);">Your payment is encrypted and secured with 256-bit SSL.</span>
          </div>
        </div>
        <div style="padding:0 28px 28px;display:flex;gap:12px;flex-wrap:wrap;">
          <button class="btn btn-outline-red" id="backToSeatsBtn" type="button"><- Back to Seats</button>
          <button class="btn btn-primary" id="confirmBookingBtn" type="button" style="flex:1;justify-content:center;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Confirm &amp; Pay
          </button>
        </div>
      </div>
    </div>
  </div>

  <div id="stepConfirm" class="hidden">
    <div class="confirmation-card">
      <div class="confirm-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div class="section-tag">Booking Confirmed</div>
      <h2 style="margin:12px 0;">Your flight is booked!</h2>
      <p style="color:var(--gray-600);margin-bottom:20px;">A confirmation has been sent to your email address. Please keep your booking reference handy at check-in.</p>
      <div class="booking-ref-wrapper">
        <p class="booking-ref-instruction">Your booking reference</p>
        <div class="booking-ref" id="bookingRefDisplay">-</div>
        <p style="font-size:0.78rem;color:var(--gray-500);margin-top:10px;">Use this code + your email to access your booking in <strong>My Bookings</strong></p>
      </div>
      <div id="confirmDetails" style="margin:20px 0;font-size:0.88rem;color:var(--gray-600);line-height:1.8;"></div>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:24px;">
        <a href="my-bookings.php" class="btn btn-primary" id="viewBookingLink">View My Booking →</a>
        <a href="index.php" class="btn btn-outline-red">Back to Home</a>
      </div>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script src="assets/js/main.js"></script>
<script src="assets/js/booking.js"></script>
</body>
</html>
