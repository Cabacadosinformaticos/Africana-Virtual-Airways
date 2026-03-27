const express = require('express');

const { attachUserIfPresent, requireAuth } = require('../middlewares/auth-middleware');
const {
  createBooking,
  findBookingByRef,
  findBookingByRefAndEmail,
  getOccupiedSeats,
  listBookingsByUserId,
  updateBookingStatus
} = require('../repositories/booking-repository');
const { findUserByEmail, findUserById } = require('../repositories/user-repository');
const { allClassPrices } = require('../utils/pricing-utils');
const { asyncHandler } = require('../utils/async-handler');
const { validateAndHydrateItinerary } = require('../services/flights/search-service');

const router = express.Router();

router.post('/', attachUserIfPresent, asyncHandler(async (req, res) => {
  const { itinerary, cabinClass, passengers = 1, passengerDetails = [], seat } = req.body;

  if (!itinerary) {
    return res.status(400).json({ error: 'itinerary is required' });
  }

  if (!['economy', 'business', 'first'].includes(cabinClass)) {
    return res.status(400).json({ error: 'A valid cabin class is required' });
  }

  if (!Array.isArray(passengerDetails) || !passengerDetails.length) {
    return res.status(400).json({ error: 'At least one passenger is required' });
  }

  const primaryPassenger = passengerDetails[0];
  if (!primaryPassenger.firstName || !primaryPassenger.lastName || !primaryPassenger.email) {
    return res.status(400).json({ error: 'Primary passenger name and email are required' });
  }

  const passengerEmail = String(primaryPassenger.email).trim().toLowerCase();
  const authenticatedUser = req.user?.id ? await findUserById(req.user.id) : null;
  const matchedUser = authenticatedUser ? null : await findUserByEmail(passengerEmail);
  const bookingOwner = authenticatedUser || matchedUser || null;

  const hydratedItinerary = await validateAndHydrateItinerary(itinerary);

  // Pre-flight seat check for a fast, user-friendly response before the transaction
  if (seat) {
    const occupiedSeats = await getOccupiedSeats(hydratedItinerary.segments, cabinClass);
    if (occupiedSeats.includes(seat)) {
      return res.status(409).json({ error: 'That seat has just been taken. Please choose another one.' });
    }
  }

  const passengerCount = Number(passengers) || passengerDetails.length || 1;
  const totalPrice = calculateItineraryTotal(hydratedItinerary, cabinClass, passengerCount);
  const bookingRef = await generateUniqueReference();
  const booking = await createBooking({
    bookingRef,
    userId: bookingOwner?.id || null,
    userName: bookingOwner?.name || `${primaryPassenger.firstName} ${primaryPassenger.lastName}`.trim(),
    passengerEmail,
    flightNumber: hydratedItinerary.segments.map(segment => segment.flightNumber).join(' / '),
    from: hydratedItinerary.from,
    to: hydratedItinerary.to,
    date: hydratedItinerary.date,
    cabinClass,
    passengers: passengerCount,
    totalPrice,
    status: 'confirmed',
    seat: seat || null,
    passengerDetails: passengerDetails.map(passenger => ({
      ...passenger,
      email: passenger.email ? String(passenger.email).trim().toLowerCase() : '',
      seat: passenger.seat || seat || null
    })),
    itinerary: hydratedItinerary
  });

  return res.status(201).json(booking);
}));

router.get('/my', requireAuth, asyncHandler(async (req, res) => {
  const authenticatedUser = await findUserById(req.user.id);
  const bookings = await listBookingsByUserId(req.user.id, authenticatedUser?.email || req.user.email || null);
  return res.json(bookings);
}));

router.get('/lookup', asyncHandler(async (req, res) => {
  const { ref, email } = req.query;

  if (!ref || !email) {
    return res.status(400).json({ error: 'booking ref and email are required' });
  }

  const booking = await findBookingByRefAndEmail(ref, email);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  return res.json(booking);
}));

router.get('/:ref', requireAuth, asyncHandler(async (req, res) => {
  const booking = await findBookingByRef(req.params.ref);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  if (!canAccessBooking(booking, req.user)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  return res.json(booking);
}));

router.put('/:ref/cancel', requireAuth, asyncHandler(async (req, res) => {
  const booking = await findBookingByRef(req.params.ref);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  if (!canAccessBooking(booking, req.user)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (booking.status === 'cancelled') {
    return res.status(400).json({ error: 'Booking already cancelled' });
  }

  const updatedBooking = await updateBookingStatus(req.params.ref, 'cancelled');
  return res.json(updatedBooking);
}));

function calculateItineraryTotal(itinerary, cabinClass, passengers) {
  // destination ICAO drives region-aware seasonal pricing — must match what the
  // /api/flights/itinerary endpoint showed the user so the price is consistent
  const destination = itinerary.to || itinerary.segments.at(-1)?.to || null;
  return itinerary.segments.reduce((total, segment) => {
    const segmentDate  = new Date(`${segment.departureDate}T12:00:00`);
    const segmentPrice = allClassPrices(segment.distanceKm, segmentDate, 0.6, destination)[cabinClass]?.perPerson || 0;
    return total + segmentPrice * passengers;
  }, 0);
}

function canAccessBooking(booking, user) {
  if (!user) return false;
  return user.role === 'admin'
    || booking.userId === user.id
    || String(booking.passengerEmail).toLowerCase() === String(user.email).toLowerCase();
}

async function generateUniqueReference() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  while (true) {
    const candidate = 'AFV' + Array.from(
      { length: 6 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join('');

    // eslint-disable-next-line no-await-in-loop
    const existing = await findBookingByRef(candidate);
    if (!existing) return candidate;
  }
}

module.exports = router;
