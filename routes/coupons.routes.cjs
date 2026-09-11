const express = require('express');
const router = express.Router();
const { db, executeMySQL } = require('../config/database.cjs');
const { requireAdminAuth } = require('../middleware/auth.cjs');

// GET All Coupons
router.get('/api/coupons', async (req, res) => {
  try {
    let rows = await executeMySQL('SELECT * FROM coupons ORDER BY id DESC');
    if (!rows || rows.length === 0) {
      rows = db.prepare('SELECT * FROM coupons ORDER BY id DESC').all() || [];
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Create Coupon
router.post('/api/coupons', requireAdminAuth, async (req, res) => {
  try {
    const {
      code, discount_type = 'PERCENTAGE', discount_value = 0,
      min_spend = 0, max_discount, expiry_date, usage_limit,
      applies_to = 'ALL', specific_ids = []
    } = req.body;

    if (!code) return res.status(400).json({ error: 'Coupon code is required' });

    const cleanCode = String(code).trim().toUpperCase();
    const myRes = await executeMySQL(
      'INSERT INTO coupons (code, discount_type, discount_value, min_spend, max_discount, expiry_date, usage_limit, applies_to, specific_ids) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [cleanCode, discount_type, discount_value, min_spend, max_discount || null, expiry_date || null, usage_limit || null, applies_to, JSON.stringify(specific_ids)]
    );
    const newId = myRes ? myRes.insertId : Date.now();

    try {
      db.prepare('INSERT OR REPLACE INTO coupons (id, code, discount_type, discount_value, min_spend, max_discount, expiry_date, usage_limit, applies_to, specific_ids) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(newId, cleanCode, discount_type, discount_value, min_spend, max_discount || null, expiry_date || null, usage_limit || null, applies_to, JSON.stringify(specific_ids));
    } catch (e) {}

    res.json({ id: newId, code: cleanCode, discount_type, discount_value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Update Coupon
router.put('/api/coupons/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { code, discount_type, discount_value, min_spend, max_discount, expiry_date, usage_limit, is_active } = req.body;
    const cleanCode = code ? String(code).trim().toUpperCase() : undefined;

    await executeMySQL(
      'UPDATE coupons SET code = COALESCE(?, code), discount_type = COALESCE(?, discount_type), discount_value = COALESCE(?, discount_value), min_spend = COALESCE(?, min_spend), max_discount = COALESCE(?, max_discount), expiry_date = COALESCE(?, expiry_date), usage_limit = COALESCE(?, usage_limit), is_active = COALESCE(?, is_active) WHERE id = ?',
      [cleanCode, discount_type, discount_value, min_spend, max_discount, expiry_date, usage_limit, is_active, id]
    );

    try {
      db.prepare('UPDATE coupons SET code = COALESCE(?, code), discount_type = COALESCE(?, discount_type), discount_value = COALESCE(?, discount_value), min_spend = COALESCE(?, min_spend), max_discount = COALESCE(?, max_discount), expiry_date = COALESCE(?, expiry_date), usage_limit = COALESCE(?, usage_limit), is_active = COALESCE(?, is_active) WHERE id = ?')
        .run(cleanCode, discount_type, discount_value, min_spend, max_discount, expiry_date, usage_limit, is_active, id);
    } catch (e) {}

    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Validate Coupon
router.post('/api/coupons/validate', async (req, res) => {
  try {
    const { code, cart_subtotal = 0 } = req.body;
    if (!code) return res.status(400).json({ error: 'Code is required' });

    const cleanCode = String(code).trim().toUpperCase();
    let coupon = null;

    const myRows = await executeMySQL('SELECT * FROM coupons WHERE UPPER(code) = ? AND (is_active IS NULL OR is_active = 1)', [cleanCode]);
    if (myRows && myRows.length > 0) {
      coupon = myRows[0];
    } else {
      coupon = db.prepare('SELECT * FROM coupons WHERE UPPER(code) = ? AND (is_active IS NULL OR is_active = 1)').get(cleanCode);
    }

    if (!coupon) {
      return res.status(404).json({ valid: false, error: 'Invalid or inactive coupon code' });
    }

    // Check expiry
    if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) {
      return res.status(400).json({ valid: false, error: 'Coupon has expired' });
    }

    // Check min spend
    const subtotal = Number(cart_subtotal) || 0;
    if (coupon.min_spend && subtotal < Number(coupon.min_spend)) {
      return res.status(400).json({ valid: false, error: `Minimum spend of ₹${coupon.min_spend} required` });
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discount_type === 'PERCENTAGE' || coupon.discount_type === 'amount_off_order') {
      discount = (subtotal * Number(coupon.discount_value)) / 100;
      if (coupon.max_discount && discount > Number(coupon.max_discount)) {
        discount = Number(coupon.max_discount);
      }
    } else {
      discount = Number(coupon.discount_value);
    }

    res.json({
      valid: true,
      code: coupon.code,
      discount_amount: Math.min(discount, subtotal),
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      coupon_id: coupon.id
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Coupon
router.delete('/api/coupons/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    await executeMySQL('DELETE FROM coupons WHERE id = ?', [id]);
    try {
      db.prepare('DELETE FROM coupons WHERE id = ?').run(id);
    } catch (e) {}
    res.json({ success: true, message: 'Coupon deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
