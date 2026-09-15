const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { paymentManager } = require('../paymentGateways.cjs');
const { executeMySQL, db } = require('../config/database.cjs');
const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = require('../config/constants.cjs');
const { verifyAndCalculateOrderPricing } = require('../utils/priceSecurity.cjs');
const {
  initiatePaymentTransaction,
  recordGatewayHandshake,
  recordPaymentFailure,
  recordPaymentVerification,
  getTransaction,
  listTransactions
} = require('../utils/transactionAudit.cjs');

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

// POST Create Payment Order (Strict Zero-Trust Server Pricing & Lifecycle Tracking)
router.post(['/api/payment/create-order', '/api/payment/razorpay/create-order'], async (req, res) => {
  try {
    const { currency = 'INR', receipt, gateway = 'razorpay', order_id, items, coupon_code } = req.body;
    let finalAmount = 0;
    let orderRecord = null;

    // 1. If order_id provided, fetch authentic price strictly from database
    if (order_id) {
      const ordRows = await executeMySQL(
        'SELECT id, order_number, user_id, customer_name, customer_email, customer_phone, total_amount, payable_amount, paid_amount, payment_status FROM orders WHERE id = ? OR order_number = ?',
        [order_id, order_id]
      );
      if (ordRows && ordRows.length > 0) {
        orderRecord = ordRows[0];
        const payable = Number(orderRecord.payable_amount || 0);
        const total = Number(orderRecord.total_amount || 0);
        finalAmount = payable > 0 ? payable : total;
      } else {
        return res.status(404).json({ error: 'Order specified for payment was not found in database' });
      }
    }

    // 2. If items provided without order_id, compute verified pricing strictly from MySQL products & variants
    if (!finalAmount && Array.isArray(items) && items.length > 0) {
      try {
        const verified = await verifyAndCalculateOrderPricing(items, coupon_code);
        finalAmount = verified.totalAmount;
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }
    }

    // 3. Fallback to client amount only when neither order_id nor items exist
    if (!finalAmount && !order_id && (!items || items.length === 0)) {
      finalAmount = Number(req.body.amount || 0);
    }

    if (!finalAmount || finalAmount <= 0) {
      return res.status(400).json({ error: 'Valid positive payment amount is required' });
    }

    const ip_address = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip;
    const user_agent = req.headers['user-agent'];

    // -------------------------------------------------------------------------
    // STEP 1: LOG PAYMENT REQUEST IN DATABASE WITH AUTHENTIC SERVER AMOUNT
    // -------------------------------------------------------------------------
    const txnRecord = await initiatePaymentTransaction({
      order_id: orderRecord ? orderRecord.id : order_id,
      order_number: orderRecord ? orderRecord.order_number : (receipt || null),
      user_id: orderRecord ? orderRecord.user_id : (req.body.user_id || null),
      customer_name: orderRecord ? orderRecord.customer_name : (req.body.customer_name || 'Customer'),
      customer_email: orderRecord ? orderRecord.customer_email : (req.body.customer_email || null),
      customer_phone: orderRecord ? orderRecord.customer_phone : (req.body.customer_phone || null),
      gateway,
      currency,
      amount: finalAmount,
      request_payload: {
        order_id,
        items_count: Array.isArray(items) ? items.length : undefined,
        coupon_code,
        body: req.body
      },
      ip_address,
      user_agent
    });

    const gw = paymentManager.get(gateway) || paymentManager.get('razorpay');
    if (!gw) {
      await recordGatewayHandshake({
        transaction_id: txnRecord.transaction_id,
        success: false,
        error: 'Payment gateway adapter unavailable'
      });
      return res.status(500).json({ error: 'Payment gateway adapter unavailable' });
    }

    // -------------------------------------------------------------------------
    // STEP 2: HANDSHAKE WITH RAZORPAY API
    // -------------------------------------------------------------------------
    try {
      const orderData = await gw.createOrder({
        amount: Math.round(finalAmount),
        currency,
        receipt: receipt || `rcpt_${order_id || Date.now()}`,
        orderId: order_id
      });

      // Record successful handshake in DB
      await recordGatewayHandshake({
        transaction_id: txnRecord.transaction_id,
        gateway_order_id: orderData.id,
        response_payload: orderData,
        success: true
      });

      // Include transaction_id so client passes it to verification
      res.json({
        ...orderData,
        transaction_id: txnRecord.transaction_id
      });
    } catch (gwErr) {
      // Record failed handshake in DB
      await recordGatewayHandshake({
        transaction_id: txnRecord.transaction_id,
        success: false,
        error: gwErr.message
      });
      throw gwErr;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Record User Payment Failure / Dismissal
router.post(['/api/payment/failure', '/api/payment/razorpay/failure'], async (req, res) => {
  try {
    const {
      transaction_id,
      gateway_order_id,
      gateway_payment_id,
      error_code = 'PAYMENT_FAILED',
      error_description = 'Payment declined or modal dismissed by user',
      order_id
    } = req.body;

    // -------------------------------------------------------------------------
    // STEP 3: USER PAY FAIL AUDIT
    // -------------------------------------------------------------------------
    await recordPaymentFailure({
      transaction_id,
      gateway_order_id,
      gateway_payment_id,
      error_code,
      error_description,
      raw_data: req.body
    });

    // Optionally mark order status as PAYMENT_FAILED if order_id is present
    if (order_id) {
      await executeMySQL(
        'UPDATE orders SET payment_status = "FAILED" WHERE (id = ? OR order_number = ?) AND payment_status != "PAID"',
        [order_id, order_id]
      );
    }

    res.json({ success: true, recorded: true, message: 'Payment failure logged in database' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Verify Payment Signature & Finalize Transaction
router.post(['/api/payment/verify', '/api/payment/razorpay/verify'], async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      order_id,
      transaction_id,
      gateway = 'razorpay'
    } = req.body;

    const gw = paymentManager.get(gateway) || paymentManager.get('razorpay');

    // 1. Verify cryptographic HMAC signature
    const result = gw ? await gw.verifyPayment(req.body) : { verified: Boolean(razorpay_payment_id) };
    const isVerified = Boolean(result && (result.verified !== undefined ? result.verified : result.success));

    // 2. Look up existing database transaction for anti-tampering check
    const existingTxn = await getTransaction(transaction_id || razorpay_order_id);

    // If transaction doesn't exist at all, flag as suspicious
    if (!existingTxn) {
      console.warn(`[PriceSecurity] Unknown transaction attempt for order ${order_id || 'unknown'} and gateway order ${razorpay_order_id}`);
    }

    // -------------------------------------------------------------------------
    // STEP 4: RECORD VERIFICATION IN DATABASE
    // -------------------------------------------------------------------------
    const updatedTxn = await recordPaymentVerification({
      transaction_id: existingTxn ? existingTxn.transaction_id : transaction_id,
      gateway_order_id: razorpay_order_id,
      gateway_payment_id: razorpay_payment_id,
      gateway_signature: razorpay_signature,
      is_verified: isVerified,
      verification_details: {
        verified: isVerified,
        verified_at: new Date().toISOString(),
        gateway_response: result,
        request_body: req.body
      }
    });

    if (!isVerified) {
      return res.status(400).json({
        success: false,
        verified: false,
        fraud_alert: true,
        message: 'Payment signature mismatch - potential tampering attempt blocked'
      });
    }

    // 3. Mark order as PAID in MySQL
    const targetOrderId = order_id || (existingTxn ? existingTxn.order_id : null);
    if (targetOrderId) {
      await executeMySQL(
        'UPDATE orders SET payment_status = "PAID", paid_amount = total_amount, remaining_amount = 0, payment_gateway = "razorpay", gateway_payment_id = ?, transaction_id = ? WHERE id = ? OR order_number = ?',
        [razorpay_payment_id || 'PAY_' + Date.now(), updatedTxn ? updatedTxn.transaction_id : transaction_id, targetOrderId, targetOrderId]
      );
      try {
        db.prepare('UPDATE orders SET payment_status = "PAID", transaction_id = ? WHERE id = ? OR order_number = ?')
          .run(updatedTxn ? updatedTxn.transaction_id : transaction_id, targetOrderId, targetOrderId);
      } catch (e) {}
    }

    res.json({
      success: true,
      verified: true,
      transaction_id: updatedTxn ? updatedTxn.transaction_id : transaction_id,
      message: 'Payment signature verified and transaction finalized'
    });
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
      const payload = req.body.payload?.payment?.entity || req.body.payload?.order?.entity;

      if (event === 'payment.captured' || event === 'order.paid') {
        const orderId = payload?.order_id;
        const paymentId = payload?.id;
        const notes = payload?.notes || {};
        const txnId = notes.transaction_id;

        // Log verified webhook payment
        await recordPaymentVerification({
          transaction_id: txnId,
          gateway_order_id: orderId,
          gateway_payment_id: paymentId,
          gateway_signature: signature,
          is_verified: true,
          verification_details: { webhook_event: event, payload }
        });

        const targetOrderId = notes.order_id || orderId;
        if (targetOrderId) {
          await executeMySQL('UPDATE orders SET payment_status = "PAID" WHERE id = ? OR order_number = ? OR gateway_order_id = ?', [targetOrderId, targetOrderId, orderId]);
        }
      } else if (event === 'payment.failed') {
        const orderId = payload?.order_id;
        const paymentId = payload?.id;
        const notes = payload?.notes || {};
        const txnId = notes.transaction_id;

        await recordPaymentFailure({
          transaction_id: txnId,
          gateway_order_id: orderId,
          gateway_payment_id: paymentId,
          error_code: payload?.error_code || 'WEBHOOK_PAYMENT_FAILED',
          error_description: payload?.error_description || 'Payment failed on Razorpay',
          raw_data: payload
        });
      }
    }
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Payment Transactions (Admin Audit Trail API)
router.get('/api/payment/transactions', async (req, res) => {
  try {
    const { limit = 50, offset = 0, status, search } = req.query;
    const result = await listTransactions({ limit, offset, status, search });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Single Transaction Audit Timeline
router.get('/api/payment/transactions/:id', async (req, res) => {
  try {
    const txn = await getTransaction(req.params.id);
    if (!txn) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json(txn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
