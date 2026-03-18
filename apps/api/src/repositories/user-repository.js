const { getPool } = require('./database');

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    vatsimCid: row.vatsim_cid,
    role: row.role,
    isPrimaryAdmin: Boolean(row.is_primary_admin),
    createdByUserId: row.created_by_user_id,
    createdByName: row.created_by_name || null,
    joinedAt: row.joined_at,
    flightHours: row.flight_hours,
    points: row.points
  };
}

function toSafeUser(user) {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}

async function findUserByEmail(email) {
  const [rows] = await getPool().query(
    'SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
    [email]
  );
  return mapUser(rows[0]);
}

async function findUserById(id) {
  const [rows] = await getPool().query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return mapUser(rows[0]);
}

async function createUser({ name, email, password, vatsimCid, role = 'user', createdByUserId = null, isPrimaryAdmin = false }) {
  const [result] = await getPool().query(
    `INSERT INTO users
      (name, email, password, vatsim_cid, role, is_primary_admin, created_by_user_id, joined_at, flight_hours, points)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 0, 0)`,
    [name, email, password, vatsimCid || null, role, isPrimaryAdmin ? 1 : 0, createdByUserId]
  );

  return findUserById(result.insertId);
}

async function listUsers() {
  const [rows] = await getPool().query(
    `SELECT users.*, creators.name AS created_by_name
     FROM users
     LEFT JOIN users AS creators ON creators.id = users.created_by_user_id
     ORDER BY users.is_primary_admin DESC, users.joined_at DESC`
  );
  return rows.map(mapUser);
}

async function updateUserRole(id, role) {
  await getPool().query('UPDATE users SET role = ? WHERE id = ?', [role, id]);
  return findUserById(id);
}

async function countUsers() {
  const [[{ count }]] = await getPool().query('SELECT COUNT(*) AS count FROM users');
  return count;
}

module.exports = {
  countUsers,
  createUser,
  findUserByEmail,
  findUserById,
  listUsers,
  toSafeUser,
  updateUserRole
};
