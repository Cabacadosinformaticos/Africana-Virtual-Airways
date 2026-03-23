const { getPool } = require('./database');
const { parseJsonField } = require('../utils/itinerary-utils');

function mapBooking(row) {
  if (!row) return null;
  return {
    id: row.id,
    bookingRef: row.booking_ref,
    userId: row.user_id,
    userName: row.user_name,
    passengerEmail: row.passenger_email,
    flightNumber: row.flight_number,
    from: row.from_airport,
    to: row.to_airport,
    date: row.travel_date instanceof Date
      ? row.travel_date.toISOString().split('T')[0]
      : String(row.travel_date),
    cabinClass: row.cabin_class,
    passengers: row.passengers,
    totalPrice: Number(row.total_price),
    status: row.status,
    seat: row.seat_selection,
    passengerDetails: parseJsonField(row.passenger_details, []),
    itinerary: parseJsonField(row.itinerary, { segments: [] }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cancelledAt: row.cancelled_at
  };
}

function mapPassenger(row) {
  return {
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone || '',
    nationality: row.nationality || '',
    seat: row.seat_selection || null
  };
}

function mapSegment(row) {
  return {
    routeId: row.route_id,
    flightNumber: row.flight_number,
    from: row.from_airport,
    to: row.to_airport,
    departureDate: String(row.departure_date),
    arrivalDate: String(row.arrival_date),
    departure: row.departure_time,
    arrival: row.arrival_time,
    departureDateTime: row.departure_datetime instanceof Date
      ? row.departure_datetime.toISOString()
      : String(row.departure_datetime),
    arrivalDateTime: row.arrival_datetime instanceof Date
      ? row.arrival_datetime.toISOString()
      : String(row.arrival_datetime),
    durationMinutes: Number(row.duration_minutes || 0),
    distanceKm: Number(row.distance_km || 0),
    aircraft: row.aircraft_id || row.aircraft_registration || row.aircraft_type
      ? {
        id: row.aircraft_id || null,
        registration: row.aircraft_registration || null,
        type: row.aircraft_type || null
      }
      : null
  };
}

async function hydrateBookings(bookings) {
  if (!Array.isArray(bookings) || !bookings.length) return bookings;

  const bookingIds = bookings.map(booking => booking.id).filter(Boolean);
  if (!bookingIds.length) return bookings;

  const placeholders = bookingIds.map(() => '?').join(', ');
  const [passengerRows, segmentRows] = await Promise.all([
    getPool().query(
      `SELECT booking_id, passenger_index, first_name, last_name, email, phone, nationality, seat_selection
       FROM booking_passengers
       WHERE booking_id IN (${placeholders})
       ORDER BY booking_id ASC, passenger_index ASC`,
      bookingIds
    ),
    getPool().query(
      `SELECT booking_id, segment_index, route_id, flight_number, from_airport, to_airport,
              departure_date, arrival_date, departure_time, arrival_time,
              departure_datetime, arrival_datetime, duration_minutes, distance_km,
              aircraft_id, aircraft_registration, aircraft_type
       FROM booking_segments
       WHERE booking_id IN (${placeholders})
       ORDER BY booking_id ASC, segment_index ASC`,
      bookingIds
    )
  ]);

  const passengersByBooking = new Map();
  passengerRows[0].forEach(row => {
    const collection = passengersByBooking.get(row.booking_id) || [];
    collection.push(mapPassenger(row));
    passengersByBooking.set(row.booking_id, collection);
  });

  const segmentsByBooking = new Map();
  segmentRows[0].forEach(row => {
    const collection = segmentsByBooking.get(row.booking_id) || [];
    collection.push(mapSegment(row));
    segmentsByBooking.set(row.booking_id, collection);
  });

  bookings.forEach(booking => {
    const passengers = passengersByBooking.get(booking.id);
    if (passengers?.length) {
      booking.passengerDetails = passengers;
    }

    const segments = segmentsByBooking.get(booking.id);
    if (segments?.length) {
      booking.itinerary = {
        ...(booking.itinerary || {}),
        segments
      };
    }
  });

  return bookings;
}

async function createBooking(booking) {
  const conn = await getPool().getConnection();
  let bookingId = null;

  try {
    await conn.beginTransaction();

    const [insertResult] = await conn.query(
      `INSERT INTO bookings
        (booking_ref, user_id, user_name, passenger_email, flight_number,
         from_airport, to_airport, travel_date, cabin_class, passengers,
         total_price, status, seat_selection, passenger_details, itinerary, cancelled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        booking.bookingRef,
        booking.userId || null,
        booking.userName,
        booking.passengerEmail,
        booking.flightNumber,
        booking.from,
        booking.to,
        booking.date,
        booking.cabinClass,
        booking.passengers,
        booking.totalPrice,
        booking.status || 'confirmed',
        booking.seat || null,
        JSON.stringify(booking.passengerDetails || []),
        JSON.stringify(booking.itinerary || { segments: [] }),
        booking.status === 'cancelled' ? new Date() : null
      ]
    );

    bookingId = insertResult.insertId;

    const passengers = Array.isArray(booking.passengerDetails) ? booking.passengerDetails : [];
    for (const [index, passenger] of passengers.entries()) {
      await conn.query(
        `INSERT INTO booking_passengers
          (booking_id, passenger_index, first_name, last_name, email, phone, nationality, seat_selection)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          bookingId,
          index,
          String(passenger.firstName || '').trim(),
          String(passenger.lastName || '').trim(),
          String(passenger.email || '').trim().toLowerCase(),
          passenger.phone ? String(passenger.phone).trim() : null,
          passenger.nationality ? String(passenger.nationality).trim() : null,
          passenger.seat || (index === 0 ? booking.seat || null : null)
        ]
      );
    }

    const segments = Array.isArray(booking.itinerary?.segments) ? booking.itinerary.segments : [];
    for (const [index, segment] of segments.entries()) {
      await conn.query(
        `INSERT INTO booking_segments
          (booking_id, segment_index, route_id, flight_number, from_airport, to_airport,
           departure_date, arrival_date, departure_time, arrival_time,
           departure_datetime, arrival_datetime, duration_minutes, distance_km,
           aircraft_id, aircraft_registration, aircraft_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          bookingId,
          index,
          segment.routeId || null,
          segment.flightNumber,
          segment.from,
          segment.to,
          segment.departureDate,
          segment.arrivalDate || segment.departureDate,
          segment.departure || '',
          segment.arrival || '',
          normalizeDateTime(segment.departureDateTime, segment.departureDate),
          normalizeDateTime(segment.arrivalDateTime, segment.arrivalDate || segment.departureDate),
          segment.durationMinutes || 0,
          segment.distanceKm || 0,
          segment.aircraft?.id || null,
          segment.aircraft?.registration || null,
          segment.aircraft?.type || null
        ]
      );

      if (booking.seat) {
        await conn.query(
          `INSERT INTO booked_seats
            (flight_number, departure_date, seat_id, cabin_class, booking_ref)
           VALUES (?, ?, ?, ?, ?)`,
          [segment.flightNumber, segment.departureDate, booking.seat, booking.cabinClass, booking.bookingRef]
        );
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();

    if (err.code === 'ER_DUP_ENTRY') {
      const conflict = new Error('That seat has just been taken. Please choose another seat.');
      conflict.status = 409;
      throw conflict;
    }

    throw err;
  } finally {
    conn.release();
  }

  return findBookingByRef(booking.bookingRef);
}

async function listBookingsByUserId(userId, email = null) {
  const hasEmail = Boolean(email);
  const [rows] = await getPool().query(
    hasEmail
      ? 'SELECT * FROM bookings WHERE user_id = ? OR LOWER(passenger_email) = LOWER(?) ORDER BY created_at DESC'
      : 'SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC',
    hasEmail ? [userId, email] : [userId]
  );

  return hydrateBookings(rows.map(mapBooking));
}

async function listAllBookings() {
  const [rows] = await getPool().query('SELECT * FROM bookings ORDER BY created_at DESC');
  return hydrateBookings(rows.map(mapBooking));
}

async function findBookingByRef(ref) {
  const [rows] = await getPool().query(
    'SELECT * FROM bookings WHERE booking_ref = ? LIMIT 1',
    [ref]
  );

  const [booking] = await hydrateBookings(rows.map(mapBooking));
  return booking || null;
}

async function findBookingByRefAndEmail(ref, email) {
  const [rows] = await getPool().query(
    'SELECT * FROM bookings WHERE booking_ref = ? AND LOWER(passenger_email) = LOWER(?) LIMIT 1',
    [ref, email]
  );

  const [booking] = await hydrateBookings(rows.map(mapBooking));
  return booking || null;
}

async function updateBookingStatus(ref, status) {
  const conn = await getPool().getConnection();

  try {
    await conn.beginTransaction();

    await conn.query(
      `UPDATE bookings
       SET status = ?,
           cancelled_at = CASE WHEN ? = 'cancelled' THEN NOW() ELSE NULL END
       WHERE booking_ref = ?`,
      [status, status, ref]
    );

    if (status === 'cancelled') {
      await conn.query('DELETE FROM booked_seats WHERE booking_ref = ?', [ref]);
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return findBookingByRef(ref);
}

async function getOccupiedSeats(segments, cabinClass) {
  if (!Array.isArray(segments) || !segments.length) return [];

  const conditions = segments
    .map(() => '(flight_number = ? AND departure_date = ?)')
    .join(' OR ');

  const values = [cabinClass, ...segments.flatMap(segment => [segment.flightNumber, segment.departureDate])];

  const [rows] = await getPool().query(
    `SELECT DISTINCT seat_id FROM booked_seats
     WHERE cabin_class = ? AND (${conditions})`,
    values
  );

  return rows.map(row => row.seat_id);
}

function normalizeDateTime(value, fallbackDate) {
  if (value) {
    return String(value).replace('T', ' ').replace('Z', '');
  }

  return `${fallbackDate} 00:00:00`;
}

module.exports = {
  createBooking,
  findBookingByRef,
  findBookingByRefAndEmail,
  getOccupiedSeats,
  listAllBookings,
  listBookingsByUserId,
  updateBookingStatus
};
