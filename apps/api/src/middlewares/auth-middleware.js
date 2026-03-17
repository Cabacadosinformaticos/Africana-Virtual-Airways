const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'afv_secret_change_in_production';

/**
 * Middleware: require a valid JWT to access the route
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  return verifyToken(req, res, next, true);
}

/**
 * Middleware: require admin role
 */
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

/**
 * Generate a signed JWT for a user object
 */
function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isPrimaryAdmin: Boolean(user.isPrimaryAdmin)
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

function attachUserIfPresent(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  return verifyToken(req, res, next, false);
}

function verifyToken(req, res, next, strictMode) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch {
    if (strictMode) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = null;
    return next();
  }
}

module.exports = { attachUserIfPresent, requireAuth, requireAdmin, signToken };
