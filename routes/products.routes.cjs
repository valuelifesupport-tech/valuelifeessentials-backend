const express = require('express');
const router = express.Router();
const { db, executeMySQL } = require('../config/database.cjs');
const { requireAdminAuth } = require('../middleware/auth.cjs');
const { isSkuTaken, generateUniqueSku } = require('../utils/sku.cjs');

function generateSlug(text) {
  return text.toString().toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

// GET Products Catalog with Filters, Search, Variants and Images
router.get('/api/products', async (req, res) => {
  try {
    const { category, collection, search, min_price, max_price, sort } = req.query;

    let query = `
      SELECT p.*,
        p.title as name,
        p.price_inr as price,
        p.stock as stock_quantity,
        c.name as category_name, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (category) {
      query += ' AND (c.slug = ? OR c.name = ? OR p.category_id = ?)';
      params.push(category, category, category);
    }

    if (search) {
      query += ' AND (p.title LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (min_price) {
      query += ' AND p.price_inr >= ?';
      params.push(Number(min_price));
    }
    if (max_price) {
      query += ' AND p.price_inr <= ?';
      params.push(Number(max_price));
    }

    // Sort
    if (sort === 'price_asc') query += ' ORDER BY p.price_inr ASC';
    else if (sort === 'price_desc') query += ' ORDER BY p.price_inr DESC';
    else query += ' ORDER BY p.id DESC';

    let prods = await executeMySQL(query, params);
    if (!prods || prods.length === 0) {
      try {
        prods = db.prepare(query).all(...params) || [];
      } catch (e) {
        prods = [];
      }
    }

    // Filter by collection if specified
    if (collection && prods.length > 0) {
      const pcRows = await executeMySQL('SELECT product_id FROM product_collections WHERE collection_id = ?', [collection]) || [];
      const colPids = new Set(pcRows.map(r => r.product_id));
      prods = prods.filter(p => colPids.has(p.id));
    }

    if (prods.length === 0) return res.json([]);

    // Fetch images and variants in batch
    const pids = prods.map(p => p.id);
    const inClause = pids.map(() => '?').join(',');

    let images = await executeMySQL(`SELECT * FROM product_images WHERE product_id IN (${inClause}) ORDER BY sort_order ASC`, pids) || [];
    let variants = await executeMySQL(`SELECT * FROM product_variants WHERE product_id IN (${inClause}) ORDER BY id ASC`, pids) || [];

    const enriched = prods.map(p => {
      const pImages = images.filter(img => img.product_id === p.id).map(img => img.image_url);
      const pVariants = variants.filter(v => v.product_id === p.id);
      return {
        ...p,
        images: pImages.length > 0 ? pImages : (p.image_url ? [p.image_url] : []),
        image_url: p.image_url || (pImages.length > 0 ? pImages[0] : null),
        variants: pVariants
      };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Product by Slug or ID
router.get(['/api/products/slug/:slug', '/api/products/:slug'], async (req, res) => {
  try {
    const param = req.params.slug;
    let prod = null;

    const myRows = await executeMySQL('SELECT p.*, c.name as category_name, c.slug as category_slug FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.slug = ? OR p.id = ?', [param, param]);
    if (myRows && myRows.length > 0) {
      prod = myRows[0];
    } else {
      prod = db.prepare('SELECT p.*, c.name as category_name, c.slug as category_slug FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.slug = ? OR p.id = ?').get(param, param);
    }

    if (!prod) return res.status(404).json({ error: 'Product not found' });

    // Variants, Images, Reviews
    const variants = await executeMySQL('SELECT * FROM product_variants WHERE product_id = ? ORDER BY id ASC', [prod.id]) || [];
    const images = await executeMySQL('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC', [prod.id]) || [];
    const reviews = await executeMySQL('SELECT * FROM product_reviews WHERE product_id = ? AND status = "APPROVED" ORDER BY created_at DESC', [prod.id]) || [];

    prod.variants = variants;
    prod.images = images.map(i => i.image_url);
    if (!prod.image_url && prod.images.length > 0) prod.image_url = prod.images[0];
    prod.reviews = reviews;
    prod.review_count = reviews.length;
    prod.rating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) : 5.0;

    res.json(prod);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Check SKU
router.get('/api/check-sku', async (req, res) => {
  const { sku, excludeId } = req.query;
  const taken = await isSkuTaken(sku, excludeId);
  res.json({ available: !taken });
});

// POST Create Product
router.post('/api/products', requireAdminAuth, async (req, res) => {
  try {
    const {
      name, description, price, compare_price, cost_price,
      sku, category_id, subcategory_id, stock_quantity = 100,
      images = [], variants = [], collections = [], is_best_product = 0,
      tax_rate = 5, hsn_code = ''
    } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    let productSku = sku ? String(sku).trim().toUpperCase() : await generateUniqueSku('VL');
    let slug = req.body.slug ? generateSlug(req.body.slug) : generateSlug(name);
    let finalSlug = slug;
    let counter = 1;

    while (true) {
      const existing = await executeMySQL('SELECT id FROM products WHERE slug = ?', [finalSlug]);
      if (!existing || existing.length === 0) break;
      finalSlug = `${slug}-${counter++}`;
    }

    const primaryImage = images.length > 0 ? images[0] : (req.body.image_url || null);

    // Insert Product into MySQL
    const myRes = await executeMySQL(
      `INSERT INTO products (
        name, slug, description, price, compare_price, cost_price,
        sku, category_id, subcategory_id, stock_quantity, image_url,
        is_best_product, tax_rate, hsn_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, finalSlug, description || '', Number(price), compare_price ? Number(compare_price) : null, cost_price ? Number(cost_price) : null,
        productSku, category_id || null, subcategory_id || null, Number(stock_quantity), primaryImage,
        is_best_product ? 1 : 0, Number(tax_rate) || 5, hsn_code || ''
      ]
    );
    const newId = myRes ? myRes.insertId : Date.now();

    // Insert into SQLite
    try {
      db.prepare(`INSERT OR REPLACE INTO products (
        id, name, slug, description, price, compare_price, cost_price,
        sku, category_id, subcategory_id, stock_quantity, image_url,
        is_best_product, tax_rate, hsn_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        newId, name, finalSlug, description || '', Number(price), compare_price ? Number(compare_price) : null, cost_price ? Number(cost_price) : null,
        productSku, category_id || null, subcategory_id || null, Number(stock_quantity), primaryImage,
        is_best_product ? 1 : 0, Number(tax_rate) || 5, hsn_code || ''
      );
    } catch (e) {}

    // Images
    if (Array.isArray(images)) {
      for (let i = 0; i < images.length; i++) {
        await executeMySQL('INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)', [newId, images[i], i]);
        try {
          db.prepare('INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)').run(newId, images[i], i);
        } catch (e) {}
      }
    }

    // Variants
    if (Array.isArray(variants)) {
      for (const v of variants) {
        const vSku = v.sku ? String(v.sku).trim().toUpperCase() : await generateUniqueSku(productSku);
        await executeMySQL(
          'INSERT INTO product_variants (product_id, name, variant_name, price, compare_price, sku, stock_quantity) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [newId, v.name || v.variant_name || '', v.variant_name || v.name || '', Number(v.price || price), v.compare_price ? Number(v.compare_price) : null, vSku, Number(v.stock_quantity || 100)]
        );
      }
    }

    // Collections
    if (Array.isArray(collections)) {
      for (const colId of collections) {
        await executeMySQL('INSERT INTO product_collections (product_id, collection_id) VALUES (?, ?)', [newId, colId]);
      }
    }

    res.json({ id: newId, name, slug: finalSlug, sku: productSku, price });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Update Product
router.put('/api/products/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const {
      name, description, price, compare_price, cost_price,
      sku, category_id, subcategory_id, stock_quantity,
      images, variants, collections, is_best_product, tax_rate, hsn_code
    } = req.body;

    const primaryImage = (images && images.length > 0) ? images[0] : (req.body.image_url || undefined);

    await executeMySQL(
      `UPDATE products SET
        name = COALESCE(?, name), description = COALESCE(?, description), price = COALESCE(?, price),
        compare_price = COALESCE(?, compare_price), cost_price = COALESCE(?, cost_price), sku = COALESCE(?, sku),
        category_id = COALESCE(?, category_id), subcategory_id = COALESCE(?, subcategory_id), stock_quantity = COALESCE(?, stock_quantity),
        image_url = COALESCE(?, image_url), is_best_product = COALESCE(?, is_best_product), tax_rate = COALESCE(?, tax_rate),
        hsn_code = COALESCE(?, hsn_code)
      WHERE id = ?`,
      [
        name, description, price ? Number(price) : null, compare_price ? Number(compare_price) : null, cost_price ? Number(cost_price) : null,
        sku, category_id, subcategory_id, stock_quantity ? Number(stock_quantity) : null, primaryImage,
        is_best_product !== undefined ? (is_best_product ? 1 : 0) : null, tax_rate, hsn_code, id
      ]
    );

    // Sync Images if provided
    if (Array.isArray(images)) {
      await executeMySQL('DELETE FROM product_images WHERE product_id = ?', [id]);
      for (let i = 0; i < images.length; i++) {
        await executeMySQL('INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)', [id, images[i], i]);
      }
    }

    // Sync Variants if provided
    if (Array.isArray(variants)) {
      await executeMySQL('DELETE FROM product_variants WHERE product_id = ?', [id]);
      for (const v of variants) {
        const vSku = v.sku ? String(v.sku).trim().toUpperCase() : await generateUniqueSku('VL');
        await executeMySQL(
          'INSERT INTO product_variants (product_id, name, variant_name, price, compare_price, sku, stock_quantity) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, v.name || v.variant_name || '', v.variant_name || v.name || '', Number(v.price || price), v.compare_price ? Number(v.compare_price) : null, vSku, Number(v.stock_quantity || 100)]
        );
      }
    }

    res.json({ success: true, id, message: 'Product updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Stock Update
router.put('/api/products/:id/stock', async (req, res) => {
  try {
    const { stock_quantity } = req.body;
    await executeMySQL('UPDATE products SET stock_quantity = ? WHERE id = ?', [Number(stock_quantity), req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Single Product
router.delete('/api/products/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    await executeMySQL('DELETE FROM product_variants WHERE product_id = ?', [id]);
    await executeMySQL('DELETE FROM product_images WHERE product_id = ?', [id]);
    await executeMySQL('DELETE FROM product_collections WHERE product_id = ?', [id]);
    await executeMySQL('DELETE FROM product_reviews WHERE product_id = ?', [id]);
    await executeMySQL('DELETE FROM products WHERE id = ?', [id]);

    try {
      db.prepare('DELETE FROM product_variants WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM product_images WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM product_collections WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM product_reviews WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM products WHERE id = ?').run(id);
    } catch (e) {}

    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Purge All Products
router.delete('/api/products/purge-all', requireAdminAuth, async (req, res) => {
  try {
    await executeMySQL('DELETE FROM product_collections');
    await executeMySQL('DELETE FROM product_images');
    await executeMySQL('DELETE FROM product_variants');
    await executeMySQL('DELETE FROM product_reviews');
    await executeMySQL('DELETE FROM products');
    await executeMySQL('ALTER TABLE products AUTO_INCREMENT = 1');

    try {
      db.prepare('DELETE FROM product_collections').run();
      db.prepare('DELETE FROM product_images').run();
      db.prepare('DELETE FROM product_variants').run();
      db.prepare('DELETE FROM product_reviews').run();
      db.prepare('DELETE FROM products').run();
    } catch (e) {}

    res.json({ success: true, message: 'All products purged' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
