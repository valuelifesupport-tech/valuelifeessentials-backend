const express = require('express');
const router = express.Router();
const { db, executeMySQL } = require('../config/database.cjs');
const { requireAdminAuth } = require('../middleware/auth.cjs');

// GET Admin Reviews
router.get('/api/admin/reviews', async (req, res) => {
  try {
    let reviews = await executeMySQL('SELECT * FROM product_reviews ORDER BY created_at DESC');
    if (!reviews || reviews.length === 0) {
      reviews = db.prepare('SELECT * FROM product_reviews ORDER BY created_at DESC').all() || [];
    }

    const revImages = await executeMySQL('SELECT * FROM review_images') || [];
    const populated = reviews.map(r => ({
      ...r,
      photos: revImages.filter(img => String(img.review_id) === String(r.id)).map(img => img.image_url)
    }));

    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Customer Review
router.post('/api/reviews', async (req, res) => {
  try {
    const { product_id, user_name, user_email, rating, title, comment, photos = [] } = req.body;
    if (!product_id || !user_name || !rating) {
      return res.status(400).json({ error: 'product_id, user_name, and rating are required' });
    }

    const myRes = await executeMySQL(
      'INSERT INTO product_reviews (product_id, user_name, user_email, rating, title, comment, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [product_id, user_name, user_email || '', Number(rating), title || '', comment || '', 'APPROVED']
    );
    const newId = myRes ? myRes.insertId : Date.now();

    try {
      db.prepare('INSERT OR REPLACE INTO product_reviews (id, product_id, user_name, user_email, rating, title, comment, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(newId, product_id, user_name, user_email || '', Number(rating), title || '', comment || '', 'APPROVED');
    } catch (e) {}

    // Photos
    if (Array.isArray(photos)) {
      for (const p of photos) {
        await executeMySQL('INSERT INTO review_images (review_id, image_url) VALUES (?, ?)', [newId, p]);
        try {
          db.prepare('INSERT INTO review_images (review_id, image_url) VALUES (?, ?)').run(newId, p);
        } catch (e) {}
      }
    }

    res.json({ id: newId, message: 'Review submitted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Review Status
router.put('/api/admin/reviews/:id/status', requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { status, admin_reply } = req.body;
    await executeMySQL('UPDATE product_reviews SET status = COALESCE(?, status), admin_reply = COALESCE(?, admin_reply) WHERE id = ?', [status, admin_reply, id]);
    try {
      db.prepare('UPDATE product_reviews SET status = COALESCE(?, status), admin_reply = COALESCE(?, admin_reply) WHERE id = ?').run(status, admin_reply, id);
    } catch (e) {}
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Review Reply
router.put('/api/admin/reviews/:id/reply', requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { admin_reply } = req.body;
    await executeMySQL('UPDATE product_reviews SET admin_reply = ? WHERE id = ?', [admin_reply, id]);
    try {
      db.prepare('UPDATE product_reviews SET admin_reply = ? WHERE id = ?').run(admin_reply, id);
    } catch (e) {}
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Review
router.delete('/api/admin/reviews/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    await executeMySQL('DELETE FROM review_images WHERE review_id = ?', [id]);
    await executeMySQL('DELETE FROM product_reviews WHERE id = ?', [id]);
    try {
      db.prepare('DELETE FROM review_images WHERE review_id = ?').run(id);
      db.prepare('DELETE FROM product_reviews WHERE id = ?').run(id);
    } catch (e) {}
    res.json({ success: true, message: 'Review deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Manual Back-office Review
router.post('/api/admin/reviews/manual', requireAdminAuth, async (req, res) => {
  try {
    const { product_id, user_name, user_email, rating, title, comment, photos = [] } = req.body;
    const myRes = await executeMySQL(
      'INSERT INTO product_reviews (product_id, user_name, user_email, rating, title, comment, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [product_id, user_name, user_email || '', Number(rating), title || '', comment || '', 'APPROVED']
    );
    const newId = myRes ? myRes.insertId : Date.now();
    res.json({ id: newId, success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
