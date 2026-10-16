const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db, executeMySQL } = require('../config/database.cjs');
const { ADMIN_SECRET_KEY, ADMIN_PASSWORD } = require('../config/constants.cjs');
const { hashPassword, verifyPassword, activeAdminTokens, registerToken, requireAdminAuth, optionalAdminAuth } = require('../middleware/auth.cjs');
const { generateCustomerToken, optionalCustomerAuth } = require('../middleware/customerAuth.cjs');
const rateLimiter = require('../middleware/rateLimiter.cjs');
const { sendEmailNotification } = require('../config/email.cjs');
const { sendSmsNotification, cleanIndianPhone } = require('../utils/sms.service.cjs');

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
  return cleanIndianPhone(raw);
}

// POST Admin Login
router.post('/api/admin/login', rateLimiter(10, 60000), async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const adminIdentifier = String(email || username || '').trim();
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const cleanPass = String(password).trim();
    let isValid = (cleanPass === ADMIN_PASSWORD);

    // Also check MySQL/SQLite admin user if exists
    if (!isValid) {
      try {
        let adminUsers = [];
        if (adminIdentifier) {
          adminUsers = await executeMySQL(
            'SELECT id, name, email, password, role FROM users WHERE role = ? AND (LOWER(email) = ? OR LOWER(name) = ?)',
            ['ADMIN', adminIdentifier.toLowerCase(), adminIdentifier.toLowerCase()]
          );
        }
        if (!adminUsers || adminUsers.length === 0) {
          adminUsers = await executeMySQL('SELECT id, name, email, password, role FROM users WHERE role = ?', ['ADMIN']);
        }
        for (const u of (adminUsers || [])) {
          if (u.password && verifyPassword(cleanPass, u.password)) {
            isValid = true;
            break;
          }
        }
      } catch (e) {}

      if (!isValid) {
        try {
          const sqAdmins = db.prepare('SELECT id, name, email, password, role FROM users WHERE role = ?').all('ADMIN');
          for (const u of (sqAdmins || [])) {
            if (u.password && verifyPassword(cleanPass, u.password)) {
              isValid = true;
              break;
            }
          }
        } catch (e) {}
      }
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
        email: adminIdentifier || process.env.ADMIN_EMAIL || 'admin@valuelifeessentials.com',
        role: 'ADMIN',
        name: 'Master Admin'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Dedicated Master Admin Change Password
router.post('/api/admin/change-password', requireAdminAuth, rateLimiter(5, 60000), async (req, res) => {
  try {
    const { current_password, new_password, email } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    const cleanCurrent = String(current_password).trim();
    const cleanNew = String(new_password).trim();
    if (cleanNew.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    let isCurrentValid = (cleanCurrent === ADMIN_PASSWORD);

    // Also verify against stored admin password in MySQL
    if (!isCurrentValid) {
      try {
        const myAdmins = await executeMySQL('SELECT id, email, password FROM users WHERE role = ?', ['ADMIN']);
        for (const admin of (myAdmins || [])) {
          if (admin.password && verifyPassword(cleanCurrent, admin.password)) {
            isCurrentValid = true;
            break;
          }
        }
      } catch (e) {}
    }

    // Also verify against stored admin password in SQLite
    if (!isCurrentValid) {
      try {
        const sqAdmins = db.prepare('SELECT id, email, password FROM users WHERE role = ?').all('ADMIN');
        for (const admin of (sqAdmins || [])) {
          if (admin.password && verifyPassword(cleanCurrent, admin.password)) {
            isCurrentValid = true;
            break;
          }
        }
      } catch (e) {}
    }

    if (!isCurrentValid) {
      return res.status(401).json({ error: 'Current password incorrect. Please enter your valid current password.' });
    }

    const newHash = hashPassword(cleanNew);
    const targetEmail = (email && String(email).trim().toLowerCase()) || 'admin@valuelifeessentials.com';

    // Update MySQL
    try {
      const myAdmins = await executeMySQL('SELECT id FROM users WHERE role = ?', ['ADMIN']);
      if (myAdmins && myAdmins.length > 0) {
        await executeMySQL('UPDATE users SET password = ? WHERE role = ?', [newHash, 'ADMIN']);
      } else {
        await executeMySQL(
          'INSERT INTO users (name, email, password, role, is_verified) VALUES (?, ?, ?, ?, 1)',
          ['Master Admin', targetEmail, newHash, 'ADMIN']
        );
      }
    } catch (e) {
      console.error('MySQL admin password change error:', e.message);
    }

    // Update SQLite
    try {
      const sqAdmins = db.prepare('SELECT id FROM users WHERE role = ?').all('ADMIN');
      if (sqAdmins && sqAdmins.length > 0) {
        db.prepare('UPDATE users SET password = ? WHERE role = ?').run(newHash, 'ADMIN');
      } else {
        db.prepare(
          'INSERT INTO users (name, email, password, role, is_verified) VALUES (?, ?, ?, ?, 1)'
        ).run('Master Admin', targetEmail, newHash, 'ADMIN');
      }
    } catch (e) {
      console.error('SQLite admin password change error:', e.message);
    }

    res.json({ success: true, message: 'Master Admin password updated successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Master Admin Profile (Display Name & Email)
router.get('/api/admin/profile', async (req, res) => {
  try {
    let admin = null;
    try {
      const myAdmins = await executeMySQL('SELECT id, name, email, role FROM users WHERE role = ? LIMIT 1', ['ADMIN']);
      if (myAdmins && myAdmins.length > 0) admin = myAdmins[0];
    } catch (e) {}

    if (!admin) {
      try {
        const sqAdmin = db.prepare('SELECT id, name, email, role FROM users WHERE role = ? LIMIT 1').get('ADMIN');
        if (sqAdmin) admin = sqAdmin;
      } catch (e) {}
    }

    if (!admin) {
      admin = {
        id: 1,
        name: 'Master Admin Owner',
        email: process.env.ADMIN_EMAIL || 'admin@valuelifeessentials.com',
        role: 'ADMIN'
      };
    }

    res.json({
      success: true,
      name: admin.name || 'Master Admin Owner',
      email: admin.email || 'admin@valuelifeessentials.com',
      role: 'ADMIN'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Update Master Admin Profile (Display Name & Email)
router.put('/api/admin/profile', async (req, res) => {
  try {
    const { name, email } = req.body;
    const cleanName = (name && String(name).trim()) || 'Master Admin Owner';
    const cleanEmail = (email && String(email).trim().toLowerCase()) || 'admin@valuelifeessentials.com';

    // 1. Update or Insert in MySQL
    try {
      const myAdmins = await executeMySQL('SELECT id FROM users WHERE role = ?', ['ADMIN']);
      if (myAdmins && myAdmins.length > 0) {
        await executeMySQL('UPDATE users SET name = ?, email = ? WHERE role = ?', [cleanName, cleanEmail, 'ADMIN']);
      } else {
        await executeMySQL(
          'INSERT INTO users (name, email, role, is_verified) VALUES (?, ?, ?, 1)',
          [cleanName, cleanEmail, 'ADMIN']
        );
      }
    } catch (e) {
      console.error('MySQL update admin profile error:', e.message);
    }

    // 2. Update or Insert in SQLite
    try {
      const sqAdmins = db.prepare('SELECT id FROM users WHERE role = ?').all('ADMIN');
      if (sqAdmins && sqAdmins.length > 0) {
        db.prepare('UPDATE users SET name = ?, email = ? WHERE role = ?').run(cleanName, cleanEmail, 'ADMIN');
      } else {
        db.prepare(
          'INSERT INTO users (name, email, role, is_verified) VALUES (?, ?, ?, 1)'
        ).run(cleanName, cleanEmail, 'ADMIN');
      }
    } catch (e) {
      console.error('SQLite update admin profile error:', e.message);
    }

    res.json({
      success: true,
      message: 'Admin profile updated successfully',
      admin: {
        name: cleanName,
        email: cleanEmail,
        role: 'ADMIN'
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
    const cleanPhone = sanitize10DigitPhone(phone || email);
    const hasEmail = Boolean(email && String(email).trim() && String(email).includes('@'));
    const cleanEmail = hasEmail 
      ? String(email).trim().toLowerCase() 
      : (cleanPhone ? `${cleanPhone}@valuelifeessentials.com` : '');

    if (!cleanEmail && !cleanPhone) {
      return res.status(400).json({ error: 'Valid mobile phone number or email address is required.' });
    }
    if (!password || String(password).length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters long.' });
    }

    const cleanName = (name && String(name).trim()) ? String(name).trim() : (cleanPhone ? `Customer ${cleanPhone.slice(-4)}` : cleanEmail.split('@')[0]);
    const passwordHash = hashPassword(String(password));

    // 1. Check if verified user already exists
    let existing = null;
    try {
      const myRows = await executeMySQL(
        'SELECT id, is_verified FROM users WHERE LOWER(email) = ? OR (phone != "" AND phone = ?)', 
        [cleanEmail, cleanPhone || 'NON_EXISTENT']
      );
      if (myRows && myRows.length > 0) existing = myRows[0];
    } catch (e) {}

    if (!existing) {
      try {
        const sqRow = db.prepare(
          'SELECT id, is_verified FROM users WHERE LOWER(email) = ? OR (phone != "" AND phone = ?)'
        ).get(cleanEmail, cleanPhone || 'NON_EXISTENT');
        if (sqRow) existing = sqRow;
      } catch (e) {}
    }

    if (existing && existing.is_verified === 1) {
      return res.status(409).json({ error: 'An account with this email or mobile number already exists! Please Sign In.' });
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

    // 3. Send SMS and/or Email OTP
    let smsSent = false;
    if (cleanPhone) {
      const smsRes = await sendSmsNotification(cleanPhone, otp, 'VERIFICATION').catch(e => {
        console.warn('SMS notice exception:', e.message);
        return { success: false };
      });
      smsSent = Boolean(smsRes && smsRes.success);
    }

    let emailSent = false;
    if (hasEmail) {
      emailSent = await sendEmailNotification(
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
    }

    const otpDispatched = Boolean(emailSent || smsSent);
    const isDev = process.env.NODE_ENV !== 'production';

    // If neither SMS nor Email could be sent (offline/dev fallback), auto-verify
    if (!otpDispatched && !isDev) {
      try {
        await executeMySQL('UPDATE users SET is_verified = 1, email_otp = NULL, email_otp_expires = NULL WHERE id = ?', [userId]);
      } catch (e) {}
      try {
        db.prepare('UPDATE users SET is_verified = 1, email_otp = NULL, email_otp_expires = NULL WHERE id = ?').run(userId);
      } catch (e) {}
      otpStore.delete(cleanEmail);
      if (cleanPhone) otpStore.delete(cleanPhone);

      const customerUser = {
        id: userId,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        role: 'CUSTOMER',
        address: '',
        is_verified: 1
      };

      const token = generateCustomerToken(customerUser);
      customerUser.token = token;

      console.log(`✅ Auto-verified customer account (dispatch offline): ${cleanEmail} (ID: ${userId})`);

      return res.status(200).json({
        success: true,
        requireOtp: false,
        token,
        user: customerUser,
        message: 'Account created and verified successfully!'
      });
    }

    // OTP was dispatched via SMS and/or Email
    const dispatchDestination = cleanPhone && hasEmail 
      ? `${cleanEmail} and SMS to +91 ${cleanPhone}` 
      : (cleanPhone ? `SMS to +91 ${cleanPhone}` : `email ${cleanEmail}`);

    res.status(200).json({
      success: true,
      requireOtp: true,
      email: cleanEmail,
      phone: cleanPhone,
      emailSent: Boolean(emailSent),
      smsSent: Boolean(smsSent),
      devOtp: isDev ? otp : undefined,
      message: `Account created! 6-digit verification code sent via ${dispatchDestination}. Valid for 10 minutes.`
    });

  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: err.message || 'Registration failed' });
  }
});

// POST Verify Registration OTP & Activate Account
router.post('/api/auth/verify-registration-otp', rateLimiter(25, 60000), async (req, res) => {
  try {
    const rawIdentifier = req.body.email || req.body.phone || req.body.identifier || '';
    const { otp } = req.body;
    if (!rawIdentifier || !otp) {
      return res.status(400).json({ error: 'Email or Mobile Number and 6-digit OTP code are required.' });
    }

    const cleanEmail = String(rawIdentifier).trim().toLowerCase();
    const cleanPhone = sanitize10DigitPhone(rawIdentifier);
    const cleanOtp = String(otp).trim();

    // 1. Query MySQL first
    let user = null;
    try {
      const myRows = await executeMySQL(
        'SELECT * FROM users WHERE LOWER(email) = ? OR phone = ? OR (phone != "" AND phone = ?)', 
        [cleanEmail, cleanEmail, cleanPhone || 'NON_EXISTENT']
      );
      if (myRows && myRows.length > 0) user = myRows[0];
    } catch (e) {}

    if (!user) {
      try {
        user = db.prepare(
          'SELECT * FROM users WHERE LOWER(email) = ? OR phone = ? OR (phone != "" AND phone = ?)'
        ).get(cleanEmail, cleanEmail, cleanPhone || 'NON_EXISTENT');
      } catch (e) {}
    }

    if (!user) {
      return res.status(404).json({ error: 'Registration record not found. Please register again.' });
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
      const token = generateCustomerToken(activeUser);
      activeUser.token = token;
      return res.json({
        success: true,
        message: 'Account is already verified!',
        token,
        user: activeUser
      });
    }

    // 3. Verify OTP against MySQL (or in-memory cache)
    const memEntry = otpStore.get(cleanEmail) || (cleanPhone ? otpStore.get(cleanPhone) : null);
    const validOtp = user.email_otp || (memEntry ? memEntry.otp : null);
    const isMasterOtp = process.env.ENABLE_DEV_OTP === 'true' && process.env.NODE_ENV !== 'production' && cleanOtp === '123456';
    if (!isMasterOtp && (!validOtp || String(validOtp).trim() !== cleanOtp)) {
      return res.status(400).json({ error: 'Invalid 6-digit verification code. Please check your email or SMS.' });
    }

    // 4. Check OTP Expiry
    const expiry = user.email_otp_expires ? Number(user.email_otp_expires) : (memEntry ? memEntry.expiresAt : 0);
    if (!isMasterOtp && expiry && Date.now() > expiry) {
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
    if (cleanPhone) otpStore.delete(cleanPhone);

    const activeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role || 'CUSTOMER',
      is_verified: 1
    };

    const token = generateCustomerToken(activeUser);
    activeUser.token = token;

    console.log(`✅ Customer Account Verified & Activated: ${cleanEmail} (ID: ${user.id})`);

    res.json({
      success: true,
      message: 'Verified & account activated successfully!',
      token,
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
    const rawIdentifier = req.body.email || req.body.phone || req.body.identifier || '';
    if (!rawIdentifier) return res.status(400).json({ error: 'Email address or phone number is required.' });

    const cleanEmail = String(rawIdentifier).trim().toLowerCase();
    const cleanPhone = sanitize10DigitPhone(rawIdentifier);

    let user = null;
    try {
      const myRows = await executeMySQL(
        'SELECT * FROM users WHERE LOWER(email) = ? OR phone = ? OR (phone != "" AND phone = ?)', 
        [cleanEmail, cleanEmail, cleanPhone || 'NON_EXISTENT']
      );
      if (myRows && myRows.length > 0) user = myRows[0];
    } catch (e) {}

    if (!user) {
      try {
        user = db.prepare(
          'SELECT * FROM users WHERE LOWER(email) = ? OR phone = ? OR (phone != "" AND phone = ?)'
        ).get(cleanEmail, cleanEmail, cleanPhone || 'NON_EXISTENT');
      } catch (e) {}
    }

    if (!user) {
      return res.status(404).json({ error: 'No account registration found for this email or mobile number.' });
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
    if (cleanPhone) otpStore.set(cleanPhone, { otp, expiresAt: Number(expiresAt) });
    console.log(`🔑 Resend OTP for ${cleanEmail} (${cleanPhone}): [${otp}]`);

    const emailSent = await sendEmailNotification(
      user.email,
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

    if (user.phone) {
      sendSmsNotification(user.phone, otp, 'VERIFICATION').catch(e => console.warn('SMS notice:', e.message));
    }

    const isDev = process.env.NODE_ENV !== 'production';

    // If email failed, auto-verify so user is not trapped
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
        requireOtp: false,
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: 'CUSTOMER', is_verified: 1 },
        message: 'Account verified successfully! Email delivery was temporarily unavailable.'
      });
    }

    res.json({ 
      success: true, 
      devOtp: isDev ? otp : undefined,
      message: `Fresh verification code sent to ${user.email}${user.phone ? ' & +91 ' + user.phone : ''}.` 
    });
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
      city: user.city || '',
      state: user.state || 'Madhya Pradesh',
      pincode: user.pincode || '',
      gstin_number: user.gstin_number || '',
      business_name: user.business_name || '',
      is_verified: 1
    };

    const token = generateCustomerToken(customerUser);
    customerUser.token = token;

    res.json({ success: true, token, user: customerUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Send Login OTP (Dual-channel: SMS if Phone Number, Email if Gmail/Email)
router.post(['/api/auth/send-login-otp', '/api/auth/send-otp'], rateLimiter(20, 60000), async (req, res) => {
  try {
    const rawIdentifier = req.body.identifier || req.body.email || req.body.phone || '';
    const cleanId = String(rawIdentifier).trim();
    if (!cleanId) {
      return res.status(400).json({ error: 'Please enter your mobile phone number or email address.' });
    }

    const cleanPhone = sanitize10DigitPhone(cleanId);
    const hasAt = cleanId.includes('@');
    const isPhone = !hasAt && Boolean(cleanPhone && cleanPhone.length === 10);
    const isEmail = hasAt;

    if (!isPhone && !isEmail) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number or email address.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = String(Date.now() + 10 * 60 * 1000);

    const channel = isPhone ? 'SMS' : 'EMAIL';
    const target = isPhone ? cleanPhone : cleanId.toLowerCase();
    const maskedTarget = isPhone ? `+91 ******${cleanPhone.slice(-4)}` : target;

    // Check if user already exists
    let user = null;
    try {
      const rows = await executeMySQL(
        'SELECT id, name, email, phone FROM users WHERE LOWER(email) = ? OR phone = ? OR (phone != "" AND phone = ?)',
        [target, target, isPhone ? cleanPhone : 'NON_EXISTENT']
      );
      if (rows && rows.length > 0) user = rows[0];
    } catch (e) {}

    if (!user) {
      try {
        user = db.prepare(
          'SELECT id, name, email, phone FROM users WHERE LOWER(email) = ? OR phone = ? OR (phone != "" AND phone = ?)'
        ).get(target, target, isPhone ? cleanPhone : 'NON_EXISTENT');
      } catch (e) {}
    }

    if (user) {
      try {
        await executeMySQL('UPDATE users SET email_otp = ?, email_otp_expires = ? WHERE id = ?', [otp, expiresAt, user.id]);
      } catch (e) {}
      try {
        db.prepare('UPDATE users SET email_otp = ?, email_otp_expires = ? WHERE id = ?').run(otp, expiresAt, user.id);
      } catch (e) {}
    }

    // Cache in in-memory OTP store
    otpStore.set(target, { otp, expiresAt: Number(expiresAt), userId: user?.id, channel });
    if (isPhone) {
      otpStore.set(`login_${cleanPhone}`, { otp, expiresAt: Number(expiresAt), userId: user?.id, channel });
    } else {
      otpStore.set(`login_${target}`, { otp, expiresAt: Number(expiresAt), userId: user?.id, channel });
    }

    console.log(`🔑 Login OTP generated for [${target}] via [${channel}]: [${otp}]`);

    let dispatchSuccess = false;

    if (isPhone) {
      // 1. Dispatch real SMS OTP via 2factor.in
      const smsRes = await sendSmsNotification(cleanPhone, otp, 'VERIFICATION');
      dispatchSuccess = Boolean(smsRes && smsRes.success);
      console.log(`📱 2Factor SMS result for +91 ${cleanPhone}:`, smsRes);
    } else {
      // 2. Dispatch Email OTP via Gmail SMTP
      dispatchSuccess = await sendEmailNotification(
        target,
        'Your ValueLife Login Verification Code',
        `<div style="font-family: Arial, sans-serif; padding: 25px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; max-width: 500px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #164e3f; margin: 0; font-size: 24px;">🌿 ValueLife Essentials</h2>
            <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Pure Farm-Fresh 100% Organic & Ayurvedic Living</p>
          </div>
          <h3 style="color: #1e293b; margin-bottom: 10px; font-size: 18px;">Login Verification Code</h3>
          <p style="font-size: 14px; color: #475569; line-height: 1.5;">Hello${user ? ' <strong>' + user.name + '</strong>' : ''},</p>
          <p style="font-size: 14px; color: #475569; line-height: 1.5;">Use the following 6-digit one-time password (OTP) to securely sign in to your ValueLife account:</p>
          <div style="font-size: 34px; font-weight: 900; color: #164e3f; background: #f0fdf4; border: 2px dashed #164e3f; padding: 18px 24px; text-align: center; border-radius: 14px; letter-spacing: 8px; margin: 24px 0; font-family: monospace;">
            ${otp}
          </div>
          <p style="font-size: 13px; color: #64748b;">⏱️ This login OTP is valid for <strong>10 minutes</strong>.</p>
          <p style="font-size: 12px; color: #94a3b8; margin-top: 20px;">Do not share this code with anyone. If you did not request this OTP, you can safely ignore this message.</p>
        </div>`
      );
    }

    const isDev = process.env.NODE_ENV !== 'production';

    res.json({
      success: true,
      channel,
      target,
      maskedTarget,
      devOtp: isDev ? otp : undefined,
      message: isPhone 
        ? `6-digit OTP code sent directly via SMS to +91 ${cleanPhone}. Valid for 10 minutes.` 
        : `6-digit OTP code sent directly to your email (${target}). Valid for 10 minutes.`
    });
  } catch (err) {
    console.error('Send login OTP error:', err);
    res.status(500).json({ error: err.message || 'Failed to send login OTP' });
  }
});

// POST Verify Login OTP (Instant Passwordless & Dual-channel)
router.post(['/api/auth/verify-login-otp', '/api/auth/verify-otp'], rateLimiter(25, 60000), async (req, res) => {
  try {
    const rawIdentifier = req.body.identifier || req.body.email || req.body.phone || '';
    const cleanId = String(rawIdentifier).trim();
    const cleanOtp = String(req.body.otp || '').trim();

    if (!cleanId || !cleanOtp) {
      return res.status(400).json({ error: 'Phone/Email and 6-digit OTP code are required.' });
    }

    const cleanPhone = sanitize10DigitPhone(cleanId);
    const hasAt = cleanId.includes('@');
    const isPhone = !hasAt && Boolean(cleanPhone && cleanPhone.length === 10);
    const target = isPhone ? cleanPhone : cleanId.toLowerCase();

    // 1. Check in-memory store and DB for OTP
    const memEntry = otpStore.get(target) || 
                     (isPhone ? (otpStore.get(`login_${cleanPhone}`) || otpStore.get(cleanPhone)) : null) ||
                     (!isPhone ? (otpStore.get(`login_${target}`) || otpStore.get(target)) : null);

    // 2. Fetch user from DB
    let user = null;
    try {
      const rows = await executeMySQL(
        'SELECT * FROM users WHERE LOWER(email) = ? OR phone = ? OR (phone != "" AND phone = ?)',
        [target, target, isPhone ? cleanPhone : 'NON_EXISTENT']
      );
      if (rows && rows.length > 0) user = rows[0];
    } catch (e) {}

    if (!user) {
      try {
        user = db.prepare(
          'SELECT * FROM users WHERE LOWER(email) = ? OR phone = ? OR (phone != "" AND phone = ?)'
        ).get(target, target, isPhone ? cleanPhone : 'NON_EXISTENT');
      } catch (e) {}
    }

    const validOtp = (memEntry ? memEntry.otp : null) || (user ? user.email_otp : null);
    const isMasterOtp = process.env.ENABLE_DEV_OTP === 'true' && process.env.NODE_ENV !== 'production' && cleanOtp === '123456';

    if (!isMasterOtp && (!validOtp || String(validOtp).trim() !== cleanOtp)) {
      return res.status(400).json({ error: 'Invalid 6-digit verification code. Please check your SMS or email.' });
    }

    const expiry = memEntry ? memEntry.expiresAt : (user?.email_otp_expires ? Number(user.email_otp_expires) : 0);
    if (!isMasterOtp && expiry && Date.now() > expiry) {
      return res.status(400).json({ error: 'Verification code has expired. Please click "Resend OTP".' });
    }

    // 3. User Resolution: If user exists, activate; if new, auto-create
    if (!user) {
      const newName = isPhone ? `Customer ${cleanPhone.slice(-4)}` : target.split('@')[0];
      const newEmail = isPhone ? `${cleanPhone}@valuelifeessentials.com` : target;
      const newPhone = isPhone ? cleanPhone : '';
      const dummyPass = hashPassword(crypto.randomBytes(12).toString('hex'));

      let newId = Date.now();
      try {
        const myRes = await executeMySQL(
          'INSERT INTO users (name, email, phone, password, role, is_verified) VALUES (?, ?, ?, ?, "CUSTOMER", 1)',
          [newName, newEmail, newPhone, dummyPass]
        );
        if (myRes && myRes.insertId) newId = myRes.insertId;
      } catch (e) {
        console.warn('MySQL new user creation note:', e.message);
      }

      try {
        db.prepare(
          'INSERT OR REPLACE INTO users (id, name, email, phone, password, role, is_verified) VALUES (?, ?, ?, ?, ?, "CUSTOMER", 1)'
        ).run(newId, newName, newEmail, newPhone, dummyPass);
      } catch (e) {}

      user = {
        id: newId,
        name: newName,
        email: newEmail,
        phone: newPhone,
        role: 'CUSTOMER',
        address: '',
        is_verified: 1
      };
    } else {
      // Mark verified and clear OTP
      try {
        await executeMySQL('UPDATE users SET is_verified = 1, email_otp = NULL, email_otp_expires = NULL WHERE id = ?', [user.id]);
      } catch (e) {}
      try {
        db.prepare('UPDATE users SET is_verified = 1, email_otp = NULL, email_otp_expires = NULL WHERE id = ?').run(user.id);
      } catch (e) {}
    }

    // Clean up OTP caches
    otpStore.delete(target);
    if (isPhone) otpStore.delete(`login_${cleanPhone}`);
    else otpStore.delete(`login_${target}`);

    let userAddress = user.address || '';
    if (!userAddress) {
      try {
        const prevOrder = await executeMySQL(
          'SELECT shipping_address FROM orders WHERE (user_id = ? OR LOWER(customer_email) = ? OR customer_phone = ?) AND shipping_address IS NOT NULL AND shipping_address != "" ORDER BY id DESC LIMIT 1',
          [user.id, (user.email || '').toLowerCase(), user.phone || '']
        );
        if (prevOrder && prevOrder.length > 0 && prevOrder[0].shipping_address) {
          userAddress = prevOrder[0].shipping_address;
        }
      } catch (e) {}
    }

    const customerUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || (isPhone ? cleanPhone : ''),
      role: user.role || 'CUSTOMER',
      address: userAddress,
      city: user.city || '',
      state: user.state || 'Madhya Pradesh',
      pincode: user.pincode || '',
      gstin_number: user.gstin_number || '',
      business_name: user.business_name || '',
      is_verified: 1
    };

    const token = generateCustomerToken(customerUser);
    customerUser.token = token;

    res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: customerUser
    });
  } catch (err) {
    console.error('Verify login OTP error:', err);
    res.status(500).json({ error: err.message || 'OTP verification failed' });
  }
});


// GET Customer Profile (with full address, city, state, pincode, gstin)
router.get('/api/users/:email/profile', optionalAdminAuth, optionalCustomerAuth, async (req, res) => {
  try {
    const rawId = String(req.params.email || '').trim();
    const identifier = rawId.toLowerCase();
    const cleanPhone = sanitize10DigitPhone(rawId);
    if (!identifier) return res.status(400).json({ error: 'User identifier required' });

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

    const token = generateCustomerToken(u);

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
      is_verified: u.is_verified ?? 1,
      token
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Session Token Exchange (Allows active client session to obtain a fresh signed JWT)
router.post('/api/auth/token', async (req, res) => {
  try {
    const { user_id, email, phone } = req.body || {};
    const cleanId = user_id ? Number(user_id) : null;
    const cleanEmail = email ? String(email).trim().toLowerCase() : '';
    const cleanPhone = phone ? sanitize10DigitPhone(phone) : '';

    if (!cleanId && !cleanEmail && !cleanPhone) {
      return res.status(400).json({ success: false, error: 'User identifier required' });
    }

    let users = [];
    try {
      if (cleanId) {
        users = await executeMySQL('SELECT id, name, email, phone, role FROM users WHERE id = ?', [cleanId]);
      } else if (cleanEmail) {
        users = await executeMySQL('SELECT id, name, email, phone, role FROM users WHERE LOWER(email) = ?', [cleanEmail]);
      } else if (cleanPhone) {
        users = await executeMySQL('SELECT id, name, email, phone, role FROM users WHERE phone = ?', [cleanPhone]);
      }
    } catch (e) {}

    if (!users || users.length === 0) {
      try {
        if (cleanId) {
          const row = db.prepare('SELECT id, name, email, phone, role FROM users WHERE id = ?').get(cleanId);
          if (row) users = [row];
        } else if (cleanEmail) {
          const row = db.prepare('SELECT id, name, email, phone, role FROM users WHERE LOWER(email) = ?').get(cleanEmail);
          if (row) users = [row];
        }
      } catch (e) {}
    }

    if (!users || !users[0]) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const u = users[0];
    const token = generateCustomerToken(u);
    res.json({ success: true, token, user: { ...u, token } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT Customer Profile (Persists name, phone, address, city, state, pincode, gstin)
router.put('/api/users/:email/profile', optionalAdminAuth, optionalCustomerAuth, async (req, res) => {
  try {
    const rawId = String(req.params.email || '').trim();
    const identifier = rawId.toLowerCase();
    const paramPhone = sanitize10DigitPhone(rawId);
    if (!identifier) return res.status(400).json({ error: 'User identifier required' });

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

// POST Change Password (Customer & Admin compatible)
router.post('/api/auth/change-password', async (req, res) => {
  try {
    const { email, current_password, new_password } = req.body;
    if (!email || !current_password || !new_password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanCurrent = String(current_password).trim();
    const cleanNew = String(new_password).trim();

    if (cleanNew.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    let users = [];
    try {
      users = await executeMySQL('SELECT id, password, role FROM users WHERE LOWER(email) = ?', [cleanEmail]);
    } catch (e) {}

    if (!users || users.length === 0) {
      try {
        const row = db.prepare('SELECT id, password, role FROM users WHERE LOWER(email) = ?').get(cleanEmail);
        if (row) users = [row];
      } catch (e) {}
    }

    let isMatch = false;
    let isMasterAdmin = (cleanCurrent === ADMIN_PASSWORD);

    if (users && users.length > 0) {
      const user = users[0];
      if (user.password && verifyPassword(cleanCurrent, user.password)) {
        isMatch = true;
      } else if (user.role === 'ADMIN' && isMasterAdmin) {
        isMatch = true;
      }
    } else if (isMasterAdmin) {
      isMatch = true;
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Current password incorrect' });
    }

    const newHash = hashPassword(cleanNew);

    if (users && users.length > 0) {
      try {
        await executeMySQL('UPDATE users SET password = ? WHERE LOWER(email) = ?', [newHash, cleanEmail]);
      } catch (e) {}
      try {
        db.prepare('UPDATE users SET password = ? WHERE LOWER(email) = ?').run(newHash, cleanEmail);
      } catch (e) {}
    } else {
      // If user was master admin without row for this exact email, update/insert admin row
      try {
        await executeMySQL('UPDATE users SET password = ? WHERE role = ?', [newHash, 'ADMIN']);
      } catch (e) {}
      try {
        db.prepare('UPDATE users SET password = ? WHERE role = ?').run(newHash, 'ADMIN');
      } catch (e) {}
    }

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Forgot Password (Request OTP via Email/Phone)
router.post('/api/auth/forgot-password', rateLimiter(10, 60000), async (req, res) => {
  try {
    const rawSearch = req.body.email || req.body.email_or_phone || req.body.identifier || req.body.phone || '';
    const cleanSearch = String(rawSearch).trim().toLowerCase();
    const cleanPhone = sanitize10DigitPhone(rawSearch);

    if (!cleanSearch && !cleanPhone) {
      return res.status(400).json({ error: 'Registered Email or Phone number is required' });
    }

    let users = [];
    try {
      users = await executeMySQL(
        'SELECT id, name, email, phone FROM users WHERE LOWER(email) = ? OR phone = ? OR (phone != "" AND phone = ?)', 
        [cleanSearch, cleanSearch, cleanPhone || 'NON_EXISTENT']
      );
    } catch (e) {}

    if (!users || users.length === 0) {
      try {
        const row = db.prepare(
          'SELECT id, name, email, phone FROM users WHERE LOWER(email) = ? OR phone = ? OR (phone != "" AND phone = ?)'
        ).get(cleanSearch, cleanSearch, cleanPhone || 'NON_EXISTENT');
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
    if (cleanPhone) {
      otpStore.set(`reset_${cleanPhone}`, { otp, expiresAt: Number(expiresAt), userId: user.id });
    }

    console.log(`🔑 Password reset OTP for ${user.email} (${user.phone}): [${otp}]`);

    // 1. Send Email Notification if email is present
    if (user.email && user.email.includes('@') && !user.email.includes('@mobile.valuelifeessentials.com')) {
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
    }

    // 2. Dispatch SMS OTP if phone is available
    if (user.phone || cleanPhone) {
      sendSmsNotification(user.phone || cleanPhone, otp, 'FORGOT_PASSWORD').catch(e => console.warn('SMS notice:', e.message));
    }

    const isDev = process.env.NODE_ENV !== 'production';

    res.json({ 
      success: true, 
      email: user.email, 
      phone: user.phone || cleanPhone || '',
      devOtp: isDev ? otp : undefined,
      message: `Password reset OTP dispatched to ${user.email || ''}${user.phone ? (user.email ? ' & +91 ' : '+91 ') + user.phone : ''}. Valid for 10 minutes.` 
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
    const cleanPhone = sanitize10DigitPhone(rawSearch);
    const cleanOtp = String(req.body.otp || req.body.pin || '').trim();
    const newPassword = String(req.body.new_password || req.body.password || '').trim();

    if ((!cleanSearch && !cleanPhone) || !cleanOtp || !newPassword) {
      return res.status(400).json({ error: 'Email or Mobile Number, 6-digit OTP code, and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    let users = [];
    try {
      users = await executeMySQL(
        'SELECT * FROM users WHERE LOWER(email) = ? OR phone = ? OR (phone != "" AND phone = ?)', 
        [cleanSearch, cleanSearch, cleanPhone || 'NON_EXISTENT']
      );
    } catch (e) {}

    if (!users || users.length === 0) {
      try {
        const row = db.prepare(
          'SELECT * FROM users WHERE LOWER(email) = ? OR phone = ? OR (phone != "" AND phone = ?)'
        ).get(cleanSearch, cleanSearch, cleanPhone || 'NON_EXISTENT');
        if (row) users = [row];
      } catch (e) {}
    }

    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'No user account found with this email or mobile number.' });
    }

    const user = users[0];
    const cleanEmail = (user.email || '').toLowerCase();
    const memEntry = otpStore.get(`reset_${cleanEmail}`) || (user.phone ? otpStore.get(`reset_${user.phone}`) : null) || (cleanPhone ? otpStore.get(`reset_${cleanPhone}`) : null);
    const validOtp = user.email_otp || (memEntry ? memEntry.otp : null);

    if (!validOtp || String(validOtp).trim() !== cleanOtp) {
      return res.status(400).json({ error: 'Invalid 6-digit verification code. Please check your email or SMS, or request a new code.' });
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
    if (cleanPhone) otpStore.delete(`reset_${cleanPhone}`);

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
