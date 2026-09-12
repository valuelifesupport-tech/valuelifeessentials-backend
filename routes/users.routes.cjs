const express = require('express');
const router = express.Router();
const { db, executeMySQL } = require('../config/database.cjs');
const { requireAdminAuth } = require('../middleware/auth.cjs');

// GET Admin Users List
router.get('/api/admin/users', requireAdminAuth, async (req, res) => {
  try {
    let users = await executeMySQL('SELECT id, name, email, phone, address, role, is_verified, created_at FROM users ORDER BY id DESC');
    if (!users || users.length === 0) {
      users = db.prepare('SELECT id, name, email, phone, address, role, is_verified, created_at FROM users ORDER BY id DESC').all() || [];
    }

    // Join with order counts and spent totals
    const orders = await executeMySQL('SELECT id, user_id, customer_email, customer_phone, total_amount FROM orders') || [];
    
    const enriched = users.map(u => {
      const uEmail = (u.email || '').trim().toLowerCase();
      const uPhoneDigits = (u.phone || '').replace(/\D/g, '').slice(-10);
      const uId = u.id;

      const userOrders = orders.filter(o => {
        if (uId && o.user_id && Number(o.user_id) === Number(uId)) return true;
        if (uEmail && o.customer_email && o.customer_email.trim().toLowerCase() === uEmail) return true;
        if (uPhoneDigits && o.customer_phone && o.customer_phone.replace(/\D/g, '').slice(-10) === uPhoneDigits) return true;
        return false;
      });

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
    const uEmail = (u.email || '').trim().toLowerCase();
    const uPhoneDigits = (u.phone || '').replace(/\D/g, '').slice(-10);

    let userOrders = await executeMySQL(
      `SELECT * FROM orders 
       WHERE (user_id = ?)
          OR (? != '' AND LOWER(customer_email) = ?)
          OR (? != '' AND customer_phone LIKE ?)
       ORDER BY id DESC`,
      [id, uEmail, uEmail, uPhoneDigits, `%${uPhoneDigits}%`]
    ) || [];

    if (!userOrders || userOrders.length === 0) {
      try {
        userOrders = db.prepare(
          `SELECT * FROM orders 
           WHERE (user_id = ?)
              OR (? != '' AND LOWER(customer_email) = ?)
              OR (? != '' AND customer_phone LIKE ?)
           ORDER BY id DESC`
        ).all(id, uEmail, uEmail, uPhoneDigits, `%${uPhoneDigits}%`) || [];
      } catch (e) {}
    }

    // Attach items to each order
    for (const ord of userOrders) {
      if (ord.items_json) {
        try { ord.items = JSON.parse(ord.items_json); } catch (e) {}
      }
      if (!ord.items || ord.items.length === 0) {
        try {
          const itms = await executeMySQL('SELECT * FROM order_items WHERE order_id = ?', [ord.id]);
          ord.items = itms || [];
        } catch (e) {}
      }
    }

    const totalSpent = userOrders.reduce((acc, o) => acc + Number(o.total_amount || 0), 0);

    res.json({
      user: {
        ...u,
        total_orders: userOrders.length,
        total_spent: totalSpent
      },
      orders: userOrders
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE User (Admin)
router.delete('/api/admin/users/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    await executeMySQL('DELETE FROM users WHERE id = ?', [id]);
    try {
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
    } catch (e) {}
    res.json({ success: true, message: 'User deleted successfully', id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
