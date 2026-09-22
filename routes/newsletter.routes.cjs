const express = require('express');
const router = express.Router();
const { db, executeMySQL } = require('../config/database.cjs');

// POST /api/newsletter/subscribe
router.post('/api/newsletter/subscribe', async (req, res) => {
  try {
    const { email, source } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // MySQL first
    try {
      await executeMySQL(
        'INSERT INTO newsletter_subscribers (email, source) VALUES (?, ?) ON DUPLICATE KEY UPDATE source = source',
        [normalizedEmail, source || 'website']
      );
    } catch (e) {
      // If duplicate in MySQL, that's fine
      if (e.code !== 'ER_DUP_ENTRY') throw e;
    }

    // SQLite dual-write
    try {
      db.prepare('INSERT OR IGNORE INTO newsletter_subscribers (email, source) VALUES (?, ?)').run(normalizedEmail, source || 'website');
    } catch (e) {}

    res.json({ success: true, message: 'Subscribed successfully!' });
  } catch (err) {
    // Duplicate email is not an error for the user
    if (err.code === 'ER_DUP_ENTRY' || (err.message && err.message.includes('UNIQUE'))) {
      return res.json({ success: true, message: 'Already subscribed!' });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/newsletter/subscribers (admin view)
router.get('/api/admin/newsletter/subscribers', async (req, res) => {
  try {
    let rows;
    try {
      const [mysqlRows] = await executeMySQL('SELECT * FROM newsletter_subscribers ORDER BY created_at DESC');
      rows = mysqlRows;
    } catch (e) {
      rows = db.prepare('SELECT * FROM newsletter_subscribers ORDER BY created_at DESC').all();
    }
    res.json(rows || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
