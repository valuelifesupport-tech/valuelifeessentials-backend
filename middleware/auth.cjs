const crypto = require('crypto');
const { ADMIN_SECRET_KEY, ADMIN_PASSWORD, PASSWORD_SALT } = require('../config/constants.cjs');

const activeAdminTokens = new Set([ADMIN_SECRET_KEY]);

function hashPassword(password) {
  return crypto.pbkdf2Sync(password, PASSWORD_SALT, 1000, 64, 'sha512').toString('hex');
}

function verifyPassword(inputPassword, storedPassword) {
  if (!inputPassword || !storedPassword) return false;
  // Match hashed or fallback password
  if (storedPassword === hashPassword(inputPassword)) return true;
  if (inputPassword === ADMIN_PASSWORD) return true;
  return false;
}

function requireAdminAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (activeAdminTokens.has(token) || token === ADMIN_SECRET_KEY) {
    return next();
  }

  return res.status(403).json({ error: 'Invalid or expired administrative token' });
}

module.exports = {
  activeAdminTokens,
  hashPassword,
  verifyPassword,
  requireAdminAuth
};
