const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { countActiveAircraft } = require('./repositories/aircraft-repository');
const { initializeDatabase } = require('./repositories/database');
const { countUsers } = require('./repositories/user-repository');
const { refreshOilPrice } = require('./services/pricing/oil-service');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'unpkg.com', 'cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'unpkg.com', 'fonts.googleapis.com', 'cdn.jsdelivr.net'],
      imgSrc: [
        "'self'",
        'data:',
        '*.wikimedia.org',
        '*.wikipedia.org',
        '*.openstreetmap.org',
        '*.tile.openstreetmap.org',
        'tile.openstreetmap.org',
        '*.basemaps.cartocdn.com',
        'basemaps.cartocdn.com',
        'unpkg.com',
        'cdn.jsdelivr.net',
        '*.unsplash.com'
      ],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'fonts.gstatic.com'],
      frameSrc: ["'none'"]
    }
  }
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 'https://africana-va.com' : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../../web'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

app.use('/api/auth', require('./routes/auth-routes'));
app.use('/api/flights', require('./routes/flights-routes'));
app.use('/api/fleet', require('./routes/fleet-routes'));
app.use('/api/bookings', require('./routes/bookings-routes'));
app.use('/api/admin', require('./routes/admin-routes'));
app.use('/api/vatsim', require('./routes/vatsim-routes'));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    airline: 'Africana Virtual Airways',
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: `${Math.floor(process.uptime())}s`
  });
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }

  return res.sendFile(path.join(__dirname, '../../web/index.html'));
});

app.use((err, req, res, next) => {
  console.error('[AFV Error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

startServer();

async function startServer() {
  try {
    await initializeDatabase();
    const [activeFleet, users] = await Promise.all([countActiveAircraft(), countUsers()]);

    // Kick off first oil price fetch in background (non-blocking)
    refreshOilPrice();

    app.listen(PORT, () => {
      console.log('\nAfricana Virtual Airways API');
      console.log(`Running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Fleet: ${activeFleet} aircraft | Users: ${users}\n`);
    });
  } catch (error) {
    console.error('[AFV Startup Error]', error.message);
    process.exit(1);
  }
}
