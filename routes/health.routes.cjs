const express = require('express');
const router = express.Router();
const { MAINTENANCE_PASSWORD } = require('../config/constants.cjs');
const { executeMySQL, db } = require('../config/database.cjs');
const { requireAdminAuth } = require('../middleware/auth.cjs');

// Canonical Health & Root check
router.get(['/', '/health', '/api/health'], (req, res) => {
  res.json({
    status: 'online',
    store: 'ValueLife Essentials API',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Maintenance Status
router.get('/api/maintenance/status', async (req, res) => {
  try {
    const envMode = process.env.MAINTENANCE_MODE === 'true';
    let dbMode = false;
    
    try {
      const myRow = await executeMySQL('SELECT maintenance_mode FROM store_settings WHERE id = 1');
      if (myRow && myRow[0] && myRow[0].maintenance_mode !== undefined) {
        dbMode = Boolean(myRow[0].maintenance_mode);
      }
    } catch (e) {}

    if (!dbMode) {
      try {
        const row = db.prepare('SELECT maintenance_mode FROM store_settings WHERE id = 1').get();
        if (row && row.maintenance_mode !== undefined) {
          dbMode = Boolean(row.maintenance_mode);
        }
      } catch (e) {}
    }

    // Active if either environment variable or database setting is true
    const isActive = envMode || dbMode;
    res.json({ maintenance_mode: isActive, mode: isActive, source: envMode ? 'env' : (dbMode ? 'db' : 'none') });
  } catch (err) {
    res.json({ maintenance_mode: process.env.MAINTENANCE_MODE === 'true' });
  }
});

// Toggle Maintenance Status in DB
router.post('/api/maintenance/toggle', requireAdminAuth, async (req, res) => {
  try {
    const { active, mode } = req.body || {};
    const newStatus = (active !== undefined ? active : mode) ? 1 : 0;
    try {
      await executeMySQL('UPDATE store_settings SET maintenance_mode = ? WHERE id = 1', [newStatus]);
    } catch (e) {}
    try {
      db.prepare('UPDATE store_settings SET maintenance_mode = ? WHERE id = 1').run(newStatus);
    } catch (e) {}
    res.json({ success: true, maintenance_mode: Boolean(newStatus) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Maintenance Verify Password
router.post('/api/maintenance/verify', (req, res) => {
  const { password } = req.body || {};
  const MAINT_PASS = process.env.MAINTENANCE_PASSWORD || '';
  if (password === MAINT_PASS) {
    return res.json({ success: true, token: 'maint_bypass_valuelife_' + Date.now() });
  }
  res.status(401).json({ success: false, error: 'Incorrect maintenance bypass password' });
});

module.exports = router;
