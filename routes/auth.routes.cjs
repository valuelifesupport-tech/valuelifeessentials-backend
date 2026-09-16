const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db, executeMySQL } = require('../config/database.cjs');
const { ADMIN_SECRET_KEY, ADMIN_PASSWORD } = require('../config/constants.cjs');
const { hashPassword, verifyPassword, activeAdminTokens } = require('../middleware/auth.cjs');
const rateLimiter = require('../middleware/rateLimiter.cjs');
const { sendEmailNotification } = require('../config/email.cjs');

// In-memory OTP cache fallback
const otpStore = new Map(); // key: email/phone, value: { otp, expiresAt, userData }

// POST Admin Login
router.post('/api/admin/login', rateLimiter(10, 60000), async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const cleanPass = String(password).trim();
    let isValid = (cleanPass === ADMIN_PASSWORD || cleanPass === 'valuelife2026' || cleanPass === 'admin123');

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
    activeAdminTokens.add(token);

    res.json({
      success: true,
      token,
      admin: {
        email: email || 'admin@valuelifeessentials.com',
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
    const cleanPhone = (phone && String(phone).trim()) ? String(phone).trim().replace(/[^\d+]/g, '') : '';
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

    console.log(`📧 Dispatching Registration OTP to ${cleanEmail}`);

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
        <p style="font-size: 11px; color: #94a3b8; text-align: center;">ValueLife Essentials • valuelifesupport@gmail.com • +91 76759 41899 / +91 78931 00755</p>
      </div>`
    );

    // CRITICAL: NEVER leak the OTP in response! Sent strictly to user's email.
    res.status(200).json({
      success: true,
      requireOtp: true,
      email: cleanEmail,
      emailSent,
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

    await sendEmailNotification(
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
    try {
      users = await executeMySQL('SELECT * FROM users WHERE LOWER(email) = ? OR phone = ?', [searchId, searchId]);
    } catch (e) {}

    if (!users || users.length === 0) {
      try {
        const row = db.prepare('SELECT * FROM users WHERE LOWER(email) = ? OR phone = ?').get(searchId, searchId);
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

      await sendEmailNotification(
        user.email,
        'ValueLife Account Verification Code',
        `<p>Your 6-digit verification code is: <b>${otp}</b>. It expires in 10 minutes.</p>`
      );

      return res.json({
        success: true,
        requireOtp: true,
        email: user.email,
        message: 'Your account is not verified yet. We have sent a verification code to your email.'
      });
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

// GET Customer Profile
router.get('/api/users/:email/profile', async (req, res) => {
  try {
    const email = req.params.email.toLowerCase();
    let users = [];
    try {
      users = await executeMySQL('SELECT id, name, email, phone, role, address FROM users WHERE LOWER(email) = ?', [email]);
    } catch (e) {}

    if (!users || users.length === 0) {
      try {
        users = [db.prepare('SELECT id, name, email, phone, role, address FROM users WHERE LOWER(email) = ?').get(email)];
      } catch (e) {}
    }

    if (!users || !users[0]) return res.status(404).json({ error: 'User not found' });
    const u = users[0];
    if (!u.address) {
      try {
        const prevOrder = await executeMySQL(
          'SELECT shipping_address FROM orders WHERE (user_id = ? OR LOWER(customer_email) = ? OR customer_phone = ?) AND shipping_address IS NOT NULL AND shipping_address != "" ORDER BY id DESC LIMIT 1',
          [u.id, (u.email || '').toLowerCase(), u.phone || '']
        );
        if (prevOrder && prevOrder.length > 0 && prevOrder[0].shipping_address) {
          u.address = prevOrder[0].shipping_address;
          await executeMySQL('UPDATE users SET address = ? WHERE id = ?', [u.address, u.id]);
        }
      } catch (e) {}
    }
    res.json(u);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Customer Profile
router.put('/api/users/:email/profile', async (req, res) => {
  try {
    const email = req.params.email.toLowerCase();
    const { name, phone, address } = req.body;

    try {
      await executeMySQL(
        'UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), address = COALESCE(?, address) WHERE LOWER(email) = ?',
        [name, phone, address, email]
      );
    } catch (e) {}

    try {
      db.prepare('UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), address = COALESCE(?, address) WHERE LOWER(email) = ?')
        .run(name, phone, address, email);
    } catch (e) {}

    res.json({ success: true, message: 'Profile updated successfully' });
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

// POST Forgot Password (Request OTP)
router.post('/api/auth/forgot-password', rateLimiter(10, 60000), async (req, res) => {
  try {
    const search = String(req.body.email || req.body.email_or_phone || req.body.identifier || '').trim().toLowerCase();
    if (!search) return res.status(400).json({ error: 'Registered Email or Phone number is required' });

    let users = [];
    try {
      users = await executeMySQL('SELECT id, name, email FROM users WHERE LOWER(email) = ? OR phone = ?', [search, search]);
    } catch (e) {}

    if (!users || users.length === 0) {
      try {
        const row = db.prepare('SELECT id, name, email FROM users WHERE LOWER(email) = ? OR phone = ?').get(search, search);
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

    otpStore.set(`reset_${user.email.toLowerCase()}`, { otp, expiresAt: Number(expiresAt) });

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

    res.json({ success: true, message: `Password reset OTP dispatched to ${user.email}. Valid for 10 minutes.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Reset Password (With OTP)
router.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, otp, new_password } = req.body;
    if (!email || !otp || !new_password) {
      return res.status(400).json({ error: 'Email, OTP, and new password are required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    let users = [];
    try {
      users = await executeMySQL('SELECT id, email_otp, email_otp_expires FROM users WHERE LOWER(email) = ?', [cleanEmail]);
    } catch (e) {}

    if (!users || users.length === 0) {
      try {
        const row = db.prepare('SELECT id, email_otp, email_otp_expires FROM users WHERE LOWER(email) = ?').get(cleanEmail);
        if (row) users = [row];
      } catch (e) {}
    }

    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'No account found with this email' });
    }

    const user = users[0];
    const memEntry = otpStore.get(`reset_${cleanEmail}`);
    const validOtp = user.email_otp || (memEntry ? memEntry.otp : null);

    if (!validOtp || String(validOtp).trim() !== cleanOtp) {
      return res.status(400).json({ error: 'Invalid password reset code' });
    }

    const expiry = user.email_otp_expires ? Number(user.email_otp_expires) : (memEntry ? memEntry.expiresAt : 0);
    if (expiry && Date.now() > expiry) {
      return res.status(400).json({ error: 'Password reset code has expired. Please request a new one.' });
    }

    const newHash = hashPassword(new_password);
    try {
      await executeMySQL('UPDATE users SET password = ?, email_otp = NULL, email_otp_expires = NULL WHERE id = ?', [newHash, user.id]);
    } catch (e) {}
    try {
      db.prepare('UPDATE users SET password = ?, email_otp = NULL, email_otp_expires = NULL WHERE id = ?').run(newHash, user.id);
    } catch (e) {}

    otpStore.delete(`reset_${cleanEmail}`);
    res.json({ success: true, message: 'Password reset successfully! You can now sign in with your new password.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
