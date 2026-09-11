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
const path = require('path');
const { PORT } = require('./config/constants.cjs');
const { setupHostingerMySQL } = require('./config/database.cjs');
const errorHandler = require('./middleware/errorHandler.cjs');

const app = express();

// UNIVERSAL CORS & SECURITY HEADERS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(cors({
  origin: true,
  credentials: true
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
app.use(require('./routes/reviews.routes.cjs'));
app.use(require('./routes/coupons.routes.cjs'));
app.use(require('./routes/analytics.routes.cjs'));
app.use(require('./routes/users.routes.cjs'));
app.use(require('./routes/auth.routes.cjs'));
app.use(require('./routes/payment.routes.cjs'));
app.use(require('./routes/products.routes.cjs'));
app.use(require('./routes/orders.routes.cjs'));

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
