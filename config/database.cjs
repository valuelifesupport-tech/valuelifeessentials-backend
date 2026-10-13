const { setupHostingerMySQL, getMySQLPool } = require('../hostinger-mysql.cjs');
const db = require('../db.cjs');

// Non-blocking MySQL query helper with auto-reconnect retry on ECONNRESET / PROTOCOL_CONNECTION_LOST
async function executeMySQL(sql, params = [], isRetry = false) {
  try {
    const pool = getMySQLPool();
    if (!pool) return null;
    const sanitizedParams = (Array.isArray(params) ? params : []).map(p => p === undefined ? null : p);
    const queryPromise = pool.query(sql, sanitizedParams);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('MySQL Query Timeout')), 3500));
    const [result] = await Promise.race([queryPromise, timeoutPromise]);
    return result;
  } catch (err) {
    const isConnErr = err.code === 'ECONNRESET' ||
                      err.code === 'PROTOCOL_CONNECTION_LOST' ||
                      err.code === 'EPIPE' ||
                      err.code === 'ETIMEDOUT' ||
                      (err.message && (err.message.includes('ECONNRESET') || err.message.includes('Connection lost')));
    if (!isRetry && isConnErr) {
      // Allow pool to drop dead connection and retry on fresh socket
      await new Promise(r => setTimeout(r, 80));
      return executeMySQL(sql, params, true);
    }
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
