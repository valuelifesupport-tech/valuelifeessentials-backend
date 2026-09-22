if (!process.env.ADMIN_SECRET_KEY) console.warn("WARNING: ADMIN_SECRET_KEY is not set in env. Using insecure default.");
if (!process.env.ADMIN_PASSWORD) console.warn("WARNING: ADMIN_PASSWORD is not set in env. Using insecure default.");
if (!process.env.PASSWORD_SALT) console.warn("WARNING: PASSWORD_SALT is not set in env. Using insecure default.");
if (!process.env.RAZORPAY_KEY_ID) console.warn("WARNING: RAZORPAY_KEY_ID is not set in env.");
if (!process.env.RAZORPAY_KEY_SECRET) console.warn("WARNING: RAZORPAY_KEY_SECRET is not set in env.");

module.exports = {
  PORT: process.env.PORT || 5000,
  ADMIN_SECRET_KEY: process.env.ADMIN_SECRET_KEY || 'valuelife_admin_sec_2026_x890',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'valuelife2026',
  PASSWORD_SALT: process.env.PASSWORD_SALT || 'valuelife_salt_2026',
  MAINTENANCE_PASSWORD: process.env.MAINTENANCE_PASSWORD || 'valuelife2026',
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || 'rzp_live_Tf0pnP0D2dQz4M',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '5Tg6D8eMZ6q7LLQKXGH0auM2'
};

