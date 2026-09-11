const express = require('express');
const router = express.Router();
const { db, executeMySQL } = require('../config/database.cjs');
const { requireAdminAuth } = require('../middleware/auth.cjs');

function generateSlug(text) {
  return text.toString().toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

// GET All Categories with Subcategories
router.get(['/api/categories', '/api/categories/tree'], async (req, res) => {
  try {
    // 1. MySQL Priority
    const myCats = await executeMySQL('SELECT * FROM categories ORDER BY id ASC');
    if (myCats && myCats.length > 0) {
      const mySubs = await executeMySQL('SELECT * FROM subcategories ORDER BY id ASC') || [];
      const catsWithSubs = myCats.map(cat => ({
        ...cat,
        subcategories: mySubs.filter(sub => String(sub.category_id) === String(cat.id))
      }));
      return res.json(catsWithSubs);
    }

    // 2. SQLite Fallback
    const rows = db.prepare('SELECT * FROM categories ORDER BY id ASC').all() || [];
    const subs = db.prepare('SELECT * FROM subcategories ORDER BY id ASC').all() || [];
    const tree = rows.map(c => ({
      ...c,
      subcategories: subs.filter(s => String(s.category_id) === String(c.id))
    }));
    res.json(tree);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Create Category
router.post('/api/categories', requireAdminAuth, async (req, res) => {
  try {
    const { name, icon, image_url, description, sort_order = 0 } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required' });

    let slug = req.body.slug ? generateSlug(req.body.slug) : generateSlug(name);
    let finalSlug = slug;
    let counter = 1;

    // Ensure unique slug
    while (true) {
      const existing = await executeMySQL('SELECT id FROM categories WHERE slug = ?', [finalSlug]);
      if (!existing || existing.length === 0) break;
      finalSlug = `${slug}-${counter++}`;
    }

    // Insert into MySQL
    const myRes = await executeMySQL(
      'INSERT INTO categories (name, slug, icon, image_url, description, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [name, finalSlug, icon || '🌿', image_url || null, description || '', Number(sort_order) || 0]
    );
    const newId = myRes ? myRes.insertId : Date.now();

    // Insert into SQLite
    try {
      db.prepare('INSERT OR REPLACE INTO categories (id, name, slug, icon, image_url, description, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(newId, name, finalSlug, icon || '🌿', image_url || null, description || '', Number(sort_order) || 0);
    } catch (e) {}

    res.json({ id: newId, name, slug: finalSlug, icon: icon || '🌿', image_url, description, sort_order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Update Category
router.put('/api/categories/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { name, icon, image_url, description, sort_order = 0 } = req.body;
    let slug = req.body.slug ? generateSlug(req.body.slug) : (name ? generateSlug(name) : undefined);

    await executeMySQL(
      'UPDATE categories SET name = COALESCE(?, name), slug = COALESCE(?, slug), icon = COALESCE(?, icon), image_url = COALESCE(?, image_url), description = COALESCE(?, description), sort_order = COALESCE(?, sort_order) WHERE id = ?',
      [name, slug, icon, image_url, description, sort_order, id]
    );

    try {
      db.prepare('UPDATE categories SET name = COALESCE(?, name), slug = COALESCE(?, slug), icon = COALESCE(?, icon), image_url = COALESCE(?, image_url), description = COALESCE(?, description), sort_order = COALESCE(?, sort_order) WHERE id = ?')
        .run(name, slug, icon, image_url, description, sort_order, id);
    } catch (e) {}

    res.json({ success: true, id, message: 'Category updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Category
router.delete('/api/categories/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    await executeMySQL('DELETE FROM subcategories WHERE category_id = ?', [id]);
    await executeMySQL('DELETE FROM categories WHERE id = ?', [id]);

    try {
      db.prepare('DELETE FROM subcategories WHERE category_id = ?').run(id);
      db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    } catch (e) {}

    res.json({ success: true, message: 'Category and its subcategories deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Create Subcategory
router.post('/api/subcategories', async (req, res) => {
  try {
    const { category_id, name, sort_order = 0 } = req.body;
    if (!category_id || !name) return res.status(400).json({ error: 'category_id and name are required' });

    const slug = generateSlug(name);
    const myRes = await executeMySQL(
      'INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES (?, ?, ?, ?)',
      [category_id, name, slug, Number(sort_order) || 0]
    );
    const newId = myRes ? myRes.insertId : Date.now();

    try {
      db.prepare('INSERT OR REPLACE INTO subcategories (id, category_id, name, slug, sort_order) VALUES (?, ?, ?, ?, ?)')
        .run(newId, category_id, name, slug, Number(sort_order) || 0);
    } catch (e) {}

    res.json({ id: newId, category_id, name, slug, sort_order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Update Subcategory
router.put('/api/subcategories/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { name, sort_order = 0 } = req.body;
    const slug = name ? generateSlug(name) : undefined;

    await executeMySQL(
      'UPDATE subcategories SET name = COALESCE(?, name), slug = COALESCE(?, slug), sort_order = COALESCE(?, sort_order) WHERE id = ?',
      [name, slug, sort_order, id]
    );

    try {
      db.prepare('UPDATE subcategories SET name = COALESCE(?, name), slug = COALESCE(?, slug), sort_order = COALESCE(?, sort_order) WHERE id = ?')
        .run(name, slug, sort_order, id);
    } catch (e) {}

    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Subcategory
router.delete('/api/subcategories/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await executeMySQL('DELETE FROM subcategories WHERE id = ?', [id]);
    try {
      db.prepare('DELETE FROM subcategories WHERE id = ?').run(id);
    } catch (e) {}
    res.json({ success: true, message: 'Subcategory deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
