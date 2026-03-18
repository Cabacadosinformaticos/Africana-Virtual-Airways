const express = require('express');
const bcrypt = require('bcryptjs');

const { requireAuth, signToken } = require('../middlewares/auth-middleware');
const { createUser, findUserByEmail, findUserById, toSafeUser } = require('../repositories/user-repository');
const { asyncHandler } = require('../utils/async-handler');

const router = express.Router();

router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, password, vatsimCid } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await createUser({ name, email, password: hash, vatsimCid });
  const token = signToken(user);

  return res.status(201).json({ token, user: toSafeUser(user) });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await findUserByEmail(email);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signToken(user);
  return res.json({ token, user: toSafeUser(user) });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await findUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json(toSafeUser(user));
}));

module.exports = router;
