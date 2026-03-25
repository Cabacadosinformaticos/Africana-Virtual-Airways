const { getAllAirports } = require('../../repositories/airport-repository');
const { getRoutesWithSchedules, getSchedulesByFlightNumbers } = require('../../repositories/route-repository');
const { allClassPrices } = require('../../utils/pricing-utils');
const {
  addMinutes,
  combineDateAndTime,
  formatDisplayTime,
  formatDurationMinutes,
  formatIsoDate,
  timeStringToMinutes
} = require('../../utils/itinerary-utils');

const MIN_LAYOVER_MINUTES = 90;

async function searchItineraries({ from, to, date, passengers = 1 }) {
  const airports    = await getAllAirports();
  const origin      = airports[from];
  const destination = airports[to];

  if (!origin || !destination) {
    const error = new Error('Airport not found');
    error.status = 404;
    throw error;
  }

  const travelDate = date || formatIsoDate(addMinutes(new Date(), 7 * 1440));
  const routes = await getRoutesWithSchedules();
  const activeRoutes = routes.filter(route => route.status === 'active');
  const routesByOrigin = groupRoutesByOrigin(activeRoutes);

  const directPaths = (routesByOrigin.get(from) || [])
    .filter(route => route.toAirport === to)
    .map(route => [route]);

  const connectingPaths = [];
  (routesByOrigin.get(from) || []).forEach(firstLeg => {
    if (firstLeg.toAirport === to) return;
    const secondLegs = routesByOrigin.get(firstLeg.toAirport) || [];
    secondLegs.forEach(secondLeg => {
      if (secondLeg.toAirport !== to) return;
      if (secondLeg.toAirport === from) return;
      connectingPaths.push([firstLeg, secondLeg]);
    });
  });

  const candidatePaths = directPaths.length ? directPaths : connectingPaths;
  const itineraries = candidatePaths.flatMap(path => buildItinerariesForPath(path, travelDate, Number(passengers)));

  itineraries.sort((left, right) => {
    if (left.stopCount !== right.stopCount) return left.stopCount - right.stopCount;
    return left.pricesPerPerson.economy - right.pricesPerPerson.economy;
  });

  return {
    origin,
    destination,
    travelDate,
    itineraries: itineraries.slice(0, 8),
    searchSummary: {
      stopsOffered: itineraries.some(itinerary => itinerary.stopCount > 0),
      totalResults: itineraries.length
    }
  };
}

async function validateAndHydrateItinerary(rawItinerary) {
  if (!rawItinerary || !Array.isArray(rawItinerary.segments) || !rawItinerary.segments.length) {
    const error = new Error('A valid itinerary is required');
    error.status = 400;
    throw error;
  }

  const flightNumbers = rawItinerary.segments.map(segment => segment.flightNumber);
  const segmentDefinitions = await getSchedulesByFlightNumbers(flightNumbers);
  const definitionsByFlight = new Map(
    segmentDefinitions.map(definition => [definition.schedule.flightNumber, definition])
  );

  if (definitionsByFlight.size !== flightNumbers.length) {
    const error = new Error('One or more flight segments are no longer available');
    error.status = 409;
    throw error;
  }

  let previousArrival = null;
  const hydratedSegments = rawItinerary.segments.map((segment, index) => {
    const definition = definitionsByFlight.get(segment.flightNumber);
    const departureDateTime = index === 0
      ? combineDateAndTime(segment.departureDate, definition.schedule.departureTime)
      : resolveSequentialDeparture(previousArrival, definition.schedule.departureTime);
    const arrivalDateTime = addMinutes(departureDateTime, definition.durationMinutes);
    previousArrival = arrivalDateTime;

    return {
      routeId: definition.routeId,
      flightNumber: definition.schedule.flightNumber,
      from: definition.fromAirport,
      to: definition.toAirport,
      departureDate: formatIsoDate(departureDateTime),
      arrivalDate: formatIsoDate(arrivalDateTime),
      departure: formatDisplayTime(departureDateTime),
      arrival: formatDisplayTime(arrivalDateTime, departureDateTime),
      departureDateTime: departureDateTime.toISOString(),
      arrivalDateTime: arrivalDateTime.toISOString(),
      durationMinutes: definition.durationMinutes,
      duration: formatDurationMinutes(definition.durationMinutes),
      distanceKm: definition.distanceKm,
      aircraft: definition.aircraft
    };
  });

  const firstSegment = hydratedSegments[0];
  const finalSegment = hydratedSegments[hydratedSegments.length - 1];
  const totalMinutes =
    (new Date(finalSegment.arrivalDateTime).getTime() - new Date(firstSegment.departureDateTime).getTime()) / 60000;

  return {
    itineraryId: rawItinerary.itineraryId || buildItineraryId(hydratedSegments),
    stopCount: Math.max(0, hydratedSegments.length - 1),
    summary: hydratedSegments.length > 1
      ? `${hydratedSegments.length - 1} stop${hydratedSegments.length > 2 ? 's' : ''}`
      : 'Non-stop',
    durationMinutes: Math.round(totalMinutes),
    duration: formatDurationMinutes(totalMinutes),
    segments: hydratedSegments,
    from: firstSegment.from,
    to: finalSegment.to,
    date: firstSegment.departureDate
  };
}

function resolveSequentialDeparture(previousArrival, departureTime) {
  const earliestDeparture = addMinutes(previousArrival, MIN_LAYOVER_MINUTES);
  const sameDayCandidate = combineDateAndTime(formatIsoDate(earliestDeparture), departureTime);
  if (sameDayCandidate >= earliestDeparture) {
    return sameDayCandidate;
  }

  const nextDay = new Date(earliestDeparture);
  nextDay.setDate(nextDay.getDate() + 1);
  return combineDateAndTime(formatIsoDate(nextDay), departureTime);
}

function buildItinerariesForPath(path, travelDate, passengers) {
  if (path.length === 1) {
    return path[0].schedules
      .filter(schedule => schedule.active)
      .map(schedule => buildDirectItinerary(path[0], schedule, travelDate, passengers));
  }

  if (path.length === 2) {
    return path[0].schedules
      .filter(schedule => schedule.active)
      .map(firstSchedule => buildConnectingItinerary(path[0], firstSchedule, path[1], travelDate, passengers))
      .filter(Boolean);
  }

  return [];
}

function buildDirectItinerary(route, schedule, travelDate, passengers) {
  const departureDateTime = combineDateAndTime(travelDate, schedule.departureTime);
  const arrivalDateTime = addMinutes(departureDateTime, route.durationMinutes);
  const segment = createSegment(route, schedule.flightNumber, departureDateTime, arrivalDateTime);
  const pricesPerPerson = buildPrices([segment]);

  return {
    itineraryId: buildItineraryId([segment]),
    stopCount: 0,
    summary: 'Non-stop',
    durationMinutes: route.durationMinutes,
    duration: formatDurationMinutes(route.durationMinutes),
    layoverMinutes: 0,
    segments: [segment],
    pricesPerPerson,
    prices: multiplyPrices(pricesPerPerson, passengers),
    from: route.fromAirport,
    to: route.toAirport,
    date: segment.departureDate
  };
}

async function buildConnectingItinerary(firstRoute, firstSchedule, secondRoute, travelDate, passengers) {
  const airports     = await getAllAirports();
  const firstDeparture = combineDateAndTime(travelDate, firstSchedule.departureTime);
  const firstArrival = addMinutes(firstDeparture, firstRoute.durationMinutes);
  const connectionChoice = pickConnection(firstArrival, secondRoute.schedules.filter(schedule => schedule.active));
  if (!connectionChoice) return null;

  const firstSegment = createSegment(firstRoute, firstSchedule.flightNumber, firstDeparture, firstArrival);
  const secondArrival = addMinutes(connectionChoice.departureDateTime, secondRoute.durationMinutes);
  const secondSegment = createSegment(
    secondRoute,
    connectionChoice.flightNumber,
    connectionChoice.departureDateTime,
    secondArrival
  );
  const totalMinutes =
    (new Date(secondSegment.arrivalDateTime).getTime() - new Date(firstSegment.departureDateTime).getTime()) / 60000;
  const layoverMinutes =
    (new Date(secondSegment.departureDateTime).getTime() - new Date(firstSegment.arrivalDateTime).getTime()) / 60000;
  const segments = [firstSegment, secondSegment];
  const pricesPerPerson = buildPrices(segments);

  return {
    itineraryId: buildItineraryId(segments),
    stopCount: 1,
    summary: `1 stop in ${airports[firstSegment.to]?.city || firstSegment.to}`,
    durationMinutes: Math.round(totalMinutes),
    duration: formatDurationMinutes(totalMinutes),
    layoverMinutes: Math.round(layoverMinutes),
    layover: formatDurationMinutes(layoverMinutes),
    segments,
    pricesPerPerson,
    prices: multiplyPrices(pricesPerPerson, passengers),
    from: firstSegment.from,
    to: secondSegment.to,
    date: firstSegment.departureDate
  };
}

function pickConnection(firstArrival, schedules) {
  const earliestDeparture = addMinutes(firstArrival, MIN_LAYOVER_MINUTES);
  const sortedSchedules = [...schedules].sort(
    (left, right) => timeStringToMinutes(left.departureTime) - timeStringToMinutes(right.departureTime)
  );

  let searchDate = formatIsoDate(earliestDeparture);

  for (let dayShift = 0; dayShift < 2; dayShift += 1) {
    for (const schedule of sortedSchedules) {
      const departureDateTime = combineDateAndTime(searchDate, schedule.departureTime);
      if (departureDateTime >= earliestDeparture) {
        return {
          flightNumber: schedule.flightNumber,
          departureDateTime
        };
      }
    }

    const nextDay = new Date(earliestDeparture);
    nextDay.setDate(nextDay.getDate() + dayShift + 1);
    searchDate = formatIsoDate(nextDay);
  }

  return null;
}

function createSegment(route, flightNumber, departureDateTime, arrivalDateTime) {
  return {
    routeId: route.id,
    flightNumber,
    from: route.fromAirport,
    to: route.toAirport,
    departureDate: formatIsoDate(departureDateTime),
    arrivalDate: formatIsoDate(arrivalDateTime),
    departure: formatDisplayTime(departureDateTime),
    arrival: formatDisplayTime(arrivalDateTime, departureDateTime),
    departureDateTime: departureDateTime.toISOString(),
    arrivalDateTime: arrivalDateTime.toISOString(),
    durationMinutes: route.durationMinutes,
    duration: formatDurationMinutes(route.durationMinutes),
    distanceKm: route.distanceKm,
    aircraft: route.aircraft
  };
}

function buildPrices(segments) {
  return segments.reduce((accumulator, segment) => {
    const segmentDate = new Date(`${segment.departureDate}T12:00:00`);
    const prices = allClassPrices(segment.distanceKm, segmentDate);
    accumulator.economy += prices.economy.perPerson;
    accumulator.business += prices.business.perPerson;
    accumulator.first += prices.first.perPerson;
    return accumulator;
  }, { economy: 0, business: 0, first: 0 });
}

function multiplyPrices(pricesPerPerson, passengers) {
  return {
    economy: pricesPerPerson.economy * passengers,
    business: pricesPerPerson.business * passengers,
    first: pricesPerPerson.first * passengers
  };
}

function groupRoutesByOrigin(routes) {
  return routes.reduce((map, route) => {
    const current = map.get(route.fromAirport) || [];
    current.push(route);
    map.set(route.fromAirport, current);
    return map;
  }, new Map());
}

function buildItineraryId(segments) {
  return segments
    .map(segment => `${segment.flightNumber}_${segment.departureDate}`)
    .join('__');
}

module.exports = {
  searchItineraries,
  validateAndHydrateItinerary
};
