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

// GET All Collections
router.get('/api/collections', async (req, res) => {
  try {
    let collections = await executeMySQL('SELECT * FROM collections ORDER BY id ASC');
    if (!collections || collections.length === 0) {
      collections = db.prepare('SELECT * FROM collections ORDER BY id ASC').all() || [];
    }

    const prodColls = await executeMySQL('SELECT collection_id, product_id FROM product_collections') || [];
    const populated = collections.map(col => {
      const pids = prodColls
        .filter(pc => String(pc.collection_id) === String(col.id))
        .map(pc => pc.product_id);
      return {
        ...col,
        product_ids: pids,
        product_count: pids.length
      };
    });

    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Create Collection
router.post('/api/collections', requireAdminAuth, async (req, res) => {
  try {
    const { name, description, image_url, show_in_navbar = 0, sort_order = 0, product_ids = [] } = req.body;
    if (!name) return res.status(400).json({ error: 'Collection name is required' });

    let slug = req.body.slug ? generateSlug(req.body.slug) : generateSlug(name);
    const myRes = await executeMySQL(
      'INSERT INTO collections (name, slug, description, image_url, show_in_navbar, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [name, slug, description || '', image_url || null, show_in_navbar ? 1 : 0, Number(sort_order) || 0]
    );
    const newId = myRes ? myRes.insertId : Date.now();

    try {
      db.prepare('INSERT OR REPLACE INTO collections (id, name, slug, description, image_url, show_in_navbar, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(newId, name, slug, description || '', image_url || null, show_in_navbar ? 1 : 0, Number(sort_order) || 0);
    } catch (e) {}

    // Attach products
    if (Array.isArray(product_ids)) {
      for (const pid of product_ids) {
        await executeMySQL('INSERT INTO product_collections (product_id, collection_id) VALUES (?, ?)', [pid, newId]);
        try {
          db.prepare('INSERT INTO product_collections (product_id, collection_id) VALUES (?, ?)').run(pid, newId);
        } catch (e) {}
      }
    }

    res.json({ id: newId, name, slug, show_in_navbar, sort_order, product_ids });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Update Collection
router.put('/api/collections/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { name, description, image_url, show_in_navbar, sort_order, product_ids } = req.body;
    const slug = name ? generateSlug(name) : undefined;

    await executeMySQL(
      'UPDATE collections SET name = COALESCE(?, name), slug = COALESCE(?, slug), description = COALESCE(?, description), image_url = COALESCE(?, image_url), show_in_navbar = COALESCE(?, show_in_navbar), sort_order = COALESCE(?, sort_order) WHERE id = ?',
      [name, slug, description, image_url, show_in_navbar !== undefined ? (show_in_navbar ? 1 : 0) : null, sort_order, id]
    );

    try {
      db.prepare('UPDATE collections SET name = COALESCE(?, name), slug = COALESCE(?, slug), description = COALESCE(?, description), image_url = COALESCE(?, image_url), show_in_navbar = COALESCE(?, show_in_navbar), sort_order = COALESCE(?, sort_order) WHERE id = ?')
        .run(name, slug, description, image_url, show_in_navbar !== undefined ? (show_in_navbar ? 1 : 0) : null, sort_order, id);
    } catch (e) {}

    if (Array.isArray(product_ids)) {
      await executeMySQL('DELETE FROM product_collections WHERE collection_id = ?', [id]);
      try {
        db.prepare('DELETE FROM product_collections WHERE collection_id = ?').run(id);
      } catch (e) {}

      for (const pid of product_ids) {
        await executeMySQL('INSERT INTO product_collections (product_id, collection_id) VALUES (?, ?)', [pid, id]);
        try {
          db.prepare('INSERT INTO product_collections (product_id, collection_id) VALUES (?, ?)').run(pid, id);
        } catch (e) {}
      }
    }

    res.json({ success: true, id, message: 'Collection updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Toggle Navbar Visibility
router.put(['/api/collections/:id/navbar-toggle', '/api/admin/collections/:id/navbar-toggle'], requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { show_in_navbar } = req.body;
    const val = show_in_navbar ? 1 : 0;
    await executeMySQL('UPDATE collections SET show_in_navbar = ? WHERE id = ?', [val, id]);
    try {
      db.prepare('UPDATE collections SET show_in_navbar = ? WHERE id = ?').run(val, id);
    } catch (e) {}
    res.json({ success: true, id, show_in_navbar: val });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Collection
router.delete('/api/collections/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    await executeMySQL('DELETE FROM product_collections WHERE collection_id = ?', [id]);
    await executeMySQL('DELETE FROM collections WHERE id = ?', [id]);
    try {
      db.prepare('DELETE FROM product_collections WHERE collection_id = ?').run(id);
      db.prepare('DELETE FROM collections WHERE id = ?').run(id);
    } catch (e) {}
    res.json({ success: true, message: 'Collection deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
