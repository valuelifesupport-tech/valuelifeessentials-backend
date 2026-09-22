const requiredVars = ['ADMIN_SECRET_KEY', 'ADMIN_PASSWORD', 'PASSWORD_SALT', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'];
const missing = requiredVars.filter(v => !process.env[v]);
if (missing.length) {
  console.error(`FATAL: Missing required env vars: ${missing.join(', ')}. Create server/.env — see .env.example`);
  process.exit(1);
}

module.exports = {
  PORT: process.env.PORT || 5000,
  ADMIN_SECRET_KEY: process.env.ADMIN_SECRET_KEY,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  PASSWORD_SALT: process.env.PASSWORD_SALT,
  MAINTENANCE_PASSWORD: process.env.MAINTENANCE_PASSWORD || '',
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  CUSTOMER_JWT_SECRET: process.env.CUSTOMER_JWT_SECRET || process.env.ADMIN_SECRET_KEY,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:5000',
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || '',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || '',
  INSTAGRAM_URL: process.env.INSTAGRAM_URL || '',
  STORE_GSTIN: process.env.STORE_GSTIN || '',
  STORE_STATE: process.env.STORE_STATE || '',
  SUPPORT_PHONE: process.env.SUPPORT_PHONE || '',
  WHATSAPP_NUMBER: process.env.WHATSAPP_NUMBER || '',
};
