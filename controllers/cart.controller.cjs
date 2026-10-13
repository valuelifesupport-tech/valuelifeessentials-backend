const { executeMySQL } = require('../config/database.cjs');

/**
 * Cart Controller
 * Encapsulates business logic for user cart and wishlist operations.
 */
const cartController = {
  getCart: async (req, res) => {
    const userId = req.query.user_id;
    if (!userId) return res.json({ success: true, items: [] });
    const rows = await executeMySQL('SELECT * FROM user_cart WHERE user_id = ?', [userId]) || [];
    res.json({ success: true, items: rows });
  },

  syncCart: async (req, res) => {
    const { user_id, product_id, variant_id = null, quantity = 1, items } = req.body;
    if (!user_id) return res.status(400).json({ success: false, error: 'user_id is required' });

    if (Array.isArray(items)) {
      await executeMySQL('DELETE FROM user_cart WHERE user_id = ?', [user_id]);
      for (const item of items) {
        const pid = item.product_id || item.id;
        const vid = item.variant_id || null;
        const qty = item.quantity || 1;
        if (pid) {
          await executeMySQL(
            'INSERT INTO user_cart (user_id, product_id, variant_id, quantity) VALUES (?, ?, ?, ?)',
            [user_id, pid, vid, qty]
          );
        }
      }
      return res.json({ success: true, message: 'Cart items synchronized' });
    }

    if (!product_id) return res.status(400).json({ success: false, error: 'product_id is required' });

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
      await executeMySQL(
        'INSERT INTO user_cart (user_id, product_id, variant_id, quantity) VALUES (?, ?, ?, ?)',
        [user_id, product_id, variant_id, quantity]
      );
    }

    res.json({ success: true, message: 'Cart updated' });
  },

  deleteCartItem: async (req, res) => {
    const { user_id, product_id, variant_id } = req.body || req.query;
    if (!user_id) return res.status(400).json({ success: false, error: 'user_id is required' });

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
  },

  getWishlist: async (req, res) => {
    const userId = req.query.user_id;
    if (!userId) return res.json({ success: true, items: [] });
    const rows = await executeMySQL('SELECT * FROM user_wishlist WHERE user_id = ?', [userId]) || [];
    res.json({ success: true, items: rows });
  },

  addWishlistItem: async (req, res) => {
    const { user_id, product_id } = req.body;
    if (!user_id || !product_id) return res.status(400).json({ success: false, error: 'user_id and product_id are required' });

    const existing = await executeMySQL('SELECT id FROM user_wishlist WHERE user_id = ? AND product_id = ?', [user_id, product_id]);
    if (!existing || existing.length === 0) {
      await executeMySQL('INSERT INTO user_wishlist (user_id, product_id) VALUES (?, ?)', [user_id, product_id]);
    }
    res.json({ success: true, message: 'Wishlist item added' });
  },

  removeWishlistItem: async (req, res) => {
    const { user_id, product_id } = req.body || req.query;
    if (!user_id || !product_id) return res.status(400).json({ success: false, error: 'user_id and product_id are required' });

    await executeMySQL('DELETE FROM user_wishlist WHERE user_id = ? AND product_id = ?', [user_id, product_id]);
    res.json({ success: true, message: 'Wishlist item removed' });
  }
};

module.exports = cartController;
