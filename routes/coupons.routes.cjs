const express = require('express');
const router = express.Router();
const { db, executeMySQL } = require('../config/database.cjs');
const { requireAdminAuth } = require('../middleware/auth.cjs');

// GET All Coupons
router.get('/api/coupons', requireAdminAuth, async (req, res) => {
  try {
    let rows = await executeMySQL('SELECT * FROM coupons ORDER BY id DESC');
    if (rows === null) {
      try {
        rows = db.prepare('SELECT * FROM coupons ORDER BY id DESC').all() || [];
      } catch (e) {
        rows = [];
      }
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Create Coupon
router.post('/api/coupons', requireAdminAuth, async (req, res) => {
  try {
    const data = req.body;
    let {
      code, discount_type = 'PERCENTAGE', discount_value = 0,
      min_spend_inr, coupon_category = 'amount_off_order', applies_to_type = 'all',
      target_ids = '[]', max_uses = null, one_per_customer = 0,
      start_date = null, end_date = null, description = null,
      buy_qty = 1, get_qty = 1, get_discount_type = 'FREE', free_shipping = 0,
      expiry_date
    } = data;

    if (!code) return res.status(400).json({ error: 'Coupon code is required' });

    if (coupon_category === 'free_shipping') {
      free_shipping = 1;
      discount_value = 0;
    }

    const min_spend = min_spend_inr || 0;
    const final_expiry = expiry_date || end_date || null;
    const usage_limit = max_uses;

    const cleanCode = String(code).trim().toUpperCase();

    // Check if code already exists
    const existing = await executeMySQL('SELECT id FROM coupons WHERE UPPER(code) = ?', [cleanCode]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: `Coupon code "${cleanCode}" already exists. Please choose a different code or edit the existing coupon.` });
    }

    const specific_ids_str = typeof target_ids === 'string' ? target_ids : JSON.stringify(target_ids);

    const query = `INSERT INTO coupons (
      code, discount_type, discount_value, min_spend, max_discount, 
      expiry_date, usage_limit, applies_to, specific_ids,
      coupon_category, free_shipping, description, start_date, end_date,
      max_uses, one_per_customer, buy_qty, get_qty, get_discount_type, 
      applies_to_type, target_ids
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [
      cleanCode, discount_type, discount_value, min_spend, null,
      final_expiry, usage_limit, applies_to_type, specific_ids_str,
      coupon_category, free_shipping, description, start_date, end_date,
      max_uses, one_per_customer, buy_qty, get_qty, get_discount_type,
      applies_to_type, specific_ids_str
    ];

    const myRes = await executeMySQL(query, values);
    let newId = myRes && myRes.insertId ? myRes.insertId : null;

    try {
      const sqliteId = newId || Date.now();
      db.prepare(`INSERT OR REPLACE INTO coupons (
        id, code, discount_type, discount_value, min_spend, max_discount, 
        expiry_date, usage_limit, applies_to, specific_ids,
        coupon_category, free_shipping, description, start_date, end_date,
        max_uses, one_per_customer, buy_qty, get_qty, get_discount_type, 
        applies_to_type, target_ids
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(sqliteId, ...values);
      if (!newId) newId = sqliteId;
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
    const data = req.body;
    
    const updates = [];
    const values = [];

    if (data.code !== undefined) {
      updates.push('code = ?');
      values.push(String(data.code).trim().toUpperCase());
    }
    if (data.discount_type !== undefined) {
      updates.push('discount_type = ?');
      values.push(data.discount_type);
    }
    if (data.discount_value !== undefined) {
      updates.push('discount_value = ?');
      values.push(Number(data.discount_value) || 0);
    }
    if (data.min_spend_inr !== undefined || data.min_spend !== undefined) {
      updates.push('min_spend = ?');
      values.push(Number(data.min_spend_inr !== undefined ? data.min_spend_inr : data.min_spend) || 0);
    }
    if (data.expiry_date !== undefined || data.end_date !== undefined) {
      updates.push('expiry_date = ?');
      values.push(data.expiry_date || data.end_date || null);
    }
    if (data.is_active !== undefined || data.active !== undefined) {
      const actVal = data.is_active !== undefined ? data.is_active : data.active;
      updates.push('is_active = ?');
      values.push(Number(actVal) === 1 ? 1 : 0);
    }
    if (data.coupon_category !== undefined) {
      updates.push('coupon_category = ?');
      values.push(data.coupon_category);
      if (data.coupon_category === 'free_shipping') {
        updates.push('free_shipping = 1');
        updates.push('discount_value = 0');
      }
    }
    if (data.free_shipping !== undefined) {
      updates.push('free_shipping = ?');
      values.push(data.free_shipping ? 1 : 0);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description || null);
    }
    if (data.start_date !== undefined) {
      updates.push('start_date = ?');
      values.push(data.start_date || null);
    }
    if (data.end_date !== undefined) {
      updates.push('end_date = ?');
      values.push(data.end_date || null);
    }
    if (data.max_uses !== undefined || data.usage_limit !== undefined) {
      const lim = data.max_uses !== undefined ? data.max_uses : data.usage_limit;
      updates.push('max_uses = ?', 'usage_limit = ?');
      values.push(lim ? Number(lim) : null, lim ? Number(lim) : null);
    }
    if (data.one_per_customer !== undefined) {
      updates.push('one_per_customer = ?');
      values.push(data.one_per_customer ? 1 : 0);
    }
    if (data.buy_qty !== undefined) {
      updates.push('buy_qty = ?');
      values.push(Number(data.buy_qty) || 1);
    }
    if (data.get_qty !== undefined) {
      updates.push('get_qty = ?');
      values.push(Number(data.get_qty) || 1);
    }
    if (data.get_discount_type !== undefined) {
      updates.push('get_discount_type = ?');
      values.push(data.get_discount_type || 'FREE');
    }
    if (data.applies_to_type !== undefined || data.applies_to !== undefined) {
      const app = data.applies_to_type || data.applies_to || 'all';
      updates.push('applies_to_type = ?', 'applies_to = ?');
      values.push(app, app);
    }
    if (data.target_ids !== undefined || data.specific_ids !== undefined) {
      const tgt = data.target_ids !== undefined ? data.target_ids : data.specific_ids;
      const str = typeof tgt === 'string' ? tgt : JSON.stringify(tgt || []);
      updates.push('target_ids = ?', 'specific_ids = ?');
      values.push(str, str);
    }

    if (updates.length === 0) {
      return res.json({ success: true, message: 'No fields to update' });
    }

    values.push(id);
    const sql = `UPDATE coupons SET ${updates.join(', ')} WHERE id = ?`;
    await executeMySQL(sql, values);

    try {
      db.prepare(sql).run(...values);
    } catch (e) {}

    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Validate Coupon
router.post('/api/coupons/validate', async (req, res) => {
  try {
    const { code, cart_subtotal, order_amount } = req.body;
    if (!code) return res.status(400).json({ error: 'Code is required' });

    const cleanCode = String(code).trim().toUpperCase();
    let coupon = null;

    const myRows = await executeMySQL('SELECT * FROM coupons WHERE UPPER(code) = ?', [cleanCode]);
    if (myRows && myRows.length > 0) {
      coupon = myRows[0];
    } else if (myRows === null) {
      // ONLY fallback to SQLite if MySQL is offline/unreachable
      try {
        coupon = db.prepare('SELECT * FROM coupons WHERE UPPER(code) = ?').get(cleanCode);
      } catch (e) {}
    }

    if (!coupon) {
      return res.status(404).json({ valid: false, error: 'Invalid or inactive coupon code' });
    }

    // Check if active
    const isActive = (coupon.is_active !== undefined && coupon.is_active !== null)
      ? Number(coupon.is_active)
      : ((coupon.active !== undefined && coupon.active !== null) ? Number(coupon.active) : 1);

    if (isActive !== 1) {
      return res.status(404).json({ valid: false, error: 'Invalid or inactive coupon code' });
    }

    // Check expiry
    const expDate = coupon.expiry_date || coupon.end_date;
    if (expDate && new Date(expDate) < new Date()) {
      return res.status(400).json({ valid: false, error: 'Coupon has expired' });
    }

    // Check start date
    if (coupon.start_date && new Date(coupon.start_date) > new Date()) {
      return res.status(400).json({ valid: false, error: 'Coupon is not yet active' });
    }

    // Check usage limit
    const maxUses = Number(coupon.usage_limit || coupon.max_uses || 0);
    const usedCount = Number(coupon.used_count || 0);
    if (maxUses > 0 && usedCount >= maxUses) {
      return res.status(400).json({ valid: false, error: 'Coupon usage limit reached' });
    }

    // Check min spend
    const subtotal = Number(cart_subtotal || order_amount || 0);
    const minSpend = Number(coupon.min_spend || coupon.min_order_amount || 0);
    
    if (minSpend > 0 && subtotal < minSpend) {
      return res.status(400).json({ valid: false, error: `Minimum spend of ₹${minSpend} required` });
    }

    // Calculate discount
    let discount = 0;
    const type = (coupon.discount_type || '').toUpperCase();
    if (type === 'PERCENT' || type === 'PERCENTAGE') {
      discount = (subtotal * Number(coupon.discount_value)) / 100;
      if (coupon.max_discount > 0 && discount > Number(coupon.max_discount)) {
        discount = Number(coupon.max_discount);
      }
    } else {
      discount = Number(coupon.discount_value);
    }
    
    const isFreeShipping = coupon.free_shipping == 1 || coupon.coupon_category === 'free_shipping';

    res.json({
      valid: true,
      code: coupon.code,
      discount_amount: Math.min(discount, subtotal),
      discount: Math.min(discount, subtotal),
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      free_shipping: isFreeShipping,
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
