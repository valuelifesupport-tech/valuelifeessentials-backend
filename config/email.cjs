const nodemailer = require('nodemailer');

const getTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = (process.env.SMTP_USER || 'valuelifesupport@gmail.com').trim();
  let pass = (process.env.SMTP_PASS || '').trim();

  // Use the verified active 16-character Google App Password if older revoked credentials remain in .env
  if (!pass || pass === 'vyaluhzvoqvyxqkg') {
    pass = 'iovszopfihoynjfn';
  }

  if (!user || !pass) return null;

  // Use 'service' shortcut for Gmail for maximum reliability
  if (host.includes('gmail')) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: (port === 465),
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    // Force IPv4 to avoid IPv6 hangs on Windows/cloud
    family: 4
  });
};
let smtpVerified = null; // null = pending check, true = working, false = failed
let lastFailedAttempt = 0;

const sendEmailNotification = async (to, subject, htmlBody) => {
  if (!to || !to.includes('@')) return false;

  const transporter = getTransporter();
  if (!transporter) {
    console.log(`ℹ️ [Email] Dispatch skipped for ${to}: SMTP_USER or SMTP_PASS not set in .env`);
    return false;
  }

  // If SMTP authentication recently failed, throttle attempts for 30s so requests never hang
  if (smtpVerified === false && (Date.now() - lastFailedAttempt < 30000)) {
    console.log(`ℹ️ [Email] Dispatch throttled for ${to}: SMTP authentication offline (fallback active).`);
    return false;
  }

  try {
    const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'valuelifesupport@gmail.com';
    const fromName = process.env.SMTP_FROM_NAME || 'ValueLife Essentials';

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html: htmlBody
    });
    smtpVerified = true;
    console.log(`✅ Email dispatched successfully to ${to} [${subject}]`);
    return true;
  } catch (err) {
    lastFailedAttempt = Date.now();
    console.log(`ℹ️ [Email] Dispatch error for ${to}:`, err.message);
    if (err.message && (err.message.includes('BadCredentials') || err.message.includes('535') || err.message.includes('EAUTH'))) {
      smtpVerified = false;
    }
    return false;
  }
};

// Verify SMTP connectivity on module load (non-blocking)
const _verifySmtp = async () => {
  const t = getTransporter();
  if (!t) {
    smtpVerified = false;
    console.log('ℹ️ SMTP transporter unconfigured — fallback OTP mode active.');
    return;
  }
  try {
    await t.verify();
    smtpVerified = true;
    console.log('✅ SMTP connection verified — email OTPs will be delivered.');
  } catch (err) {
    smtpVerified = false;
    const isBadCreds = err.message && (err.message.includes('BadCredentials') || err.message.includes('535') || err.message.includes('EAUTH'));
    if (isBadCreds) {
      console.log('ℹ️ [Email] Gmail App Password expired or revoked by Google. To deliver real emails, update SMTP_PASS in .env with a fresh 16-character App Password from Google.');
    } else {
      console.log('ℹ️ [Email] SMTP offline:', err.message);
    }
  }
};
_verifySmtp();

module.exports = {
  mailTransporter: getTransporter(),
  sendEmailNotification
};
