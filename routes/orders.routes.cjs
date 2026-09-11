const express = require('express');
const router = express.Router();
const { db, executeMySQL } = require('../config/database.cjs');
const { requireAdminAuth } = require('../middleware/auth.cjs');
const { sendEmailNotification } = require('../config/email.cjs');

// POST Place Order
router.post('/api/orders', async (req, res) => {
  try {
    const {
      customer_name, customer_email, customer_phone,
      shipping_address, payment_method = 'COD',
      items = [], coupon_code, coupon_discount = 0,
      state_name, is_partial_deposit = false, partial_deposit_percent = 20,
      remark = ''
    } = req.body;

    if (!customer_name || !customer_phone || !shipping_address || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Missing required order details' });
    }

    // Calculate item pricing & GST
    let subtotal = 0;
    const orderItems = [];

    for (const it of items) {
      const pPrice = Number(it.price || 0);
      const pQty = Number(it.quantity || 1);
      const lineTotal = pPrice * pQty;
      subtotal += lineTotal;
      orderItems.push({
        product_id: it.product_id || it.id,
        variant_id: it.variant_id || null,
        product_name: it.product_name || it.name || 'Product',
        variant_name: it.variant_name || null,
        price: pPrice,
        quantity: pQty,
        total: lineTotal
      });
    }

    const discount = Math.min(Number(coupon_discount || 0), subtotal);
    const taxableAmount = Math.max(0, subtotal - discount);

    // GST Calculation (5% default standard for food & wellness)
    const gstRate = 5;
    const taxAmount = Math.round((taxableAmount * gstRate) / 100);
    const shippingAmount = taxableAmount >= 499 ? 0 : 50;
    const totalAmount = taxableAmount + taxAmount + shippingAmount;

    // Deposit ratio
    let payableNow = totalAmount;
    let codBalance = 0;
    if (is_partial_deposit || payment_method === 'PARTIAL_COD') {
      payableNow = Math.round((totalAmount * Number(partial_deposit_percent)) / 100);
      codBalance = totalAmount - payableNow;
    }

    const orderNumber = `VL-${Date.now().toString().slice(-6)}`;

    // Insert Order into MySQL
    const myRes = await executeMySQL(
      `INSERT INTO orders (
        order_number, customer_name, customer_email, customer_phone,
        shipping_address, state_name, payment_method, payment_status,
        order_status, subtotal, discount_amount, coupon_code, tax_amount,
        shipping_amount, total_amount, payable_amount, cod_balance_amount,
        is_partial_payment, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderNumber, customer_name, customer_email || '', customer_phone,
        shipping_address, state_name || '', payment_method,
        payment_method === 'COD' ? 'PENDING' : (payment_method === 'ONLINE' ? 'PENDING' : 'PENDING'),
        'PENDING', subtotal, discount, coupon_code || null, taxAmount,
        shippingAmount, totalAmount, payableNow, codBalance,
        is_partial_deposit ? 1 : 0, remark || ''
      ]
    );
    const newOrderId = myRes ? myRes.insertId : Date.now();

    // Insert into SQLite
    try {
      db.prepare(`INSERT OR REPLACE INTO orders (
        id, order_number, customer_name, customer_email, customer_phone,
        shipping_address, state_name, payment_method, payment_status,
        order_status, subtotal, discount_amount, coupon_code, tax_amount,
        shipping_amount, total_amount, payable_amount, cod_balance_amount,
        is_partial_payment, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        newOrderId, orderNumber, customer_name, customer_email || '', customer_phone,
        shipping_address, state_name || '', payment_method, 'PENDING',
        'PENDING', subtotal, discount, coupon_code || null, taxAmount,
        shippingAmount, totalAmount, payableNow, codBalance,
        is_partial_deposit ? 1 : 0, remark || ''
      );
    } catch (e) {}

    // Insert Items and Decrement Stock
    for (const item of orderItems) {
      await executeMySQL(
        'INSERT INTO order_items (order_id, product_id, variant_id, product_name, variant_name, price, quantity, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [newOrderId, item.product_id, item.variant_id, item.product_name, item.variant_name, item.price, item.quantity, item.total]
      );
      try {
        db.prepare('INSERT INTO order_items (order_id, product_id, variant_id, product_name, variant_name, price, quantity, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(newOrderId, item.product_id, item.variant_id, item.product_name, item.variant_name, item.price, item.quantity, item.total);
      } catch (e) {}

      // Stock decrement
      if (item.product_id) {
        await executeMySQL('UPDATE products SET stock_quantity = GREATEST(0, stock_quantity - ?) WHERE id = ?', [item.quantity, item.product_id]);
      }
      if (item.variant_id) {
        await executeMySQL('UPDATE product_variants SET stock_quantity = GREATEST(0, stock_quantity - ?) WHERE id = ?', [item.quantity, item.variant_id]);
      }
    }

    // Send confirmation email
    if (customer_email) {
      sendEmailNotification(
        customer_email,
        `Order Confirmation - #${orderNumber} | ValueLife Essentials`,
        `<div style="font-family: Arial, sans-serif; padding: 20px; color: #164e3f;">
          <h2>Thank you for your order, ${customer_name}!</h2>
          <p>Your order <b>#${orderNumber}</b> has been received and is being prepared with care.</p>
          <p><b>Order Total:</b> ₹${totalAmount}</p>
          <p><b>Delivery Address:</b> ${shipping_address}</p>
        </div>`
      ).catch(() => {});
    }

    res.json({
      success: true,
      order_id: newOrderId,
      order_number: orderNumber,
      total_amount: totalAmount,
      payable_amount: payableNow,
      cod_balance: codBalance
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET All Orders (Admin)
router.get('/api/admin/orders', requireAdminAuth, async (req, res) => {
  try {
    let rows = await executeMySQL('SELECT * FROM orders ORDER BY id DESC');
    if (!rows || rows.length === 0) {
      rows = db.prepare('SELECT * FROM orders ORDER BY id DESC').all() || [];
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Single Order with Items
router.get('/api/admin/orders/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    let order = await executeMySQL('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order || order.length === 0) {
      order = [db.prepare('SELECT * FROM orders WHERE id = ?').get(id)];
    }
    if (!order || !order[0]) return res.status(404).json({ error: 'Order not found' });

    const items = await executeMySQL('SELECT * FROM order_items WHERE order_id = ?', [id]) || [];
    res.json({
      ...order[0],
      items
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Update Order Status / Courier / Tracking
router.put(['/api/admin/orders/:id/status', '/api/admin/orders/:id', '/api/orders/:id'], requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { order_status, payment_status, courier_name, tracking_number, notes } = req.body;

    await executeMySQL(
      `UPDATE orders SET
        order_status = COALESCE(?, order_status),
        payment_status = COALESCE(?, payment_status),
        courier_name = COALESCE(?, courier_name),
        tracking_number = COALESCE(?, tracking_number),
        notes = COALESCE(?, notes)
      WHERE id = ?`,
      [order_status, payment_status, courier_name, tracking_number, notes, id]
    );

    try {
      db.prepare(`UPDATE orders SET
        order_status = COALESCE(?, order_status),
        payment_status = COALESCE(?, payment_status),
        courier_name = COALESCE(?, courier_name),
        tracking_number = COALESCE(?, tracking_number),
        notes = COALESCE(?, notes)
      WHERE id = ?`).run(order_status, payment_status, courier_name, tracking_number, notes, id);
    } catch (e) {}

    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Cancel Order (Customer or Admin)
router.post(['/api/orders/:id/cancel', '/api/orders/cancel/:id'], async (req, res) => {
  try {
    const id = req.params.id;
    await executeMySQL('UPDATE orders SET order_status = "CANCELLED" WHERE id = ?', [id]);
    try {
      db.prepare('UPDATE orders SET order_status = "CANCELLED" WHERE id = ?').run(id);
    } catch (e) {}
    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Recent Order Activity (Social Proof Sales Ticker)
router.get('/api/orders/recent-activity', async (req, res) => {
  try {
    const orders = await executeMySQL('SELECT id, customer_name, country, total_amount, created_at FROM orders ORDER BY id DESC LIMIT 5') || [];
    const activities = orders.map(o => ({
      id: o.id,
      name: o.customer_name ? (o.customer_name.split(' ')[0] + ' ' + (o.customer_name.split(' ')[1] ? o.customer_name.split(' ')[1][0] + '.' : '')) : 'Customer',
      location: o.country || 'India',
      amount: o.total_amount,
      timeAgo: 'Recently'
    }));
    res.json(activities);
  } catch (err) {
    res.json([]);
  }
});

// GET Customer Order History
router.get('/api/users/:email/orders', async (req, res) => {
  try {
    const email = req.params.email;
    let orders = await executeMySQL('SELECT * FROM orders WHERE customer_email = ? OR customer_phone = ? ORDER BY id DESC', [email, email]);
    if (!orders || orders.length === 0) {
      orders = db.prepare('SELECT * FROM orders WHERE customer_email = ? OR customer_phone = ? ORDER BY id DESC').all(email, email) || [];
    }
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
