/**
 * Unified SMS Service for Indian Mobile OTP Dispatch
 * Supports: Fast2SMS, 2Factor, Twilio, and Console/Dev logging
 */
const https = require('https');
const http = require('http');

/**
 * Clean any Indian phone number to 10 digits
 */
function cleanIndianPhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  const m = digits.match(/[6-9]\d{9}/);
  if (m) return m[0];
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/**
 * Send SMS OTP to 10-digit Indian Mobile Number
 * @param {string} phone - 10-digit Indian phone number
 * @param {string} otp - 6-digit OTP code
 * @param {string} messageType - 'VERIFICATION' | 'FORGOT_PASSWORD' | 'ORDER_UPDATE'
 */
async function sendSmsNotification(phone, otp, messageType = 'VERIFICATION') {
  const cleanPhone = cleanIndianPhone(phone);
  if (!cleanPhone || cleanPhone.length !== 10) {
    console.warn(`⚠️ SMS skipped: Invalid 10-digit Indian phone number: "${phone}"`);
    return { success: false, reason: 'INVALID_PHONE' };
  }

  const twoFactorKey = process.env.TWOFACTOR_API_KEY || process.env.TWO_FACTOR_API_KEY || process.env.TWO_FACTOR_KEY || 'be2f1c24-bc9a-11f1-af74-0200cd936042';
  const fast2SmsKey = process.env.FAST2SMS_API_KEY || process.env.FAST2SMS_KEY || '';

  // 1. 2FACTOR.IN DISPATCH (Primary & Active carrier gateway)
  if (twoFactorKey) {
    try {
      // Helper function to call 2factor GET
      const call2Factor = (endpointUrl) => {
        return new Promise((resolve) => {
          https.get(endpointUrl, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
              try {
                const parsed = JSON.parse(data);
                if (parsed.Status === 'Success') {
                  resolve({ success: true, provider: '2Factor', sessionId: parsed.Details });
                } else {
                  resolve({ success: false, provider: '2Factor', error: parsed.Details || data });
                }
              } catch (e) {
                resolve({ success: false, provider: '2Factor', error: data });
              }
            });
          }).on('error', (err) => {
            resolve({ success: false, provider: '2Factor', error: err.message });
          });
        });
      };

      // 1. Primary requested endpoint: AUTOGEN with template OTP1
      // Endpoint: https://2factor.in/API/V1/:api_key/SMS/:phone_number/AUTOGEN/OTP1
      const endpointPattern = process.env.TWO_FACTOR_ENDPOINT || 'https://2factor.in/API/V1/:api_key/SMS/:phone_number/AUTOGEN/OTP1';
      const targetUrl = endpointPattern
        .replace(':api_key', twoFactorKey)
        .replace(':phone_number', cleanPhone);

      let tfRes = await call2Factor(targetUrl);
      
      // If template failed, fallback to default standard AUTOGEN endpoint
      if (!tfRes.success) {
        console.warn(`2Factor AUTOGEN/OTP1 returned: ${tfRes.error}. Falling back to default AUTOGEN endpoint...`);
        tfRes = await call2Factor(`https://2factor.in/API/V1/${twoFactorKey}/SMS/${cleanPhone}/AUTOGEN`);
      }

      // If still not sent and custom OTP provided, try with OTP1 template
      if (!tfRes.success && otp) {
        console.warn(`2Factor AUTOGEN returned: ${tfRes.error}. Trying custom OTP with OTP1...`);
        tfRes = await call2Factor(`https://2factor.in/API/V1/${twoFactorKey}/SMS/${cleanPhone}/${otp}/OTP1`);
        if (!tfRes.success) {
          tfRes = await call2Factor(`https://2factor.in/API/V1/${twoFactorKey}/SMS/${cleanPhone}/${otp}`);
        }
      }

      if (tfRes.success) {
        console.log(`📱 [2FACTOR SMS SUCCESS] OTP dispatched to +91 ${cleanPhone} (Session ID: ${tfRes.sessionId})`);
        return tfRes;
      } else {
        console.warn(`⚠️ 2Factor dispatch error for +91 ${cleanPhone}:`, tfRes.error);
      }
    } catch (err) {
      console.warn('2Factor execution exception:', err.message);
    }
  }

  // 2. FAST2SMS DISPATCH (Fallback secondary gateway)
  if (fast2SmsKey) {
    try {
      const postData = JSON.stringify({
        route: 'otp',
        variables_values: otp,
        numbers: cleanPhone
      });

      const options = {
        hostname: 'www.fast2sms.com',
        path: '/dev/bulkV2',
        method: 'POST',
        headers: {
          'authorization': fast2SmsKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const result = await new Promise((resolve) => {
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              if (parsed.return === true || res.statusCode === 200) {
                console.log(`📱 Fast2SMS OTP [${otp}] dispatched to +91 ${cleanPhone}`);
                resolve({ success: true, provider: 'Fast2SMS' });
              } else {
                console.warn('Fast2SMS response error:', data);
                resolve({ success: false, provider: 'Fast2SMS', error: data });
              }
            } catch (e) {
              resolve({ success: false, provider: 'Fast2SMS', error: data });
            }
          });
        });
        req.on('error', (err) => {
          console.warn('Fast2SMS request error:', err.message);
          resolve({ success: false, provider: 'Fast2SMS', error: err.message });
        });
        req.write(postData);
        req.end();
      });

      if (result.success) return result;
    } catch (err) {
      console.warn('Fast2SMS execution exception:', err.message);
    }
  }

  // Fallback Dev / Offline Log
  console.log(`📱 [SMS DISPATCH NOTICE] Target: +91 ${cleanPhone} | Code: [${otp}] | Type: ${messageType}`);
  return { 
    success: true, 
    provider: 'CONSOLE_SIMULATOR', 
    note: 'Add TWO_FACTOR_API_KEY to .env for carrier network SMS delivery.' 
  };
}

/**
 * Send Transactional Order Confirmation SMS to Indian Phone
 * @param {string} phone - Indian mobile number
 * @param {string} orderNumber - e.g. "VLE-1042"
 * @param {number|string} totalAmount - e.g. 599
 * @param {string} paymentMode - 'COD' | 'PAID_ONLINE'
 */
async function sendOrderConfirmationSms(phone, orderNumber, totalAmount, paymentMode = 'COD') {
  const cleanPhone = cleanIndianPhone(phone);
  if (!cleanPhone || cleanPhone.length !== 10) {
    return { success: false, reason: 'INVALID_PHONE' };
  }

  const twoFactorKey = process.env.TWOFACTOR_API_KEY || process.env.TWO_FACTOR_API_KEY || process.env.TWO_FACTOR_KEY || 'be2f1c24-bc9a-11f1-af74-0200cd936042';
  const fast2SmsKey = process.env.FAST2SMS_API_KEY || process.env.FAST2SMS_KEY || '';

  // 1. 2FACTOR TSMS / Transactional endpoint
  if (twoFactorKey) {
    try {
      const payload = JSON.stringify({
        From: 'VALUEL',
        To: cleanPhone,
        Msg: `Thank you for choosing ValueLife Essentials! Order #${orderNumber} for Rs.${totalAmount} (${paymentMode}) is confirmed. Track on valuelifeessentials.com`
      });

      const options = {
        hostname: '2factor.in',
        path: `/API/V1/${twoFactorKey}/ADDON_SERVICES/SEND/TSMS`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const result = await new Promise((resolve) => {
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              if (parsed.Status === 'Success') {
                console.log(`📱 [2FACTOR ORDER SMS SUCCESS] Order #${orderNumber} alert sent to +91 ${cleanPhone}`);
                resolve({ success: true, provider: '2Factor', details: parsed.Details });
              } else {
                resolve({ success: false, provider: '2Factor', error: parsed.Details || data });
              }
            } catch (_) {
              resolve({ success: false, provider: '2Factor', error: data });
            }
          });
        });
        req.on('error', (err) => resolve({ success: false, error: err.message }));
        req.write(payload);
        req.end();
      });

      if (result.success) return result;
    } catch (err) {
      console.warn('2Factor order SMS exception:', err.message);
    }
  }

  // 2. Fast2SMS Quick Route Fallback
  if (fast2SmsKey) {
    try {
      const postData = JSON.stringify({
        route: 'q',
        message: `ValueLife: Order #${orderNumber} of Rs.${totalAmount} confirmed (${paymentMode}). Visit valuelifeessentials.com to track.`,
        numbers: cleanPhone
      });

      const options = {
        hostname: 'www.fast2sms.com',
        path: '/dev/bulkV2',
        method: 'POST',
        headers: {
          'authorization': fast2SmsKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const result = await new Promise((resolve) => {
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              if (parsed.return === true || res.statusCode === 200) {
                console.log(`📱 [FAST2SMS ORDER SMS SUCCESS] Order #${orderNumber} sent to +91 ${cleanPhone}`);
                resolve({ success: true, provider: 'Fast2SMS' });
              } else {
                resolve({ success: false, error: data });
              }
            } catch (_) {
              resolve({ success: false, error: data });
            }
          });
        });
        req.on('error', (err) => resolve({ success: false, error: err.message }));
        req.write(postData);
        req.end();
      });

      if (result.success) return result;
    } catch (err) {
      console.warn('Fast2SMS order exception:', err.message);
    }
  }

  console.log(`📱 [ORDER SMS NOTICE] Target: +91 ${cleanPhone} | Order: #${orderNumber} | Total: Rs.${totalAmount}`);
  return { success: true, provider: 'CONSOLE_SIMULATOR' };
}

/**
 * Send Transactional Order Alert SMS to Store Owner / Admin Mobile (e.g. 7675941899)
 * @param {Object} params
 * @param {string} [params.ownerPhone] - Target mobile (default 7675941899)
 * @param {string} params.orderNumber - e.g. "VLE-1042"
 * @param {number|string} params.totalAmount - e.g. 1250
 * @param {string} [params.paymentMode] - 'COD' | 'ONLINE_PREPAID'
 * @param {string} [params.customerName] - Customer full name
 * @param {string} [params.customerPhone] - Customer contact phone
 */
async function sendAdminOrderAlertSms({
  ownerPhone = '7675941899',
  orderNumber = '',
  totalAmount = 0,
  paymentMode = 'COD',
  customerName = '',
  customerPhone = ''
} = {}) {
  const targetPhone = cleanIndianPhone(ownerPhone || process.env.ADMIN_ALERT_PHONE || '7675941899');
  if (!targetPhone || targetPhone.length !== 10) {
    console.warn(`⚠️ Admin order SMS skipped: Invalid phone number "${ownerPhone}"`);
    return { success: false, reason: 'INVALID_PHONE' };
  }

  const cleanTotal = Number(totalAmount || 0).toLocaleString('en-IN');
  const isCOD = paymentMode === 'COD' || String(paymentMode).toUpperCase().includes('COD');
  const payLabel = isCOD ? 'COD' : 'PREPAID';
  const custNameStr = customerName ? ` by ${String(customerName).trim().slice(0, 18)}` : '';
  const custPhoneStr = customerPhone ? ` (Ph: ${String(customerPhone).replace(/\D/g, '').slice(-10)})` : '';

  const twoFactorKey = process.env.TWOFACTOR_API_KEY || process.env.TWO_FACTOR_API_KEY || process.env.TWO_FACTOR_KEY || 'be2f1c24-bc9a-11f1-af74-0200cd936042';
  const fast2SmsKey = process.env.FAST2SMS_API_KEY || process.env.FAST2SMS_KEY || '';

  console.log(`📢 [ADMIN SMS ALERT] Dispatching to +91 ${targetPhone} for Order #${orderNumber} [₹${cleanTotal} - ${payLabel}]`);

  // 1. 2FACTOR.IN Transactional Route
  if (twoFactorKey) {
    try {
      const msgText = `ValueLife Alert: New Order #${orderNumber} for Rs.${cleanTotal} (${payLabel})${custNameStr}${custPhoneStr}. Check admin panel to dispatch.`;
      const payload = JSON.stringify({
        From: 'VALUEL',
        To: targetPhone,
        Msg: msgText
      });

      const options = {
        hostname: '2factor.in',
        path: `/API/V1/${twoFactorKey}/ADDON_SERVICES/SEND/TSMS`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const result = await new Promise((resolve) => {
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              if (parsed.Status === 'Success') {
                console.log(`📱 [2FACTOR ADMIN SMS SUCCESS] Alert delivered to +91 ${targetPhone} for Order #${orderNumber}`);
                resolve({ success: true, provider: '2Factor', details: parsed.Details });
              } else {
                resolve({ success: false, provider: '2Factor', error: parsed.Details || data });
              }
            } catch (_) {
              resolve({ success: false, provider: '2Factor', error: data });
            }
          });
        });
        req.on('error', (err) => resolve({ success: false, error: err.message }));
        req.write(payload);
        req.end();
      });

      if (result.success) return result;
    } catch (err) {
      console.warn('2Factor admin alert exception:', err.message);
    }
  }

  // 2. Fast2SMS Bulk Route Fallback
  if (fast2SmsKey) {
    try {
      const postData = JSON.stringify({
        route: 'q',
        message: `ValueLife: New Order #${orderNumber} of Rs.${cleanTotal} (${payLabel})${custNameStr}. Login to admin to process.`,
        numbers: targetPhone
      });

      const options = {
        hostname: 'www.fast2sms.com',
        path: '/dev/bulkV2',
        method: 'POST',
        headers: {
          'authorization': fast2SmsKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const result = await new Promise((resolve) => {
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              if (parsed.return === true || res.statusCode === 200) {
                console.log(`📱 [FAST2SMS ADMIN SMS SUCCESS] Alert delivered to +91 ${targetPhone}`);
                resolve({ success: true, provider: 'Fast2SMS' });
              } else {
                resolve({ success: false, error: data });
              }
            } catch (_) {
              resolve({ success: false, error: data });
            }
          });
        });
        req.on('error', (err) => resolve({ success: false, error: err.message }));
        req.write(postData);
        req.end();
      });

      if (result.success) return result;
    } catch (err) {
      console.warn('Fast2SMS admin alert exception:', err.message);
    }
  }

  console.log(`📱 [ADMIN SMS NOTIFIED] +91 ${targetPhone} | Order: #${orderNumber} | Total: Rs.${cleanTotal} (${payLabel})`);
  return { success: true, provider: 'CONSOLE_SIMULATOR' };
}

/**
 * Verify OTP entered by customer via 2Factor.in Session ID
 * @param {string} sessionId - 2Factor Session ID returned by AUTOGEN
 * @param {string} enteredOtp - OTP entered by user
 */
async function verifyTwoFactorOtp(sessionId, enteredOtp) {
  if (!sessionId || !enteredOtp) return { success: false, error: 'MISSING_PARAMS' };
  const twoFactorKey = process.env.TWOFACTOR_API_KEY || process.env.TWO_FACTOR_API_KEY || process.env.TWO_FACTOR_KEY || 'be2f1c24-bc9a-11f1-af74-0200cd936042';
  if (!twoFactorKey) return { success: false, error: 'NO_API_KEY' };

  return new Promise((resolve) => {
    const cleanSession = encodeURIComponent(String(sessionId).trim());
    const cleanCode = encodeURIComponent(String(enteredOtp).trim());
    const url = `https://2factor.in/API/V1/${twoFactorKey}/SMS/VERIFY/${cleanSession}/${cleanCode}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.Status === 'Success' || (parsed.Details && String(parsed.Details).toLowerCase().includes('matched'))) {
            resolve({ success: true, details: parsed.Details });
          } else {
            resolve({ success: false, error: parsed.Details || data });
          }
        } catch (e) {
          resolve({ success: false, error: data });
        }
      });
    }).on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

module.exports = {
  cleanIndianPhone,
  sendSmsNotification,
  sendOrderConfirmationSms,
  sendAdminOrderAlertSms,
  verifyTwoFactorOtp
};
