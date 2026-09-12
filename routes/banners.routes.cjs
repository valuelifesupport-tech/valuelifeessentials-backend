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

// PUT Update Banner
router.put(['/api/banners/:id', '/api/admin/banners/:id'], requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { title, subtitle, image_url, link_url, button_text, background_color, sort_order } = req.body;
    await executeMySQL(
      'UPDATE banners SET title = ?, subtitle = ?, image_url = ?, link_url = ?, button_text = ?, background_color = ?, sort_order = ? WHERE id = ?',
      [title || '', subtitle || '', image_url, link_url || '', button_text || '', background_color || '#164e3f', Number(sort_order) || 0, id]
    );
    try {
      db.prepare('UPDATE banners SET title = ?, subtitle = ?, image_url = ?, link_url = ?, button_text = ?, background_color = ?, sort_order = ? WHERE id = ?')
        .run(title || '', subtitle || '', image_url, link_url || '', button_text || '', background_color || '#164e3f', Number(sort_order) || 0, id);
    } catch (e) {}
    res.json({ success: true, message: 'Banner updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Banner
router.delete(['/api/banners/:id', '/api/admin/banners/:id'], requireAdminAuth, async (req, res) => {
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

// ==========================================
// HERO ROTATING SLIDES CRUD ENDPOINTS
// ==========================================

// GET All Hero Slides
router.get(['/api/hero-slides', '/api/admin/hero-slides'], async (req, res) => {
  try {
    let rows = await executeMySQL('SELECT * FROM hero_slides ORDER BY sort_order ASC, id ASC');
    if (!rows || rows.length === 0) {
      try {
        rows = db.prepare('SELECT * FROM hero_slides ORDER BY sort_order ASC, id ASC').all() || [];
      } catch (e) {}
    }
    res.json(rows || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Create Hero Slide
router.post(['/api/hero-slides', '/api/admin/hero-slides'], requireAdminAuth, async (req, res) => {
  try {
    const {
      title_part1,
      title_part2,
      tagline,
      description,
      cta_text,
      cta_link,
      packaging_img,
      jars_img,
      script_quote,
      sort_order = 0,
      is_active = 1
    } = req.body;

    const myRes = await executeMySQL(
      `INSERT INTO hero_slides (title_part1, title_part2, tagline, description, cta_text, cta_link, packaging_img, jars_img, script_quote, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title_part1 || '',
        title_part2 || '',
        tagline || '',
        description || '',
        cta_text || 'Shop Now',
        cta_link || '/products',
        packaging_img || '',
        jars_img || '',
        script_quote || '',
        Number(sort_order) || 0,
        Number(is_active) ?? 1
      ]
    );

    const newId = myRes ? myRes.insertId : Date.now();
    try {
      db.prepare(`
        INSERT OR REPLACE INTO hero_slides (id, title_part1, title_part2, tagline, description, cta_text, cta_link, packaging_img, jars_img, script_quote, sort_order, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newId,
        title_part1 || '',
        title_part2 || '',
        tagline || '',
        description || '',
        cta_text || 'Shop Now',
        cta_link || '/products',
        packaging_img || '',
        jars_img || '',
        script_quote || '',
        Number(sort_order) || 0,
        Number(is_active) ?? 1
      );
    } catch (e) {}

    res.json({
      success: true,
      id: newId,
      title_part1,
      title_part2,
      tagline,
      description,
      cta_text,
      cta_link,
      packaging_img,
      jars_img,
      script_quote,
      sort_order,
      is_active
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Update Hero Slide
router.put(['/api/hero-slides/:id', '/api/admin/hero-slides/:id'], requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const {
      title_part1,
      title_part2,
      tagline,
      description,
      cta_text,
      cta_link,
      packaging_img,
      jars_img,
      script_quote,
      sort_order = 0,
      is_active = 1
    } = req.body;

    await executeMySQL(
      `UPDATE hero_slides 
       SET title_part1 = ?, title_part2 = ?, tagline = ?, description = ?, cta_text = ?, cta_link = ?, packaging_img = ?, jars_img = ?, script_quote = ?, sort_order = ?, is_active = ?
       WHERE id = ?`,
      [
        title_part1 || '',
        title_part2 || '',
        tagline || '',
        description || '',
        cta_text || 'Shop Now',
        cta_link || '/products',
        packaging_img || '',
        jars_img || '',
        script_quote || '',
        Number(sort_order) || 0,
        Number(is_active) ?? 1,
        id
      ]
    );

    try {
      db.prepare(`
        UPDATE hero_slides 
        SET title_part1 = ?, title_part2 = ?, tagline = ?, description = ?, cta_text = ?, cta_link = ?, packaging_img = ?, jars_img = ?, script_quote = ?, sort_order = ?, is_active = ?
        WHERE id = ?
      `).run(
        title_part1 || '',
        title_part2 || '',
        tagline || '',
        description || '',
        cta_text || 'Shop Now',
        cta_link || '/products',
        packaging_img || '',
        jars_img || '',
        script_quote || '',
        Number(sort_order) || 0,
        Number(is_active) ?? 1,
        id
      );
    } catch (e) {}

    res.json({ success: true, message: 'Hero slide updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Hero Slide
router.delete(['/api/hero-slides/:id', '/api/admin/hero-slides/:id'], requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    await executeMySQL('DELETE FROM hero_slides WHERE id = ?', [id]);
    try {
      db.prepare('DELETE FROM hero_slides WHERE id = ?').run(id);
    } catch (e) {}
    res.json({ success: true, message: 'Hero slide deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// INSTAGRAM POSTS CRUD ENDPOINTS
// ==========================================

// GET All Instagram Posts
router.get(['/api/instagram-posts', '/api/admin/instagram-posts'], async (req, res) => {
  try {
    let rows = await executeMySQL('SELECT * FROM instagram_posts ORDER BY sort_order ASC, id ASC');
    if (!rows || rows.length === 0) {
      try {
        rows = db.prepare('SELECT * FROM instagram_posts ORDER BY sort_order ASC, id ASC').all() || [];
      } catch (e) {}
    }
    res.json(rows || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Create Instagram Post
router.post(['/api/instagram-posts', '/api/admin/instagram-posts'], requireAdminAuth, async (req, res) => {
  try {
    const { title, image_url, post_url, sort_order = 0, is_active = 1 } = req.body;
    if (!image_url) return res.status(400).json({ error: 'Post image_url is required' });

    const myRes = await executeMySQL(
      'INSERT INTO instagram_posts (title, image_url, post_url, sort_order, is_active) VALUES (?, ?, ?, ?, ?)',
      [
        title || '',
        image_url,
        post_url || 'https://www.instagram.com/valuelife_essentials/?hl=en',
        Number(sort_order) || 0,
        Number(is_active) ?? 1
      ]
    );

    const newId = myRes ? myRes.insertId : Date.now();
    try {
      db.prepare('INSERT OR REPLACE INTO instagram_posts (id, title, image_url, post_url, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?)')
        .run(
          newId,
          title || '',
          image_url,
          post_url || 'https://www.instagram.com/valuelife_essentials/?hl=en',
          Number(sort_order) || 0,
          Number(is_active) ?? 1
        );
    } catch (e) {}

    res.json({
      success: true,
      id: newId,
      title,
      image_url,
      post_url: post_url || 'https://www.instagram.com/valuelife_essentials/?hl=en',
      sort_order,
      is_active
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Update Instagram Post
router.put(['/api/instagram-posts/:id', '/api/admin/instagram-posts/:id'], requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { title, image_url, post_url, sort_order = 0, is_active = 1 } = req.body;

    await executeMySQL(
      'UPDATE instagram_posts SET title = ?, image_url = ?, post_url = ?, sort_order = ?, is_active = ? WHERE id = ?',
      [
        title || '',
        image_url,
        post_url || 'https://www.instagram.com/valuelife_essentials/?hl=en',
        Number(sort_order) || 0,
        Number(is_active) ?? 1,
        id
      ]
    );

    try {
      db.prepare('UPDATE instagram_posts SET title = ?, image_url = ?, post_url = ?, sort_order = ?, is_active = ? WHERE id = ?')
        .run(
          title || '',
          image_url,
          post_url || 'https://www.instagram.com/valuelife_essentials/?hl=en',
          Number(sort_order) || 0,
          Number(is_active) ?? 1,
          id
        );
    } catch (e) {}

    res.json({ success: true, message: 'Instagram post updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Instagram Post
router.delete(['/api/instagram-posts/:id', '/api/admin/instagram-posts/:id'], requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    await executeMySQL('DELETE FROM instagram_posts WHERE id = ?', [id]);
    try {
      db.prepare('DELETE FROM instagram_posts WHERE id = ?').run(id);
    } catch (e) {}
    res.json({ success: true, message: 'Instagram post deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
