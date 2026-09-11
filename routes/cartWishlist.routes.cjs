const express = require('express');
const router = express.Router();
const { db, executeMySQL } = require('../config/database.cjs');

// Ensure user_cart and user_wishlist tables exist
async function ensureCartWishlistTables() {
  await executeMySQL(`
    CREATE TABLE IF NOT EXISTS user_cart (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      product_id INT NOT NULL,
      variant_id INT DEFAULT NULL,
      quantity INT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await executeMySQL(`
    CREATE TABLE IF NOT EXISTS user_wishlist (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      product_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
ensureCartWishlistTables().catch(() => {});

// GET Cart
router.get('/api/cart', async (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) return res.json([]);
    const rows = await executeMySQL('SELECT * FROM user_cart WHERE user_id = ?', [userId]) || [];
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Cart (Upsert / Sync)
router.post('/api/cart', async (req, res) => {
  try {
    const { user_id, product_id, variant_id = null, quantity = 1 } = req.body;
    if (!user_id || !product_id) return res.status(400).json({ error: 'user_id and product_id are required' });

    // Check existing
    let checkSql = 'SELECT id, quantity FROM user_cart WHERE user_id = ? AND product_id = ?';
    let checkParams = [user_id, product_id];
    if (variant_id) {
      checkSql += ' AND variant_id = ?';
      checkParams.push(variant_id);
    } else {
      checkSql += ' AND variant_id IS NULL';
    }

    const existing = await executeMySQL(checkSql, checkParams);
    if (existing && existing.length > 0) {
      await executeMySQL('UPDATE user_cart SET quantity = ? WHERE id = ?', [quantity, existing[0].id]);
    } else {
      await executeMySQL('INSERT INTO user_cart (user_id, product_id, variant_id, quantity) VALUES (?, ?, ?, ?)', [user_id, product_id, variant_id, quantity]);
    }

    res.json({ success: true, message: 'Cart updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Cart Item or Clear
router.delete('/api/cart', async (req, res) => {
  try {
    const { user_id, product_id, variant_id } = req.body || req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    if (product_id) {
      let sql = 'DELETE FROM user_cart WHERE user_id = ? AND product_id = ?';
      let params = [user_id, product_id];
      if (variant_id) {
        sql += ' AND variant_id = ?';
        params.push(variant_id);
      }
      await executeMySQL(sql, params);
    } else {
      await executeMySQL('DELETE FROM user_cart WHERE user_id = ?', [user_id]);
    }
    res.json({ success: true, message: 'Cart cleared or item removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Wishlist
router.get('/api/wishlist', async (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) return res.json([]);
    const rows = await executeMySQL('SELECT * FROM user_wishlist WHERE user_id = ?', [userId]) || [];
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Wishlist Item
router.post('/api/wishlist', async (req, res) => {
  try {
    const { user_id, product_id } = req.body;
    if (!user_id || !product_id) return res.status(400).json({ error: 'user_id and product_id are required' });

    const existing = await executeMySQL('SELECT id FROM user_wishlist WHERE user_id = ? AND product_id = ?', [user_id, product_id]);
    if (!existing || existing.length === 0) {
      await executeMySQL('INSERT INTO user_wishlist (user_id, product_id) VALUES (?, ?)', [user_id, product_id]);
    }
    res.json({ success: true, message: 'Wishlist item added' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Wishlist Item
router.delete('/api/wishlist', async (req, res) => {
  try {
    const { user_id, product_id } = req.body || req.query;
    if (!user_id || !product_id) return res.status(400).json({ error: 'user_id and product_id are required' });

    await executeMySQL('DELETE FROM user_wishlist WHERE user_id = ? AND product_id = ?', [user_id, product_id]);
    res.json({ success: true, message: 'Wishlist item removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
