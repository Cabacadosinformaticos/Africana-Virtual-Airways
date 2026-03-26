const express = require('express');

const { requireAdmin } = require('../middlewares/auth-middleware');
const {
  createAircraft,
  findAircraftByIdOrRegistration,
  listAircraft,
  retireAircraft,
  updateAircraft
} = require('../repositories/aircraft-repository');
const { asyncHandler } = require('../utils/async-handler');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const fleet = await listAircraft(req.query);
  return res.json(fleet);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const aircraft = await findAircraftByIdOrRegistration(req.params.id);
  if (!aircraft) {
    return res.status(404).json({ error: 'Aircraft not found' });
  }

  return res.json(aircraft);
}));

router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const aircraft = await createAircraft(req.body);
  return res.status(201).json(aircraft);
}));

router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const existing = await findAircraftByIdOrRegistration(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Aircraft not found' });
  }

  const aircraft = await updateAircraft(existing.id, { ...existing, ...req.body });
  return res.json(aircraft);
}));

router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const existing = await findAircraftByIdOrRegistration(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Aircraft not found' });
  }

  await retireAircraft(existing.id);
  return res.json({ message: 'Aircraft retired' });
}));

module.exports = router;
