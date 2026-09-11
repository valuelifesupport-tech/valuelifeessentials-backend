const { db, executeMySQL } = require('../config/database.cjs');

async function isSkuTaken(sku, excludeProductId = null) {
  if (!sku) return false;
  const cleanSku = String(sku).trim().toUpperCase();

  // 1. Check MySQL
  try {
    let sql1 = 'SELECT id FROM products WHERE UPPER(sku) = ?';
    let params1 = [cleanSku];
    if (excludeProductId) {
      sql1 += ' AND id != ?';
      params1.push(excludeProductId);
    }
    const myProd = await executeMySQL(sql1, params1);
    if (myProd && myProd.length > 0) return true;

    let sql2 = 'SELECT id FROM product_variants WHERE UPPER(sku) = ?';
    let params2 = [cleanSku];
    if (excludeProductId) {
      sql2 += ' AND product_id != ?';
      params2.push(excludeProductId);
    }
    const myVar = await executeMySQL(sql2, params2);
    if (myVar && myVar.length > 0) return true;
  } catch (e) {}

  // 2. Check SQLite
  try {
    let q1 = 'SELECT id FROM products WHERE UPPER(sku) = ?';
    let p1 = [cleanSku];
    if (excludeProductId) {
      q1 += ' AND id != ?';
      p1.push(excludeProductId);
    }
    const r1 = db.prepare(q1).get(...p1);
    if (r1) return true;

    let q2 = 'SELECT id FROM product_variants WHERE UPPER(sku) = ?';
    let p2 = [cleanSku];
    if (excludeProductId) {
      q2 += ' AND product_id != ?';
      p2.push(excludeProductId);
    }
    const r2 = db.prepare(q2).get(...p2);
    if (r2) return true;
  } catch (e) {}

  return false;
}

async function generateUniqueSku(prefix = 'VL') {
  const cleanPrefix = (prefix || 'VL').toUpperCase().slice(0, 4);
  for (let i = 0; i < 50; i++) {
    const candidate = `${cleanPrefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    const taken = await isSkuTaken(candidate);
    if (!taken) return candidate;
  }
  return `${cleanPrefix}-${Date.now().toString().slice(-4)}`;
}

module.exports = {
  isSkuTaken,
  generateUniqueSku
};
