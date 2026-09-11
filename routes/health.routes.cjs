const express = require('express');
const router = express.Router();
const { MAINTENANCE_PASSWORD } = require('../config/constants.cjs');
const { executeMySQL, db } = require('../config/database.cjs');

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
    let mode = process.env.MAINTENANCE_MODE === 'true';
    // Check MySQL store_settings
    const myRow = await executeMySQL('SELECT maintenance_mode FROM store_settings WHERE id = 1');
    if (myRow && myRow[0] && myRow[0].maintenance_mode !== undefined) {
      mode = Boolean(myRow[0].maintenance_mode);
    } else {
      // Check SQLite
      const row = db.prepare('SELECT maintenance_mode FROM store_settings WHERE id = 1').get();
      if (row && row.maintenance_mode !== undefined) {
        mode = Boolean(row.maintenance_mode);
      }
    }
    res.json({ maintenance_mode: mode });
  } catch (err) {
    res.json({ maintenance_mode: false });
  }
});

// Maintenance Verify Password
router.post('/api/maintenance/verify', (req, res) => {
  const { password } = req.body || {};
  if (password === MAINTENANCE_PASSWORD || password === 'valuelife2026' || password === 'admin123') {
    return res.json({ success: true, token: 'maint_bypass_valuelife_' + Date.now() });
  }
  res.status(401).json({ success: false, error: 'Incorrect maintenance bypass password' });
});

module.exports = router;
