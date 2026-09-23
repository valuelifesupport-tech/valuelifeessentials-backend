const nodemailer = require('nodemailer');

const getTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465');
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();

  if (!user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: (port === 465),
    auth: { user, pass }
  });
};

const sendEmailNotification = async (to, subject, htmlBody) => {
  if (!to || !to.includes('@')) return false;

  const transporter = getTransporter();
  if (!transporter) {
    console.warn(`⚠️ Email dispatch skipped for ${to}: SMTP_USER or SMTP_PASS not set in .env`);
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
    console.log(`✅ Email dispatched successfully to ${to} [${subject}]`);
    return true;
  } catch (err) {
    console.warn(`⚠️ Email dispatch error for ${to}:`, err.message);
    return false;
  }
};

module.exports = {
  mailTransporter: getTransporter(),
  sendEmailNotification
};
