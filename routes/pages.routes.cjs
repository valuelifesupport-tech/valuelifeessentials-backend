const express = require('express');
const router = express.Router();
const { db, executeMySQL } = require('../config/database.cjs');
const { requireAdminAuth } = require('../middleware/auth.cjs');

// GET All Published Pages
router.get('/api/pages', async (req, res) => {
  try {
    let rows = await executeMySQL('SELECT * FROM custom_pages WHERE is_published = 1 ORDER BY title ASC');
    if (!rows || rows.length === 0) {
      rows = db.prepare('SELECT * FROM custom_pages WHERE is_published = 1 ORDER BY title ASC').all() || [];
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Page by Slug
router.get('/api/pages/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    let page = await executeMySQL('SELECT * FROM custom_pages WHERE slug = ?', [slug]);
    if (page && page.length > 0) return res.json(page[0]);

    const row = db.prepare('SELECT * FROM custom_pages WHERE slug = ?').get(slug);
    if (row) return res.json(row);

    // Fallback template content for core pages
    const fallbacks = {
      'about-us': {
        title: 'About ValueLife Essentials',
        content: '<p>Welcome to ValueLife Essentials. We are passionate about providing 100% pure, natural, and certified organic health and wellness essentials.</p>'
      },
      'contact-us': {
        title: 'Contact Us',
        content: '<p>Have questions? Reach our team at support@valuelifeessentials.com or call +91 98765 43210.</p>'
      },
      'privacy-policy': {
        title: 'Privacy Policy',
        content: '<p>Your privacy is important to us. We protect your personal data with 256-bit encryption.</p>'
      },
      'terms-of-service': {
        title: 'Terms of Service',
        content: '<p>By accessing ValueLife Essentials, you agree to our standard terms of service.</p>'
      },
      'shipping-policy': {
        title: 'Shipping Policy',
        content: '<p>Free express delivery across India on orders above ₹499. Orders dispatch within 24-48 hours.</p>'
      },
      'refund-policy': {
        title: 'Refund & Return Policy',
        content: '<p>We offer hassle-free returns within 7 days of receiving your order.</p>'
      },
      'blog': {
        title: 'ValueLife Wellness & Organic Journal',
        content: '<p>Explore science-backed nutritional insights, ancient Ayurvedic remedies, and guides to 100% chemical-free organic living curated by our certified herbalists.</p>'
      }
    };

    if (fallbacks[slug]) {
      return res.json({
        id: 0,
        slug,
        title: fallbacks[slug].title,
        content: fallbacks[slug].content,
        is_published: 1
      });
    }

    res.status(404).json({ error: 'Page not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Create Custom Page
router.post('/api/admin/pages', requireAdminAuth, async (req, res) => {
  try {
    const { title, slug, content, is_published = 1, meta_title, meta_description } = req.body;
    if (!title || !slug) return res.status(400).json({ error: 'Title and slug are required' });

    const myRes = await executeMySQL(
      'INSERT INTO custom_pages (title, slug, content, is_published, meta_title, meta_description) VALUES (?, ?, ?, ?, ?, ?)',
      [title, slug, content || '', is_published ? 1 : 0, meta_title || '', meta_description || '']
    );
    const newId = myRes ? myRes.insertId : Date.now();

    try {
      db.prepare('INSERT OR REPLACE INTO custom_pages (id, title, slug, content, is_published, meta_title, meta_description) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(newId, title, slug, content || '', is_published ? 1 : 0, meta_title || '', meta_description || '');
    } catch (e) {}

    res.json({ id: newId, title, slug, is_published });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Update Custom Page
router.put('/api/admin/pages/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { title, slug, content, is_published, meta_title, meta_description } = req.body;

    await executeMySQL(
      'UPDATE custom_pages SET title = COALESCE(?, title), slug = COALESCE(?, slug), content = COALESCE(?, content), is_published = COALESCE(?, is_published), meta_title = COALESCE(?, meta_title), meta_description = COALESCE(?, meta_description) WHERE id = ?',
      [title, slug, content, is_published !== undefined ? (is_published ? 1 : 0) : null, meta_title, meta_description, id]
    );

    try {
      db.prepare('UPDATE custom_pages SET title = COALESCE(?, title), slug = COALESCE(?, slug), content = COALESCE(?, content), is_published = COALESCE(?, is_published), meta_title = COALESCE(?, meta_title), meta_description = COALESCE(?, meta_description) WHERE id = ?')
        .run(title, slug, content, is_published !== undefined ? (is_published ? 1 : 0) : null, meta_title, meta_description, id);
    } catch (e) {}

    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Custom Page
router.delete('/api/admin/pages/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    await executeMySQL('DELETE FROM custom_pages WHERE id = ?', [id]);
    try {
      db.prepare('DELETE FROM custom_pages WHERE id = ?').run(id);
    } catch (e) {}
    res.json({ success: true, message: 'Page deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
