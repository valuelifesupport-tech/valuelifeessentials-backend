const crypto = require('crypto');
const { ADMIN_SECRET_KEY, ADMIN_PASSWORD, PASSWORD_SALT } = require('../config/constants.cjs');

const activeAdminTokens = new Set([ADMIN_SECRET_KEY]);
const tokenTimestamps = new Map();
tokenTimestamps.set(ADMIN_SECRET_KEY, Date.now());

function registerToken(token) {
  activeAdminTokens.add(token);
  tokenTimestamps.set(token, Date.now());
}

// Auto-cleanup expired admin tokens every 10 minutes
setInterval(() => {
  const now = Date.now();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  for (const [token, ts] of tokenTimestamps) {
    if (token === ADMIN_SECRET_KEY) continue; // Never expire master key
    if (now - ts > TWENTY_FOUR_HOURS) {
      activeAdminTokens.delete(token);
      tokenTimestamps.delete(token);
    }
  }
}, 10 * 60 * 1000);

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
  let token = null;

  if (authHeader) {
    token = authHeader.replace(/^Bearer\s+/i, '').trim();
  } else {
    token = req.headers['x-admin-token'] || req.headers['x-admin-key'] || req.query?.admin_token;
  }

  if (token && activeAdminTokens.has(token)) {
    const timestamp = tokenTimestamps.get(token);
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    if (timestamp && (Date.now() - timestamp < TWENTY_FOUR_HOURS)) {
      return next();
    } else {
      activeAdminTokens.delete(token);
      tokenTimestamps.delete(token);
    }
  }

  return res.status(401).json({ error: 'Authorization header missing, invalid, or expired' });
}

module.exports = {
  activeAdminTokens,
  registerToken,
  hashPassword,
  verifyPassword,
  requireAdminAuth
};
