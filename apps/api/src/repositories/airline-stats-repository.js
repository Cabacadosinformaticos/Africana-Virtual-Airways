/**
 * Airline Stats Repository
 *
 * Manages the single `airline_stats` row that drives the /api/vatsim/stats
 * endpoint and admin dashboards.
 */

const { getPool } = require('./database');

function rowToStats(r) {
  return {
    totalFlights:  r.total_flights,
    totalHours:    r.total_hours,
    activeMembers: r.active_members,
    foundedDate:   r.founded_date,
    firstFlight: {
      from: r.first_flight_from,
      to:   r.first_flight_to,
      date: r.first_flight_date
    },
    division:       r.division,
    callsignPrefix: r.callsign_prefix,
    updatedAt:      r.updated_at
  };
}

/**
 * Return the airline stats record.
 */
async function getStats() {
  const [rows] = await getPool().query('SELECT * FROM airline_stats LIMIT 1');
  return rows.length ? rowToStats(rows[0]) : null;
}

/**
 * Partially update the airline stats record.
 * Accepted keys: totalFlights, totalHours, activeMembers, foundedDate, division, callsignPrefix
 */
async function updateStats(patch) {
  const fieldMap = {
    totalFlights:   'total_flights',
    totalHours:     'total_hours',
    activeMembers:  'active_members',
    foundedDate:    'founded_date',
    division:       'division',
    callsignPrefix: 'callsign_prefix'
  };

  const setClauses = [];
  const values = [];

  for (const [key, col] of Object.entries(fieldMap)) {
    if (patch[key] !== undefined) {
      setClauses.push(`${col} = ?`);
      values.push(patch[key]);
    }
  }

  if (!setClauses.length) return getStats();

  await getPool().query(
    `UPDATE airline_stats SET ${setClauses.join(', ')} WHERE id = 1`,
    values
  );

  return getStats();
}

module.exports = { getStats, updateStats };
