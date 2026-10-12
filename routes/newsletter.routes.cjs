const express = require('express');
const router = express.Router();
const { db, executeMySQL } = require('../config/database.cjs');
const { requireAdminAuth } = require('../middleware/auth.cjs');

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
router.get(['/api/admin/newsletter/subscribers', '/api/newsletter/subscribers'], async (req, res) => {
  try {
    let rows = [];
    try {
      const mysqlRows = await executeMySQL('SELECT * FROM newsletter_subscribers ORDER BY created_at DESC');
      if (Array.isArray(mysqlRows) && mysqlRows.length > 0) {
        rows = mysqlRows;
      } else {
        rows = db.prepare('SELECT * FROM newsletter_subscribers ORDER BY created_at DESC').all() || [];
      }
    } catch (e) {
      try {
        rows = db.prepare('SELECT * FROM newsletter_subscribers ORDER BY created_at DESC').all() || [];
      } catch (err) {}
    }
    res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/newsletter/subscribers/:id
router.delete(['/api/admin/newsletter/subscribers/:id', '/api/newsletter/subscribers/:id'], requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    try {
      await executeMySQL('DELETE FROM newsletter_subscribers WHERE id = ?', [id]);
    } catch (e) {}
    try {
      db.prepare('DELETE FROM newsletter_subscribers WHERE id = ?').run(id);
    } catch (e) {}
    res.json({ success: true, message: 'Subscriber removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
