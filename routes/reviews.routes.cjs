const express = require('express');
const router = express.Router();
const { db, executeMySQL } = require('../config/database.cjs');
const { requireAdminAuth } = require('../middleware/auth.cjs');

// GET Admin Reviews (With Product details and images)
router.get('/api/admin/reviews', requireAdminAuth, async (req, res) => {
  try {
    let reviews = [];
    try {
      reviews = await executeMySQL(`
        SELECT r.*, p.title as product_title, p.sku as product_sku, p.image_url as product_thumbnail 
        FROM product_reviews r 
        LEFT JOIN products p ON r.product_id = p.id 
        ORDER BY r.created_at DESC
      `);
    } catch (e) {}

    if (!reviews || reviews.length === 0) {
      try {
        reviews = db.prepare(`
          SELECT r.*, p.title as product_title, p.sku as product_sku, p.image_url as product_thumbnail 
          FROM product_reviews r 
          LEFT JOIN products p ON r.product_id = p.id 
          ORDER BY r.created_at DESC
        `).all() || [];
      } catch (e) {
        try {
          reviews = db.prepare('SELECT * FROM product_reviews ORDER BY created_at DESC').all() || [];
        } catch (e2) {}
      }
    }

    let revImages = [];
    try {
      revImages = await executeMySQL('SELECT * FROM review_images') || [];
    } catch (e) {}
    if (!revImages || revImages.length === 0) {
      try {
        revImages = db.prepare('SELECT * FROM review_images').all() || [];
      } catch (e) {}
    }

    const populated = (reviews || []).map(r => {
      const imagesList = (revImages || [])
        .filter(img => String(img.review_id) === String(r.id))
        .map(img => img.image_url);

      let prodThumbnail = r.product_thumbnail || '';
      if (!prodThumbnail && r.product_images) {
        try {
          const parsed = typeof r.product_images === 'string' ? JSON.parse(r.product_images) : r.product_images;
          if (Array.isArray(parsed) && parsed.length > 0) prodThumbnail = parsed[0];
          else if (typeof parsed === 'string') prodThumbnail = parsed;
        } catch (e) {
          prodThumbnail = String(r.product_images).split(',')[0].trim();
        }
      }

      return {
        ...r,
        user_name: r.user_name || r.customer_name || 'Verified Buyer',
        customer_name: r.customer_name || r.user_name || 'Verified Buyer',
        user_email: r.user_email || r.customer_email || '',
        customer_email: r.customer_email || r.user_email || '',
        title: r.title || r.review_title || '',
        review_title: r.review_title || r.title || '',
        comment: r.comment || r.review_text || '',
        review_text: r.review_text || r.comment || '',
        status: r.status || 'PENDING',
        photos: imagesList,
        images: imagesList,
        product_title: r.product_title || `Product #${r.product_id}`,
        product_thumbnail: prodThumbnail || 'https://images.unsplash.com/photo-1592417817098-8f3d6eb1b7a5?w=100'
      };
    });

    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Public Approved Reviews (for storefront testimonials — NO AUTH needed)
router.get('/api/reviews', async (req, res) => {
  try {
    let reviews = [];
    try {
      reviews = await executeMySQL(`
        SELECT r.id, r.product_id, r.user_name, r.customer_name, r.rating, r.title, r.review_title, 
               r.comment, r.review_text, r.status, r.created_at, r.admin_reply,
               p.title as product_title, p.image_url as product_thumbnail
        FROM product_reviews r 
        LEFT JOIN products p ON r.product_id = p.id 
        WHERE r.status = 'APPROVED'
        ORDER BY r.created_at DESC
        LIMIT 20
      `);
    } catch (e) {}

    if (!reviews || reviews.length === 0) {
      try {
        reviews = db.prepare(`
          SELECT r.id, r.product_id, r.user_name, r.customer_name, r.rating, r.title, r.review_title,
                 r.comment, r.review_text, r.status, r.created_at, r.admin_reply,
                 p.title as product_title, p.image_url as product_thumbnail
          FROM product_reviews r 
          LEFT JOIN products p ON r.product_id = p.id 
          WHERE r.status = 'APPROVED'
          ORDER BY r.created_at DESC
          LIMIT 20
        `).all() || [];
      } catch (e) {
        try {
          reviews = db.prepare("SELECT * FROM product_reviews WHERE status = 'APPROVED' ORDER BY created_at DESC LIMIT 20").all() || [];
        } catch (e2) {}
      }
    }

    const populated = (reviews || []).map(r => ({
      id: r.id,
      product_id: r.product_id,
      user_name: r.user_name || r.customer_name || 'Verified Buyer',
      customer_name: r.customer_name || r.user_name || 'Verified Buyer',
      rating: r.rating,
      title: r.title || r.review_title || '',
      comment: r.comment || r.review_text || '',
      status: r.status,
      created_at: r.created_at,
      admin_reply: r.admin_reply || '',
      product_title: r.product_title || '',
      product_thumbnail: r.product_thumbnail || ''
    }));

    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Customer Review (Submits request for admin moderation)
router.post('/api/reviews', async (req, res) => {
  try {
    const { product_id, user_name, user_email, rating, title, comment, photos = [], images = [] } = req.body;
    const authorName = user_name || req.body.customer_name || req.body.name;
    const authorEmail = user_email || req.body.customer_email || req.body.email || '';
    const reviewTitle = title || req.body.review_title || '';
    const reviewBody = comment || req.body.review_text || req.body.message || '';
    const reviewRating = Number(rating) || 5;
    const combinedPhotos = Array.isArray(photos) && photos.length > 0 ? photos : (Array.isArray(images) ? images : []);

    if (!product_id || !authorName || !reviewRating) {
      return res.status(400).json({ error: 'product_id, user_name, and rating are required' });
    }

    let myRes;
    try {
      myRes = await executeMySQL(
        'INSERT INTO product_reviews (product_id, user_name, customer_name, user_email, customer_email, rating, title, review_title, comment, review_text, status, is_verified_buyer) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [product_id, authorName, authorName, authorEmail, authorEmail, reviewRating, reviewTitle, reviewTitle, reviewBody, reviewBody, 'PENDING', 1]
      );
    } catch (e) {
      try {
        myRes = await executeMySQL(
          'INSERT INTO product_reviews (product_id, customer_name, customer_email, rating, review_title, review_text, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [product_id, authorName, authorEmail, reviewRating, reviewTitle, reviewBody, 'PENDING']
        );
      } catch (e2) {
        myRes = await executeMySQL(
          'INSERT INTO product_reviews (product_id, user_name, user_email, rating, title, comment, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [product_id, authorName, authorEmail, reviewRating, reviewTitle, reviewBody, 'PENDING']
        );
      }
    }
    const newId = myRes ? myRes.insertId : Date.now();

    try {
      db.prepare(`
        INSERT OR REPLACE INTO product_reviews 
        (id, product_id, user_name, customer_name, user_email, customer_email, rating, title, review_title, comment, review_text, status, is_verified_buyer) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(newId, product_id, authorName, authorName, authorEmail, authorEmail, reviewRating, reviewTitle, reviewTitle, reviewBody, reviewBody, 'PENDING', 1);
    } catch (e) {
      try {
        db.prepare('INSERT OR REPLACE INTO product_reviews (id, product_id, user_name, user_email, rating, title, comment, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(newId, product_id, authorName, authorEmail, reviewRating, reviewTitle, reviewBody, 'PENDING');
      } catch (e2) {}
    }

    // Attach Photos
    if (Array.isArray(combinedPhotos)) {
      for (const p of combinedPhotos) {
        if (!p) continue;
        try { await executeMySQL('INSERT INTO review_images (review_id, image_url) VALUES (?, ?)', [newId, p]); } catch (e) {}
        try { db.prepare('INSERT INTO review_images (review_id, image_url) VALUES (?, ?)').run(newId, p); } catch (e) {}
      }
    }

    res.json({ 
      id: newId, 
      status: 'PENDING', 
      message: 'Review request submitted successfully! It will appear once approved by admin moderation.' 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Review Status
router.put('/api/admin/reviews/:id/status', requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { status, admin_reply } = req.body;
    try {
      await executeMySQL('UPDATE product_reviews SET status = COALESCE(?, status), admin_reply = COALESCE(?, admin_reply) WHERE id = ?', [status, admin_reply, id]);
    } catch (e) {
      await executeMySQL('UPDATE product_reviews SET status = COALESCE(?, status) WHERE id = ?', [status, id]);
    }
    try {
      db.prepare('UPDATE product_reviews SET status = COALESCE(?, status), admin_reply = COALESCE(?, admin_reply) WHERE id = ?').run(status, admin_reply, id);
    } catch (e) {
      try { db.prepare('UPDATE product_reviews SET status = COALESCE(?, status) WHERE id = ?').run(status, id); } catch(e2) {}
    }
    res.json({ success: true, id, status });
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

    // SQLite dual-write for manual review
    try {
      db.prepare(
        'INSERT OR REPLACE INTO product_reviews (id, product_id, user_name, customer_name, user_email, customer_email, rating, title, review_title, comment, review_text, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(newId, product_id, user_name, user_name, user_email || '', user_email || '', Number(rating), title || '', title || '', comment || '', comment || '', 'APPROVED');
    } catch (e) {
      try {
        db.prepare('INSERT OR REPLACE INTO product_reviews (id, product_id, user_name, user_email, rating, title, comment, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
          newId, product_id, user_name, user_email || '', Number(rating), title || '', comment || '', 'APPROVED'
        );
      } catch (e2) {}
    }

    res.json({ id: newId, success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
