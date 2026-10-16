const jwt = require('jsonwebtoken');
const { CUSTOMER_JWT_SECRET, ADMIN_SECRET_KEY } = require('../config/constants.cjs');
const { activeAdminTokens } = require('./auth.cjs');

const JWT_SECRET = process.env.CUSTOMER_JWT_SECRET || process.env.ADMIN_SECRET_KEY || CUSTOMER_JWT_SECRET;
const TOKEN_EXPIRY = '30d';

function generateCustomerToken(user) {
  if (!user || !user.id) return null;
  return jwt.sign(
    { 
      id: Number(user.id), 
      email: user.email ? String(user.email).toLowerCase() : '', 
      name: user.name || '',
      phone: user.phone || '',
      role: user.role || 'CUSTOMER'
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

function checkIsAdmin(req) {
  const token = req.headers['x-admin-token'] || req.headers['admin-token'] || req.headers['x-admin-key'];
  if (token && (token === ADMIN_SECRET_KEY || (activeAdminTokens && activeAdminTokens.has(token)))) {
    return true;
  }
  return false;
}

function requireCustomerAuth(req, res, next) {
  // Check if admin is calling
  if (checkIsAdmin(req)) {
    req.isAdmin = true;
    return next();
  }

  const authHeader = req.headers['authorization'] || req.headers['x-auth-token'] || req.headers['x-customer-token'];
  if (!authHeader) {
    return res.status(401).json({ 
      success: false, 
      error: 'Unauthorized: Authentication required. Please log in with a valid session token.' 
    });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Malformed session token.' });
    }
    req.customer = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ 
      success: false, 
      error: 'Unauthorized: Invalid or expired session token. Please log in again.' 
    });
  }
}

// Soft auth - attaches customer if token present, but doesn't block
function optionalCustomerAuth(req, res, next) {
  if (checkIsAdmin(req)) {
    req.isAdmin = true;
  }
  const authHeader = req.headers['authorization'] || req.headers['x-auth-token'] || req.headers['x-customer-token'];
  if (!authHeader) return next();
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  try {
    req.customer = jwt.verify(token, JWT_SECRET);
  } catch (err) { /* ignore invalid tokens */ }
  next();
}

module.exports = { generateCustomerToken, requireCustomerAuth, optionalCustomerAuth, JWT_SECRET };

