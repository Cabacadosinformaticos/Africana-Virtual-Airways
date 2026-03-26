const express = require('express');

const { getAllAirports } = require('../repositories/airport-repository');
const { getOccupiedSeats } = require('../repositories/booking-repository');
const { listRoutes } = require('../repositories/route-repository');
const { searchItineraries, validateAndHydrateItinerary } = require('../services/flights/search-service');
const { asyncHandler } = require('../utils/async-handler');
const { allClassPrices, getPricingFactors } = require('../utils/pricing-utils');

const router = express.Router();

router.get('/search', asyncHandler(async (req, res) => {
  const { from, to, date, passengers = 1 } = req.query;

  if (!from || !to) {
    return res.status(400).json({ error: 'from and to are required' });
  }

  const result = await searchItineraries({
    from: String(from).toUpperCase(),
    to:   String(to).toUpperCase(),
    date,
    passengers: Number(passengers) || 1
  });

  return res.json(result);
}));

router.get('/routes', asyncHandler(async (req, res) => {
  const [routes, airports] = await Promise.all([listRoutes(), getAllAirports()]);

  const response = routes
    .filter(route => route.status === 'active')
    .map(route => ({
      from:        route.fromAirport,
      to:          route.toAirport,
      fromCity:    airports[route.fromAirport]?.city || route.fromAirport,
      toCity:      airports[route.toAirport]?.city   || route.toAirport,
      fromCoords:  airports[route.fromAirport]
        ? [airports[route.fromAirport].lat, airports[route.fromAirport].lon]
        : null,
      toCoords:    airports[route.toAirport]
        ? [airports[route.toAirport].lat, airports[route.toAirport].lon]
        : null,
      distanceKm:  route.distanceKm,
      hub:         route.hubAirport
    }));

  return res.json(response);
}));

router.get('/airports', asyncHandler(async (req, res) => {
  const airports = await getAllAirports();
  res.json(airports);
}));

router.post('/itinerary', asyncHandler(async (req, res) => {
  const { itinerary, passengers = 1 } = req.body;
  const hydratedItinerary = await validateAndHydrateItinerary(itinerary);
  const passengerCount = Number(passengers) || 1;

  const destination = hydratedItinerary.to || hydratedItinerary.segments.at(-1)?.to;
  const pricesPerPerson = hydratedItinerary.segments.reduce((totals, segment) => {
    const segmentDate   = new Date(`${segment.departureDate}T12:00:00`);
    const segmentPrices = allClassPrices(segment.distanceKm, segmentDate, 0.6, destination);
    totals.economy  += segmentPrices.economy.perPerson;
    totals.business += segmentPrices.business.perPerson;
    totals.first    += segmentPrices.first.perPerson;
    return totals;
  }, { economy: 0, business: 0, first: 0 });

  return res.json({
    ...hydratedItinerary,
    pricesPerPerson,
    prices: {
      economy:  pricesPerPerson.economy  * passengerCount,
      business: pricesPerPerson.business * passengerCount,
      first:    pricesPerPerson.first    * passengerCount
    }
  });
}));

router.get('/pricing-factors', (req, res) => {
  const date = req.query.date ? new Date(req.query.date) : new Date();
  res.json(getPricingFactors(date));
});

router.post('/seat-map', asyncHandler(async (req, res) => {
  const { itinerary, cabinClass } = req.body;

  if (!itinerary || !Array.isArray(itinerary.segments) || !itinerary.segments.length) {
    return res.status(400).json({ error: 'A valid itinerary is required' });
  }

  if (!['economy', 'business', 'first'].includes(cabinClass)) {
    return res.status(400).json({ error: 'A valid cabin class is required' });
  }

  const occupiedSeats = await getOccupiedSeats(itinerary.segments, cabinClass);
  return res.json({ occupiedSeats });
}));

module.exports = router;
