const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const aircraftData  = require('../data/aircraft.json');
const airportsData  = require('../data/airports.json');   // used only for initial seed
const { AIRLINE_STATS, DAILY_SCHEDULES, ROUTES } = require('../config/flight-network');
const { estimateDurationMinutes, haversineDistance, routeCategory } = require('../utils/distance-utils');
const { parseJsonField } = require('../utils/itinerary-utils');

let pool;

async function initializeDatabase() {
  if (pool) return pool;

  const host     = process.env.DB_HOST     || '127.0.0.1';
  const port     = Number(process.env.DB_PORT || 3306);
  const user     = process.env.DB_USER     || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME     || 'afv_booking';

  const adminConnection = await mysql.createConnection({ host, port, user, password });
  await adminConnection.query(
    `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await adminConnection.end();

  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    dateStrings: true,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true
  });

  await runSchema(pool);
  await ensureSchemaMigrations(pool);
  await backfillBookingChildren(pool);
  await ensurePrimaryAdmin(pool);
  await seedAircraft(pool);
  await seedAirports(pool);            // airports table must exist before routes
  await seedRoutesAndSchedules(pool);
  await seedAirlineStats(pool);

  return pool;
}

function getPool() {
  if (!pool) throw new Error('Database has not been initialized yet');
  return pool;
}

async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// ── Schema ────────────────────────────────────────────────────────────────────

async function runSchema(connectionPool) {
  const schemaPath = path.resolve(__dirname, '../../../../database/schema/mysql.sql');
  const schemaSql  = fs.readFileSync(schemaPath, 'utf8');
  const statements = schemaSql
    .split(/;\s*(?:\r?\n|$)/)
    .map(s => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await connectionPool.query(statement);
  }
}

async function ensureSchemaMigrations(connectionPool) {
  await ensureColumn(
    connectionPool,
    'users',
    'is_primary_admin',
    'TINYINT(1) NOT NULL DEFAULT 0 AFTER role'
  );
  await ensureColumn(
    connectionPool,
    'users',
    'created_by_user_id',
    'INT NULL AFTER is_primary_admin'
  );
  await ensureIndex(
    connectionPool,
    'users',
    'idx_users_created_by',
    'ALTER TABLE users ADD INDEX idx_users_created_by (created_by_user_id)'
  );
}

async function ensureColumn(connectionPool, tableName, columnName, definitionSql) {
  const [rows] = await connectionPool.query(
    `SHOW COLUMNS FROM \`${tableName}\` LIKE ?`,
    [columnName]
  );

  if (!rows.length) {
    await connectionPool.query(
      `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definitionSql}`
    );
  }
}

async function ensureIndex(connectionPool, tableName, indexName, statement) {
  const [rows] = await connectionPool.query(
    `SHOW INDEX FROM \`${tableName}\` WHERE Key_name = ?`,
    [indexName]
  );

  if (!rows.length) {
    await connectionPool.query(statement);
  }
}

async function backfillBookingChildren(connectionPool) {
  const [rows] = await connectionPool.query(
    `SELECT
        b.id,
        b.booking_ref,
        b.seat_selection,
        b.passenger_details,
        b.itinerary,
        COALESCE(bp.passenger_count, 0) AS passenger_count,
        COALESCE(bs.segment_count, 0) AS segment_count
      FROM bookings b
      LEFT JOIN (
        SELECT booking_id, COUNT(*) AS passenger_count
        FROM booking_passengers
        GROUP BY booking_id
      ) bp ON bp.booking_id = b.id
      LEFT JOIN (
        SELECT booking_id, COUNT(*) AS segment_count
        FROM booking_segments
        GROUP BY booking_id
      ) bs ON bs.booking_id = b.id
      WHERE COALESCE(bp.passenger_count, 0) = 0 OR COALESCE(bs.segment_count, 0) = 0`
  );

  if (!rows.length) return;

  const connection = await connectionPool.getConnection();
  try {
    await connection.beginTransaction();

    for (const row of rows) {
      const passengers = parseJsonField(row.passenger_details, []);
      const segments = parseJsonField(row.itinerary, { segments: [] })?.segments || [];

      if (!row.passenger_count) {
        for (const [index, passenger] of passengers.entries()) {
          await connection.query(
            `INSERT INTO booking_passengers
              (booking_id, passenger_index, first_name, last_name, email, phone, nationality, seat_selection)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              row.id,
              index,
              String(passenger.firstName || '').trim(),
              String(passenger.lastName || '').trim(),
              String(passenger.email || '').trim().toLowerCase(),
              passenger.phone ? String(passenger.phone).trim() : null,
              passenger.nationality ? String(passenger.nationality).trim() : null,
              passenger.seat || (index === 0 ? row.seat_selection || null : null)
            ]
          );
        }
      }

      if (!row.segment_count) {
        for (const [index, segment] of segments.entries()) {
          await connection.query(
            `INSERT INTO booking_segments
              (booking_id, segment_index, route_id, flight_number, from_airport, to_airport,
               departure_date, arrival_date, departure_time, arrival_time,
               departure_datetime, arrival_datetime, duration_minutes, distance_km,
               aircraft_id, aircraft_registration, aircraft_type)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              row.id,
              index,
              segment.routeId || null,
              segment.flightNumber,
              segment.from,
              segment.to,
              segment.departureDate,
              segment.arrivalDate || segment.departureDate,
              segment.departure || '',
              segment.arrival || '',
              normalizeSeedDateTime(segment.departureDateTime, segment.departureDate),
              normalizeSeedDateTime(segment.arrivalDateTime, segment.arrivalDate || segment.departureDate),
              segment.durationMinutes || 0,
              segment.distanceKm || 0,
              segment.aircraft?.id || null,
              segment.aircraft?.registration || null,
              segment.aircraft?.type || null
            ]
          );
        }
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// ── Users ─────────────────────────────────────────────────────────────────────

async function ensurePrimaryAdmin(connectionPool) {
  const primaryAdmin = getPrimaryAdminBootstrap();
  if (!primaryAdmin) {
    console.warn('[AFV] No primary admin bootstrap configured. Set PRIMARY_ADMIN_EMAIL and PRIMARY_ADMIN_PASSWORD to create one automatically.');
    return;
  }

  const passwordHash = await resolvePasswordHash(primaryAdmin.password);
  await connectionPool.query(
    'UPDATE users SET is_primary_admin = 0 WHERE is_primary_admin <> 0'
  );

  const [rows] = await connectionPool.query(
    'SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
    [primaryAdmin.email]
  );

  if (rows.length) {
    await connectionPool.query(
      `UPDATE users
       SET name = ?, password = ?, vatsim_cid = ?, role = 'admin', is_primary_admin = 1
       WHERE id = ?`,
      [primaryAdmin.name, passwordHash, primaryAdmin.vatsimCid || null, rows[0].id]
    );
    return;
  }

  await connectionPool.query(
    `INSERT INTO users
      (name, email, password, vatsim_cid, role, is_primary_admin, created_by_user_id, joined_at, flight_hours, points)
     VALUES (?, ?, ?, ?, 'admin', 1, NULL, ?, ?, ?)`,
    [
      primaryAdmin.name,
      primaryAdmin.email,
      passwordHash,
      primaryAdmin.vatsimCid || null,
      new Date(primaryAdmin.joinedAt),
      primaryAdmin.flightHours || 0,
      primaryAdmin.points || 0
    ]
  );
}

async function resolvePasswordHash(password) {
  if (typeof password === 'string' && password.startsWith('$2')) {
    return password;
  }

  return bcrypt.hash(String(password || ''), 10);
}

function getPrimaryAdminBootstrap() {
  const email = String(process.env.PRIMARY_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.PRIMARY_ADMIN_PASSWORD || '');
  if (!email || !password) return null;

  return {
    name: String(process.env.PRIMARY_ADMIN_NAME || 'Main Admin').trim(),
    email,
    password,
    vatsimCid: String(process.env.PRIMARY_ADMIN_VATSIM_CID || '').trim() || null,
    joinedAt: '2020-03-01T00:00:00.000Z',
    flightHours: Number(process.env.PRIMARY_ADMIN_FLIGHT_HOURS || 0),
    points: Number(process.env.PRIMARY_ADMIN_POINTS || 0)
  };
}

function normalizeSeedDateTime(value, fallbackDate) {
  if (value) {
    return String(value).replace('T', ' ').replace('Z', '');
  }

  return `${fallbackDate} 00:00:00`;
}

// ── Aircraft ──────────────────────────────────────────────────────────────────

async function seedAircraft(connectionPool) {
  const [[{ count }]] = await connectionPool.query('SELECT COUNT(*) AS count FROM aircraft');
  if (count > 0) return;

  for (const aircraft of aircraftData) {
    await connectionPool.query(
      `INSERT INTO aircraft
        (registration, type, category, hub, hub_name,
         economy_seats, business_seats, first_seats,
         range_km, cruise_speed_kmh, status, image, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        aircraft.registration, aircraft.type, aircraft.category,
        aircraft.hub, aircraft.hub_name,
        aircraft.seats.economy  || 0,
        aircraft.seats.business || 0,
        aircraft.seats.first    || 0,
        aircraft.range_km       || 0,
        aircraft.cruise_speed_kmh || 0,
        aircraft.status      || 'active',
        aircraft.image       || null,
        aircraft.description || null
      ]
    );
  }
}

// ── Airports ──────────────────────────────────────────────────────────────────

async function seedAirports(connectionPool) {
  const [[{ count }]] = await connectionPool.query('SELECT COUNT(*) AS count FROM airports');
  if (count > 0) return;

  for (const [icao, ap] of Object.entries(airportsData)) {
    await connectionPool.query(
      `INSERT INTO airports (icao, iata, name, city, country, lat, lon, hub)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [icao, ap.iata || null, ap.name, ap.city, ap.country,
       ap.lat, ap.lon, ap.hub ? 1 : 0]
    );
  }

  console.log(`[AFV] Seeded ${Object.keys(airportsData).length} airports.`);
}

// ── Routes & Schedules ────────────────────────────────────────────────────────

/**
 * Seed the route network once. After that, the database becomes the
 * source of truth so backoffice edits survive restarts.
 */
async function seedRoutesAndSchedules(connectionPool) {
  const [[{ routeCount }]] = await connectionPool.query(
    'SELECT COUNT(*) AS routeCount FROM routes'
  );

  if (Number(routeCount) > 0) {
    return;
  }

  if (Number(routeCount) !== ROUTES.length) {
    console.log(`[AFV] Route count mismatch (DB: ${routeCount}, config: ${ROUTES.length}). Re-seeding…`);
    await connectionPool.query('DELETE FROM route_schedules');
    await connectionPool.query('DELETE FROM routes');
    await connectionPool.query('ALTER TABLE routes AUTO_INCREMENT = 1');
    await connectionPool.query('ALTER TABLE route_schedules AUTO_INCREMENT = 1');
  } else {
    const [[{ scheduleCount }]] = await connectionPool.query(
      'SELECT COUNT(*) AS scheduleCount FROM route_schedules'
    );
    if (scheduleCount > 0) return;
  }

  // Load airports from DB (already seeded above)
  const [airportRows] = await connectionPool.query('SELECT * FROM airports');
  const airportMap = Object.fromEntries(
    airportRows.map(r => [r.icao, { lat: parseFloat(r.lat), lon: parseFloat(r.lon) }])
  );

  const [aircraftRows] = await connectionPool.query(
    'SELECT id, registration, category, hub, range_km FROM aircraft ORDER BY id ASC'
  );

  for (const route of ROUTES) {
    const origin      = airportMap[route.from];
    const destination = airportMap[route.to];

    if (!origin || !destination) {
      console.warn(`[AFV] Skipping route ${route.flightNumber}: unknown airport ${route.from} or ${route.to}`);
      continue;
    }

    const distanceKm      = haversineDistance(origin.lat, origin.lon, destination.lat, destination.lon);
    const durationMinutes = estimateDurationMinutes(distanceKm);
    const aircraftId      = selectAircraftId(aircraftRows, route.hub, distanceKm);

    const [result] = await connectionPool.query(
      `INSERT INTO routes
        (from_airport, to_airport, hub_airport, distance_km, duration_minutes, aircraft_id, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [route.from, route.to, route.hub, distanceKm, durationMinutes, aircraftId]
    );

    await seedSchedulesForRoute(connectionPool, result.insertId, route.flightNumber);
  }

  console.log(`[AFV] Seeded ${ROUTES.length} routes with schedules.`);
}

async function seedSchedulesForRoute(connectionPool, routeId, flightNumber) {
  const slot = DAILY_SCHEDULES[0]; // one morning departure per route
  await connectionPool.query(
    `INSERT INTO route_schedules
      (route_id, flight_number, slot_code, departure_time, active)
     VALUES (?, ?, ?, ?, 1)`,
    [routeId, flightNumber, slot.slotCode, slot.departureTime]
  );
}

function selectAircraftId(aircraftRows, hubAirport, distanceKm) {
  const category   = routeCategory(distanceKm);
  const byHub      = aircraftRows.filter(a => a.hub === hubAirport);
  const byCategory = byHub.filter(a => a.category === category);

  if (byCategory.length)  return byCategory[0].id;
  if (byHub.length)       return byHub[0].id;

  const anyCategory = aircraftRows.filter(a => a.category === category);
  if (anyCategory.length) return anyCategory[0].id;

  return aircraftRows[0]?.id || null;
}

// ── Airline Stats ─────────────────────────────────────────────────────────────

async function seedAirlineStats(connectionPool) {
  const [[{ count }]] = await connectionPool.query(
    'SELECT COUNT(*) AS count FROM airline_stats'
  );
  if (count > 0) return;

  await connectionPool.query(
    `INSERT INTO airline_stats
      (total_flights, total_hours, active_members, founded_date,
       first_flight_from, first_flight_to, first_flight_date,
       division, callsign_prefix)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      AIRLINE_STATS.totalFlights,
      AIRLINE_STATS.totalHours,
      AIRLINE_STATS.activeMembers,
      AIRLINE_STATS.foundedDate,
      AIRLINE_STATS.firstFlightFrom,
      AIRLINE_STATS.firstFlightTo,
      AIRLINE_STATS.firstFlightDate,
      AIRLINE_STATS.division,
      AIRLINE_STATS.callsignPrefix
    ]
  );

  console.log('[AFV] Seeded airline stats.');
}

module.exports = {
  closeDatabase,
  getPool,
  initializeDatabase
};
