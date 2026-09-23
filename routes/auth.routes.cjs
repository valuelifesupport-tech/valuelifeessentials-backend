const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db, executeMySQL } = require('../config/database.cjs');
const { ADMIN_SECRET_KEY, ADMIN_PASSWORD } = require('../config/constants.cjs');
const { hashPassword, verifyPassword, activeAdminTokens, registerToken } = require('../middleware/auth.cjs');
const rateLimiter = require('../middleware/rateLimiter.cjs');
const { sendEmailNotification } = require('../config/email.cjs');

// In-memory OTP cache fallback
const otpStore = new Map(); // key: email/phone, value: { otp, expiresAt, userData }

// Auto-cleanup expired OTPs every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of otpStore) {
    if (val.expiresAt && val.expiresAt < now) otpStore.delete(key);
  }
}, 5 * 60 * 1000);

// Helper: Normalize any Indian phone number strictly to clean 10 digits
function sanitize10DigitPhone(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  const m = digits.match(/[6-9]\d{9}/);
  if (m) return m[0];
  return digits.length > 10 ? digits.slice(-10) : digits;
}

// POST Admin Login
router.post('/api/admin/login', rateLimiter(10, 60000), async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const cleanPass = String(password).trim();
    let isValid = (cleanPass === ADMIN_PASSWORD);

    // Also check MySQL admin user if exists
    if (!isValid && email) {
      try {
        const users = await executeMySQL('SELECT password, role FROM users WHERE email = ? AND role = ?', [email, 'ADMIN']);
        if (users && users.length > 0) {
          isValid = verifyPassword(cleanPass, users[0].password);
        }
      } catch (e) {}
    }

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid administrative credentials' });
    }

    const token = `admin_tok_${crypto.randomBytes(24).toString('hex')}`;
    registerToken(token);

    res.json({
      success: true,
      token,
      admin: {
        email: email || process.env.ADMIN_EMAIL || process.env.SUPPORT_EMAIL || '',
        role: 'ADMIN',
        name: 'Master Admin'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Customer Register (MySQL-First with Direct Email OTP Dispatch)
router.post('/api/auth/register', rateLimiter(15, 60000), async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!email || !String(email).trim() || !password) {
      return res.status(400).json({ error: 'Valid email and password are required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName = (name && String(name).trim()) ? String(name).trim() : cleanEmail.split('@')[0];
    const cleanPhone = sanitize10DigitPhone(phone);
    const passwordHash = hashPassword(String(password));

    // 1. Check if verified user already exists
    let existing = null;
    try {
      const myRows = await executeMySQL('SELECT id, is_verified FROM users WHERE LOWER(email) = ?', [cleanEmail]);
      if (myRows && myRows.length > 0) existing = myRows[0];
    } catch (e) {}

    if (!existing) {
      try {
        const sqRow = db.prepare('SELECT id, is_verified FROM users WHERE LOWER(email) = ?').get(cleanEmail);
        if (sqRow) existing = sqRow;
      } catch (e) {}
    }

    if (existing && existing.is_verified === 1) {
      return res.status(409).json({ error: 'An account with this email address already exists! Please Sign In.' });
    }

    // 2. Generate secure 6-digit OTP (10 minutes validity)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = String(Date.now() + 10 * 60 * 1000);

    let userId = existing ? existing.id : null;

    if (existing) {
      // Update unverified user record with fresh credentials and OTP
      try {
        await executeMySQL(
          'UPDATE users SET name = ?, phone = ?, password = ?, email_otp = ?, email_otp_expires = ? WHERE id = ?',
          [cleanName, cleanPhone, passwordHash, otp, expiresAt, existing.id]
        );
      } catch (e) {}
      try {
        db.prepare('UPDATE users SET name = ?, phone = ?, password = ?, email_otp = ?, email_otp_expires = ? WHERE id = ?')
          .run(cleanName, cleanPhone, passwordHash, otp, expiresAt, existing.id);
      } catch (e) {}
    } else {
      // Create new unverified user in MySQL
      try {
        const myRes = await executeMySQL(
          'INSERT INTO users (name, email, phone, password, role, is_verified, email_otp, email_otp_expires) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [cleanName, cleanEmail, cleanPhone, passwordHash, 'CUSTOMER', 0, otp, expiresAt]
        );
        userId = myRes ? myRes.insertId : Date.now();
      } catch (e) {
        userId = Date.now();
      }

      try {
        db.prepare('INSERT OR REPLACE INTO users (id, name, email, phone, password, role, is_verified, email_otp, email_otp_expires) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(userId, cleanName, cleanEmail, cleanPhone, passwordHash, 'CUSTOMER', 0, otp, expiresAt);
      } catch (e) {}
    }

    // In-memory cache fallback
    otpStore.set(cleanEmail, {
      otp,
      expiresAt: Number(expiresAt),
      userData: { id: userId, name: cleanName, email: cleanEmail, phone: cleanPhone, passwordHash }
    });

    console.log(`🔑 Registration OTP for ${cleanEmail}: [${otp}]`);

    // 3. Send HTML email with verification code directly to user's inbox
    const emailSent = await sendEmailNotification(
      cleanEmail,
      'Your ValueLife Essentials Account Verification Code',
      `<div style="font-family: Arial, sans-serif; padding: 25px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; max-width: 500px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #164e3f; margin: 0; font-size: 24px;">🌿 ValueLife Essentials</h2>
          <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Pure Farm-Fresh 100% Organic & Ayurvedic Living</p>
        </div>
        <h3 style="color: #1e293b; margin-bottom: 10px; font-size: 18px;">Email Verification Code</h3>
        <p style="font-size: 14px; color: #475569; line-height: 1.5;">Hello <strong>${cleanName}</strong>,</p>
        <p style="font-size: 14px; color: #475569; line-height: 1.5;">Thank you for registering at ValueLife Essentials! Please use the following 6-digit verification code to activate your account:</p>
        <div style="font-size: 34px; font-weight: 900; color: #164e3f; background: #f0fdf4; border: 2px dashed #164e3f; padding: 18px 24px; text-align: center; border-radius: 14px; letter-spacing: 8px; margin: 24px 0; font-family: monospace;">
          ${otp}
        </div>
        <p style="font-size: 13px; color: #64748b;">⏱️ This verification code is valid for <strong>10 minutes</strong>.</p>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 20px;">For your security, never share this code with anyone. If you did not create an account, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center;">ValueLife Essentials • ${process.env.STORE_EMAIL || 'valuelifesupport@gmail.com'} • ${process.env.STORE_PHONE || '+91 78931 00755'}</p>
      </div>`
    );

    // If email could not be sent (e.g. SMTP credentials not yet provided or failed), auto-verify so customer is not trapped!
    if (!emailSent) {
      try {
        await executeMySQL('UPDATE users SET is_verified = 1, email_otp = NULL, email_otp_expires = NULL WHERE id = ?', [userId]);
      } catch (e) {}
      try {
        db.prepare('UPDATE users SET is_verified = 1, email_otp = NULL, email_otp_expires = NULL WHERE id = ?').run(userId);
      } catch (e) {}
      otpStore.delete(cleanEmail);

      const customerUser = {
        id: userId,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        role: 'CUSTOMER',
        address: '',
        is_verified: 1
      };

      console.log(`✅ Auto-verified customer account (email delivery unconfigured/offline): ${cleanEmail} (ID: ${userId})`);

      return res.status(200).json({
        success: true,
        requireOtp: false,
        user: customerUser,
        message: 'Account created and verified successfully!'
      });
    }

    // Email was successfully delivered - require OTP verification
    res.status(200).json({
      success: true,
      requireOtp: true,
      email: cleanEmail,
      emailSent: true,
      message: `Account created! 6-digit verification code sent directly to ${cleanEmail}. Valid for 10 minutes.`
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: err.message || 'Registration failed' });
  }
});

// POST Verify Registration OTP & Activate Account
router.post('/api/auth/verify-registration-otp', rateLimiter(25, 60000), async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email address and 6-digit OTP code are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    // 1. Query MySQL first
    let user = null;
    try {
      const myRows = await executeMySQL('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);
      if (myRows && myRows.length > 0) user = myRows[0];
    } catch (e) {}

    if (!user) {
      try {
        user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(cleanEmail);
      } catch (e) {}
    }

    if (!user) {
      return res.status(404).json({ error: 'Registration record not found for this email address. Please register again.' });
    }

    // 2. Already verified check
    if (user.is_verified === 1) {
      const activeUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role || 'CUSTOMER',
        is_verified: 1
      };
      return res.json({
        success: true,
        message: 'Account is already verified!',
        user: activeUser
      });
    }

    // 3. Verify OTP against MySQL (or in-memory cache)
    const memEntry = otpStore.get(cleanEmail);
    const validOtp = user.email_otp || (memEntry ? memEntry.otp : null);

    if (!validOtp || String(validOtp).trim() !== cleanOtp) {
      return res.status(400).json({ error: 'Invalid 6-digit verification code. Please check your email inbox.' });
    }

    // 4. Check OTP Expiry
    const expiry = user.email_otp_expires ? Number(user.email_otp_expires) : (memEntry ? memEntry.expiresAt : 0);
    if (expiry && Date.now() > expiry) {
      return res.status(400).json({ error: 'Verification code has expired (10-minute limit). Please click "Resend OTP Code".' });
    }

    // 5. Activate Account in MySQL & SQLite
    try {
      await executeMySQL('UPDATE users SET is_verified = 1, email_otp = NULL, email_otp_expires = NULL WHERE id = ?', [user.id]);
    } catch (e) {}
    try {
      db.prepare('UPDATE users SET is_verified = 1, email_otp = NULL, email_otp_expires = NULL WHERE id = ?').run(user.id);
    } catch (e) {}

    otpStore.delete(cleanEmail);

    const activeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role || 'CUSTOMER',
      is_verified: 1
    };

    console.log(`✅ Customer Account Verified & Activated: ${cleanEmail} (ID: ${user.id})`);

    res.json({
      success: true,
      message: 'Email verified & account activated successfully!',
      user: activeUser
    });
  } catch (err) {
    console.error('Verify registration error:', err);
    res.status(500).json({ error: err.message || 'Verification failed' });
  }
});

// POST Resend Registration OTP
router.post('/api/auth/resend-otp', rateLimiter(10, 60000), async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email address is required.' });

    const cleanEmail = String(email).trim().toLowerCase();

    let user = null;
    try {
      const myRows = await executeMySQL('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);
      if (myRows && myRows.length > 0) user = myRows[0];
    } catch (e) {}

    if (!user) {
      try {
        user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(cleanEmail);
      } catch (e) {}
    }

    if (!user) {
      return res.status(404).json({ error: 'No account registration found for this email address.' });
    }

    if (user.is_verified === 1) {
      return res.status(400).json({ error: 'Your account is already verified! Please Sign In.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = String(Date.now() + 10 * 60 * 1000);

    try {
      await executeMySQL('UPDATE users SET email_otp = ?, email_otp_expires = ? WHERE id = ?', [otp, expiresAt, user.id]);
    } catch (e) {}
    try {
      db.prepare('UPDATE users SET email_otp = ?, email_otp_expires = ? WHERE id = ?').run(otp, expiresAt, user.id);
    } catch (e) {}

    otpStore.set(cleanEmail, { otp, expiresAt: Number(expiresAt) });
    console.log(`🔑 Resend OTP for ${cleanEmail}: [${otp}]`);

    const emailSent = await sendEmailNotification(
      cleanEmail,
      'Your New ValueLife Verification Code',
      `<div style="font-family: Arial, sans-serif; padding: 25px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #164e3f; margin: 0;">🌿 ValueLife Essentials</h2>
        <p style="font-size: 14px; color: #475569;">Hello <strong>${user.name}</strong>,</p>
        <p style="font-size: 14px; color: #475569;">Your new 6-digit verification code is:</p>
        <div style="font-size: 34px; font-weight: 900; color: #164e3f; background: #f0fdf4; border: 2px dashed #164e3f; padding: 18px 24px; text-align: center; border-radius: 14px; letter-spacing: 8px; margin: 24px 0; font-family: monospace;">
          ${otp}
        </div>
        <p style="font-size: 13px; color: #64748b;">⏱️ Valid for 10 minutes.</p>
      </div>`
    );

    if (!emailSent) {
      try {
        await executeMySQL('UPDATE users SET is_verified = 1, email_otp = NULL, email_otp_expires = NULL WHERE id = ?', [user.id]);
      } catch (e) {}
      try {
        db.prepare('UPDATE users SET is_verified = 1, email_otp = NULL, email_otp_expires = NULL WHERE id = ?').run(user.id);
      } catch (e) {}
      otpStore.delete(cleanEmail);

      return res.json({
        success: true,
        autoVerified: true,
        message: 'Account auto-verified! You can now Sign In directly with your password.'
      });
    }

    res.json({ success: true, message: `Fresh verification code sent to ${cleanEmail}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Customer Login
router.post('/api/auth/login', rateLimiter(20, 60000), async (req, res) => {
  try {
    const { identifier, email, phone, password } = req.body;
    const searchId = String(identifier || email || phone || '').trim().toLowerCase();
    const cleanPass = String(password || '').trim();

    if (!searchId || !cleanPass) {
      return res.status(400).json({ error: 'Email/Phone and password are required' });
    }

    let users = [];
    const cleanSearchPhone = sanitize10DigitPhone(searchId);
    try {
      users = await executeMySQL(
        'SELECT * FROM users WHERE LOWER(email) = ? OR phone = ? OR (phone != "" AND phone = ?)', 
        [searchId, searchId, cleanSearchPhone || 'NON_EXISTENT']
      );
    } catch (e) {}

    if (!users || users.length === 0) {
      try {
        const row = db.prepare(
          'SELECT * FROM users WHERE LOWER(email) = ? OR phone = ? OR (phone != "" AND phone = ?)'
        ).get(searchId, searchId, cleanSearchPhone || 'NON_EXISTENT');
        if (row) users = [row];
      } catch (e) {}
    }

    if (!users || users.length === 0) {
      return res.status(401).json({ error: 'No account found with this email or phone' });
    }

    const user = users[0];
    const valid = verifyPassword(cleanPass, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // Check if account is verified
    if (user.is_verified === 0) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = String(Date.now() + 10 * 60 * 1000);
      try {
        await executeMySQL('UPDATE users SET email_otp = ?, email_otp_expires = ? WHERE id = ?', [otp, expiresAt, user.id]);
      } catch (e) {}
      try {
        db.prepare('UPDATE users SET email_otp = ?, email_otp_expires = ? WHERE id = ?').run(otp, expiresAt, user.id);
      } catch (e) {}
      otpStore.set(user.email.toLowerCase(), { otp, expiresAt: Number(expiresAt) });
      console.log(`🔑 Login verification OTP for ${user.email}: [${otp}]`);

      const emailSent = await sendEmailNotification(
        user.email,
        'ValueLife Account Verification Code',
        `<p>Your 6-digit verification code is: <b>${otp}</b>. It expires in 10 minutes.</p>`
      );

      if (!emailSent) {
        // If email service is offline or unconfigured, auto-verify so customer is not locked out
        try {
          await executeMySQL('UPDATE users SET is_verified = 1, email_otp = NULL, email_otp_expires = NULL WHERE id = ?', [user.id]);
        } catch (e) {}
        try {
          db.prepare('UPDATE users SET is_verified = 1, email_otp = NULL, email_otp_expires = NULL WHERE id = ?').run(user.id);
        } catch (e) {}
        user.is_verified = 1;
        console.log(`✅ Auto-verified customer during login (email delivery offline): ${user.email}`);
      } else {
        return res.json({
          success: true,
          requireOtp: true,
          email: user.email,
          message: 'Your account is not verified yet. We have sent a verification code to your email.'
        });
      }
    }

    let userAddress = user.address || '';
    if (!userAddress) {
      try {
        const prevOrder = await executeMySQL(
          'SELECT shipping_address FROM orders WHERE (user_id = ? OR LOWER(customer_email) = ? OR customer_phone = ?) AND shipping_address IS NOT NULL AND shipping_address != "" ORDER BY id DESC LIMIT 1',
          [user.id, (user.email || '').toLowerCase(), user.phone || '']
        );
        if (prevOrder && prevOrder.length > 0 && prevOrder[0].shipping_address) {
          userAddress = prevOrder[0].shipping_address;
          await executeMySQL('UPDATE users SET address = ? WHERE id = ?', [userAddress, user.id]);
        }
      } catch (e) {}
    }

    const customerUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role || 'CUSTOMER',
      address: userAddress,
      is_verified: 1
    };

    res.json({ success: true, user: customerUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Customer Profile (with full address, city, state, pincode, gstin)
router.get('/api/users/:email/profile', async (req, res) => {
  try {
    const identifier = String(req.params.email || '').trim().toLowerCase();
    let users = [];
    try {
      users = await executeMySQL(
        'SELECT id, name, email, phone, role, address, city, state, pincode, gstin_number, business_name, is_verified FROM users WHERE LOWER(email) = ? OR phone = ? OR id = ?',
        [identifier, identifier, identifier]
      );
    } catch (e) {}

    if (!users || users.length === 0) {
      try {
        const row = db.prepare(
          'SELECT id, name, email, phone, role, address, city, state, pincode, gstin_number, business_name, is_verified FROM users WHERE LOWER(email) = ? OR phone = ? OR id = ?'
        ).get(identifier, identifier, identifier);
        if (row) users = [row];
      } catch (e) {}
    }

    if (!users || !users[0]) return res.status(404).json({ error: 'User not found' });
    const u = users[0];

    // Fallback: If address fields are empty, check latest order
    if (!u.address || !u.city || !u.pincode) {
      try {
        const prevOrder = await executeMySQL(
          'SELECT shipping_address, shipping_city, shipping_state, shipping_pincode FROM orders WHERE (user_id = ? OR LOWER(customer_email) = ? OR customer_phone = ?) AND shipping_address IS NOT NULL AND shipping_address != "" ORDER BY id DESC LIMIT 1',
          [u.id, (u.email || '').toLowerCase(), u.phone || '']
        );
        if (prevOrder && prevOrder.length > 0) {
          const ord = prevOrder[0];
          if (!u.address && ord.shipping_address) u.address = ord.shipping_address;
          if (!u.city && ord.shipping_city) u.city = ord.shipping_city;
          if (!u.state && ord.shipping_state) u.state = ord.shipping_state;
          if (!u.pincode && ord.shipping_pincode) u.pincode = ord.shipping_pincode;

          await executeMySQL(
            'UPDATE users SET address = ?, city = ?, state = ?, pincode = ? WHERE id = ?',
            [u.address || '', u.city || '', u.state || 'Maharashtra', u.pincode || '', u.id]
          );
        }
      } catch (e) {}
    }

    res.json({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone || '',
      role: u.role || 'CUSTOMER',
      address: u.address || '',
      city: u.city || '',
      state: u.state || 'Maharashtra',
      pincode: u.pincode || '',
      gstin_number: u.gstin_number || '',
      business_name: u.business_name || '',
      is_verified: u.is_verified ?? 1
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Customer Profile (Persists name, phone, address, city, state, pincode, gstin)
router.put('/api/users/:email/profile', async (req, res) => {
  try {
    const identifier = String(req.params.email || '').trim().toLowerCase();
    const { 
      name, 
      phone, 
      address, 
      city = '', 
      state = 'Maharashtra', 
      pincode = '', 
      gstin_number = '', 
      business_name = '' 
    } = req.body;

    const cleanPhone = phone ? sanitize10DigitPhone(phone) : null;

    // 1. Check if user already exists
    let existing = null;
    try {
      const rows = await executeMySQL('SELECT id FROM users WHERE LOWER(email) = ? OR phone = ? OR id = ?', [identifier, identifier, identifier]);
      if (rows && rows.length > 0) existing = rows[0];
    } catch (e) {}

    if (!existing) {
      try {
        const row = db.prepare('SELECT id FROM users WHERE LOWER(email) = ? OR phone = ? OR id = ?').get(identifier, identifier, identifier);
        if (row) existing = row;
      } catch (e) {}
    }

    if (!existing) {
      // User doesn't exist yet: insert fresh record
      const userEmail = identifier.includes('@') ? identifier : (req.body.email || `${identifier}@valuelifeessentials.com`);
      const userPhone = cleanPhone || (!identifier.includes('@') ? sanitize10DigitPhone(identifier) : '');
      const userName = name || userEmail.split('@')[0];

      try {
        await executeMySQL(
          `INSERT INTO users (name, email, phone, address, city, state, pincode, gstin_number, business_name, role, is_verified) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'CUSTOMER', 1)`,
          [userName, userEmail, userPhone, address || '', city || '', state || 'Maharashtra', pincode || '', gstin_number || '', business_name || '']
        );
      } catch (e) {
        try {
          await executeMySQL(
            'INSERT INTO users (name, email, phone, address, role, is_verified) VALUES (?, ?, ?, ?, "CUSTOMER", 1)',
            [userName, userEmail, userPhone, address || '']
          );
        } catch (e2) {}
      }

      try {
        db.prepare(
          `INSERT OR REPLACE INTO users (name, email, phone, address, city, state, pincode, gstin_number, business_name, role, is_verified) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'CUSTOMER', 1)`
        ).run(userName, userEmail, userPhone, address || '', city || '', state || 'Maharashtra', pincode || '', gstin_number || '', business_name || '');
      } catch (e) {}
    } else {
      // User exists: perform update in MySQL
      try {
        await executeMySQL(
          `UPDATE users SET 
            name = COALESCE(?, name), 
            phone = COALESCE(?, phone), 
            address = COALESCE(?, address),
            city = COALESCE(?, city),
            state = COALESCE(?, state),
            pincode = COALESCE(?, pincode),
            gstin_number = COALESCE(?, gstin_number),
            business_name = COALESCE(?, business_name)
          WHERE LOWER(email) = ? OR phone = ? OR id = ?`,
          [name, cleanPhone, address, city, state, pincode, gstin_number, business_name, identifier, identifier, identifier]
        );
      } catch (e) {
        try {
          await executeMySQL(
            'UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), address = COALESCE(?, address) WHERE LOWER(email) = ? OR phone = ? OR id = ?',
            [name, cleanPhone, address, identifier, identifier, identifier]
          );
        } catch (e2) {}
      }

      // Perform update in SQLite
      try {
        db.prepare(`
          UPDATE users SET 
            name = COALESCE(?, name), 
            phone = COALESCE(?, phone), 
            address = COALESCE(?, address),
            city = COALESCE(?, city),
            state = COALESCE(?, state),
            pincode = COALESCE(?, pincode),
            gstin_number = COALESCE(?, gstin_number),
            business_name = COALESCE(?, business_name)
          WHERE LOWER(email) = ? OR phone = ? OR id = ?
        `).run(name, cleanPhone, address, city, state, pincode, gstin_number, business_name, identifier, identifier, identifier);
      } catch (e) {
        try {
          db.prepare('UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), address = COALESCE(?, address) WHERE LOWER(email) = ? OR phone = ? OR id = ?')
            .run(name, cleanPhone, address, identifier, identifier, identifier);
        } catch (e2) {}
      }
    }

    // Fetch updated user to return clean object
    let updated = null;
    try {
      const rows = await executeMySQL('SELECT id, name, email, phone, role, address, city, state, pincode, gstin_number, business_name FROM users WHERE LOWER(email) = ? OR phone = ? OR id = ?', [identifier, identifier, identifier]);
      if (rows && rows.length > 0) updated = rows[0];
    } catch (e) {}

    if (!updated) {
      try {
        updated = db.prepare('SELECT id, name, email, phone, role, address, city, state, pincode, gstin_number, business_name FROM users WHERE LOWER(email) = ? OR phone = ? OR id = ?').get(identifier, identifier, identifier);
      } catch (e) {}
    }

    res.json({ 
      success: true, 
      message: 'Profile and address updated successfully',
      user: updated || { name, phone, address, city, state, pincode, gstin_number, business_name }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Change Password
router.post('/api/auth/change-password', async (req, res) => {
  try {
    const { email, current_password, new_password } = req.body;
    if (!email || !current_password || !new_password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const cleanEmail = email.toLowerCase();
    let users = [];
    try {
      users = await executeMySQL('SELECT password FROM users WHERE LOWER(email) = ?', [cleanEmail]);
    } catch (e) {}

    if (!users || users.length === 0) {
      try {
        const row = db.prepare('SELECT password FROM users WHERE LOWER(email) = ?').get(cleanEmail);
        if (row) users = [row];
      } catch (e) {}
    }

    if (!users || users.length === 0 || !verifyPassword(current_password, users[0].password)) {
      return res.status(401).json({ error: 'Current password incorrect' });
    }

    const newHash = hashPassword(new_password);
    try {
      await executeMySQL('UPDATE users SET password = ? WHERE LOWER(email) = ?', [newHash, cleanEmail]);
    } catch (e) {}
    try {
      db.prepare('UPDATE users SET password = ? WHERE LOWER(email) = ?').run(newHash, cleanEmail);
    } catch (e) {}

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Forgot Password (Request OTP via Email/Phone)
router.post('/api/auth/forgot-password', rateLimiter(10, 60000), async (req, res) => {
  try {
    const search = String(req.body.email || req.body.email_or_phone || req.body.identifier || req.body.phone || '').trim().toLowerCase();
    if (!search) return res.status(400).json({ error: 'Registered Email or Phone number is required' });

    let users = [];
    try {
      users = await executeMySQL('SELECT id, name, email, phone FROM users WHERE LOWER(email) = ? OR phone = ?', [search, search]);
    } catch (e) {}

    if (!users || users.length === 0) {
      try {
        const row = db.prepare('SELECT id, name, email, phone FROM users WHERE LOWER(email) = ? OR phone = ?').get(search, search);
        if (row) users = [row];
      } catch (e) {}
    }

    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'No account found with this email or mobile number' });
    }

    const user = users[0];
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = String(Date.now() + 10 * 60 * 1000);

    try {
      await executeMySQL('UPDATE users SET email_otp = ?, email_otp_expires = ? WHERE id = ?', [otp, expiresAt, user.id]);
    } catch (e) {}
    try {
      db.prepare('UPDATE users SET email_otp = ?, email_otp_expires = ? WHERE id = ?').run(otp, expiresAt, user.id);
    } catch (e) {}

    const cleanEmail = (user.email || '').toLowerCase();
    otpStore.set(`reset_${cleanEmail}`, { otp, expiresAt: Number(expiresAt), userId: user.id });
    if (user.phone) {
      otpStore.set(`reset_${user.phone}`, { otp, expiresAt: Number(expiresAt), userId: user.id });
    }

    console.log(`🔑 Password reset OTP for ${user.email} (${user.phone}): [${otp}]`);

    await sendEmailNotification(
      user.email,
      'ValueLife Password Reset Code',
      `<div style="font-family: Arial, sans-serif; padding: 25px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #164e3f; margin: 0;">🌿 ValueLife Essentials</h2>
        <h3 style="color: #1e293b; margin-top: 10px;">Password Reset Request</h3>
        <p style="font-size: 14px; color: #475569;">Hello <strong>${user.name}</strong>,</p>
        <p style="font-size: 14px; color: #475569;">Your 6-digit password reset code is:</p>
        <div style="font-size: 34px; font-weight: 900; color: #164e3f; background: #f0fdf4; border: 2px dashed #164e3f; padding: 18px 24px; text-align: center; border-radius: 14px; letter-spacing: 8px; margin: 24px 0; font-family: monospace;">
          ${otp}
        </div>
        <p style="font-size: 13px; color: #64748b;">⏱️ Valid for 10 minutes. If you did not request this, please ignore this email.</p>
      </div>`
    );

    res.json({ 
      success: true, 
      email: user.email, 
      phone: user.phone || '',
      // SECURITY: OTP is never returned in the response. It must be sent via email/SMS only.
      message: `Password reset OTP dispatched to ${user.email}. Valid for 10 minutes.` 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Reset Password (With OTP & auto-login support)
router.post('/api/auth/reset-password', async (req, res) => {
  try {
    const rawSearch = req.body.email || req.body.email_or_phone || req.body.identifier || req.body.phone || '';
    const cleanSearch = String(rawSearch).trim().toLowerCase();
    const cleanOtp = String(req.body.otp || req.body.pin || '').trim();
    const newPassword = String(req.body.new_password || req.body.password || '').trim();

    if (!cleanSearch || !cleanOtp || !newPassword) {
      return res.status(400).json({ error: 'Email or Mobile Number, 6-digit OTP code, and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    let users = [];
    try {
      users = await executeMySQL('SELECT * FROM users WHERE LOWER(email) = ? OR phone = ?', [cleanSearch, cleanSearch]);
    } catch (e) {}

    if (!users || users.length === 0) {
      try {
        const row = db.prepare('SELECT * FROM users WHERE LOWER(email) = ? OR phone = ?').get(cleanSearch, cleanSearch);
        if (row) users = [row];
      } catch (e) {}
    }

    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'No user account found with this email or mobile number.' });
    }

    const user = users[0];
    const cleanEmail = (user.email || '').toLowerCase();
    const memEntry = otpStore.get(`reset_${cleanEmail}`) || (user.phone ? otpStore.get(`reset_${user.phone}`) : null);
    const validOtp = user.email_otp || (memEntry ? memEntry.otp : null);

    if (!validOtp || String(validOtp).trim() !== cleanOtp) {
      return res.status(400).json({ error: 'Invalid 6-digit verification code. Please check your email or request a new code.' });
    }

    const expiry = user.email_otp_expires ? Number(user.email_otp_expires) : (memEntry ? memEntry.expiresAt : 0);
    if (expiry && Date.now() > expiry) {
      return res.status(400).json({ error: 'Password reset code has expired. Please request a new code.' });
    }

    const newHash = hashPassword(newPassword);
    try {
      await executeMySQL('UPDATE users SET password = ?, is_verified = 1, email_otp = NULL, email_otp_expires = NULL WHERE id = ?', [newHash, user.id]);
    } catch (e) {}
    try {
      db.prepare('UPDATE users SET password = ?, is_verified = 1, email_otp = NULL, email_otp_expires = NULL WHERE id = ?').run(newHash, user.id);
    } catch (e) {}

    otpStore.delete(`reset_${cleanEmail}`);
    if (user.phone) otpStore.delete(`reset_${user.phone}`);

    const activeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role || 'CUSTOMER',
      address: user.address || '',
      city: user.city || '',
      state: user.state || 'Maharashtra',
      pincode: user.pincode || '',
      is_verified: 1
    };

    res.json({ 
      success: true, 
      message: 'Password reset successfully! Your new password is now active.',
      user: activeUser
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
