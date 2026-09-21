const express = require('express');
const router = express.Router();
const { db, executeMySQL } = require('../config/database.cjs');
const { requireAdminAuth } = require('../middleware/auth.cjs');
const { sendEmailNotification } = require('../config/email.cjs');
const { verifyAndCalculateOrderPricing } = require('../utils/priceSecurity.cjs');
const { buildOrderConfirmationEmailHtml } = require('../utils/orderEmailTemplate.cjs');

// Helper for strict 10-digit Indian phone normalization
function sanitize10DigitPhone(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && (digits.startsWith('0') || digits.startsWith('1'))) return digits.slice(1);
  if (digits.length === 10) return digits;
  const m = digits.match(/[6-9]\d{9}/);
  if (m) return m[0];
  return digits.slice(-10);
}

// Helper to attach items to an array of orders or single order and ensure SKUs are populated
async function enrichOrdersWithItems(orders) {
  if (!orders || orders.length === 0) return [];
  const orderList = Array.isArray(orders) ? orders : [orders];
  for (const ord of orderList) {
    if (!ord) continue;
    let items = ord.items;
    if (!items || !Array.isArray(items) || items.length === 0) {
      // Check items_json column first
      if (ord.items_json) {
        try {
          const parsed = typeof ord.items_json === 'string' ? JSON.parse(ord.items_json) : ord.items_json;
          if (Array.isArray(parsed) && parsed.length > 0) {
            items = parsed;
          }
        } catch (e) {}
      }

      // Query order_items table if items_json wasn't available
      if (!items || items.length === 0) {
        try {
          items = await executeMySQL(
            'SELECT id, order_id, product_id, COALESCE(product_title, product_name) as product_title, COALESCE(product_name, product_title) as product_name, variant_id, variant_name, COALESCE(price_inr, price) as price, COALESCE(price_inr, price) as price_inr, quantity, COALESCE(total, price * quantity) as total, image_url FROM order_items WHERE order_id = ?',
            [ord.id]
          );
          if (!items || items.length === 0) {
            try {
              items = db.prepare('SELECT id, order_id, product_id, product_name, variant_id, variant_name, price, quantity, total FROM order_items WHERE order_id = ?').all(ord.id);
            } catch (e) {}
          }
        } catch (e) {
          items = [];
        }
      }
    }

    // Always resolve SKUs for all items in order
    if (Array.isArray(items) && items.length > 0) {
      for (const it of items) {
        if (!it) continue;
        const vId = it.variant_id || it.variantId;
        const pId = it.product_id || it.productId || it.id;

        // 1. Resolve variant SKU if missing
        if (!it.variant_sku && vId) {
          try {
            const vRows = await executeMySQL('SELECT sku, variant_name, title FROM product_variants WHERE id = ?', [vId]);
            if (vRows && vRows[0]?.sku) {
              it.variant_sku = (vRows[0].sku || '').trim();
            } else {
              try {
                const locV = db.prepare('SELECT sku FROM product_variants WHERE id = ?').get(vId);
                if (locV?.sku) it.variant_sku = (locV.sku || '').trim();
              } catch (e) {}
            }
          } catch (e) {}
        }

        // 2. Resolve product SKU if missing
        if (!it.product_sku && pId) {
          try {
            const pRows = await executeMySQL('SELECT sku, title FROM products WHERE id = ?', [pId]);
            if (pRows && pRows[0]?.sku) {
              it.product_sku = (pRows[0].sku || '').trim();
            } else {
              try {
                const locP = db.prepare('SELECT sku FROM products WHERE id = ?').get(pId);
                if (locP?.sku) it.product_sku = (locP.sku || '').trim();
              } catch (e) {}
            }
          } catch (e) {}
        }

        // 3. Fallback logic for sku
        const baseSku = it.variant_sku || it.product_sku || (vId ? `VL-VAR-${vId}` : (pId ? `VL-${pId}` : 'VL-ITEM'));
        it.sku = it.sku || baseSku;
        it.variant_sku = it.variant_sku || (vId ? it.sku : null);
        it.product_sku = it.product_sku || it.sku;
      }
    }

    ord.items = items || [];
  }
  return Array.isArray(orders) ? orderList : orderList[0];
}

// GET Public Order Tracking (by order_number or phone — limited info, NO AUTH)
router.get('/api/orders/track', async (req, res) => {
  try {
    const query = (req.query.q || '').trim();
    if (!query || query.length < 3) {
      return res.status(400).json({ error: 'Please enter an order number or phone number (min 3 characters)' });
    }

    let order = null;
    try {
      const rows = await executeMySQL(
        `SELECT id, order_number, customer_name, customer_phone, order_status, shipping_status, 
                tracking_number, carrier, total_amount, currency, created_at, items_json
         FROM orders 
         WHERE LOWER(order_number) = LOWER(?) 
            OR customer_phone LIKE ? 
            OR id = ?
         ORDER BY id DESC LIMIT 1`,
        [query, `%${query}%`, query]
      );
      if (rows && rows.length > 0) order = rows[0];
    } catch (e) {}

    if (!order) {
      try {
        order = db.prepare(
          `SELECT id, order_number, customer_name, customer_phone, order_status, shipping_status,
                  tracking_number, carrier, total_amount, currency, created_at, items_json
           FROM orders 
           WHERE LOWER(order_number) = LOWER(?) 
              OR customer_phone LIKE ?
              OR id = ?
           ORDER BY id DESC LIMIT 1`
        ).get(query, `%${query}%`, query);
      } catch (e) {}
    }

    if (!order) {
      return res.status(404).json({ error: 'No order found with that order number or phone number' });
    }

    // Parse items
    if (order.items_json) {
      try { order.items = JSON.parse(order.items_json); } catch (e) { order.items = []; }
    }
    delete order.items_json;

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Place Order
router.post('/api/orders', async (req, res) => {
  try {
    const {
      user_id,
      customer_name,
      customer_email,
      customer_phone,
      shipping_address,
      shipping_city,
      shipping_state,
      shipping_pincode,
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
    const rawPhone = sanitize10DigitPhone(customer_phone);
    const rawAddress = (shipping_address || '').trim();
    const rawEmail = (customer_email || '').trim().toLowerCase();
    const effectiveState = (shipping_state || state_name || '').trim() || 'Maharashtra';
    const pinMatch = rawAddress.match(/\b\d{6}\b/);
    const effectivePincode = (shipping_pincode || (pinMatch ? pinMatch[0] : '')).trim();
    const effectiveCity = (shipping_city || '').trim();

    if (!rawName || !rawPhone || rawPhone.length !== 10 || !rawAddress || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Valid customer name, 10-digit mobile number, shipping address, and items are mandatory.' });
    }

    // Determine payment mode & notes
    const effectivePaymentMode = (payment_mode || payment_method || 'COD').toUpperCase();
    const effectiveNotes = (order_notes || remark || '').trim();

    // ZERO-TRUST SERVER-SIDE PRICING & INVENTORY SECURITY
    // Every item price, variant price, coupon discount, tax rate, and total are strictly verified from MySQL
    let verifiedPricing;
    try {
      verifiedPricing = await verifyAndCalculateOrderPricing(items, coupon_code);
    } catch (pricingErr) {
      return res.status(400).json({ error: pricingErr.message });
    }

    const {
      verifiedItems: orderItems,
      subtotal,
      discountAmount: discount,
      couponCode: validatedCouponCode,
      taxableAmount,
      taxAmount,
      shippingAmount,
      totalAmount
    } = verifiedPricing;

    // Deposit & Balance Calculation strictly based on verified total
    const isPartial = is_partial_deposit || effectivePaymentMode === 'PARTIAL' || effectivePaymentMode === 'PARTIAL_COD';
    let payableNow = totalAmount;
    let codBalance = 0;

    if (isPartial) {
      const depPercent = Math.min(100, Math.max(10, Number(partial_deposit_percent) || 20));
      payableNow = Math.round((totalAmount * depPercent) / 100);
      codBalance = Math.max(0, totalAmount - payableNow);
    } else if (effectivePaymentMode === 'COD') {
      payableNow = 0;
      codBalance = totalAmount;
    } else {
      // FULL / PREPAID / ONLINE
      payableNow = totalAmount;
      codBalance = 0;
    }

    // SECURITY: Never trust client-supplied payment amounts. Calculate server-side only.
    const paidAmount = (effectivePaymentMode === 'COD') ? 0 : payableNow;
    const remainingAmount = Math.max(0, totalAmount - paidAmount);

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
          'INSERT INTO users (name, email, phone, password, address, city, state, pincode, role, is_verified, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "CUSTOMER", 1, NOW())',
          [rawName, rawEmail || null, rawPhone, custHash, rawAddress, effectiveCity, effectiveState, effectivePincode]
        );
        if (insUserRes && insUserRes.insertId) {
          finalUserId = insUserRes.insertId;
        } else {
          finalUserId = Date.now();
        }

        try {
          db.prepare('INSERT OR IGNORE INTO users (id, name, email, phone, address, city, state, pincode, role, is_verified, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "CUSTOMER", 1, datetime("now"))')
            .run(finalUserId, rawName, rawEmail || null, rawPhone, rawAddress, effectiveCity, effectiveState, effectivePincode);
        } catch (e) {}
      } else {
        finalUserId = existingUser.id;
        // Update user address/phone/city/state/pincode
        await executeMySQL(
          'UPDATE users SET address = COALESCE(NULLIF(address, ""), ?), phone = COALESCE(NULLIF(phone, ""), ?), city = COALESCE(NULLIF(?, ""), city), state = COALESCE(NULLIF(?, ""), state), pincode = COALESCE(NULLIF(?, ""), pincode) WHERE id = ?',
          [rawAddress, rawPhone, effectiveCity, effectiveState, effectivePincode, finalUserId]
        );
        try {
          db.prepare('UPDATE users SET address = COALESCE(NULLIF(address, ""), ?), phone = COALESCE(NULLIF(phone, ""), ?), city = COALESCE(NULLIF(?, ""), city), state = COALESCE(NULLIF(?, ""), state), pincode = COALESCE(NULLIF(?, ""), pincode) WHERE id = ?')
            .run(rawAddress, rawPhone, effectiveCity, effectiveState, effectivePincode, finalUserId);
        } catch (e) {}
      }
    } catch (uErr) {
      console.warn('Customer upsert notification:', uErr.message);
    }

    // Determine Intra-State (CGST + SGST) vs Inter-State (IGST) dynamically from Store State
    let storeBaseState = 'Madhya Pradesh';
    try {
      const sRow = await executeMySQL('SELECT store_state FROM store_settings WHERE id = 1');
      if (sRow && sRow[0] && sRow[0].store_state) storeBaseState = sRow[0].store_state.trim();
    } catch (e) {}

    const cleanCustState = (effectiveState || '').trim().toLowerCase();
    const cleanStoreState = storeBaseState.toLowerCase();
    const isIntraState = !cleanCustState || cleanCustState === cleanStoreState;
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

    const insertSQL = `
      INSERT INTO orders (
        order_number, customer_name, customer_email, customer_phone,
        shipping_address, shipping_city, shipping_state, shipping_pincode, country, currency, total_amount, paid_amount,
        remaining_amount, payment_mode, payment_status, order_status,
        order_notes, gst_amount, cgst_amount, sgst_amount, igst_amount,
        customer_gstin, courier_name, tracking_number, created_at,
        user_id, payment_gateway, gateway_order_id, gateway_payment_id,
        state_name, subtotal, discount_amount, coupon_code, tax_amount,
        shipping_amount, payable_amount, cod_balance_amount, is_partial_payment,
        payment_method, remark, items_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const insertParams = [
      orderNumber, rawName, rawEmail, rawPhone,
      rawAddress, effectiveCity, effectiveState, effectivePincode, country, currency, totalAmount, paidAmount,
      remainingAmount, effectivePaymentMode,
      (paidAmount >= totalAmount ? 'PAID' : (paidAmount > 0 ? 'PARTIAL_PAID' : 'PENDING')),
      (effectivePaymentMode === 'COD' ? 'PROCESSING' : 'PENDING_PAYMENT'),
      effectiveNotes, taxAmount, cgstAmount, sgstAmount, igstAmount,
      '', '', '',
      finalUserId, payment_gateway, gateway_order_id || null, gateway_payment_id || null,
      effectiveState, subtotal, discount, coupon_code || null, taxAmount,
      shippingAmount, payableNow, codBalance, isPartial ? 1 : 0,
      effectivePaymentMode, effectiveNotes, itemsJsonString
    ];

    const myRes = await executeMySQL(insertSQL, insertParams);
    const newOrderId = (myRes && myRes.insertId) ? myRes.insertId : Date.now();

    // Persist shipping address and contact to user record if registered
    if ((finalUserId || rawEmail) && rawAddress) {
      try {
        await executeMySQL(
          'UPDATE users SET address = ?, city = COALESCE(NULLIF(city, ""), ?), state = COALESCE(NULLIF(state, ""), ?), pincode = COALESCE(NULLIF(pincode, ""), ?), name = COALESCE(NULLIF(name, ""), ?), phone = COALESCE(NULLIF(phone, ""), ?) WHERE id = ? OR LOWER(email) = ?',
          [rawAddress, effectiveCity, effectiveState, effectivePincode, rawName || '', rawPhone || '', finalUserId || 0, (rawEmail || '').toLowerCase()]
        );
      } catch (e) {}
    }

    // Insert Order into SQLite fallback
    try {
      db.prepare(`
        INSERT OR REPLACE INTO orders (
          id, order_number, customer_name, customer_email, customer_phone,
          shipping_address, shipping_city, shipping_state, shipping_pincode, country, currency, total_amount, paid_amount,
          remaining_amount, payment_mode, payment_status, order_status,
          order_notes, gst_amount, courier_name, tracking_number,
          user_id, payment_gateway, state_name, subtotal, discount_amount,
          coupon_code, tax_amount, shipping_amount, payable_amount,
          cod_balance_amount, is_partial_payment, remark, items_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newOrderId, orderNumber, rawName, rawEmail, rawPhone,
        rawAddress, effectiveCity, effectiveState, effectivePincode, country, currency, totalAmount, paidAmount,
        remainingAmount, effectivePaymentMode,
        (paidAmount >= totalAmount ? 'PAID' : (paidAmount > 0 ? 'PARTIAL_PAID' : 'PENDING')),
        (effectivePaymentMode === 'COD' ? 'PROCESSING' : 'PENDING_PAYMENT'),
        effectiveNotes, taxAmount, '', '',
        finalUserId, payment_gateway, effectiveState, subtotal, discount,
        coupon_code || null, taxAmount, shippingAmount, payableNow,
        codBalance, isPartial ? 1 : 0, effectiveNotes, itemsJsonString
      );
    } catch (e) {
      console.warn('SQLite order insert notice:', e.message);
    }

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

    // Send confirmation email ONLY for Cash on Delivery (COD) orders immediately on creation.
    // For online payments (Razorpay), confirmation email will be dispatched strictly upon verified payment!
    if (effectivePaymentMode === 'COD' && rawEmail) {
      try {
        const emailHtml = buildOrderConfirmationEmailHtml({
          orderNumber,
          customerName: rawName,
          paymentMode: 'COD',
          paymentStatus: 'PENDING',
          totalAmount,
          paidAmount,
          remainingAmount,
          subtotal,
          discountAmount: discount,
          shippingAmount,
          taxAmount,
          shippingAddress: rawAddress,
          items: orderItems
        });

        sendEmailNotification(
          rawEmail,
          `Order Confirmed #${orderNumber} | ValueLife Essentials`,
          emailHtml
        ).catch((e) => console.warn('Order confirmation email warn:', e.message));
      } catch (emErr) {
        console.warn('Failed to build confirmation email:', emErr.message);
      }
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
      cancellation_notes,
      customer_name,
      customer_email,
      customer_phone,
      shipping_address,
      shipping_city,
      shipping_state,
      shipping_pincode,
      state_name
    } = req.body;

    const noteVal = order_notes !== undefined ? order_notes : (remark !== undefined ? remark : notes);
    const sanitizedPhone = customer_phone !== undefined ? (sanitize10DigitPhone(customer_phone) || customer_phone) : null;
    const effectiveState = shipping_state !== undefined ? shipping_state : (state_name !== undefined ? state_name : null);

    await executeMySQL(
      `UPDATE orders SET
        order_status = COALESCE(?, order_status),
        payment_status = COALESCE(?, payment_status),
        courier_name = COALESCE(?, courier_name),
        tracking_number = COALESCE(?, tracking_number),
        order_notes = COALESCE(?, order_notes),
        remark = COALESCE(?, remark),
        cancellation_reason = COALESCE(?, cancellation_reason),
        cancellation_notes = COALESCE(?, cancellation_notes),
        customer_name = COALESCE(?, customer_name),
        customer_email = COALESCE(?, customer_email),
        customer_phone = COALESCE(?, customer_phone),
        shipping_address = COALESCE(?, shipping_address),
        shipping_city = COALESCE(?, shipping_city),
        shipping_state = COALESCE(?, shipping_state),
        shipping_pincode = COALESCE(?, shipping_pincode),
        state_name = COALESCE(?, state_name)
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
        customer_name !== undefined ? customer_name : null,
        customer_email !== undefined ? customer_email : null,
        sanitizedPhone,
        shipping_address !== undefined ? shipping_address : null,
        shipping_city !== undefined ? shipping_city : null,
        effectiveState,
        shipping_pincode !== undefined ? shipping_pincode : null,
        effectiveState,
        id, id
      ]
    );

    // If state updated, adjust tax breakdown
    if (effectiveState) {
      const isIntra = effectiveState.trim().toLowerCase() === 'maharashtra';
      const ordRows = await executeMySQL('SELECT tax_amount FROM orders WHERE id = ? OR order_number = ?', [id, id]);
      const taxAmt = Number(ordRows && ordRows[0] ? ordRows[0].tax_amount : 0);
      if (taxAmt > 0) {
        const cgst = isIntra ? Math.round((taxAmt / 2) * 100) / 100 : 0;
        const sgst = isIntra ? Math.round((taxAmt - cgst) * 100) / 100 : 0;
        const igst = !isIntra ? taxAmt : 0;
        await executeMySQL('UPDATE orders SET cgst_amount = ?, sgst_amount = ?, igst_amount = ? WHERE id = ? OR order_number = ?', [cgst, sgst, igst, id, id]);
      }
    }

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
          cancellation_notes = COALESCE(?, cancellation_notes),
          customer_name = COALESCE(?, customer_name),
          customer_email = COALESCE(?, customer_email),
          customer_phone = COALESCE(?, customer_phone),
          shipping_address = COALESCE(?, shipping_address),
          shipping_city = COALESCE(?, shipping_city),
          shipping_state = COALESCE(?, shipping_state),
          shipping_pincode = COALESCE(?, shipping_pincode),
          state_name = COALESCE(?, state_name)
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
        customer_name !== undefined ? customer_name : null,
        customer_email !== undefined ? customer_email : null,
        sanitizedPhone,
        shipping_address !== undefined ? shipping_address : null,
        shipping_city !== undefined ? shipping_city : null,
        effectiveState,
        shipping_pincode !== undefined ? shipping_pincode : null,
        effectiveState,
        id, id
      );
    } catch (e) {}

    // Fetch updated order
    let updated = await executeMySQL('SELECT * FROM orders WHERE id = ? OR order_number = ?', [id, id]);
    if (!updated || !updated[0]) {
      updated = [db.prepare('SELECT * FROM orders WHERE id = ? OR order_number = ?').get(id, id)];
    }

    if (order_status === 'CANCELLED' && updated && updated[0]?.customer_email) {
      sendEmailNotification(
        updated[0].customer_email,
        `Order #${updated[0].order_number || id} Cancelled | ValueLife Essentials`,
        `<div style="font-family: Arial, sans-serif; padding: 25px; color: #164e3f; max-width: 600px; margin: 0 auto; border: 1px solid #fed7aa; border-radius: 12px; background: #ffffff;">
          <h2 style="color: #dc2626; margin-bottom: 8px;">Order #${updated[0].order_number || id} has been Cancelled</h2>
          <p style="color: #475569; font-size: 14px;">Hi ${updated[0].customer_name || 'Customer'},</p>
          <p style="color: #475569; font-size: 14px;">Your order has been cancelled. Reason: <b>${cancellation_reason || 'Order cancelled'}</b>.</p>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 4px 0; font-size: 14px;"><b>Order Number:</b> #${updated[0].order_number || id}</p>
            <p style="margin: 4px 0; font-size: 14px;"><b>Status:</b> CANCELLED</p>
          </div>
          <p style="font-size: 12px; color: #94a3b8;">If you have any questions, please reach out to us at valuelifesupport@gmail.com.</p>
        </div>`
      ).catch(() => {});
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
    const { reason, notes, email } = req.body || {};
    // Restore stock for cancelled order items if not already cancelled
    try {
      let ordRows = await executeMySQL('SELECT id, order_status, customer_email FROM orders WHERE id = ? OR order_number = ?', [id, id]);
      
      // SECURITY: Require matching email to cancel order
      if (ordRows && ordRows.length > 0) {
        const reqEmail = (email || '').trim().toLowerCase();
        const orderEmail = (ordRows[0].customer_email || '').trim().toLowerCase();
        if (!req.isAdmin && reqEmail !== orderEmail) {
          return res.status(403).json({ error: 'Unauthorized: matching email required' });
        }
      }

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

    // Dispatch Order Cancellation Email
    try {
      const ordRows = await executeMySQL('SELECT order_number, customer_name, customer_email, total_amount FROM orders WHERE id = ? OR order_number = ?', [id, id]);
      if (ordRows && ordRows[0]?.customer_email) {
        const ord = ordRows[0];
        sendEmailNotification(
          ord.customer_email,
          `Order #${ord.order_number || id} Cancelled | ValueLife Essentials`,
          `<div style="font-family: Arial, sans-serif; padding: 25px; color: #164e3f; max-width: 600px; margin: 0 auto; border: 1px solid #fed7aa; border-radius: 12px; background: #ffffff;">
            <h2 style="color: #dc2626; margin-bottom: 8px;">Order #${ord.order_number || id} has been Cancelled</h2>
            <p style="color: #475569; font-size: 14px;">Hi ${ord.customer_name || 'Customer'},</p>
            <p style="color: #475569; font-size: 14px;">Your order has been cancelled. Reason: <b>${reason || 'Cancelled by customer'}</b>.</p>
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 4px 0; font-size: 14px;"><b>Order Number:</b> #${ord.order_number || id}</p>
              <p style="margin: 4px 0; font-size: 14px;"><b>Status:</b> CANCELLED</p>
            </div>
            <p style="font-size: 12px; color: #94a3b8;">If you have any questions or this was done in error, please reach out to us at valuelifesupport@gmail.com.</p>
          </div>`
        ).catch(() => {});
      }
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
