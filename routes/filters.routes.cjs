const express = require('express');
const router = express.Router();
const { db, executeMySQL } = require('../config/database.cjs');
const { requireAdminAuth } = require('../middleware/auth.cjs');

// GET Filter Groups with nested options
router.get(['/api/filter-groups', '/api/admin/filter-groups'], async (req, res) => {
  try {
    let groups = await executeMySQL('SELECT * FROM product_filter_groups ORDER BY sort_order ASC, id ASC');
    if (!groups || groups.length === 0) {
      groups = db.prepare('SELECT * FROM product_filter_groups ORDER BY sort_order ASC, id ASC').all() || [];
    }

    let options = await executeMySQL('SELECT * FROM product_filter_options ORDER BY sort_order ASC, id ASC');
    if (!options || options.length === 0) {
      options = db.prepare('SELECT * FROM product_filter_options ORDER BY sort_order ASC, id ASC').all() || [];
    }

    const populated = groups.map(g => ({
      ...g,
      options: options.filter(opt => String(opt.group_id) === String(g.id))
    }));

    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Create Filter Group
router.post('/api/admin/filter-groups', requireAdminAuth, async (req, res) => {
  try {
    const { name, display_name, sort_order = 0 } = req.body;
    if (!name) return res.status(400).json({ error: 'Filter group name is required' });

    const myRes = await executeMySQL(
      'INSERT INTO product_filter_groups (name, display_name, sort_order) VALUES (?, ?, ?)',
      [name, display_name || name, Number(sort_order) || 0]
    );
    const newId = myRes ? myRes.insertId : Date.now();

    try {
      db.prepare('INSERT OR REPLACE INTO product_filter_groups (id, name, display_name, sort_order) VALUES (?, ?, ?, ?)')
        .run(newId, name, display_name || name, Number(sort_order) || 0);
    } catch (e) {}

    res.json({ id: newId, name, display_name: display_name || name, sort_order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Update Filter Group
router.put('/api/admin/filter-groups/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { name, display_name, sort_order } = req.body;
    await executeMySQL(
      'UPDATE product_filter_groups SET name = COALESCE(?, name), display_name = COALESCE(?, display_name), sort_order = COALESCE(?, sort_order) WHERE id = ?',
      [name, display_name, sort_order, id]
    );
    try {
      db.prepare('UPDATE product_filter_groups SET name = COALESCE(?, name), display_name = COALESCE(?, display_name), sort_order = COALESCE(?, sort_order) WHERE id = ?')
        .run(name, display_name, sort_order, id);
    } catch (e) {}
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Filter Group
router.delete('/api/admin/filter-groups/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    await executeMySQL('DELETE FROM product_filter_options WHERE group_id = ?', [id]);
    await executeMySQL('DELETE FROM product_filter_groups WHERE id = ?', [id]);
    try {
      db.prepare('DELETE FROM product_filter_options WHERE group_id = ?').run(id);
      db.prepare('DELETE FROM product_filter_groups WHERE id = ?').run(id);
    } catch (e) {}
    res.json({ success: true, message: 'Filter group deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Create Filter Option
router.post('/api/admin/filter-options', requireAdminAuth, async (req, res) => {
  try {
    const { group_id, label, value, sort_order = 0 } = req.body;
    if (!group_id || !label) return res.status(400).json({ error: 'group_id and label are required' });

    const val = value || label.toLowerCase().replace(/\s+/g, '-');
    const myRes = await executeMySQL(
      'INSERT INTO product_filter_options (group_id, label, value, sort_order) VALUES (?, ?, ?, ?)',
      [group_id, label, val, Number(sort_order) || 0]
    );
    const newId = myRes ? myRes.insertId : Date.now();

    try {
      db.prepare('INSERT OR REPLACE INTO product_filter_options (id, group_id, label, value, sort_order) VALUES (?, ?, ?, ?, ?)')
        .run(newId, group_id, label, val, Number(sort_order) || 0);
    } catch (e) {}

    res.json({ id: newId, group_id, label, value: val, sort_order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Filter Option
router.delete('/api/admin/filter-options/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    await executeMySQL('DELETE FROM product_filter_options WHERE id = ?', [id]);
    try {
      db.prepare('DELETE FROM product_filter_options WHERE id = ?').run(id);
    } catch (e) {}
    res.json({ success: true, message: 'Filter option deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
