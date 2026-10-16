const { executeMySQL, db } = require('../config/database.cjs');

/**
 * Cart Controller
 * Encapsulates business logic for user cart and wishlist operations.
 */
const cartController = {
  getCart: async (req, res) => {
    const userId = req.query.user_id;
    if (!userId) return res.json({ success: true, items: [] });

    const sql = `
      SELECT 
        uc.id as cart_row_id,
        uc.user_id,
        uc.product_id,
        uc.variant_id,
        uc.quantity,
        p.id as prod_id,
        p.title,
        p.slug,
        p.sku,
        p.price_inr as prod_price_inr,
        p.price_usd as prod_price_usd,
        p.discount_inr as prod_discount_inr,
        p.discount_usd as prod_discount_usd,
        p.image_url as prod_image,
        p.gst_percent,
        p.gst_rate,
        pv.variant_name,
        pv.sku as var_sku,
        pv.price_inr as var_price_inr,
        pv.price_usd as var_price_usd,
        pv.discount_inr as var_discount_inr,
        pv.discount_usd as var_discount_usd,
        pv.image_url as var_image
      FROM user_cart uc
      LEFT JOIN products p ON uc.product_id = p.id
      LEFT JOIN product_variants pv ON uc.variant_id = pv.id
      WHERE uc.user_id = ?
      ORDER BY uc.id ASC
    `;

    let rows = null;
    try {
      rows = await executeMySQL(sql, [userId]);
    } catch (err) {
      console.warn('[CartController] MySQL getCart error:', err.message);
    }

    if (!rows && db) {
      try {
        rows = db.prepare(sql).all(userId);
      } catch (err) {
        console.warn('[CartController] SQLite getCart fallback error:', err.message);
        rows = [];
      }
    }
    rows = rows || [];

    const mappedItems = rows.map(r => {
      const pid = r.prod_id || r.product_id;
      const vid = r.variant_id || null;
      const vName = r.variant_name || null;
      const cartKey = vid ? `${pid}_var_${vid}` : (vName ? `${pid}_opt_${vName}` : `${pid}`);

      // Calculate INR and USD prices
      const rawVarInr = Number(r.var_price_inr || 0);
      const rawVarDiscInr = Number(r.var_discount_inr || 0);
      const varPriceInr = (rawVarDiscInr > 0 && rawVarDiscInr < rawVarInr) ? rawVarDiscInr : (rawVarInr > 0 ? rawVarInr : 0);

      const rawProdInr = Number(r.prod_price_inr || 0);
      const rawProdDiscInr = Number(r.prod_discount_inr || 0);
      const prodPriceInr = (rawProdDiscInr > 0 && rawProdDiscInr < rawProdInr) ? rawProdDiscInr : (rawProdInr > 0 ? rawProdInr : 0);

      const finalPriceInr = varPriceInr > 0 ? varPriceInr : prodPriceInr;

      const rawVarUsd = Number(r.var_price_usd || 0);
      const rawVarDiscUsd = Number(r.var_discount_usd || 0);
      const varPriceUsd = (rawVarDiscUsd > 0 && rawVarDiscUsd < rawVarUsd) ? rawVarDiscUsd : (rawVarUsd > 0 ? rawVarUsd : 0);

      const rawProdUsd = Number(r.prod_price_usd || 0);
      const rawProdDiscUsd = Number(r.prod_discount_usd || 0);
      const prodPriceUsd = (rawProdDiscUsd > 0 && rawProdDiscUsd < rawProdUsd) ? rawProdDiscUsd : (rawProdUsd > 0 ? rawProdUsd : 0);

      const finalPriceUsd = varPriceUsd > 0 ? varPriceUsd : prodPriceUsd;

      const thumb = r.var_image || r.prod_image || '';

      const selectedVariant = vid ? {
        id: vid,
        variant_name: vName,
        price_inr: r.var_price_inr,
        price_usd: r.var_price_usd,
        discount_inr: r.var_discount_inr,
        discount_usd: r.var_discount_usd,
        image_url: r.var_image
      } : null;

      const gst = (r.gst_percent !== undefined && r.gst_percent !== null && r.gst_percent !== '')
        ? Number(r.gst_percent)
        : ((r.gst_rate !== undefined && r.gst_rate !== null && r.gst_rate !== '') ? Number(r.gst_rate) : 18);

      return {
        id: pid,
        product_id: pid,
        cart_row_id: r.cart_row_id,
        cartKey,
        title: r.title || 'Product',
        slug: r.slug || '',
        sku: r.var_sku || r.sku || '',
        variant_id: vid,
        variant_name: vName,
        variant: selectedVariant,
        selectedVariant,
        thumbnail: thumb,
        image_url: thumb,
        price: finalPriceInr,
        price_inr: finalPriceInr,
        price_usd: finalPriceUsd,
        discount_inr: r.var_discount_inr || r.prod_discount_inr || null,
        discount_usd: r.var_discount_usd || r.prod_discount_usd || null,
        quantity: Math.max(1, Number(r.quantity) || 1),
        gst_percent: gst,
        gst_rate: gst
      };
    });

    res.json({ success: true, items: mappedItems });
  },

  syncCart: async (req, res) => {
    const { user_id, product_id, variant_id = null, quantity = 1, items } = req.body;
    if (!user_id) return res.status(400).json({ success: false, error: 'user_id is required' });

    if (Array.isArray(items)) {
      try {
        await executeMySQL('DELETE FROM user_cart WHERE user_id = ?', [user_id]);
        for (const item of items) {
          const pid = item.product_id || item.id;
          const vid = item.variant_id || item.variant?.id || item.selectedVariant?.id || null;
          const qty = Math.max(1, Number(item.quantity) || 1);
          if (pid) {
            await executeMySQL(
              'INSERT INTO user_cart (user_id, product_id, variant_id, quantity) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE quantity = ?',
              [user_id, pid, vid, qty, qty]
            );
          }
        }
      } catch (err) {
        console.warn('[CartController] MySQL syncCart error:', err.message);
      }

      if (db) {
        try {
          db.prepare('DELETE FROM user_cart WHERE user_id = ?').run(user_id);
          const insertStmt = db.prepare('INSERT OR REPLACE INTO user_cart (user_id, product_id, variant_id, quantity) VALUES (?, ?, ?, ?)');
          for (const item of items) {
            const pid = item.product_id || item.id;
            const vid = item.variant_id || item.variant?.id || item.selectedVariant?.id || null;
            const qty = Math.max(1, Number(item.quantity) || 1);
            if (pid) {
              insertStmt.run(user_id, pid, vid, qty);
            }
          }
        } catch (err) {
          console.warn('[CartController] SQLite syncCart error:', err.message);
        }
      }

      return res.json({ success: true, message: 'Cart items synchronized' });
    }

    if (!product_id) return res.status(400).json({ success: false, error: 'product_id is required' });
    const cleanQty = Math.max(1, Number(quantity) || 1);
    const cleanVid = variant_id || null;

    try {
      let checkSql = 'SELECT id, quantity FROM user_cart WHERE user_id = ? AND product_id = ?';
      let checkParams = [user_id, product_id];
      if (cleanVid) {
        checkSql += ' AND variant_id = ?';
        checkParams.push(cleanVid);
      } else {
        checkSql += ' AND variant_id IS NULL';
      }

      const existing = await executeMySQL(checkSql, checkParams);
      if (existing && existing.length > 0) {
        await executeMySQL('UPDATE user_cart SET quantity = ? WHERE id = ?', [cleanQty, existing[0].id]);
      } else {
        await executeMySQL(
          'INSERT INTO user_cart (user_id, product_id, variant_id, quantity) VALUES (?, ?, ?, ?)',
          [user_id, product_id, cleanVid, cleanQty]
        );
      }
    } catch (err) {
      console.warn('[CartController] MySQL single syncCart error:', err.message);
    }

    if (db) {
      try {
        let checkSql = 'SELECT id, quantity FROM user_cart WHERE user_id = ? AND product_id = ?';
        let checkParams = [user_id, product_id];
        if (cleanVid) {
          checkSql += ' AND variant_id = ?';
          checkParams.push(cleanVid);
        } else {
          checkSql += ' AND variant_id IS NULL';
        }
        const existing = db.prepare(checkSql).all(...checkParams);
        if (existing && existing.length > 0) {
          db.prepare('UPDATE user_cart SET quantity = ? WHERE id = ?').run(cleanQty, existing[0].id);
        } else {
          db.prepare('INSERT OR REPLACE INTO user_cart (user_id, product_id, variant_id, quantity) VALUES (?, ?, ?, ?)').run(user_id, product_id, cleanVid, cleanQty);
        }
      } catch (err) {
        console.warn('[CartController] SQLite single syncCart error:', err.message);
      }
    }

    res.json({ success: true, message: 'Cart updated' });
  },

  deleteCartItem: async (req, res) => {
    const { user_id, product_id, variant_id } = req.body || req.query;
    if (!user_id) return res.status(400).json({ success: false, error: 'user_id is required' });

    try {
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
    } catch (err) {
      console.warn('[CartController] MySQL deleteCartItem error:', err.message);
    }

    if (db) {
      try {
        if (product_id) {
          let sql = 'DELETE FROM user_cart WHERE user_id = ? AND product_id = ?';
          let params = [user_id, product_id];
          if (variant_id) {
            sql += ' AND variant_id = ?';
            params.push(variant_id);
          }
          db.prepare(sql).run(...params);
        } else {
          db.prepare('DELETE FROM user_cart WHERE user_id = ?').run(user_id);
        }
      } catch (err) {
        console.warn('[CartController] SQLite deleteCartItem error:', err.message);
      }
    }

    res.json({ success: true, message: 'Cart cleared or item removed' });
  },

  getWishlist: async (req, res) => {
    const userId = req.query.user_id;
    if (!userId) return res.json({ success: true, items: [] });
    let rows = await executeMySQL('SELECT * FROM user_wishlist WHERE user_id = ?', [userId]);
    if (!rows && db) {
      try {
        rows = db.prepare('SELECT * FROM user_wishlist WHERE user_id = ?').all(userId);
      } catch (e) {
        rows = [];
      }
    }
    res.json({ success: true, items: rows || [] });
  },

  addWishlistItem: async (req, res) => {
    const { user_id, product_id } = req.body;
    if (!user_id || !product_id) return res.status(400).json({ success: false, error: 'user_id and product_id are required' });

    try {
      const existing = await executeMySQL('SELECT id FROM user_wishlist WHERE user_id = ? AND product_id = ?', [user_id, product_id]);
      if (!existing || existing.length === 0) {
        await executeMySQL('INSERT INTO user_wishlist (user_id, product_id) VALUES (?, ?)', [user_id, product_id]);
      }
    } catch (e) {}

    if (db) {
      try {
        const existing = db.prepare('SELECT id FROM user_wishlist WHERE user_id = ? AND product_id = ?').all(user_id, product_id);
        if (!existing || existing.length === 0) {
          db.prepare('INSERT OR REPLACE INTO user_wishlist (user_id, product_id) VALUES (?, ?)').run(user_id, product_id);
        }
      } catch (e) {}
    }

    res.json({ success: true, message: 'Wishlist item added' });
  },

  removeWishlistItem: async (req, res) => {
    const { user_id, product_id } = req.body || req.query;
    if (!user_id || !product_id) return res.status(400).json({ success: false, error: 'user_id and product_id are required' });

    try {
      await executeMySQL('DELETE FROM user_wishlist WHERE user_id = ? AND product_id = ?', [user_id, product_id]);
    } catch (e) {}

    if (db) {
      try {
        db.prepare('DELETE FROM user_wishlist WHERE user_id = ? AND product_id = ?').run(user_id, product_id);
      } catch (e) {}
    }

    res.json({ success: true, message: 'Wishlist item removed' });
  }
};

module.exports = cartController;
