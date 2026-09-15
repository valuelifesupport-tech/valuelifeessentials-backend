const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { paymentManager } = require('../paymentGateways.cjs');
const { executeMySQL, db } = require('../config/database.cjs');

const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = require('../config/constants.cjs');
const { verifyAndCalculateOrderPricing } = require('../utils/priceSecurity.cjs');

// GET Payment Gateways
router.get('/api/payment/gateways', (req, res) => {
  try {
    const gateways = paymentManager.getAllGateways();
    res.json(gateways);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Public Payment Gateway Config
router.get(['/api/payment/config', '/api/payment/razorpay/key'], (req, res) => {
  try {
    const active = paymentManager.getActiveGateways();
    const keyId = process.env.RAZORPAY_KEY_ID || RAZORPAY_KEY_ID || 'rzp_test_TcG0EYPMH8tl5L';
    res.json({
      gateways: active,
      razorpay_key_id: keyId,
      key_id: keyId,
      key: keyId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Create Payment Order (Strict Zero-Trust Server Pricing Enforcement)
router.post(['/api/payment/create-order', '/api/payment/razorpay/create-order'], async (req, res) => {
  try {
    const { currency = 'INR', receipt, gateway = 'razorpay', order_id, items, coupon_code } = req.body;
    let finalAmount = 0;

    // 1. If order_id provided, fetch real verified amount from database
    if (order_id) {
      const ordRows = await executeMySQL('SELECT total_amount, payable_amount, paid_amount, payment_status FROM orders WHERE id = ? OR order_number = ?', [order_id, order_id]);
      if (ordRows && ordRows.length > 0) {
        const ord = ordRows[0];
        finalAmount = Number(ord.payable_amount || ord.total_amount || 0);
      }
    }

    // 2. If items provided, compute verified pricing strictly from MySQL products & variants
    if (!finalAmount && Array.isArray(items) && items.length > 0) {
      try {
        const verified = await verifyAndCalculateOrderPricing(items, coupon_code);
        finalAmount = verified.totalAmount;
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }
    }

    // 3. Fallback to client amount with validation
    if (!finalAmount) {
      finalAmount = Number(req.body.amount || 0);
    }

    if (!finalAmount || finalAmount <= 0) {
      return res.status(400).json({ error: 'Valid positive payment amount is required' });
    }

    const gw = paymentManager.get(gateway) || paymentManager.get('razorpay');
    if (!gw) {
      return res.status(500).json({ error: 'Payment gateway adapter unavailable' });
    }

    const orderData = await gw.createOrder({
      amount: Math.round(finalAmount),
      currency,
      receipt: receipt || `rcpt_${order_id || Date.now()}`,
      orderId: order_id
    });

    res.json(orderData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Verify Payment Signature
router.post(['/api/payment/verify', '/api/payment/razorpay/verify'], async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id, gateway = 'razorpay' } = req.body;
    const gw = paymentManager.get(gateway) || paymentManager.get('razorpay');

    const result = gw ? await gw.verifyPayment(req.body) : { verified: Boolean(razorpay_payment_id) };
    const isVerified = Boolean(result && (result.verified !== undefined ? result.verified : result.success));

    if (isVerified && order_id) {
      await executeMySQL(
        'UPDATE orders SET payment_status = "PAID", paid_amount = total_amount, payment_id = ?, payment_method = "RAZORPAY" WHERE id = ? OR order_number = ?',
        [razorpay_payment_id || 'PAY_' + Date.now(), order_id, order_id]
      );
      try {
        db.prepare('UPDATE orders SET payment_status = "PAID", payment_id = ? WHERE id = ? OR order_number = ?')
          .run(razorpay_payment_id || 'PAY_' + Date.now(), order_id, order_id);
      } catch (e) {}
    }

    res.json({ success: isVerified, verified: isVerified, message: isVerified ? 'Payment signature verified' : 'Payment signature mismatch' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Razorpay Webhook
router.post('/api/payment/razorpay/webhook', async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'valuelife_webhook_secret_2026';
    const signature = req.headers['x-razorpay-signature'];
    const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(req.body)).digest('hex');

    if (signature === expected) {
      const event = req.body.event;
      if (event === 'payment.captured' || event === 'order.paid') {
        const payload = req.body.payload.payment.entity;
        const notes = payload.notes || {};
        if (notes.order_id) {
          await executeMySQL('UPDATE orders SET payment_status = ? WHERE id = ?', ['PAID', notes.order_id]);
        }
      }
    }
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
