const express = require('express');
const router = express.Router();
const { db, executeMySQL } = require('../config/database.cjs');
const { requireAdminAuth } = require('../middleware/auth.cjs');

// SECURITY: Column whitelists to prevent SQL injection via dynamic Object.keys
const ALLOWED_SETTINGS_COLS = new Set([
  'announcement_text', 'announcement_code', 'contact_phone', 'contact_email',
  'partial_deposit_percent', 'enable_multi_currency', 'enable_cod', 'enable_partial_payment',
  'prepaid_discount_percent', 'enable_gst', 'gstin_number', 'store_name', 'store_tagline',
  'store_logo', 'store_favicon', 'currency', 'shipping_fee', 'free_shipping_threshold',
  'address_line1', 'address_line2', 'city', 'state', 'country', 'pincode',
  'instagram_url', 'facebook_url', 'twitter_url', 'youtube_url', 'whatsapp_number',
  'google_analytics_id', 'meta_pixel_id', 'maintenance_mode', 'maintenance_password',
  'default_gst_percent', 'gst_type', 'all_prices_include_tax', 'store_state', 'legal_business_name', 'federal_tax_rate',
  'enable_free_shipping'
]);
const ALLOWED_HERO_COLS = new Set([
  'hero_enabled', 'active_style', 'badge_text', 'title', 'subtitle',
  'primary_btn_text', 'primary_btn_link', 'secondary_btn_text', 'secondary_btn_link',
  'image_url', 'bg_image_url', 'card_1_title', 'card_1_sub', 'card_1_img',
  'card_2_title', 'card_2_sub', 'card_2_img',
  'headline', 'subheadline', 'primary_cta_text', 'primary_cta_link',
  'secondary_cta_text', 'secondary_cta_link', 'bg_video_url',
  'overlay_opacity', 'text_color', 'layout_style'
]);
const ALLOWED_THEME_COLS = new Set([
  'primary_color', 'secondary_color', 'accent_color', 'font_family', 'heading_font',
  'bg_color', 'text_color', 'border_radius', 'card_style'
]);
const ALLOWED_SECTIONS_COLS = new Set([
  'show_announcement', 'show_announcement_bar', 'show_hero', 'show_trust_badges',
  'show_promo_banners', 'show_categories_slider', 'show_categories', 'show_featured_products',
  'show_editorial_promo', 'show_why_choose_us', 'show_bestsellers', 'show_brand_story',
  'show_testimonials', 'show_instagram_feed', 'show_newsletter', 'show_footer',
  'show_sales_ticker', 'sales_ticker_json', 'trust_badge_1_title', 'trust_badge_1_sub',
  'trust_badge_2_title', 'trust_badge_2_sub', 'trust_badge_3_title', 'trust_badge_3_sub',
  'trust_badge_4_title', 'trust_badge_4_sub', 'show_blog_section', 'show_reviews',
  'show_collections', 'show_banners', 'category_slider_title', 'bestsellers_title',
  'bestsellers_badge', 'bestsellers_count'
]);
const ALLOWED_EDITORIAL_COLS = new Set([
  'badge_text', 'title_part1', 'title_part2', 'subtitle', 'cta_text', 'cta_link',
  'image_url', 'script_quote', 'quote_subtext', 'is_enabled'
]);
const ALLOWED_BRAND_STORY_COLS = new Set([
  'badge_text', 'heading', 'overlay_title', 'overlay_subtitle', 'description',
  'cta_text', 'cta_link', 'image_url', 'is_enabled'
]);

function sanitizeKeys(fields, allowedSet) {
  return Object.keys(fields).filter(k => k !== 'id' && k !== 'updated_at' && allowedSet.has(k));
}

// GET Store Settings
router.get(['/api/settings', '/api/admin/settings'], async (req, res) => {
  try {
    const myRows = await executeMySQL('SELECT * FROM store_settings WHERE id = 1');
    if (myRows && myRows.length > 0) {
      return res.json(myRows[0]);
    }
    const row = db.prepare('SELECT * FROM store_settings WHERE id = 1').get();
    if (row) return res.json(row);

    res.json({
      id: 1,
      announcement_text: 'Free Express Shipping Across India on Orders Above ₹499!',
      announcement_code: 'VALUELIFE15',
      contact_phone: process.env.SUPPORT_PHONE || '',
      contact_email: process.env.SUPPORT_EMAIL || '',
      partial_deposit_percent: 20,
      enable_multi_currency: 1,
      enable_cod: 1,
      enable_partial_payment: 1,
      prepaid_discount_percent: 5,
      enable_gst: 1,
      gstin_number: process.env.STORE_GSTIN || ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Update Store Settings
router.put(['/api/settings', '/api/admin/settings'], requireAdminAuth, async (req, res) => {
  try {
    const fields = req.body;
    const keys = sanitizeKeys(fields, ALLOWED_SETTINGS_COLS);
    if (keys.length === 0) return res.json({ success: true });

    // Update MySQL
    const setSql = keys.map(k => `${k} = ?`).join(', ');
    const vals = keys.map(k => fields[k]);
    await executeMySQL(`UPDATE store_settings SET ${setSql} WHERE id = 1`, vals);

    // Update SQLite
    try {
      db.prepare(`UPDATE store_settings SET ${setSql} WHERE id = 1`).run(...vals);
    } catch (e) {}

    res.json({ success: true, message: 'Settings updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Currency Detect
router.get('/api/currency/detect', (req, res) => {
  res.json({ currency: 'INR', symbol: '₹', isIndia: true });
});

// GET Hero Config
router.get(['/api/hero-config', '/api/admin/hero-config'], async (req, res) => {
  try {
    let row = await executeMySQL('SELECT * FROM store_hero_config WHERE id = 1');
    if (row && row.length > 0) {
      const data = row[0];
      data.hero_enabled = data.hero_enabled !== undefined && data.hero_enabled !== null ? Number(data.hero_enabled) : 1;
      return res.json(data);
    }
    row = db.prepare('SELECT * FROM store_hero_config WHERE id = 1').get();
    if (row) {
      row.hero_enabled = row.hero_enabled !== undefined && row.hero_enabled !== null ? Number(row.hero_enabled) : 1;
      return res.json(row);
    }
    res.json({
      id: 1,
      hero_enabled: 1,
      active_style: 'SPLIT',
      title: 'Better Choices Better Life.',
      subtitle: 'Discover natural, healthy and premium products for a smarter, happier everyday life.',
      badge_text: '100% Certified Organic Superfoods',
      primary_btn_text: 'Shop Now',
      primary_btn_link: '/products',
      secondary_btn_text: 'Explore Offers',
      secondary_btn_link: '/offers'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Hero Config
router.put(['/api/admin/hero-config', '/api/hero-config'], requireAdminAuth, async (req, res) => {
  try {
    const fields = req.body;
    const keys = sanitizeKeys(fields, ALLOWED_HERO_COLS);
    if (keys.length === 0) return res.json({ success: true });

    const setSql = keys.map(k => `${k} = ?`).join(', ');
    const vals = keys.map(k => fields[k]);
    await executeMySQL(`UPDATE store_hero_config SET ${setSql} WHERE id = 1`, vals);
    try {
      db.prepare(`UPDATE store_hero_config SET ${setSql} WHERE id = 1`).run(...vals);
    } catch (e) {}

    // Synchronize store_sections_config.show_hero if hero_enabled was provided
    if (fields.hero_enabled !== undefined) {
      const isEnabled = (fields.hero_enabled === 1 || fields.hero_enabled === true || fields.hero_enabled === '1') ? 1 : 0;
      try {
        await executeMySQL('UPDATE store_sections_config SET show_hero = ? WHERE id = 1', [isEnabled]);
        db.prepare('UPDATE store_sections_config SET show_hero = ? WHERE id = 1').run(isEnabled);
      } catch (e) {}
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Theme Config
router.get(['/api/theme-config', '/api/admin/theme-config'], async (req, res) => {
  try {
    let row = await executeMySQL('SELECT * FROM store_theme_config WHERE id = 1');
    if (row && row.length > 0) return res.json(row[0]);
    row = db.prepare('SELECT * FROM store_theme_config WHERE id = 1').get();
    res.json(row || {
      id: 1,
      primary_color: '#164e3f',
      secondary_color: '#52b788',
      font_family: 'Outfit, Inter, sans-serif'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Theme Config
router.put(['/api/admin/theme-config', '/api/theme-config'], requireAdminAuth, async (req, res) => {
  try {
    const fields = req.body;
    const keys = sanitizeKeys(fields, ALLOWED_THEME_COLS);
    if (keys.length === 0) return res.json({ success: true });

    const setSql = keys.map(k => `${k} = ?`).join(', ');
    const vals = keys.map(k => fields[k]);
    await executeMySQL(`UPDATE store_theme_config SET ${setSql} WHERE id = 1`, vals);
    try {
      db.prepare(`UPDATE store_theme_config SET ${setSql} WHERE id = 1`).run(...vals);
    } catch (e) {}
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Sections Config
router.get(['/api/sections-config', '/api/admin/sections-config'], async (req, res) => {
  try {
    let row = await executeMySQL('SELECT * FROM store_sections_config WHERE id = 1');
    if (row && row.length > 0) return res.json(row[0]);
    row = db.prepare('SELECT * FROM store_sections_config WHERE id = 1').get();
    res.json(row || {
      id: 1,
      show_announcement_bar: 1,
      show_hero: 1,
      show_categories: 1,
      show_featured_products: 1,
      show_editorial_promo: 1,
      show_why_choose_us: 1,
      show_bestsellers: 1,
      show_brand_story: 1,
      show_testimonials: 1,
      show_instagram_feed: 1,
      show_newsletter: 1,
      show_footer: 1
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Sections Config
router.put(['/api/sections-config', '/api/admin/sections-config'], requireAdminAuth, async (req, res) => {
  try {
    const fields = req.body;
    const keys = sanitizeKeys(fields, ALLOWED_SECTIONS_COLS);
    if (keys.length === 0) return res.json({ success: true });

    const setSql = keys.map(k => `${k} = ?`).join(', ');
    const vals = keys.map(k => fields[k]);
    await executeMySQL(`UPDATE store_sections_config SET ${setSql} WHERE id = 1`, vals);
    try {
      db.prepare(`UPDATE store_sections_config SET ${setSql} WHERE id = 1`).run(...vals);
    } catch (e) {}

    // Synchronize store_hero_config.hero_enabled if show_hero was provided
    if (fields.show_hero !== undefined) {
      const isEnabled = (fields.show_hero === 1 || fields.show_hero === true || fields.show_hero === '1') ? 1 : 0;
      try {
        await executeMySQL('UPDATE store_hero_config SET hero_enabled = ? WHERE id = 1', [isEnabled]);
        db.prepare('UPDATE store_hero_config SET hero_enabled = ? WHERE id = 1').run(isEnabled);
      } catch (e) {}
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET State Taxes
router.get(['/api/admin/taxes/states', '/api/taxes/states'], requireAdminAuth, async (req, res) => {
  try {
    let rows = await executeMySQL('SELECT * FROM state_tax_rates ORDER BY state_name ASC');
    if (!rows || rows.length === 0) {
      try {
        rows = db.prepare('SELECT * FROM state_tax_rates ORDER BY state_name ASC').all() || [];
      } catch (e) {
        rows = [];
      }
    }
    res.json(rows || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT State Taxes
router.put(['/api/admin/taxes/states', '/api/taxes/states'], requireAdminAuth, async (req, res) => {
  try {
    const list = Array.isArray(req.body?.states)
      ? req.body.states
      : (Array.isArray(req.body?.rates) ? req.body.rates : (Array.isArray(req.body) ? req.body : []));

    try { await executeMySQL('ALTER TABLE state_tax_rates ADD COLUMN tax_label VARCHAR(50) DEFAULT "IGST"'); } catch (e) {}
    try { await executeMySQL('ALTER TABLE state_tax_rates ADD COLUMN tax_rule VARCHAR(50) DEFAULT "INSTEAD_OF_FEDERAL"'); } catch (e) {}

    for (const st of list) {
      const rate = Number(st.tax_rate) || 0;
      const label = st.tax_label || 'IGST';
      const rule = st.tax_rule || 'INSTEAD_OF_FEDERAL';
      const updated = await executeMySQL(
        'UPDATE state_tax_rates SET tax_rate = ?, tax_label = ?, tax_rule = ? WHERE id = ?',
        [rate, label, rule, st.id]
      );
      if (updated === null) {
        await executeMySQL('UPDATE state_tax_rates SET tax_rate = ? WHERE id = ?', [rate, st.id]);
      }
      try {
        db.prepare('UPDATE state_tax_rates SET tax_rate = ?, tax_label = ? WHERE id = ?').run(rate, label, st.id);
      } catch (e) {
        try {
          db.prepare('UPDATE state_tax_rates SET tax_rate = ? WHERE id = ?').run(rate, st.id);
        } catch (e2) {}
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset State Taxes
router.post(['/api/admin/taxes/states/reset', '/api/taxes/states/reset'], requireAdminAuth, async (req, res) => {
  try {
    await executeMySQL('UPDATE state_tax_rates SET tax_rate = 18.0');
    try {
      db.prepare('UPDATE state_tax_rates SET tax_rate = 18.0').run();
    } catch (e) {}
    res.json({ success: true, message: 'Tax rates reset to standards' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Collection Tax Overrides
router.get(['/api/admin/taxes/overrides', '/api/taxes/overrides'], requireAdminAuth, async (req, res) => {
  try {
    let rows = await executeMySQL(`
      SELECT cto.*, c.name as collection_name
      FROM collection_tax_overrides cto
      LEFT JOIN collections c ON cto.collection_id = c.id
      ORDER BY cto.id DESC
    `);
    if (!rows || rows.length === 0) {
      try {
        rows = db.prepare(`
          SELECT cto.*, c.name as collection_name
          FROM collection_tax_overrides cto
          LEFT JOIN collections c ON cto.collection_id = c.id
          ORDER BY cto.id DESC
        `).all() || [];
      } catch (e) {
        rows = [];
      }
    }
    const normalized = (rows || []).map(r => ({
      ...r,
      title: r.title || r.reason || 'Collection Tax Override',
      tax_rate: r.tax_rate !== undefined && r.tax_rate !== null ? Number(r.tax_rate) : Number(r.override_tax_rate || 0),
      state_name: r.state_name || 'ALL'
    }));
    res.json(normalized);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Collection Tax Override
router.post(['/api/admin/taxes/overrides', '/api/taxes/overrides'], requireAdminAuth, async (req, res) => {
  try {
    const { title, collection_id, tax_rate, override_tax_rate, state_name, reason } = req.body;
    const finalRate = tax_rate !== undefined ? Number(tax_rate) : Number(override_tax_rate || 0);
    const finalTitle = title || reason || 'Collection Tax Override';
    const finalState = state_name || 'ALL';

    try { await executeMySQL('ALTER TABLE collection_tax_overrides ADD COLUMN title VARCHAR(255)'); } catch (e) {}

    let myRes = await executeMySQL(
      'INSERT INTO collection_tax_overrides (title, collection_id, tax_rate, state_name) VALUES (?, ?, ?, ?)',
      [finalTitle, collection_id, finalRate, finalState]
    );
    if (myRes === null) {
      myRes = await executeMySQL(
        'INSERT INTO collection_tax_overrides (collection_id, tax_rate, state_name) VALUES (?, ?, ?)',
        [collection_id, finalRate, finalState]
      );
    }
    const newId = myRes && myRes.insertId ? myRes.insertId : Date.now();

    try {
      db.prepare('INSERT OR REPLACE INTO collection_tax_overrides (id, title, collection_id, tax_rate, state_name) VALUES (?, ?, ?, ?, ?)')
        .run(newId, finalTitle, collection_id, finalRate, finalState);
    } catch (e) {}

    res.json({ success: true, id: newId, title: finalTitle, collection_id, tax_rate: finalRate, state_name: finalState });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Collection Tax Override
router.delete(['/api/admin/taxes/overrides/:id', '/api/taxes/overrides/:id'], requireAdminAuth, async (req, res) => {
  try {
    await executeMySQL('DELETE FROM collection_tax_overrides WHERE id = ?', [req.params.id]);
    try {
      db.prepare('DELETE FROM collection_tax_overrides WHERE id = ?').run(req.params.id);
    } catch (e) {}
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// EDITORIAL PROMO BANNER CONFIG ENDPOINTS
// ==========================================

// GET Editorial Promo Config
router.get(['/api/editorial-promo', '/api/admin/editorial-promo'], async (req, res) => {
  try {
    let row = await executeMySQL('SELECT * FROM editorial_promo_config WHERE id = 1');
    if (row && row.length > 0) return res.json(row[0]);
    try {
      const sqliteRow = db.prepare('SELECT * FROM editorial_promo_config WHERE id = 1').get();
      if (sqliteRow) return res.json(sqliteRow);
    } catch (e) {}

    res.json({
      id: 1,
      badge_text: 'LIMITED TIME OFFER',
      title_part1: 'Pure Products',
      title_part2: 'Happier Lives',
      subtitle: 'Flat 20% Off on Natural Essentials & Certified Organics',
      cta_text: 'Shop the Collection',
      cta_link: '/offers',
      image_url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
      script_quote: 'Nature Nurtures You',
      quote_subtext: '🌿 Handcrafted with Care',
      is_enabled: 1
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Editorial Promo Config
router.put(['/api/editorial-promo', '/api/admin/editorial-promo'], requireAdminAuth, async (req, res) => {
  try {
    const fields = req.body;
    const keys = sanitizeKeys(fields, ALLOWED_EDITORIAL_COLS);
    if (keys.length === 0) return res.json({ success: true });

    const setSql = keys.map(k => `${k} = ?`).join(', ');
    const vals = keys.map(k => fields[k]);
    await executeMySQL(`UPDATE editorial_promo_config SET ${setSql} WHERE id = 1`, vals);

    try {
      db.prepare(`UPDATE editorial_promo_config SET ${setSql} WHERE id = 1`).run(...vals);
    } catch (e) {}

    res.json({ success: true, message: 'Editorial promo updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// BRAND STORY SECTION CONFIG ENDPOINTS
// ==========================================

// GET Brand Story Config
router.get(['/api/brand-story', '/api/admin/brand-story'], async (req, res) => {
  try {
    let row = await executeMySQL('SELECT * FROM brand_story_config WHERE id = 1');
    if (row && row.length > 0) return res.json(row[0]);
    try {
      const sqliteRow = db.prepare('SELECT * FROM brand_story_config WHERE id = 1').get();
      if (sqliteRow) return res.json(sqliteRow);
    } catch (e) {}

    res.json({
      id: 1,
      badge_text: 'WHO WE ARE',
      heading: 'Our Story',
      overlay_title: 'A Healthier',
      overlay_subtitle: 'Tomorrow Together',
      description: 'At ValueLife, we believe in the power of nature to create a healthier, happier world. Our mission is to bring you high-quality, natural and sustainable products for a better everyday life.',
      cta_text: 'Learn More',
      cta_link: '/pages/about-us',
      image_url: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1000&q=80',
      is_enabled: 1
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Brand Story Config
router.put(['/api/brand-story', '/api/admin/brand-story'], requireAdminAuth, async (req, res) => {
  try {
    const fields = req.body;
    const keys = sanitizeKeys(fields, ALLOWED_BRAND_STORY_COLS);
    if (keys.length === 0) return res.json({ success: true });

    const setSql = keys.map(k => `${k} = ?`).join(', ');
    const vals = keys.map(k => fields[k]);
    await executeMySQL(`UPDATE brand_story_config SET ${setSql} WHERE id = 1`, vals);

    try {
      db.prepare(`UPDATE brand_story_config SET ${setSql} WHERE id = 1`).run(...vals);
    } catch (e) {}

    res.json({ success: true, message: 'Brand story updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
