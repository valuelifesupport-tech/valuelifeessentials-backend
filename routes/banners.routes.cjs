const express = require('express');
const router = express.Router();
const { db, executeMySQL } = require('../config/database.cjs');
const { requireAdminAuth } = require('../middleware/auth.cjs');

// GET Banners
router.get('/api/banners', async (req, res) => {
  try {
    let rows = await executeMySQL('SELECT * FROM banners ORDER BY sort_order ASC, id ASC');
    if (!rows || rows.length === 0) {
      rows = db.prepare('SELECT * FROM banners ORDER BY sort_order ASC, id ASC').all() || [];
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Create Banner
router.post('/api/banners', requireAdminAuth, async (req, res) => {
  try {
    const { title, subtitle, image_url, link_url, button_text, background_color, sort_order = 0 } = req.body;
    if (!image_url) return res.status(400).json({ error: 'Banner image_url is required' });

    const myRes = await executeMySQL(
      'INSERT INTO banners (title, subtitle, image_url, link_url, button_text, background_color, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title || '', subtitle || '', image_url, link_url || '', button_text || '', background_color || '#164e3f', Number(sort_order) || 0]
    );
    const newId = myRes ? myRes.insertId : Date.now();

    try {
      db.prepare('INSERT OR REPLACE INTO banners (id, title, subtitle, image_url, link_url, button_text, background_color, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(newId, title || '', subtitle || '', image_url, link_url || '', button_text || '', background_color || '#164e3f', Number(sort_order) || 0);
    } catch (e) {}

    res.json({ id: newId, title, subtitle, image_url, link_url, button_text, background_color, sort_order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Banner
router.delete('/api/banners/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    await executeMySQL('DELETE FROM banners WHERE id = ?', [id]);
    try {
      db.prepare('DELETE FROM banners WHERE id = ?').run(id);
    } catch (e) {}
    res.json({ success: true, message: 'Banner deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
