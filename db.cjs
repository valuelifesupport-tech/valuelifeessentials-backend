/**
 * ValueLife Essentials — Database Module
 * 
 * Thin orchestrator: creates the SQLite connection (or JSON fallback proxy)
 * and runs schema initialization.
 * 
 * Extracted modules:
 *   config/defaults.cjs      — default config objects
 *   config/fallbackStore.cjs  — JSON fallback CRUD proxy
 *   config/schema.cjs         — SQLite schema, migrations, seed data
 */
require('dotenv').config();
const path = require('path');
const { createFallbackDb } = require('./config/fallbackStore.cjs');
const { initDb } = require('./config/schema.cjs');

let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.log('⚠️ better-sqlite3 module not available on Linux. Production MySQL mode active.');
}

const dbPath = path.join(__dirname, 'ecommerce.db');
const db = Database ? new Database(dbPath) : createFallbackDb();

if (Database) {
  try { db.pragma('foreign_keys = ON'); } catch (e) {}
}

if (Database) {
  try {
    initDb(db);
  } catch (err) {
    console.warn('⚠️ SQLite initDb notice:', err.message);
  }
}

module.exports = db;
