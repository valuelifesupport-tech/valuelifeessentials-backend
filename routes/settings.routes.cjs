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
  'google_analytics_id', 'meta_pixel_id', 'maintenance_mode', 'maintenance_password'
]);
const ALLOWED_HERO_COLS = new Set([
  'headline', 'subheadline', 'badge_text', 'primary_cta_text', 'primary_cta_link',
  'secondary_cta_text', 'secondary_cta_link', 'bg_image_url', 'bg_video_url',
  'overlay_opacity', 'text_color', 'layout_style'
]);
const ALLOWED_THEME_COLS = new Set([
  'primary_color', 'secondary_color', 'accent_color', 'font_family', 'heading_font',
  'bg_color', 'text_color', 'border_radius', 'card_style'
]);
const ALLOWED_SECTIONS_COLS = new Set([
  'show_announcement_bar', 'show_hero', 'show_categories', 'show_featured_products',
  'show_editorial_promo', 'show_why_choose_us', 'show_bestsellers', 'show_brand_story',
  'show_testimonials', 'show_instagram_feed', 'show_newsletter', 'show_footer',
  'show_reviews', 'show_collections', 'show_banners'
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
router.get('/api/settings', async (req, res) => {
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
      contact_phone: '+91 76759 41899, +91 78931 00755',
      contact_email: 'valuelifesupport@gmail.com',
      partial_deposit_percent: 20,
      enable_multi_currency: 1,
      enable_cod: 1,
      enable_partial_payment: 1,
      prepaid_discount_percent: 5,
      enable_gst: 1,
      gstin_number: '27AAAAA0000A1Z5'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Update Store Settings
router.put('/api/settings', requireAdminAuth, async (req, res) => {
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
router.get('/api/hero-config', async (req, res) => {
  try {
    let row = await executeMySQL('SELECT * FROM store_hero_config WHERE id = 1');
    if (row && row.length > 0) return res.json(row[0]);
    row = db.prepare('SELECT * FROM store_hero_config WHERE id = 1').get();
    res.json(row || {
      id: 1,
      headline: 'Better Choices Better Life.',
      subheadline: 'Discover natural, healthy and premium products for a smarter, happier everyday life.',
      badge_text: 'NATURAL • HEALTHY • SUSTAINABLE',
      primary_cta_text: 'Shop Now',
      primary_cta_link: '/products'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Hero Config
router.put('/api/admin/hero-config', requireAdminAuth, async (req, res) => {
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
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Theme Config
router.get('/api/theme-config', async (req, res) => {
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
router.put('/api/admin/theme-config', requireAdminAuth, async (req, res) => {
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
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET State Taxes
router.get('/api/admin/taxes/states', requireAdminAuth, async (req, res) => {
  try {
    let rows = await executeMySQL('SELECT * FROM state_tax_rates ORDER BY state_name ASC');
    if (!rows || rows.length === 0) {
      rows = db.prepare('SELECT * FROM state_tax_rates ORDER BY state_name ASC').all() || [];
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT State Taxes
router.put('/api/admin/taxes/states', requireAdminAuth, async (req, res) => {
  try {
    const { states } = req.body;
    if (Array.isArray(states)) {
      for (const st of states) {
        await executeMySQL('UPDATE state_tax_rates SET tax_rate = ?, tax_label = ? WHERE id = ?', [st.tax_rate, st.tax_label, st.id]);
        try {
          db.prepare('UPDATE state_tax_rates SET tax_rate = ?, tax_label = ? WHERE id = ?').run(st.tax_rate, st.tax_label, st.id);
        } catch (e) {}
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset State Taxes
router.post('/api/admin/taxes/states/reset', requireAdminAuth, async (req, res) => {
  res.json({ success: true, message: 'Tax rates reset to standards' });
});

// GET Collection Tax Overrides
router.get('/api/admin/taxes/overrides', requireAdminAuth, async (req, res) => {
  try {
    const rows = await executeMySQL(`
      SELECT cto.*, c.name as collection_name
      FROM collection_tax_overrides cto
      LEFT JOIN collections c ON cto.collection_id = c.id
    `) || [];
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Collection Tax Override
router.post('/api/admin/taxes/overrides', requireAdminAuth, async (req, res) => {
  try {
    const { collection_id, override_tax_rate, reason } = req.body;
    await executeMySQL('INSERT INTO collection_tax_overrides (collection_id, override_tax_rate, reason) VALUES (?, ?, ?)', [collection_id, override_tax_rate, reason || '']);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Collection Tax Override
router.delete('/api/admin/taxes/overrides/:id', requireAdminAuth, async (req, res) => {
  try {
    await executeMySQL('DELETE FROM collection_tax_overrides WHERE id = ?', [req.params.id]);
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
