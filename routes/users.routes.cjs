const express = require('express');
const router = express.Router();
const { db, executeMySQL } = require('../config/database.cjs');
const { requireAdminAuth } = require('../middleware/auth.cjs');

// GET Admin Users List
router.get('/api/admin/users', requireAdminAuth, async (req, res) => {
  try {
    let users = await executeMySQL('SELECT id, name, email, phone, role, is_verified, created_at FROM users ORDER BY id DESC');
    if (!users || users.length === 0) {
      users = db.prepare('SELECT id, name, email, phone, role, is_verified, created_at FROM users ORDER BY id DESC').all() || [];
    }

    // Join with order counts
    const orders = await executeMySQL('SELECT customer_email, total_amount FROM orders') || [];
    const enriched = users.map(u => {
      const userOrders = orders.filter(o => o.customer_email && o.customer_email.toLowerCase() === (u.email || '').toLowerCase());
      return {
        ...u,
        total_orders: userOrders.length,
        total_spent: userOrders.reduce((acc, o) => acc + Number(o.total_amount || 0), 0)
      };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Change User Role
router.put('/api/admin/users/:id/role', requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { role } = req.body;
    if (!['ADMIN', 'CUSTOMER'].includes(role)) {
      return res.status(400).json({ error: 'Role must be ADMIN or CUSTOMER' });
    }
    await executeMySQL('UPDATE users SET role = ? WHERE id = ?', [role, id]);
    try {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
    } catch (e) {}
    res.json({ success: true, id, role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET User Dossier / Purchase History
router.get('/api/admin/users/:id/details', requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    let user = await executeMySQL('SELECT id, name, email, phone, role, is_verified, address, created_at FROM users WHERE id = ?', [id]);
    if (!user || user.length === 0) {
      user = [db.prepare('SELECT id, name, email, phone, role, is_verified, address, created_at FROM users WHERE id = ?').get(id)];
    }
    if (!user || !user[0]) return res.status(404).json({ error: 'User not found' });

    const u = user[0];
    const userOrders = await executeMySQL('SELECT * FROM orders WHERE customer_email = ? ORDER BY id DESC', [u.email]) || [];

    res.json({
      user: u,
      orders: userOrders
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
