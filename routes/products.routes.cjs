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
      const primaryImg = p.image_url || (pImages.length > 0 ? pImages[0] : null);
      return {
        ...p,
        images: pImages.length > 0 ? pImages : (primaryImg ? [primaryImg] : []),
        image_url: primaryImg,
        thumbnail: p.thumbnail || primaryImg,
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
    if (!prod.thumbnail) prod.thumbnail = prod.image_url || (prod.images && prod.images[0]) || null;
    const normalizedReviews = (reviews || []).map(r => ({
      ...r,
      user_name: r.user_name || r.customer_name || 'Verified Customer',
      comment: r.comment || r.review_text || '',
      title: r.title || r.review_title || ''
    }));
    prod.reviews = normalizedReviews;
    prod.review_count = normalizedReviews.length;
    prod.rating = normalizedReviews.length > 0 ? (normalizedReviews.reduce((s, r) => s + (Number(r.rating) || 5), 0) / normalizedReviews.length) : 5.0;

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
      description, sku, category_id, subcategory_id,
      images = [], variants = [], collections = [], is_best_product = 0,
      vendor, product_type, tags, weight, country_of_origin, barcode
    } = req.body;

    // Accept both naming conventions for backward compatibility
    const title = req.body.title || req.body.name;
    const price_inr = req.body.price_inr != null ? Number(req.body.price_inr) : (req.body.price != null ? Number(req.body.price) : undefined);
    const price_usd = req.body.price_usd != null ? Number(req.body.price_usd) : (price_inr != null ? Math.round(price_inr / 83 * 100) / 100 : undefined);
    const compare_price_inr = req.body.compare_price_inr != null ? Number(req.body.compare_price_inr) : (req.body.compare_price != null ? Number(req.body.compare_price) : null);
    const compare_price_usd = req.body.compare_price_usd != null ? Number(req.body.compare_price_usd) : (compare_price_inr ? Math.round(compare_price_inr / 83 * 100) / 100 : null);
    const cost_per_item_inr = req.body.cost_per_item_inr != null ? Number(req.body.cost_per_item_inr) : (req.body.cost_price != null ? Number(req.body.cost_price) : null);
    const cost_per_item_usd = req.body.cost_per_item_usd != null ? Number(req.body.cost_per_item_usd) : (cost_per_item_inr ? Math.round(cost_per_item_inr / 83 * 100) / 100 : null);
    const stock = req.body.stock != null ? Number(req.body.stock) : (req.body.stock_quantity != null ? Number(req.body.stock_quantity) : 100);
    const gst_percent = req.body.gst_percent != null ? Number(req.body.gst_percent) : (req.body.tax_rate != null ? Number(req.body.tax_rate) : 5);
    const hs_code = req.body.hs_code || req.body.hsn_code || '';

    if (!title || price_inr === undefined) {
      return res.status(400).json({ error: 'Title/name and price are required' });
    }

    let productSku = sku ? String(sku).trim().toUpperCase() : await generateUniqueSku('VL');
    let slug = req.body.slug ? generateSlug(req.body.slug) : generateSlug(title);
    let finalSlug = slug;
    let counter = 1;

    while (true) {
      const existing = await executeMySQL('SELECT id FROM products WHERE slug = ?', [finalSlug]);
      if (!existing || existing.length === 0) break;
      finalSlug = `${slug}-${counter++}`;
    }

    const primaryImage = images.length > 0 ? images[0] : (req.body.image_url || null);

    // Insert Product into MySQL (using correct column names)
    const myRes = await executeMySQL(
      `INSERT INTO products (
        title, slug, description, price_inr, price_usd,
        compare_price_inr, compare_price_usd, cost_per_item_inr, cost_per_item_usd,
        sku, category_id, subcategory_id, stock, image_url,
        is_best_product, gst_percent, hs_code,
        vendor, product_type, tags, weight, country_of_origin, barcode, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')`,
      [
        title, finalSlug, description || '', price_inr, price_usd,
        compare_price_inr, compare_price_usd, cost_per_item_inr, cost_per_item_usd,
        productSku, category_id || null, subcategory_id || null, stock, primaryImage,
        is_best_product ? 1 : 0, gst_percent, hs_code,
        vendor || 'VALUELIFE ESSENTIALS', product_type || '', tags || '', Number(weight) || 0.5, country_of_origin || 'India', barcode || null
      ]
    );
    const newId = myRes ? myRes.insertId : Date.now();

    // Insert into SQLite
    try {
      db.prepare(`INSERT OR REPLACE INTO products (
        id, title, slug, description, price_inr, price_usd,
        compare_price_inr, compare_price_usd, cost_per_item_inr, cost_per_item_usd,
        sku, category_id, subcategory_id, stock, image_url,
        is_best_product, hs_code,
        vendor, product_type, tags, weight, country_of_origin, barcode, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')`).run(
        newId, title, finalSlug, description || '', price_inr, price_usd,
        compare_price_inr, compare_price_usd, cost_per_item_inr, cost_per_item_usd,
        productSku, category_id || null, subcategory_id || null, stock, primaryImage,
        is_best_product ? 1 : 0, hs_code,
        vendor || 'VALUELIFE ESSENTIALS', product_type || '', tags || '', Number(weight) || 0.5, country_of_origin || 'India', barcode || null
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
        const vPriceInr = Number(v.price_inr || v.price || price_inr);
        const vPriceUsd = Number(v.price_usd || (Math.round(vPriceInr / 83 * 100) / 100));
        await executeMySQL(
          'INSERT INTO product_variants (product_id, title, variant_name, price_inr, price_usd, sku, stock) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [newId, v.title || v.name || v.variant_name || '', v.variant_name || v.name || v.title || '', vPriceInr, vPriceUsd, vSku, Number(v.stock || v.stock_quantity || 100)]
        );
      }
    }

    // Collections
    if (Array.isArray(collections)) {
      for (const colId of collections) {
        await executeMySQL('INSERT IGNORE INTO product_collections (product_id, collection_id) VALUES (?, ?)', [newId, colId]);
      }
    }

    res.json({ id: newId, title, name: title, slug: finalSlug, sku: productSku, price_inr, price: price_inr });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Update Product
router.put('/api/products/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const {
      description, sku, category_id, subcategory_id,
      images, variants, collections, is_best_product,
      vendor, product_type, tags, weight, country_of_origin, barcode
    } = req.body;

    // Accept both naming conventions
    const title = req.body.title || req.body.name || undefined;
    const price_inr = req.body.price_inr != null ? Number(req.body.price_inr) : (req.body.price != null ? Number(req.body.price) : undefined);
    const price_usd = req.body.price_usd != null ? Number(req.body.price_usd) : (price_inr != null ? Math.round(price_inr / 83 * 100) / 100 : undefined);
    const compare_price_inr = req.body.compare_price_inr != null ? Number(req.body.compare_price_inr) : (req.body.compare_price != null ? Number(req.body.compare_price) : undefined);
    const compare_price_usd = req.body.compare_price_usd != null ? Number(req.body.compare_price_usd) : (compare_price_inr != null ? Math.round(compare_price_inr / 83 * 100) / 100 : undefined);
    const cost_per_item_inr = req.body.cost_per_item_inr != null ? Number(req.body.cost_per_item_inr) : (req.body.cost_price != null ? Number(req.body.cost_price) : undefined);
    const cost_per_item_usd = req.body.cost_per_item_usd != null ? Number(req.body.cost_per_item_usd) : (cost_per_item_inr != null ? Math.round(cost_per_item_inr / 83 * 100) / 100 : undefined);
    const stock = req.body.stock != null ? Number(req.body.stock) : (req.body.stock_quantity != null ? Number(req.body.stock_quantity) : undefined);
    const gst_percent = req.body.gst_percent != null ? Number(req.body.gst_percent) : (req.body.tax_rate != null ? Number(req.body.tax_rate) : undefined);
    const hs_code = req.body.hs_code || req.body.hsn_code || undefined;

    const primaryImage = (images && images.length > 0) ? images[0] : (req.body.image_url || undefined);

    // Build slug if title changed
    let slug = undefined;
    if (title) {
      slug = req.body.slug ? generateSlug(req.body.slug) : generateSlug(title);
    }

    await executeMySQL(
      `UPDATE products SET
        title = COALESCE(?, title), slug = COALESCE(?, slug), description = COALESCE(?, description),
        price_inr = COALESCE(?, price_inr), price_usd = COALESCE(?, price_usd),
        compare_price_inr = COALESCE(?, compare_price_inr), compare_price_usd = COALESCE(?, compare_price_usd),
        cost_per_item_inr = COALESCE(?, cost_per_item_inr), cost_per_item_usd = COALESCE(?, cost_per_item_usd),
        sku = COALESCE(?, sku), category_id = COALESCE(?, category_id), subcategory_id = COALESCE(?, subcategory_id),
        stock = COALESCE(?, stock), image_url = COALESCE(?, image_url),
        is_best_product = COALESCE(?, is_best_product), gst_percent = COALESCE(?, gst_percent), hs_code = COALESCE(?, hs_code),
        vendor = COALESCE(?, vendor), product_type = COALESCE(?, product_type), tags = COALESCE(?, tags),
        weight = COALESCE(?, weight), country_of_origin = COALESCE(?, country_of_origin)
      WHERE id = ?`,
      [
        title, slug, description,
        price_inr, price_usd,
        compare_price_inr, compare_price_usd,
        cost_per_item_inr, cost_per_item_usd,
        sku, category_id, subcategory_id,
        stock, primaryImage,
        is_best_product !== undefined ? (is_best_product ? 1 : 0) : null, gst_percent, hs_code,
        vendor, product_type, tags,
        weight ? Number(weight) : null, country_of_origin, id
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
        const vPriceInr = Number(v.price_inr || v.price || price_inr || 0);
        const vPriceUsd = Number(v.price_usd || (Math.round(vPriceInr / 83 * 100) / 100));
        await executeMySQL(
          'INSERT INTO product_variants (product_id, title, variant_name, price_inr, price_usd, sku, stock) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, v.title || v.name || v.variant_name || '', v.variant_name || v.name || v.title || '', vPriceInr, vPriceUsd, vSku, Number(v.stock || v.stock_quantity || 100)]
        );
      }
    }

    // Sync Collections if provided
    if (Array.isArray(collections)) {
      await executeMySQL('DELETE FROM product_collections WHERE product_id = ?', [id]);
      for (const colId of collections) {
        await executeMySQL('INSERT IGNORE INTO product_collections (product_id, collection_id) VALUES (?, ?)', [id, colId]);
      }
    }

    res.json({ success: true, id, message: 'Product updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT / PATCH Product Stock Update
router.all(['/api/products/:id/stock'], async (req, res) => {
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const rawStock = req.body.stock !== undefined ? req.body.stock : req.body.stock_quantity;
    const newStock = Math.max(0, Number(rawStock) || 0);
    const productId = req.params.id;

    await executeMySQL('UPDATE products SET stock = ? WHERE id = ?', [newStock, productId]);
    try {
      db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, productId);
    } catch (e) {}

    res.json({ success: true, product_id: productId, stock: newStock, message: 'Product stock updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT / PATCH Variant Stock Update (Handles both /api/variants/:id/stock and /api/products/variants/:id/stock)
router.all(['/api/variants/:id/stock', '/api/products/variants/:id/stock'], async (req, res) => {
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const rawStock = req.body.stock !== undefined ? req.body.stock : req.body.stock_quantity;
    const newStock = Math.max(0, Number(rawStock) || 0);
    const variantId = req.params.id;

    await executeMySQL('UPDATE product_variants SET stock = ? WHERE id = ?', [newStock, variantId]);
    try {
      db.prepare('UPDATE product_variants SET stock = ? WHERE id = ?').run(newStock, variantId);
    } catch (e) {}

    res.json({ success: true, variant_id: variantId, stock: newStock, message: 'Variant stock updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Create Variant for Product
router.post(['/api/products/:id/variants', '/api/variants'], async (req, res) => {
  try {
    const productId = req.params.id || req.body.product_id;
    if (!productId) return res.status(400).json({ error: 'Product ID is required' });

    const {
      variant_name,
      title,
      sku,
      price_inr,
      price_usd,
      discount_inr,
      discount_usd,
      stock,
      image_url,
      compare_price_inr,
      compare_price_usd
    } = req.body;

    const vName = variant_name || title || 'Standard';
    const vSku = sku ? String(sku).trim().toUpperCase() : await generateUniqueSku('VL-VAR');
    const vPriceInr = Number(price_inr || discount_inr || 149);
    const vPriceUsd = Number(price_usd || (Math.round(vPriceInr / 83 * 100) / 100));
    const vStock = Math.max(0, Number(stock !== undefined ? stock : 50));
    const vImg = image_url || null;

    const myRes = await executeMySQL(
      `INSERT INTO product_variants (
        product_id, title, variant_name, sku, price_inr, price_usd,
        discount_inr, discount_usd, stock, image_url, compare_price_inr, compare_price_usd
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        productId, vName, vName, vSku, vPriceInr, vPriceUsd,
        discount_inr ? Number(discount_inr) : null, discount_usd ? Number(discount_usd) : null,
        vStock, vImg, compare_price_inr ? Number(compare_price_inr) : null, compare_price_usd ? Number(compare_price_usd) : null
      ]
    );

    const newVariantId = myRes ? myRes.insertId : Date.now();
    try {
      db.prepare(`
        INSERT OR REPLACE INTO product_variants (
          id, product_id, title, variant_name, sku, price_inr, price_usd, stock
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(newVariantId, productId, vName, vName, vSku, vPriceInr, vPriceUsd, vStock);
    } catch (e) {}

    res.json({
      success: true,
      variant: {
        id: newVariantId,
        product_id: productId,
        variant_name: vName,
        sku: vSku,
        price_inr: vPriceInr,
        price_usd: vPriceUsd,
        stock: vStock,
        image_url: vImg
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Variant
router.delete(['/api/variants/:id', '/api/products/variants/:id'], async (req, res) => {
  try {
    const variantId = req.params.id;
    await executeMySQL('DELETE FROM product_variants WHERE id = ?', [variantId]);
    try {
      db.prepare('DELETE FROM product_variants WHERE id = ?').run(variantId);
    } catch (e) {}
    res.json({ success: true, message: 'Variant deleted successfully' });
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
