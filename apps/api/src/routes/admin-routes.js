const express = require('express');
const bcrypt = require('bcryptjs');

const { requireAdmin } = require('../middlewares/auth-middleware');
const { countActiveAircraft, listAircraft } = require('../repositories/aircraft-repository');
const { getStats, updateStats } = require('../repositories/airline-stats-repository');
const { getAllAirports } = require('../repositories/airport-repository');
const { listAllBookings, updateBookingStatus } = require('../repositories/booking-repository');
const { createRoute, getRouteById, getRoutesWithSchedules, updateRoute } = require('../repositories/route-repository');
const {
  countUsers,
  createUser,
  findUserByEmail,
  findUserById,
  listUsers,
  toSafeUser,
  updateUserRole
} = require('../repositories/user-repository');
const { asyncHandler } = require('../utils/async-handler');

const router = express.Router();

router.use(requireAdmin);

function createHttpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function getCurrentAdmin(req) {
  const admin = await findUserById(req.user.id);
  if (!admin || admin.role !== 'admin') {
    throw createHttpError('Admin access required', 403);
  }
  return admin;
}

async function requirePrimaryAdmin(req) {
  const admin = await getCurrentAdmin(req);
  if (!admin.isPrimaryAdmin) {
    throw createHttpError('Only the main admin can manage user logins.', 403);
  }
  return admin;
}

function normalizeRoutePayload(body = {}) {
  const fromAirport = String(body.fromAirport || body.from || '').trim().toUpperCase();
  const toAirport = String(body.toAirport || body.to || '').trim().toUpperCase();
  const hubAirport = String(body.hubAirport || body.hub || '').trim().toUpperCase();
  const status = String(body.status || 'active').trim().toLowerCase();
  const rawAircraftId = body.aircraftId === '' ? null : body.aircraftId;
  const aircraftId = rawAircraftId === undefined || rawAircraftId === null
    ? null
    : Number(rawAircraftId);

  const schedulesSource = Array.isArray(body.schedules) && body.schedules.length
    ? body.schedules
    : [{
      flightNumber: body.flightNumber,
      slotCode: body.slotCode,
      departureTime: body.departureTime,
      active: body.scheduleActive
    }];

  const schedules = schedulesSource
    .filter(schedule => schedule && (
      schedule.flightNumber !== undefined ||
      schedule.departureTime !== undefined ||
      schedule.slotCode !== undefined
    ))
    .map(schedule => ({
      flightNumber: schedule.flightNumber,
      slotCode: schedule.slotCode,
      departureTime: schedule.departureTime,
      active: schedule.active
    }));

  if (!fromAirport || !toAirport || !hubAirport) {
    throw createHttpError('fromAirport, toAirport and hubAirport are required.', 400);
  }

  if (!['active', 'inactive'].includes(status)) {
    throw createHttpError('Route status must be active or inactive.', 400);
  }

  if (aircraftId !== null && Number.isNaN(aircraftId)) {
    throw createHttpError('aircraftId must be a valid number.', 400);
  }

  return {
    fromAirport,
    toAirport,
    hubAirport,
    aircraftId,
    status,
    schedules
  };
}

router.get('/stats', asyncHandler(async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const [bookings, totalUsers, activeFleet] = await Promise.all([
    listAllBookings(),
    countUsers(),
    countActiveAircraft()
  ]);

  const totalBookings = bookings.length;
  const confirmedBookings = bookings.filter(booking => booking.status !== 'cancelled').length;
  const cancelledBookings = bookings.filter(booking => booking.status === 'cancelled').length;
  const delayedBookings = bookings.filter(booking => booking.status === 'delayed').length;
  const todayBookings = bookings.filter(booking => String(booking.createdAt || '').startsWith(today)).length;
  const totalRevenue = bookings
    .filter(booking => booking.status !== 'cancelled')
    .reduce((sum, booking) => sum + (booking.totalPrice || 0), 0);

  const revenueByClass = { economy: 0, business: 0, first: 0 };
  bookings
    .filter(booking => booking.status !== 'cancelled')
    .forEach(booking => {
      revenueByClass[booking.cabinClass] = (revenueByClass[booking.cabinClass] || 0) + (booking.totalPrice || 0);
    });

  const routeCounts = {};
  bookings.forEach(booking => {
    const key = `${booking.from}-${booking.to}`;
    routeCounts[key] = (routeCounts[key] || 0) + 1;
  });

  const topRoutes = Object.entries(routeCounts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([route, count]) => ({ route, count }));

  return res.json({
    totalBookings,
    confirmedBookings,
    cancelledBookings,
    delayedBookings,
    todayBookings,
    totalRevenue,
    totalUsers,
    activeFleet,
    revenueByClass,
    topRoutes
  });
}));

router.get('/users', asyncHandler(async (req, res) => {
  const users = await listUsers();
  return res.json(users.map(toSafeUser));
}));

router.post('/users', asyncHandler(async (req, res) => {
  const actor = await requirePrimaryAdmin(req);
  const { name, email, password, vatsimCid, role = 'user' } = req.body;

  if (!name || !email || !password) {
    throw createHttpError('name, email and password are required', 400);
  }

  if (!['admin', 'user'].includes(role)) {
    throw createHttpError('role must be admin or user', 400);
  }

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    throw createHttpError('Email already registered', 409);
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = await createUser({
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    password: passwordHash,
    vatsimCid: vatsimCid ? String(vatsimCid).trim() : null,
    role,
    createdByUserId: actor.id
  });

  return res.status(201).json(toSafeUser(user));
}));

router.put('/users/:id/role', asyncHandler(async (req, res) => {
  await requirePrimaryAdmin(req);

  const targetUserId = Number(req.params.id);
  const currentUser = await findUserById(targetUserId);
  if (!currentUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (currentUser.isPrimaryAdmin) {
    throw createHttpError('The main admin role cannot be changed.', 400);
  }

  const role = String(req.body.role || 'user').trim().toLowerCase();
  if (!['admin', 'user'].includes(role)) {
    throw createHttpError('role must be admin or user', 400);
  }

  const user = await updateUserRole(targetUserId, role);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json(toSafeUser(user));
}));

router.get('/bookings', asyncHandler(async (req, res) => {
  const bookings = await listAllBookings();
  return res.json(bookings);
}));

router.put('/bookings/:ref/status', asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['confirmed', 'on_time', 'delayed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const booking = await updateBookingStatus(req.params.ref, status);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  return res.json(booking);
}));

router.get('/fleet', asyncHandler(async (req, res) => {
  const fleet = await listAircraft();
  return res.json(fleet);
}));

router.get('/lookups', asyncHandler(async (req, res) => {
  const [airportsMap, fleet] = await Promise.all([
    getAllAirports(),
    listAircraft()
  ]);

  const airports = Object.values(airportsMap).sort((left, right) => {
    if (left.hub !== right.hub) {
      return Number(right.hub) - Number(left.hub);
    }

    const cityComparison = left.city.localeCompare(right.city);
    if (cityComparison !== 0) return cityComparison;
    return left.icao.localeCompare(right.icao);
  });

  const aircraft = [...fleet].sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === 'active' ? -1 : 1;
    }

    return left.registration.localeCompare(right.registration);
  });

  return res.json({
    airports,
    aircraft,
    routeStatuses: ['active', 'inactive']
  });
}));

router.get('/routes', asyncHandler(async (req, res) => {
  const routes = await getRoutesWithSchedules();

  return res.json({
    summary: {
      totalRoutes: routes.length,
      activeRoutes: routes.filter(route => route.status === 'active').length,
      inactiveRoutes: routes.filter(route => route.status !== 'active').length,
      routesWithAircraft: routes.filter(route => route.aircraft).length,
      hubs: new Set(routes.map(route => route.hubAirport)).size
    },
    routes
  });
}));

router.post('/routes', asyncHandler(async (req, res) => {
  const payload = normalizeRoutePayload(req.body);
  const route = await createRoute(payload);
  return res.status(201).json(route);
}));

router.put('/routes/:id', asyncHandler(async (req, res) => {
  const routeId = Number(req.params.id);
  if (!routeId) {
    return res.status(400).json({ error: 'A valid route id is required.' });
  }

  const existingRoute = await getRouteById(routeId);
  if (!existingRoute) {
    return res.status(404).json({ error: 'Route not found' });
  }

  const payload = normalizeRoutePayload(req.body);
  const route = await updateRoute(routeId, payload);
  return res.json(route);
}));

router.get('/airline-stats', asyncHandler(async (req, res) => {
  const stats = await getStats();
  if (!stats) return res.status(404).json({ error: 'Airline stats not found' });
  return res.json(stats);
}));

router.put('/airline-stats', asyncHandler(async (req, res) => {
  const allowed = ['totalFlights', 'totalHours', 'activeMembers', 'foundedDate', 'division', 'callsignPrefix'];
  const patch   = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) patch[key] = req.body[key];
  }
  if (!Object.keys(patch).length) {
    return res.status(400).json({ error: 'No valid fields provided' });
  }
  const updated = await updateStats(patch);
  return res.json(updated);
}));

module.exports = router;
