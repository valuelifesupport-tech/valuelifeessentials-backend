const crypto = require('crypto');
const { executeMySQL, db } = require('../config/database.cjs');

/**
 * Generates an immutable, unique transaction ID.
 * Format: TXN_VL_<timestamp>_<randomHex>
 */
function generateTransactionId() {
  const ts = Date.now();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `TXN_VL_${ts}_${rand}`;
}

/**
 * Step 1: Record initial payment request with authentic verified amount
 */
async function initiatePaymentTransaction({
  order_id = null,
  order_number = null,
  user_id = null,
  customer_name = '',
  customer_email = '',
  customer_phone = '',
  gateway = 'razorpay',
  currency = 'INR',
  amount = 0,
  request_payload = null,
  ip_address = null,
  user_agent = null
}) {
  const transaction_id = generateTransactionId();
  const verifiedAmount = Math.max(0, Number(amount || 0));
  const amount_paise = Math.round(verifiedAmount * 100);
  const reqStr = request_payload ? (typeof request_payload === 'string' ? request_payload : JSON.stringify(request_payload)) : null;

  try {
    // 1. MySQL Insert
    await executeMySQL(`
      INSERT INTO payment_transactions (
        transaction_id, order_id, order_number, user_id,
        customer_name, customer_email, customer_phone, gateway,
        currency, amount, amount_paise, step, status,
        request_payload, ip_address, user_agent, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '1_PAYMENT_REQ', 'INITIATED', ?, ?, ?, NOW(), NOW())
    `, [
      transaction_id,
      order_id ? String(order_id) : null,
      order_number ? String(order_number) : null,
      user_id ? Number(user_id) : null,
      customer_name || 'Customer',
      customer_email || null,
      customer_phone || null,
      gateway,
      currency,
      verifiedAmount,
      amount_paise,
      reqStr,
      ip_address || null,
      user_agent ? String(user_agent).slice(0, 500) : null
    ]);

    // 2. Link transaction_id in orders if order_id exists
    if (order_id) {
      await executeMySQL('UPDATE orders SET transaction_id = ? WHERE id = ? OR order_number = ?', [
        transaction_id,
        order_id,
        order_id
      ]);
    }

    // 3. Fallback SQLite
    try {
      if (db) {
        db.prepare(`
          INSERT INTO payment_transactions (
            transaction_id, order_id, order_number, user_id,
            customer_name, customer_email, customer_phone, gateway,
            currency, amount, amount_paise, step, status,
            request_payload, ip_address, user_agent
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '1_PAYMENT_REQ', 'INITIATED', ?, ?, ?)
        `).run(
          transaction_id,
          order_id ? String(order_id) : null,
          order_number ? String(order_number) : null,
          user_id ? Number(user_id) : null,
          customer_name || 'Customer',
          customer_email || null,
          customer_phone || null,
          gateway,
          currency,
          verifiedAmount,
          amount_paise,
          reqStr,
          ip_address || null,
          user_agent ? String(user_agent).slice(0, 500) : null
        );
      }
    } catch (e) {}

    console.log(`[TxnAudit] Step 1 INITIATED: ${transaction_id} for Amount: ₹${verifiedAmount}`);
    return {
      transaction_id,
      amount: verifiedAmount,
      amount_paise,
      currency,
      step: '1_PAYMENT_REQ',
      status: 'INITIATED'
    };
  } catch (err) {
    console.error('[TxnAudit] Error initiating payment transaction:', err.message);
    return {
      transaction_id,
      amount: verifiedAmount,
      amount_paise,
      currency,
      step: '1_PAYMENT_REQ',
      status: 'INITIATED'
    };
  }
}

/**
 * Step 2: Record handshake with Razorpay (gateway order created or failed)
 */
async function recordGatewayHandshake({
  transaction_id,
  gateway_order_id,
  response_payload = null,
  success = true,
  error = null
}) {
  if (!transaction_id) return;
  const respStr = response_payload ? (typeof response_payload === 'string' ? response_payload : JSON.stringify(response_payload)) : null;

  try {
    if (success) {
      await executeMySQL(`
        UPDATE payment_transactions
        SET step = '2_HANDSHAKE_RAZORPAY',
            status = 'ORDER_CREATED',
            gateway_order_id = ?,
            response_payload = ?,
            updated_at = NOW()
        WHERE transaction_id = ?
      `, [gateway_order_id, respStr, transaction_id]);

      try {
        if (db) {
          db.prepare(`
            UPDATE payment_transactions
            SET step = '2_HANDSHAKE_RAZORPAY',
                status = 'ORDER_CREATED',
                gateway_order_id = ?,
                response_payload = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE transaction_id = ?
          `).run(gateway_order_id, respStr, transaction_id);
        }
      } catch (e) {}

      console.log(`[TxnAudit] Step 2 HANDSHAKE SUCCESS: ${transaction_id} -> Gateway Order: ${gateway_order_id}`);
    } else {
      await executeMySQL(`
        UPDATE payment_transactions
        SET step = '2_HANDSHAKE_FAILED',
            status = 'CREATION_FAILED',
            error_description = ?,
            updated_at = NOW()
        WHERE transaction_id = ?
      `, [String(error || 'Handshake failed'), transaction_id]);

      try {
        if (db) {
          db.prepare(`
            UPDATE payment_transactions
            SET step = '2_HANDSHAKE_FAILED',
                status = 'CREATION_FAILED',
                error_description = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE transaction_id = ?
          `).run(String(error || 'Handshake failed'), transaction_id);
        }
      } catch (e) {}

      console.warn(`[TxnAudit] Step 2 HANDSHAKE FAILED: ${transaction_id} -> ${error}`);
    }
  } catch (err) {
    console.error('[TxnAudit] Error recording handshake:', err.message);
  }
}

/**
 * Step 3: Record payment failure / dismissal
 */
async function recordPaymentFailure({
  transaction_id,
  gateway_order_id = null,
  gateway_payment_id = null,
  error_code = null,
  error_description = null,
  raw_data = null
}) {
  const payloadStr = raw_data ? (typeof raw_data === 'string' ? raw_data : JSON.stringify(raw_data)) : null;

  try {
    const whereClause = transaction_id ? 'transaction_id = ?' : 'gateway_order_id = ?';
    const whereVal = transaction_id || gateway_order_id;
    if (!whereVal) return;

    await executeMySQL(`
      UPDATE payment_transactions
      SET step = '3_USER_PAY_FAIL',
          status = 'FAILED',
          gateway_payment_id = COALESCE(?, gateway_payment_id),
          error_code = ?,
          error_description = ?,
          verification_payload = COALESCE(?, verification_payload),
          updated_at = NOW()
      WHERE ${whereClause}
    `, [gateway_payment_id, error_code, error_description, payloadStr, whereVal]);

    try {
      if (db) {
        db.prepare(`
          UPDATE payment_transactions
          SET step = '3_USER_PAY_FAIL',
              status = 'FAILED',
              gateway_payment_id = COALESCE(?, gateway_payment_id),
              error_code = ?,
              error_description = ?,
              verification_payload = COALESCE(?, verification_payload),
              updated_at = CURRENT_TIMESTAMP
          WHERE ${whereClause}
        `).run(gateway_payment_id, error_code, error_description, payloadStr, whereVal);
      }
    } catch (e) {}

    console.log(`[TxnAudit] Step 3 USER PAY FAILED: ${whereVal} -> ${error_code}: ${error_description}`);
  } catch (err) {
    console.error('[TxnAudit] Error recording payment failure:', err.message);
  }
}

/**
 * Step 4: Record server-side Razorpay verification & anti-tamper confirmation
 */
async function recordPaymentVerification({
  transaction_id,
  gateway_order_id,
  gateway_payment_id,
  gateway_signature,
  is_verified,
  verification_details = {}
}) {
  const whereVal = transaction_id || gateway_order_id;
  if (!whereVal) return null;

  const whereClause = transaction_id ? 'transaction_id = ?' : 'gateway_order_id = ?';
  const verStr = JSON.stringify(verification_details);

  try {
    if (is_verified) {
      await executeMySQL(`
        UPDATE payment_transactions
        SET step = '4_VERIFY_SUCCESS',
            status = 'PAID',
            gateway_payment_id = ?,
            gateway_signature = ?,
            verified_at = NOW(),
            verification_payload = ?,
            updated_at = NOW()
        WHERE ${whereClause}
      `, [gateway_payment_id, gateway_signature, verStr, whereVal]);

      try {
        if (db) {
          db.prepare(`
            UPDATE payment_transactions
            SET step = '4_VERIFY_SUCCESS',
                status = 'PAID',
                gateway_payment_id = ?,
                gateway_signature = ?,
                verified_at = CURRENT_TIMESTAMP,
                verification_payload = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE ${whereClause}
          `).run(gateway_payment_id, gateway_signature, verStr, whereVal);
        }
      } catch (e) {}

      console.log(`[TxnAudit] Step 4 VERIFIED SUCCESS: ${whereVal} -> Payment: ${gateway_payment_id} PAID`);
    } else {
      await executeMySQL(`
        UPDATE payment_transactions
        SET step = '4_VERIFY_FAILED',
            status = 'SIGNATURE_MISMATCH',
            gateway_payment_id = ?,
            gateway_signature = ?,
            error_code = 'FRAUD_ALERT',
            error_description = 'HMAC signature verification failed: potential tampering attempt',
            verification_payload = ?,
            updated_at = NOW()
        WHERE ${whereClause}
      `, [gateway_payment_id, gateway_signature, verStr, whereVal]);

      try {
        if (db) {
          db.prepare(`
            UPDATE payment_transactions
            SET step = '4_VERIFY_FAILED',
                status = 'SIGNATURE_MISMATCH',
                gateway_payment_id = ?,
                gateway_signature = ?,
                error_code = 'FRAUD_ALERT',
                error_description = 'HMAC signature verification failed: potential tampering attempt',
                verification_payload = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE ${whereClause}
          `).run(gateway_payment_id, gateway_signature, verStr, whereVal);
        }
      } catch (e) {}

      console.warn(`[TxnAudit] Step 4 SIGNATURE MISMATCH / FRAUD BLOCKED: ${whereVal}`);
    }

    // Fetch and return updated record
    const rows = await executeMySQL(`SELECT * FROM payment_transactions WHERE ${whereClause}`, [whereVal]);
    return rows && rows.length > 0 ? rows[0] : null;
  } catch (err) {
    console.error('[TxnAudit] Error recording payment verification:', err.message);
    return null;
  }
}

/**
 * Query transaction by transaction_id or gateway_order_id
 */
async function getTransaction(txnIdOrGatewayOrderId) {
  if (!txnIdOrGatewayOrderId) return null;
  try {
    const rows = await executeMySQL(
      'SELECT * FROM payment_transactions WHERE transaction_id = ? OR gateway_order_id = ? LIMIT 1',
      [txnIdOrGatewayOrderId, txnIdOrGatewayOrderId]
    );
    return rows && rows.length > 0 ? rows[0] : null;
  } catch (err) {
    console.error('[TxnAudit] Error getting transaction:', err.message);
    return null;
  }
}

/**
 * List transactions for admin with filters
 */
async function listTransactions({ limit = 50, offset = 0, status, search }) {
  try {
    let sql = 'SELECT * FROM payment_transactions WHERE 1=1';
    const params = [];

    if (status && status !== 'ALL') {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      sql += ' AND (transaction_id LIKE ? OR order_number LIKE ? OR order_id LIKE ? OR customer_name LIKE ? OR customer_email LIKE ? OR gateway_order_id LIKE ? OR gateway_payment_id LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s, s);
    }

    sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(Number(limit) || 50, Number(offset) || 0);

    const rows = await executeMySQL(sql, params);
    const countRows = await executeMySQL('SELECT COUNT(*) as total FROM payment_transactions');
    const total = countRows && countRows[0] ? countRows[0].total : (rows ? rows.length : 0);

    return { transactions: rows || [], total };
  } catch (err) {
    console.error('[TxnAudit] Error listing transactions:', err.message);
    return { transactions: [], total: 0 };
  }
}

module.exports = {
  generateTransactionId,
  initiatePaymentTransaction,
  recordGatewayHandshake,
  recordPaymentFailure,
  recordPaymentVerification,
  getTransaction,
  listTransactions
};
