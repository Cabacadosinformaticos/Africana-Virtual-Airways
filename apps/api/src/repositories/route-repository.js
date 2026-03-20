const { getAllAirports } = require('./airport-repository');
const { getPool } = require('./database');
const { estimateDurationMinutes, haversineDistance } = require('../utils/distance-utils');

function mapAircraftSummary(row) {
  if (!row.aircraft_id) return null;
  return {
    id: row.aircraft_id,
    registration: row.registration,
    type: row.type,
    category: row.category,
    hub: row.hub,
    hubName: row.hub_name,
    seats: {
      economy: row.economy_seats,
      business: row.business_seats,
      first: row.first_seats
    }
  };
}

function mapAirportSummary(icao, name, city, country) {
  if (!icao) return null;
  return { icao, name, city, country };
}

function createHttpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeDepartureTime(value) {
  const departureTime = String(value || '').trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(departureTime)) {
    throw createHttpError('Departure time must use HH:MM or HH:MM:SS format.');
  }

  return departureTime.length === 5 ? `${departureTime}:00` : departureTime;
}

function normalizeSchedules(schedules) {
  if (!Array.isArray(schedules) || !schedules.length) {
    throw createHttpError('At least one route schedule is required.');
  }

  return schedules.map((schedule, index) => {
    const flightNumber = String(schedule.flightNumber || '').trim().toUpperCase();
    if (!flightNumber) {
      throw createHttpError(`Schedule ${index + 1} is missing a flight number.`);
    }

    return {
      flightNumber,
      slotCode: String(schedule.slotCode || `slot-${index + 1}`).trim().toLowerCase(),
      departureTime: normalizeDepartureTime(schedule.departureTime),
      active: schedule.active === undefined ? true : Boolean(schedule.active)
    };
  });
}

function estimateDurationForAircraft(distanceKm, cruiseSpeedKmh) {
  const speed = Number(cruiseSpeedKmh) || 820;
  const extraMinutes = distanceKm < 1000 ? 45 : 30;
  return Math.round((distanceKm / speed) * 60) + extraMinutes;
}

async function getAircraftCruiseSpeed(aircraftId) {
  if (!aircraftId) return null;

  const [rows] = await getPool().query(
    'SELECT cruise_speed_kmh FROM aircraft WHERE id = ? LIMIT 1',
    [aircraftId]
  );

  return rows[0]?.cruise_speed_kmh || null;
}

async function calculateRouteMetrics(fromAirport, toAirport, hubAirport = null, aircraftId = null) {
  const airports = await getAllAirports();
  const origin = airports[fromAirport];
  const destination = airports[toAirport];
  const hub = hubAirport ? airports[hubAirport] : null;

  if (!origin || !destination) {
    throw createHttpError('One or more airports do not exist.', 400);
  }

  if (hubAirport && !hub) {
    throw createHttpError('The selected hub airport does not exist.', 400);
  }

  if (fromAirport === toAirport) {
    throw createHttpError('Origin and destination must be different airports.', 400);
  }

  const distanceKm = haversineDistance(origin.lat, origin.lon, destination.lat, destination.lon);
  const cruiseSpeedKmh = await getAircraftCruiseSpeed(aircraftId);
  return {
    distanceKm,
    durationMinutes: cruiseSpeedKmh
      ? estimateDurationForAircraft(distanceKm, cruiseSpeedKmh)
      : estimateDurationMinutes(distanceKm)
  };
}

function mapRouteRows(rows) {
  const grouped = new Map();

  rows.forEach(row => {
    const route = grouped.get(row.id) || {
      id: row.id,
      fromAirport: row.from_airport,
      toAirport: row.to_airport,
      hubAirport: row.hub_airport,
      distanceKm: row.distance_km,
      durationMinutes: row.duration_minutes,
      status: row.status,
      aircraftId: row.aircraft_id,
      aircraft: mapAircraftSummary(row),
      fromAirportDetails: mapAirportSummary(
        row.from_airport,
        row.from_airport_name,
        row.from_city,
        row.from_country
      ),
      toAirportDetails: mapAirportSummary(
        row.to_airport,
        row.to_airport_name,
        row.to_city,
        row.to_country
      ),
      hubAirportDetails: mapAirportSummary(
        row.hub_airport,
        row.hub_airport_name,
        row.hub_city,
        row.hub_country
      ),
      schedules: []
    };

    if (row.schedule_id) {
      route.schedules.push({
        id: row.schedule_id,
        flightNumber: row.flight_number,
        slotCode: row.slot_code,
        departureTime: row.departure_time,
        active: Boolean(row.schedule_active)
      });
    }

    grouped.set(row.id, route);
  });

  return Array.from(grouped.values());
}

async function fetchRoutes(whereClause = '', values = []) {
  const [rows] = await getPool().query(
    `SELECT
        r.id,
        r.from_airport,
        r.to_airport,
        r.hub_airport,
        r.distance_km,
        r.duration_minutes,
        r.status,
        a.id AS aircraft_id,
        a.registration,
        a.type,
        a.category,
        a.hub,
        a.hub_name,
        a.economy_seats,
        a.business_seats,
        a.first_seats,
        af.name AS from_airport_name,
        af.city AS from_city,
        af.country AS from_country,
        at.name AS to_airport_name,
        at.city AS to_city,
        at.country AS to_country,
        ah.name AS hub_airport_name,
        ah.city AS hub_city,
        ah.country AS hub_country,
        s.id AS schedule_id,
        s.flight_number,
        s.slot_code,
        TIME_FORMAT(s.departure_time, '%H:%i:%s') AS departure_time,
        s.active AS schedule_active
      FROM routes r
      LEFT JOIN aircraft a ON a.id = r.aircraft_id
      LEFT JOIN airports af ON af.icao = r.from_airport
      LEFT JOIN airports at ON at.icao = r.to_airport
      LEFT JOIN airports ah ON ah.icao = r.hub_airport
      LEFT JOIN route_schedules s ON s.route_id = r.id
      ${whereClause}
      ORDER BY r.id ASC, s.departure_time ASC`,
    values
  );

  return mapRouteRows(rows);
}

async function getRoutesWithSchedules() {
  return fetchRoutes();
}

async function getRouteById(routeId) {
  const [route] = await fetchRoutes('WHERE r.id = ?', [routeId]);
  return route || null;
}

async function listRoutes() {
  const [rows] = await getPool().query(
    `SELECT id, from_airport, to_airport, hub_airport, distance_km, duration_minutes, aircraft_id, status
     FROM routes
     ORDER BY from_airport ASC, to_airport ASC`
  );

  return rows.map(row => ({
    id: row.id,
    fromAirport: row.from_airport,
    toAirport: row.to_airport,
    hubAirport: row.hub_airport,
    distanceKm: row.distance_km,
    durationMinutes: row.duration_minutes,
    aircraftId: row.aircraft_id,
    status: row.status
  }));
}

async function replaceRouteSchedules(connection, routeId, schedules) {
  await connection.query('DELETE FROM route_schedules WHERE route_id = ?', [routeId]);

  for (const schedule of schedules) {
    await connection.query(
      `INSERT INTO route_schedules
        (route_id, flight_number, slot_code, departure_time, active)
       VALUES (?, ?, ?, ?, ?)`,
      [routeId, schedule.flightNumber, schedule.slotCode, schedule.departureTime, schedule.active ? 1 : 0]
    );
  }
}

function coerceWriteError(error) {
  if (error.status) return error;

  if (error.code === 'ER_DUP_ENTRY') {
    if (String(error.message).includes('uq_route_pair')) {
      return createHttpError('A route for that airport pair already exists.', 409);
    }

    if (String(error.message).includes('flight_number')) {
      return createHttpError('That flight number is already assigned to another route.', 409);
    }
  }

  if (error.code === 'ER_NO_REFERENCED_ROW_2') {
    return createHttpError('The selected aircraft does not exist.', 400);
  }

  return error;
}

async function createRoute(route) {
  const schedules = normalizeSchedules(route.schedules);
  const metrics = await calculateRouteMetrics(route.fromAirport, route.toAirport, route.hubAirport, route.aircraftId);
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO routes
        (from_airport, to_airport, hub_airport, distance_km, duration_minutes, aircraft_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        route.fromAirport,
        route.toAirport,
        route.hubAirport,
        metrics.distanceKm,
        metrics.durationMinutes,
        route.aircraftId || null,
        route.status || 'active'
      ]
    );

    await replaceRouteSchedules(connection, result.insertId, schedules);
    await connection.commit();
    return getRouteById(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw coerceWriteError(error);
  } finally {
    connection.release();
  }
}

async function updateRoute(routeId, route) {
  const schedules = normalizeSchedules(route.schedules);
  const metrics = await calculateRouteMetrics(route.fromAirport, route.toAirport, route.hubAirport, route.aircraftId);
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      `UPDATE routes SET
        from_airport = ?,
        to_airport = ?,
        hub_airport = ?,
        distance_km = ?,
        duration_minutes = ?,
        aircraft_id = ?,
        status = ?
       WHERE id = ?`,
      [
        route.fromAirport,
        route.toAirport,
        route.hubAirport,
        metrics.distanceKm,
        metrics.durationMinutes,
        route.aircraftId || null,
        route.status || 'active',
        routeId
      ]
    );

    await replaceRouteSchedules(connection, routeId, schedules);
    await connection.commit();
    return getRouteById(routeId);
  } catch (error) {
    await connection.rollback();
    throw coerceWriteError(error);
  } finally {
    connection.release();
  }
}

async function getSchedulesByFlightNumbers(flightNumbers) {
  if (!Array.isArray(flightNumbers) || !flightNumbers.length) return [];

  const placeholders = flightNumbers.map(() => '?').join(', ');
  const [rows] = await getPool().query(
    `SELECT
        r.id,
        r.from_airport,
        r.to_airport,
        r.hub_airport,
        r.distance_km,
        r.duration_minutes,
        a.id AS aircraft_id,
        a.registration,
        a.type,
        a.category,
        a.hub,
        a.hub_name,
        a.economy_seats,
        a.business_seats,
        a.first_seats,
        s.id AS schedule_id,
        s.flight_number,
        s.slot_code,
        TIME_FORMAT(s.departure_time, '%H:%i:%s') AS departure_time,
        s.active AS schedule_active
      FROM route_schedules s
      INNER JOIN routes r ON r.id = s.route_id
      LEFT JOIN aircraft a ON a.id = r.aircraft_id
      WHERE s.flight_number IN (${placeholders})`,
    flightNumbers
  );

  return rows.map(row => ({
    routeId: row.id,
    fromAirport: row.from_airport,
    toAirport: row.to_airport,
    hubAirport: row.hub_airport,
    distanceKm: row.distance_km,
    durationMinutes: row.duration_minutes,
    aircraft: mapAircraftSummary(row),
    schedule: {
      id: row.schedule_id,
      flightNumber: row.flight_number,
      slotCode: row.slot_code,
      departureTime: row.departure_time,
      active: Boolean(row.schedule_active)
    }
  }));
}

module.exports = {
  createRoute,
  getRouteById,
  getRoutesWithSchedules,
  getSchedulesByFlightNumbers,
  listRoutes,
  updateRoute
};
