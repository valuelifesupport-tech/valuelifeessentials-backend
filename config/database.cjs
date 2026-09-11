const { setupHostingerMySQL, getMySQLPool } = require('../hostinger-mysql.cjs');
const db = require('../db.cjs');

// Non-blocking MySQL query helper with timeout fallback
async function executeMySQL(sql, params = []) {
  try {
    const pool = getMySQLPool();
    if (!pool) return null;
    const queryPromise = pool.query(sql, params);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('MySQL Query Timeout')), 2500));
    const [result] = await Promise.race([queryPromise, timeoutPromise]);
    return result;
  } catch (err) {
    console.warn(`[MySQL Notice] ${String(sql).slice(0, 60)}:`, err.message);
    return null;
  }
}

module.exports = {
  db,
  getMySQLPool,
  executeMySQL,
  setupHostingerMySQL
};
