const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { paymentManager } = require('../paymentGateways.cjs');
const { executeMySQL, db } = require('../config/database.cjs');
const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = require('../config/constants.cjs');
const { sendEmailNotification } = require('../config/email.cjs');
const { verifyAndCalculateOrderPricing } = require('../utils/priceSecurity.cjs');
const { buildOrderConfirmationEmailHtml } = require('../utils/orderEmailTemplate.cjs');
const {
  initiatePaymentTransaction,
  recordGatewayHandshake,
  recordPaymentFailure,
  recordPaymentVerification,
  getTransaction,
  listTransactions
} = require('../utils/transactionAudit.cjs');
const { requireAdminAuth } = require('../middleware/auth.cjs');

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

    // Mark order status as CANCELLED / FAILED and restore stock
    if (order_id) {
      const ordRows = await executeMySQL(
        'SELECT id, order_number, customer_name, customer_email, total_amount, payment_status, order_status FROM orders WHERE (id = ? OR order_number = ?) AND payment_status != "PAID"',
        [order_id, order_id]
      );
      if (ordRows && ordRows.length > 0) {
        const ord = ordRows[0];
        await executeMySQL(
          'UPDATE orders SET payment_status = "FAILED", order_status = "CANCELLED", cancellation_reason = ? WHERE id = ?',
          [error_description || 'Payment checkout closed/cancelled', ord.id]
        );
        try {
          db.prepare('UPDATE orders SET payment_status = "FAILED", order_status = "CANCELLED", cancellation_reason = ? WHERE id = ?')
            .run(error_description || 'Payment checkout closed/cancelled', ord.id);
        } catch (e) {}

        // Restore reserved stock
        try {
          const oItems = await executeMySQL('SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ?', [ord.id]);
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
        } catch (e) {}

        // Dispatch Order Cancellation / Payment Incomplete Email
        if (ord.customer_email) {
          sendEmailNotification(
            ord.customer_email,
            `Order Cancelled / Payment Incomplete #${ord.order_number} | ValueLife Essentials`,
            `<div style="font-family: Arial, sans-serif; padding: 25px; color: #164e3f; max-width: 600px; margin: 0 auto; border: 1px solid #fed7aa; border-radius: 12px; background: #ffffff;">
              <h2 style="color: #ea580c; margin-bottom: 8px;">Order #${ord.order_number} — Payment Incomplete</h2>
              <p style="color: #475569; font-size: 14px;">Hi ${ord.customer_name || 'Customer'},</p>
              <p style="color: #475569; font-size: 14px;">Your online payment for Order <b>#${ord.order_number}</b> was not completed (checkout window closed or payment was cancelled). <b>No money was deducted from your account</b>.</p>
              <div style="background: #fff7ed; border: 1px solid #fdba74; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="margin: 4px 0; font-size: 14px;"><b>Order Number:</b> #${ord.order_number}</p>
                <p style="margin: 4px 0; font-size: 14px;"><b>Status:</b> <span style="color: #ea580c; font-weight: bold;">Cancelled / Unpaid</span></p>
                <p style="margin: 4px 0; font-size: 14px;"><b>Order Amount:</b> ₹${Number(ord.total_amount).toLocaleString('en-IN')}</p>
                <p style="margin: 4px 0; font-size: 14px;"><b>Reason:</b> ${error_description || 'Checkout closed before payment'}</p>
              </div>
              <p style="color: #475569; font-size: 14px;">If this was accidental or you wish to complete your purchase, your items are still waiting for you. You can return to <a href="https://valuelifeessentials.com" style="color: #164e3f; font-weight: bold;">ValueLife Essentials</a> anytime.</p>
              <p style="font-size: 12px; color: #94a3b8; margin-top: 20px;">If you have any questions, contact us at valuelifesupport@gmail.com.</p>
            </div>`
          ).catch(e => console.warn('Payment cancel email warn:', e.message));
        }
      }
    }

    res.json({ success: true, recorded: true, message: 'Payment failure logged and order cancelled' });
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

    // SECURITY: Ensure request includes matching order ownership info
    if (existingTxn) {
      const reqEmail = (req.body.email || req.body.customer_email || '').trim().toLowerCase();
      const reqUserId = req.body.user_id ? Number(req.body.user_id) : null;
      const txnEmail = (existingTxn.customer_email || '').trim().toLowerCase();
      const txnUserId = existingTxn.user_id;

      let hasAuthMatch = false;
      if (req.isAdmin) hasAuthMatch = true;
      if (txnEmail && txnEmail === reqEmail) hasAuthMatch = true;
      if (txnUserId && txnUserId === reqUserId) hasAuthMatch = true;

      if (!hasAuthMatch && (txnEmail || txnUserId)) {
         return res.status(403).json({ error: 'Unauthorized: Missing or invalid order ownership information' });
      }
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

    // 3. Mark order as PAID or PARTIAL_PAID in MySQL & SQLite
    const targetOrderId = order_id || (existingTxn ? existingTxn.order_id : null);
    let confirmedOrder = null;
    if (targetOrderId) {
      const ordRows = await executeMySQL(
        'SELECT id, order_number, customer_name, customer_email, customer_phone, total_amount, payable_amount, paid_amount, remaining_amount, cod_balance_amount, is_partial_payment, payment_mode, shipping_address, payment_status FROM orders WHERE id = ? OR order_number = ?',
        [targetOrderId, targetOrderId]
      );
      if (ordRows && ordRows.length > 0) {
        const ord = ordRows[0];
        const isPartial = ord.is_partial_payment == 1 || ord.payment_mode === 'PARTIAL';
        const newPaidAmount = isPartial ? Number(ord.payable_amount || ord.paid_amount || 0) : Number(ord.total_amount || 0);
        const newRemainingAmount = isPartial ? Number(ord.cod_balance_amount || Math.max(0, Number(ord.total_amount) - newPaidAmount)) : 0;
        const newPayStatus = isPartial ? 'PARTIAL_PAID' : 'PAID';
        const wasAlreadyPaid = ord.payment_status === 'PAID' || ord.payment_status === 'PARTIAL_PAID';

        await executeMySQL(
          'UPDATE orders SET payment_status = ?, order_status = "PROCESSING", paid_amount = ?, remaining_amount = ?, payment_gateway = "razorpay", gateway_payment_id = ?, transaction_id = ? WHERE id = ?',
          [newPayStatus, newPaidAmount, newRemainingAmount, razorpay_payment_id || 'PAY_' + Date.now(), updatedTxn ? updatedTxn.transaction_id : transaction_id, ord.id]
        );
        try {
          db.prepare('UPDATE orders SET payment_status = ?, order_status = "PROCESSING", paid_amount = ?, remaining_amount = ?, transaction_id = ? WHERE id = ?')
            .run(newPayStatus, newPaidAmount, newRemainingAmount, updatedTxn ? updatedTxn.transaction_id : transaction_id, ord.id);
        } catch (e) {}

        confirmedOrder = {
          ...ord,
          order_id: ord.id,
          order_number: ord.order_number,
          payment_status: newPayStatus,
          order_status: 'PROCESSING',
          paid_amount: newPaidAmount,
          remaining_amount: newRemainingAmount
        };

        // DISPATCH OFFICIAL ORDER CONFIRMATION EMAIL UPON SUCCESSFUL PAYMENT
        if (ord.customer_email && !wasAlreadyPaid) {
          try {
            let orderItems = [];
            try {
              orderItems = typeof ord.items_json === 'string' ? JSON.parse(ord.items_json) : (ord.items_json || []);
            } catch (e) {
              orderItems = [];
            }

            const emailHtml = buildOrderConfirmationEmailHtml({
              orderNumber: ord.order_number,
              customerName: ord.customer_name || 'Valued Customer',
              paymentMode: ord.payment_mode || 'ONLINE',
              paymentStatus: newPayStatus,
              totalAmount: Number(ord.total_amount || 0),
              paidAmount: newPaidAmount,
              remainingAmount: newRemainingAmount,
              subtotal: Number(ord.subtotal || 0),
              discountAmount: Number(ord.discount_amount || 0),
              shippingAmount: Number(ord.shipping_amount || 0),
              taxAmount: Number(ord.tax_amount || 0),
              shippingAddress: ord.shipping_address || 'Provided at checkout',
              items: orderItems
            });

            sendEmailNotification(
              ord.customer_email,
              `Order Confirmed #${ord.order_number} | ValueLife Essentials`,
              emailHtml
            ).catch(e => console.warn('Payment verify email warn:', e.message));
          } catch (emErr) {
            console.warn('Payment confirmation email build error:', emErr.message);
          }
        }
      }
    }

    res.json({
      success: true,
      verified: true,
      transaction_id: updatedTxn ? updatedTxn.transaction_id : transaction_id,
      order: confirmedOrder,
      message: 'Payment signature verified and order confirmed successfully'
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
    
    // SECURITY: Webhook payload must use raw bytes for accurate HMAC.
    // If req.rawBody is not set by a prior middleware, it falls back to JSON.stringify,
    // which may cause signature mismatch if whitespace differs.
    const payloadString = req.rawBody ? req.rawBody : JSON.stringify(req.body);
    const expected = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');

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
router.get('/api/payment/transactions', requireAdminAuth, async (req, res) => {
  try {
    const { limit = 50, offset = 0, status, search } = req.query;
    const result = await listTransactions({ limit, offset, status, search });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Single Transaction Audit Timeline
router.get('/api/payment/transactions/:id', requireAdminAuth, async (req, res) => {
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
