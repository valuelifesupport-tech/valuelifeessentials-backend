const path = require('path');
// Load server/.env first (contains SMTP, MySQL, Razorpay, etc.)
require('dotenv').config({ path: path.join(__dirname, '.env') });
// Then load root .env as fallback (won't override already-set vars)
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();

// PREVENT PROCESS CRASHES ON UNCAUGHT ERRORS
process.on('uncaughtException', (err) => {
  console.error('🔥 Uncaught Exception:', err.message, err.stack);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 Unhandled Rejection at:', promise, 'reason:', reason);
});

const express = require('express');
const cors = require('cors');
const { PORT } = require('./config/constants.cjs');
const { setupHostingerMySQL } = require('./config/database.cjs');
const errorHandler = require('./middleware/errorHandler.cjs');

const app = express();

// UNIVERSAL CORS & SECURITY HEADERS
const DEFAULT_ALLOWED_ORIGINS = [
  'https://www.valuelifeessentials.com',
  'https://valuelifeessentials.com',
  'https://admin.valuelifeessentials.com',
  'https://backend.valuelifeessentials.com',
  'http://www.valuelifeessentials.com',
  'http://valuelifeessentials.com',
  'http://admin.valuelifeessentials.com',
  'http://backend.valuelifeessentials.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://localhost:5000'
];

const ALLOWED_ORIGINS = new Set([
  ...DEFAULT_ALLOWED_ORIGINS,
  ...(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
]);

function isAllowedOrigin(origin) {
  if (!origin) return true; // allow same-origin, curl, server-to-server, mobile apps
  const clean = String(origin).trim().toLowerCase().replace(/\/$/, '');
  try {
    const parsed = new URL(clean);
    if (
      parsed.hostname === 'valuelifeessentials.com' ||
      parsed.hostname.endsWith('.valuelifeessentials.com') ||
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1'
    ) {
      return true;
    }
  } catch (e) {}
  return ALLOWED_ORIGINS.has(clean);
}

app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  if (isAllowedOrigin(origin)) {
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Vary', 'Origin');
    }
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');

  const reqHeaders = req.headers['access-control-request-headers'];
  if (reqHeaders) {
    res.header('Access-Control-Allow-Headers', reqHeaders);
  } else {
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-admin-token, X-Admin-Token, x-admin-key, X-Admin-Key, x-auth-token, X-Auth-Token, x-customer-token, X-Customer-Token, x-user-id, X-User-Id, Cache-Control, Pragma'
    );
  }

  res.header('Access-Control-Expose-Headers', 'Content-Disposition, X-Total-Count');
  res.header('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use(cors({
  origin: (incomingOrigin, callback) => {
    if (isAllowedOrigin(incomingOrigin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Origin', 'X-Requested-With', 'Content-Type', 'Accept',
    'Authorization', 'x-admin-token', 'X-Admin-Token',
    'x-admin-key', 'X-Admin-Key', 'x-auth-token', 'X-Auth-Token',
    'x-customer-token', 'X-Customer-Token', 'x-user-id', 'X-User-Id',
    'Cache-Control', 'Pragma'
  ],
  exposedHeaders: ['Content-Disposition', 'X-Total-Count']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// STATIC UPLOADS SERVING
const uploadsDir = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsDir));
app.use('/api/uploads', express.static(uploadsDir));

// MOUNT MODULAR ROUTE CONTROLLERS
app.use(require('./routes/health.routes.cjs'));
app.use(require('./routes/media.routes.cjs'));
app.use(require('./routes/categories.routes.cjs'));
app.use(require('./routes/collections.routes.cjs'));
app.use(require('./routes/banners.routes.cjs'));
app.use(require('./routes/filters.routes.cjs'));
app.use(require('./routes/cart.routes.cjs'));
app.use(require('./routes/settings.routes.cjs'));
app.use(require('./routes/pages.routes.cjs'));
app.use(require('./routes/blogs.routes.cjs'));
app.use(require('./routes/reviews.routes.cjs'));
app.use(require('./routes/coupons.routes.cjs'));
app.use(require('./routes/analytics.routes.cjs'));
app.use(require('./routes/users.routes.cjs'));
app.use(require('./routes/auth.routes.cjs'));
app.use(require('./routes/payment.routes.cjs'));
app.use(require('./routes/products.routes.cjs'));
app.use(require('./routes/orders.routes.cjs'));
app.use(require('./routes/shiprocket.routes.cjs'));
app.use(require('./routes/newsletter.routes.cjs'));

// 404 UNMATCHED ROUTE HANDLER
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
    code: 'NOT_FOUND',
    timestamp: new Date().toISOString()
  });
});

// CENTRAL ERROR HANDLER
app.use(errorHandler);

// START SERVER & INITIALIZE DATABASE
const server = app.listen(PORT, async () => {
  console.log(`🚀 ValueLife Essentials Modular API Server running on port ${PORT}`);
  try {
    await setupHostingerMySQL();
  } catch (err) {
    console.warn('MySQL setup notice:', err.message);
  }
});

module.exports = app;
