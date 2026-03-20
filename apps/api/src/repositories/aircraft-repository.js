const { getPool } = require('./database');

function mapAircraft(row) {
  if (!row) return null;
  return {
    id: row.id,
    registration: row.registration,
    type: row.type,
    category: row.category,
    hub: row.hub,
    hub_name: row.hub_name,
    seats: {
      economy: row.economy_seats,
      business: row.business_seats,
      first: row.first_seats
    },
    range_km: row.range_km,
    cruise_speed_kmh: row.cruise_speed_kmh,
    status: row.status,
    image: row.image,
    description: row.description
  };
}

async function listAircraft(filters = {}) {
  const clauses = [];
  const values = [];

  if (filters.hub) {
    clauses.push('hub = ?');
    values.push(String(filters.hub).toUpperCase());
  }

  if (filters.category) {
    clauses.push('LOWER(category) = LOWER(?)');
    values.push(filters.category);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const [rows] = await getPool().query(`SELECT * FROM aircraft ${whereClause} ORDER BY id ASC`, values);
  return rows.map(mapAircraft);
}

async function findAircraftByIdOrRegistration(idOrRegistration) {
  const [rows] = await getPool().query(
    'SELECT * FROM aircraft WHERE id = ? OR registration = ? LIMIT 1',
    [Number(idOrRegistration) || 0, idOrRegistration]
  );
  return mapAircraft(rows[0]);
}

async function createAircraft(aircraft) {
  const [result] = await getPool().query(
    `INSERT INTO aircraft
      (registration, type, category, hub, hub_name, economy_seats, business_seats, first_seats, range_km, cruise_speed_kmh, status, image, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      aircraft.registration,
      aircraft.type,
      aircraft.category,
      aircraft.hub,
      aircraft.hub_name,
      aircraft.seats?.economy || 0,
      aircraft.seats?.business || 0,
      aircraft.seats?.first || 0,
      aircraft.range_km || 0,
      aircraft.cruise_speed_kmh || 0,
      aircraft.status || 'active',
      aircraft.image || null,
      aircraft.description || null
    ]
  );

  return findAircraftByIdOrRegistration(result.insertId);
}

async function updateAircraft(id, aircraft) {
  await getPool().query(
    `UPDATE aircraft SET
      registration = ?,
      type = ?,
      category = ?,
      hub = ?,
      hub_name = ?,
      economy_seats = ?,
      business_seats = ?,
      first_seats = ?,
      range_km = ?,
      cruise_speed_kmh = ?,
      status = ?,
      image = ?,
      description = ?
     WHERE id = ?`,
    [
      aircraft.registration,
      aircraft.type,
      aircraft.category,
      aircraft.hub,
      aircraft.hub_name,
      aircraft.seats?.economy || 0,
      aircraft.seats?.business || 0,
      aircraft.seats?.first || 0,
      aircraft.range_km || 0,
      aircraft.cruise_speed_kmh || 0,
      aircraft.status || 'active',
      aircraft.image || null,
      aircraft.description || null,
      id
    ]
  );

  return findAircraftByIdOrRegistration(id);
}

async function retireAircraft(id) {
  await getPool().query('UPDATE aircraft SET status = ? WHERE id = ?', ['retired', id]);
  return findAircraftByIdOrRegistration(id);
}

async function countActiveAircraft() {
  const [[{ count }]] = await getPool().query(
    "SELECT COUNT(*) AS count FROM aircraft WHERE status = 'active'"
  );
  return count;
}

module.exports = {
  countActiveAircraft,
  createAircraft,
  findAircraftByIdOrRegistration,
  listAircraft,
  retireAircraft,
  updateAircraft
};
