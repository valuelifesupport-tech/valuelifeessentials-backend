const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config();

const constants = require('./constants.cjs');

/**
 * Validates and exposes server environment configuration
 */
const env = {
  // App
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'production',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_DEVELOPMENT: process.env.NODE_ENV !== 'production',

  // URLs
  FRONTEND_URL: process.env.FRONTEND_URL || constants.FRONTEND_URL,
  BACKEND_URL: process.env.BACKEND_URL || constants.BACKEND_URL,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://localhost:3000',

  // Database
  DB_TYPE: process.env.DB_TYPE || 'mysql',
  MYSQL_HOST: process.env.MYSQL_HOST || '127.0.0.1',
  MYSQL_PORT: parseInt(process.env.MYSQL_PORT || '3306', 10),
  MYSQL_USER: process.env.MYSQL_USER || '',
  MYSQL_PASSWORD: process.env.MYSQL_PASSWORD || '',
  MYSQL_DATABASE: process.env.MYSQL_DATABASE || '',

  // Auth & Secrets
  ADMIN_SECRET_KEY: process.env.ADMIN_SECRET_KEY || constants.ADMIN_SECRET_KEY,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || constants.ADMIN_PASSWORD,
  PASSWORD_SALT: process.env.PASSWORD_SALT || constants.PASSWORD_SALT,
  MAINTENANCE_PASSWORD: process.env.MAINTENANCE_PASSWORD || constants.MAINTENANCE_PASSWORD,
  CUSTOMER_JWT_SECRET: process.env.CUSTOMER_JWT_SECRET || constants.CUSTOMER_JWT_SECRET,

  // Gateways
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || constants.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || constants.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',

  // Email / SMTP
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '465', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM_NAME: process.env.SMTP_FROM_NAME || 'ValueLife Essentials',
  SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'valuelifesupport@gmail.com',

  // Store Contacts
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || constants.SUPPORT_EMAIL,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || constants.ADMIN_EMAIL,
  SUPPORT_PHONE: process.env.SUPPORT_PHONE || constants.SUPPORT_PHONE,
  WHATSAPP_NUMBER: process.env.WHATSAPP_NUMBER || constants.WHATSAPP_NUMBER,
  STORE_GSTIN: process.env.STORE_GSTIN || constants.STORE_GSTIN,
  STORE_STATE: process.env.STORE_STATE || constants.STORE_STATE,
};

module.exports = env;
