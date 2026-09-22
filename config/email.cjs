const nodemailer = require('nodemailer');

const mailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: (process.env.SMTP_PORT == '465' || !process.env.SMTP_PORT),
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

const sendEmailNotification = async (to, subject, htmlBody) => {
  if (!to || !to.includes('@')) return false;
  try {
    await mailTransporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'ValueLife Essentials'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || ''}>`,
      to,
      subject,
      html: htmlBody
    });
    console.log(`✅ Email dispatched successfully to ${to} [${subject}]`);
    return true;
  } catch (err) {
    console.warn(`⚠️ Email dispatch warning for ${to}:`, err.message);
    return false;
  }
};

module.exports = {
  mailTransporter,
  sendEmailNotification
};
