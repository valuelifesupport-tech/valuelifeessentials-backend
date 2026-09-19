const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.CUSTOMER_JWT_SECRET || process.env.ADMIN_SECRET_KEY || 'valuelife_customer_jwt_2026';
const TOKEN_EXPIRY = '7d';

function generateCustomerToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

function requireCustomerAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['x-auth-token'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.customer = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Soft auth - attaches customer if token present, but doesn't block
function optionalCustomerAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['x-auth-token'];
  if (!authHeader) return next();
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  try {
    req.customer = jwt.verify(token, JWT_SECRET);
  } catch (err) { /* ignore invalid tokens */ }
  next();
}

module.exports = { generateCustomerToken, requireCustomerAuth, optionalCustomerAuth, JWT_SECRET };
