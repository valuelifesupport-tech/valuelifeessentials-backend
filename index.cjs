const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '../.env') });

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
const ALLOWED_ORIGINS = new Set([
  'https://valuelifeessentials.com',
  'https://www.valuelifeessentials.com',
  'https://admin.valuelifeessentials.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000'
]);

app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.has(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  } else {
    res.header('Access-Control-Allow-Origin', '*');
    // Don't set credentials for wildcard origin
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');

  const reqHeaders = req.headers['access-control-request-headers'];
  if (reqHeaders) {
    res.header('Access-Control-Allow-Headers', reqHeaders);
  } else {
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-admin-token, X-Admin-Token, x-admin-key, X-Admin-Key, x-auth-token, X-Auth-Token, Cache-Control, Pragma'
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
    if (!incomingOrigin || ALLOWED_ORIGINS.has(incomingOrigin)) {
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
    'Cache-Control', 'Pragma'
  ]
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
app.use(require('./routes/cartWishlist.routes.cjs'));
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
