const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { paymentManager } = require('../paymentGateways.cjs');
const { executeMySQL, db } = require('../config/database.cjs');

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
router.get('/api/payment/config', (req, res) => {
  try {
    const active = paymentManager.getActiveGateways();
    res.json({
      gateways: active,
      razorpay_key_id: process.env.RAZORPAY_KEY_ID || 'rzp_live_placeholder'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Create Payment Order
router.post(['/api/payment/create-order', '/api/payment/razorpay/create-order'], async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt, gateway = 'razorpay' } = req.body;
    if (!amount) return res.status(400).json({ error: 'Amount is required' });

    const gw = paymentManager.get(gateway) || paymentManager.get('razorpay');
    if (!gw) {
      return res.status(500).json({ error: 'Payment gateway adapter unavailable' });
    }

    const orderData = await gw.createOrder({
      amount: Math.round(Number(amount)),
      currency,
      receipt: receipt || `rcpt_${Date.now()}`
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

    const isValid = gw ? await gw.verifyPayment(req.body) : true;
    if (isValid && order_id) {
      await executeMySQL('UPDATE orders SET payment_status = ?, payment_id = ? WHERE id = ?', ['PAID', razorpay_payment_id || 'PAY_' + Date.now(), order_id]);
      try {
        db.prepare('UPDATE orders SET payment_status = ?, payment_id = ? WHERE id = ?').run('PAID', razorpay_payment_id || 'PAY_' + Date.now(), order_id);
      } catch (e) {}
    }

    res.json({ success: isValid });
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
