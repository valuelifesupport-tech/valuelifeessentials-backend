const express = require('express');
const router = express.Router();
const { db, executeMySQL } = require('../config/database.cjs');
const { requireAdminAuth } = require('../middleware/auth.cjs');
const { sendEmailNotification } = require('../config/email.cjs');

// Helper to attach items to an array of orders or single order
async function enrichOrdersWithItems(orders) {
  if (!orders || orders.length === 0) return [];
  const orderList = Array.isArray(orders) ? orders : [orders];
  for (const ord of orderList) {
    if (!ord) continue;
    if (ord.items && Array.isArray(ord.items) && ord.items.length > 0) continue;

    // Check items_json column first
    if (ord.items_json) {
      try {
        const parsed = typeof ord.items_json === 'string' ? JSON.parse(ord.items_json) : ord.items_json;
        if (Array.isArray(parsed) && parsed.length > 0) {
          ord.items = parsed;
          continue;
        }
      } catch (e) {}
    }

    // Query order_items table
    try {
      let items = await executeMySQL(
        'SELECT id, order_id, product_id, COALESCE(product_title, product_name) as product_title, COALESCE(product_name, product_title) as product_name, variant_id, variant_name, COALESCE(price_inr, price) as price, COALESCE(price_inr, price) as price_inr, quantity, COALESCE(total, price * quantity) as total, image_url FROM order_items WHERE order_id = ?',
        [ord.id]
      );
      if (!items || items.length === 0) {
        try {
          items = db.prepare('SELECT id, order_id, product_id, product_name, variant_id, variant_name, price, quantity, total FROM order_items WHERE order_id = ?').all(ord.id);
        } catch (e) {}
      }
      ord.items = items || [];
    } catch (e) {
      ord.items = [];
    }
  }
  return Array.isArray(orders) ? orderList : orderList[0];
}

// POST Place Order
router.post('/api/orders', async (req, res) => {
  try {
    const {
      user_id,
      customer_name,
      customer_email,
      customer_phone,
      shipping_address,
      country = 'India',
      currency = 'INR',
      state_name = '',
      payment_mode,
      payment_method,
      payment_gateway = 'razorpay',
      gateway_order_id,
      gateway_payment_id,
      order_notes,
      remark = '',
      items = [],
      coupon_code,
      coupon_discount = 0,
      is_partial_deposit = false,
      partial_deposit_percent = 20,
      total_amount: clientTotal,
      paid_amount: clientPaid,
      remaining_amount: clientRemaining
    } = req.body;

    const rawName = (customer_name || '').trim();
    const rawPhone = (customer_phone || '').trim();
    const rawAddress = (shipping_address || '').trim();
    const rawEmail = (customer_email || '').trim().toLowerCase();

    if (!rawName || !rawPhone || !rawAddress || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Missing required order details: name, phone, address, and items are mandatory.' });
    }

    // Determine payment mode & notes
    const effectivePaymentMode = (payment_mode || payment_method || 'COD').toUpperCase();
    const effectiveNotes = (order_notes || remark || '').trim();

    // Process items & calculate pricing
    let subtotal = 0;
    const orderItems = [];

    for (const it of items) {
      const pId = it.product_id || it.id;
      let title = it.product_title || it.product_name || it.name || it.title || 'Product';
      let img = it.image_url || it.image || it.primary_image || it.item_image || '';
      let pPrice = Number(it.price || it.price_inr || 0);
      const pQty = Number(it.quantity || 1);

      let vId = it.variant_id || it.variantId || null;
      let vName = it.variant_name || it.variant_title || null;

      // Find variant_id if variant name given but id missing
      if (!vId && vName && pId) {
        try {
          const vRows = await executeMySQL(
            'SELECT id, price_inr, stock FROM product_variants WHERE product_id = ? AND (variant_name = ? OR title = ?) LIMIT 1',
            [pId, vName, vName]
          );
          if (vRows && vRows.length > 0) {
            vId = vRows[0].id;
          }
        } catch (e) {}
      }

      // Fetch product info from MySQL if missing
      if (pId && (!title || title === 'Product' || !img || !pPrice)) {
        try {
          const prods = await executeMySQL('SELECT title, price_inr, image_url, thumbnail FROM products WHERE id = ?', [pId]);
          if (prods && prods.length > 0) {
            if (!title || title === 'Product') title = prods[0].title;
            if (!img) img = prods[0].image_url || prods[0].thumbnail || '';
            if (!pPrice) pPrice = Number(prods[0].price_inr || 0);
          }
        } catch (e) {}
      }

      const lineTotal = pPrice * pQty;
      subtotal += lineTotal;

      orderItems.push({
        product_id: pId || null,
        variant_id: vId || null,
        product_title: title,
        product_name: title,
        variant_name: vName,
        price: pPrice,
        price_inr: pPrice,
        price_usd: Math.round((pPrice / 85) * 100) / 100,
        quantity: pQty,
        total: lineTotal,
        image_url: img
      });
    }

    const discount = Math.min(Number(coupon_discount || 0), subtotal);
    const taxableAmount = Math.max(0, subtotal - discount);

    // GST & shipping calculation
    const gstRate = 5;
    const taxAmount = Math.round((taxableAmount * gstRate) / 100);
    const shippingAmount = taxableAmount >= 499 ? 0 : 50;
    const calculatedTotal = taxableAmount + taxAmount + shippingAmount;

    // Final total amount
    const totalAmount = (clientTotal !== undefined && Number(clientTotal) > 0) ? Number(clientTotal) : calculatedTotal;

    // Deposit & Balance
    const isPartial = is_partial_deposit || effectivePaymentMode === 'PARTIAL' || effectivePaymentMode === 'PARTIAL_COD';
    let payableNow = totalAmount;
    let codBalance = 0;

    if (isPartial) {
      payableNow = (clientPaid !== undefined && Number(clientPaid) > 0)
        ? Number(clientPaid)
        : Math.round((totalAmount * Number(partial_deposit_percent)) / 100);
      codBalance = totalAmount - payableNow;
    } else if (effectivePaymentMode === 'COD') {
      payableNow = 0;
      codBalance = totalAmount;
    } else {
      // FULL / PREPAID / ONLINE
      payableNow = totalAmount;
      codBalance = 0;
    }

    const paidAmount = (clientPaid !== undefined) ? Number(clientPaid) : (effectivePaymentMode === 'COD' ? 0 : payableNow);
    const remainingAmount = (clientRemaining !== undefined) ? Number(clientRemaining) : Math.max(0, totalAmount - paidAmount);

    const orderNumber = `VL-${Date.now().toString().slice(-6)}`;
    const itemsJsonString = JSON.stringify(orderItems);

    // AUTO-UPSERT CUSTOMER RECORD INTO users TABLE
    let finalUserId = user_id ? Number(user_id) : null;
    try {
      let existingUser = null;
      if (finalUserId) {
        const rows = await executeMySQL('SELECT id FROM users WHERE id = ?', [finalUserId]);
        if (rows && rows.length > 0) existingUser = rows[0];
      }
      if (!existingUser && rawEmail) {
        const rows = await executeMySQL('SELECT id FROM users WHERE LOWER(email) = ?', [rawEmail]);
        if (rows && rows.length > 0) existingUser = rows[0];
      }
      if (!existingUser && rawPhone) {
        const cleanPhoneDigits = rawPhone.replace(/\D/g, '').slice(-10);
        const rows = await executeMySQL('SELECT id FROM users WHERE phone LIKE ?', [`%${cleanPhoneDigits}`]);
        if (rows && rows.length > 0) existingUser = rows[0];
      }

      if (!existingUser) {
        // Create customer in MySQL
        const custHash = 'cust_' + Date.now().toString(36);
        const insUserRes = await executeMySQL(
          'INSERT INTO users (name, email, phone, password, address, role, is_verified, created_at) VALUES (?, ?, ?, ?, ?, "CUSTOMER", 1, NOW())',
          [rawName, rawEmail || null, rawPhone, custHash, rawAddress]
        );
        if (insUserRes && insUserRes.insertId) {
          finalUserId = insUserRes.insertId;
        } else {
          finalUserId = Date.now();
        }

        try {
          db.prepare('INSERT OR IGNORE INTO users (id, name, email, phone, address, role, is_verified, created_at) VALUES (?, ?, ?, ?, ?, "CUSTOMER", 1, datetime("now"))')
            .run(finalUserId, rawName, rawEmail || null, rawPhone, rawAddress);
        } catch (e) {}
      } else {
        finalUserId = existingUser.id;
        // Update user address/phone if missing
        await executeMySQL(
          'UPDATE users SET address = COALESCE(NULLIF(address, ""), ?), phone = COALESCE(NULLIF(phone, ""), ?) WHERE id = ?',
          [rawAddress, rawPhone, finalUserId]
        );
      }
    } catch (uErr) {
      console.warn('Customer upsert notification:', uErr.message);
    }

    // Insert Order into MySQL
    const insertSQL = `
      INSERT INTO orders (
        order_number, customer_name, customer_email, customer_phone,
        shipping_address, country, currency, total_amount, paid_amount,
        remaining_amount, payment_mode, payment_status, order_status,
        order_notes, gst_amount, cgst_amount, sgst_amount, igst_amount,
        customer_gstin, courier_name, tracking_number, created_at,
        user_id, payment_gateway, gateway_order_id, gateway_payment_id,
        state_name, subtotal, discount_amount, coupon_code, tax_amount,
        shipping_amount, payable_amount, cod_balance_amount, is_partial_payment,
        payment_method, remark, items_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const isIntraState = !state_name || state_name.trim().toLowerCase() === 'maharashtra';
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (isIntraState) {
      cgstAmount = Math.round((taxAmount / 2) * 100) / 100;
      sgstAmount = Math.round((taxAmount - cgstAmount) * 100) / 100;
      igstAmount = 0;
    } else {
      cgstAmount = 0;
      sgstAmount = 0;
      igstAmount = taxAmount;
    }

    const insertParams = [
      orderNumber, rawName, rawEmail, rawPhone,
      rawAddress, country, currency, totalAmount, paidAmount,
      remainingAmount, effectivePaymentMode,
      (paidAmount >= totalAmount ? 'PAID' : (paidAmount > 0 ? 'PARTIAL_PAID' : 'PENDING')),
      'PROCESSING',
      effectiveNotes, taxAmount, cgstAmount, sgstAmount, igstAmount,
      '', '', '',
      finalUserId, payment_gateway, gateway_order_id || null, gateway_payment_id || null,
      state_name, subtotal, discount, coupon_code || null, taxAmount,
      shippingAmount, payableNow, codBalance, isPartial ? 1 : 0,
      effectivePaymentMode, effectiveNotes, itemsJsonString
    ];

    const myRes = await executeMySQL(insertSQL, insertParams);
    const newOrderId = (myRes && myRes.insertId) ? myRes.insertId : Date.now();

    // Insert Order into SQLite fallback
    try {
      db.prepare(`
        INSERT OR REPLACE INTO orders (
          id, order_number, customer_name, customer_email, customer_phone,
          shipping_address, country, currency, total_amount, paid_amount,
          remaining_amount, payment_mode, payment_status, order_status,
          order_notes, gst_amount, courier_name, tracking_number,
          user_id, payment_gateway, state_name, subtotal, discount_amount,
          coupon_code, tax_amount, shipping_amount, payable_amount,
          cod_balance_amount, is_partial_payment, remark
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newOrderId, orderNumber, rawName, rawEmail, rawPhone,
        rawAddress, country, currency, totalAmount, paidAmount,
        remainingAmount, effectivePaymentMode,
        (paidAmount >= totalAmount ? 'PAID' : (paidAmount > 0 ? 'PARTIAL_PAID' : 'PENDING')),
        'PROCESSING',
        effectiveNotes, taxAmount, '', '',
        finalUserId, payment_gateway, state_name, subtotal, discount,
        coupon_code || null, taxAmount, shippingAmount, payableNow,
        codBalance, isPartial ? 1 : 0, effectiveNotes
      );
    } catch (e) {}

    // Insert Items into MySQL & SQLite + Decrement Stock
    for (const item of orderItems) {
      await executeMySQL(
        `INSERT INTO order_items (
          order_id, product_id, product_title, product_name,
          variant_id, variant_name, price_inr, price, quantity, total, image_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newOrderId, item.product_id, item.product_title, item.product_name,
          item.variant_id, item.variant_name, item.price_inr, item.price,
          item.quantity, item.total, item.image_url
        ]
      );

      try {
        db.prepare(`
          INSERT INTO order_items (order_id, product_id, product_name, variant_id, variant_name, price, quantity, total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(newOrderId, item.product_id, item.product_name, item.variant_id, item.variant_name, item.price, item.quantity, item.total);
      } catch (e) {}

      // Stock decrement by purchased quantity
      const buyQty = Math.max(1, Number(item.quantity) || 1);
      if (item.variant_id) {
        await executeMySQL('UPDATE product_variants SET stock = GREATEST(0, stock - ?) WHERE id = ?', [buyQty, item.variant_id]);
        try {
          db.prepare('UPDATE product_variants SET stock = MAX(0, stock - ?) WHERE id = ?').run(buyQty, item.variant_id);
        } catch (e) {}
      }
      if (item.product_id) {
        await executeMySQL('UPDATE products SET stock = GREATEST(0, stock - ?) WHERE id = ?', [buyQty, item.product_id]);
        try {
          db.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?').run(buyQty, item.product_id);
        } catch (e) {}
      }
    }

    // Send confirmation email
    if (rawEmail) {
      sendEmailNotification(
        rawEmail,
        `Order Confirmed #${orderNumber} | ValueLife Essentials`,
        `<div style="font-family: Arial, sans-serif; padding: 25px; color: #164e3f; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #164e3f; margin-bottom: 8px;">Thank you for your order, ${rawName}!</h2>
          <p style="color: #475569; font-size: 14px;">Your order <b>#${orderNumber}</b> has been received and is being prepared with 100% certified organic care.</p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 4px 0; font-size: 14px;"><b>Order Number:</b> ${orderNumber}</p>
            <p style="margin: 4px 0; font-size: 14px;"><b>Total Amount:</b> ₹${totalAmount.toLocaleString('en-IN')}</p>
            <p style="margin: 4px 0; font-size: 14px;"><b>Payment Mode:</b> ${effectivePaymentMode}</p>
            ${codBalance > 0 ? `<p style="margin: 4px 0; font-size: 14px; color: #b45309;"><b>COD Balance to Pay on Delivery:</b> ₹${codBalance.toLocaleString('en-IN')}</p>` : ''}
            <p style="margin: 4px 0; font-size: 14px;"><b>Delivery Address:</b> ${rawAddress}</p>
          </div>
          <p style="font-size: 12px; color: #94a3b8;">You can track real-time shipment updates anytime by signing into your ValueLife account.</p>
        </div>`
      ).catch(() => {});
    }

    res.json({
      success: true,
      order_id: newOrderId,
      order_number: orderNumber,
      orderNumber,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      remaining_amount: remainingAmount,
      payable_amount: payableNow,
      cod_balance: codBalance,
      customer_name: rawName,
      customer_email: rawEmail,
      items: orderItems
    });
  } catch (err) {
    console.error('Order creation error:', err);
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

// GET Single Order with Items (Admin)
router.get('/api/admin/orders/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    let orders = await executeMySQL('SELECT * FROM orders WHERE id = ? OR order_number = ?', [id, id]);
    if (!orders || orders.length === 0) {
      const sq = db.prepare('SELECT * FROM orders WHERE id = ? OR order_number = ?').get(id, id);
      if (sq) orders = [sq];
    }
    if (!orders || !orders[0]) return res.status(404).json({ error: 'Order not found' });

    const enriched = await enrichOrdersWithItems(orders[0]);
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Update Order Status / Courier / Tracking / Cancellation / Notes
router.put([
  '/api/admin/orders/:id/status',
  '/api/admin/orders/:id/notes',
  '/api/admin/orders/:id',
  '/api/orders/:id'
], requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const {
      order_status,
      payment_status,
      courier_name,
      tracking_number,
      order_notes,
      remark,
      notes,
      cancellation_reason,
      cancellation_notes
    } = req.body;

    const noteVal = order_notes !== undefined ? order_notes : (remark !== undefined ? remark : notes);

    await executeMySQL(
      `UPDATE orders SET
        order_status = COALESCE(?, order_status),
        payment_status = COALESCE(?, payment_status),
        courier_name = COALESCE(?, courier_name),
        tracking_number = COALESCE(?, tracking_number),
        order_notes = COALESCE(?, order_notes),
        remark = COALESCE(?, remark),
        cancellation_reason = COALESCE(?, cancellation_reason),
        cancellation_notes = COALESCE(?, cancellation_notes)
      WHERE id = ? OR order_number = ?`,
      [
        order_status || null,
        payment_status || null,
        courier_name || null,
        tracking_number || null,
        noteVal !== undefined ? noteVal : null,
        noteVal !== undefined ? noteVal : null,
        cancellation_reason !== undefined ? cancellation_reason : null,
        cancellation_notes !== undefined ? cancellation_notes : null,
        id, id
      ]
    );

    try {
      db.prepare(`
        UPDATE orders SET
          order_status = COALESCE(?, order_status),
          payment_status = COALESCE(?, payment_status),
          courier_name = COALESCE(?, courier_name),
          tracking_number = COALESCE(?, tracking_number),
          order_notes = COALESCE(?, order_notes),
          remark = COALESCE(?, remark),
          cancellation_reason = COALESCE(?, cancellation_reason),
          cancellation_notes = COALESCE(?, cancellation_notes)
        WHERE id = ? OR order_number = ?
      `).run(
        order_status || null,
        payment_status || null,
        courier_name || null,
        tracking_number || null,
        noteVal !== undefined ? noteVal : null,
        noteVal !== undefined ? noteVal : null,
        cancellation_reason !== undefined ? cancellation_reason : null,
        cancellation_notes !== undefined ? cancellation_notes : null,
        id, id
      );
    } catch (e) {}

    // Fetch updated order
    let updated = await executeMySQL('SELECT * FROM orders WHERE id = ? OR order_number = ?', [id, id]);
    if (!updated || !updated[0]) {
      updated = [db.prepare('SELECT * FROM orders WHERE id = ? OR order_number = ?').get(id, id)];
    }

    res.json({ success: true, id, order: updated ? updated[0] : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Cancel Order (Customer or Admin)
router.post(['/api/orders/:id/cancel', '/api/orders/cancel/:id'], async (req, res) => {
  try {
    const id = req.params.id;
    const { reason, notes } = req.body || {};
    // Restore stock for cancelled order items if not already cancelled
    try {
      let ordRows = await executeMySQL('SELECT id, order_status FROM orders WHERE id = ? OR order_number = ?', [id, id]);
      if (ordRows && ordRows.length > 0 && ordRows[0].order_status !== 'CANCELLED') {
        const orderPk = ordRows[0].id;
        const oItems = await executeMySQL('SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ?', [orderPk]);
        if (Array.isArray(oItems)) {
          for (const it of oItems) {
            const qty = Math.max(1, Number(it.quantity) || 1);
            if (it.variant_id) {
              await executeMySQL('UPDATE product_variants SET stock = stock + ? WHERE id = ?', [qty, it.variant_id]);
              try { db.prepare('UPDATE product_variants SET stock = stock + ? WHERE id = ?').run(qty, it.variant_id); } catch (e) {}
            }
            if (it.product_id) {
              await executeMySQL('UPDATE products SET stock = stock + ? WHERE id = ?', [qty, it.product_id]);
              try { db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(qty, it.product_id); } catch (e) {}
            }
          }
        }
      }
    } catch (restErr) {
      console.warn('Stock restoration notice on cancel:', restErr.message);
    }

    await executeMySQL(
      'UPDATE orders SET order_status = "CANCELLED", cancellation_reason = COALESCE(?, cancellation_reason), cancellation_notes = COALESCE(?, cancellation_notes) WHERE id = ? OR order_number = ?',
      [reason || 'Cancelled by customer', notes || '', id, id]
    );
    try {
      db.prepare('UPDATE orders SET order_status = "CANCELLED", cancellation_reason = COALESCE(?, cancellation_reason), cancellation_notes = COALESCE(?, cancellation_notes) WHERE id = ? OR order_number = ?')
        .run(reason || 'Cancelled by customer', notes || '', id, id);
    } catch (e) {}
    res.json({ success: true, message: 'Order cancelled and stock restored successfully' });
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

// GET Customer Order History (Supports email, phone, user_id query params)
router.get('/api/users/:email/orders', async (req, res) => {
  try {
    const paramVal = decodeURIComponent(req.params.email || '').trim();
    const queryEmail = (req.query.email || '').trim();
    const queryPhone = (req.query.phone || '').trim();
    const queryUserId = req.query.user_id ? Number(req.query.user_id) : null;

    const emailToMatch = (queryEmail || (paramVal.includes('@') ? paramVal : '')).toLowerCase();
    const phoneToMatch = queryPhone || (!paramVal.includes('@') && paramVal.replace(/\D/g, '').length >= 6 ? paramVal : '');
    const cleanPhoneDigits = phoneToMatch.replace(/\D/g, '').slice(-10);

    let orders = [];

    // 1. Query MySQL
    if (queryUserId || emailToMatch || cleanPhoneDigits) {
      orders = await executeMySQL(
        `SELECT * FROM orders 
         WHERE (? IS NOT NULL AND user_id = ?)
            OR (? != '' AND LOWER(customer_email) = ?)
            OR (? != '' AND customer_phone LIKE ?)
         ORDER BY id DESC`,
        [
          queryUserId, queryUserId,
          emailToMatch, emailToMatch,
          cleanPhoneDigits, `%${cleanPhoneDigits}%`
        ]
      ) || [];
    }

    // 2. Fallback to SQLite if empty
    if (!orders || orders.length === 0) {
      try {
        orders = db.prepare(
          `SELECT * FROM orders 
           WHERE (? IS NOT NULL AND user_id = ?)
              OR (? != '' AND LOWER(customer_email) = ?)
              OR (? != '' AND customer_phone LIKE ?)
           ORDER BY id DESC`
        ).all(
          queryUserId, queryUserId,
          emailToMatch, emailToMatch,
          cleanPhoneDigits, `%${cleanPhoneDigits}%`
        ) || [];
      } catch (e) {}
    }

    // 3. Fallback to simple matching if still empty
    if (!orders || orders.length === 0) {
      try {
        orders = await executeMySQL('SELECT * FROM orders WHERE customer_email = ? OR customer_phone = ? ORDER BY id DESC', [paramVal, paramVal]) || [];
      } catch (e) {}
    }

    // CRITICAL: Attach items to each order so the user sees ordered products & images
    const enrichedOrders = await enrichOrdersWithItems(orders);
    res.json(enrichedOrders);
  } catch (err) {
    console.error('Customer orders fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
