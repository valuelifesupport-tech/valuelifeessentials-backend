require('dotenv').config();
const path = require('path');

let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.log('⚠️ better-sqlite3 module not available on Linux. Production MySQL mode active.');
}

const defaultHeroConfig = {
  id: 1, hero_enabled: 1, active_style: 'SPLIT',
  badge_text: '100% Certified Organic Superfoods',
  title: 'Pure Farm-Fresh Organic Groceries & Wellness Supplies',
  subtitle: 'Delivering chemical-free superfoods, edible seeds, virgin oils & herbal supplements straight from certified organic farms.',
  primary_btn_text: 'Shop Catalog Now', primary_btn_link: '/products',
  secondary_btn_text: 'Explore Organic Offers', secondary_btn_link: '/offers',
  image_url: 'https://images.unsplash.com/photo-1615811361523-6bd03d7748e7?auto=format&fit=crop&w=1000&q=80',
  bg_image_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1600&q=80',
  card_1_title: 'Edible Chia & Flax Seeds', card_1_sub: 'Rich in Omega-3 & Fiber',
  card_1_img: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=600&q=80',
  card_2_title: 'Pure Ashwagandha Powder', card_2_sub: '100% Natural Immunity Booster',
  card_2_img: 'https://images.unsplash.com/photo-1592417817098-8f3d6ef23a2a?auto=format&fit=crop&w=600&q=80'
};

const defaultThemeConfig = {
  id: 1, active_preset: 'EMERALD', primary_color: '#3b6e14', primary_hover: '#2e5710',
  secondary_color: '#f8f7f2', accent_color: '#f59e0b', heading_font: 'Outfit',
  body_font: 'Inter', border_radius: 'rounded-3xl', header_style: 'EMERALD_DARK',
  card_style: 'VALUELIFE_ESSENTIALS', dark_mode: 0
};

const defaultSectionsConfig = {
  id: 1, show_announcement: 1, show_hero: 1, show_trust_badges: 1, show_promo_banners: 1,
  show_categories_slider: 1, show_bestsellers: 1, show_catalog_grid: 1, show_footer: 1,
  show_sales_ticker: 1, sales_ticker_json: '[]',
  trust_badge_1_title: '100% Pure Organic', trust_badge_1_sub: 'Chemical-free bio products',
  trust_badge_2_title: 'Fast Home Delivery', trust_badge_2_sub: 'Safe packaging across India',
  trust_badge_3_title: 'Partial Payment & COD', trust_badge_3_sub: 'Pay 20% deposit online',
  trust_badge_4_title: 'Top Rated Service', trust_badge_4_sub: '4.9 ★ Average Reviews',
  category_slider_title: 'Shop By Categories', bestsellers_title: '🔥 Best Seller Products',
  bestsellers_badge: 'HIGH DEMAND ITEMS', bestsellers_count: 8
};

const defaultStoreSettings = {
  id: 1, announcement_text: 'Get 15% OFF + Free Home Delivery! Use Code: VALUELIFE15',
  announcement_code: 'VALUELIFE15', contact_phone: '+91 98765 43210',
  contact_email: 'support@valuelifeessentials.com', partial_deposit_percent: 20,
  enable_multi_currency: 1, enable_cod: 1, enable_partial_payment: 1,
  partial_payment_heading: 'Choose Payment Breakdown Option:',
  partial_payment_subtext: 'Pay rest on Delivery', prepaid_discount_percent: 5,
  enable_gst: 1, gstin_number: '27AAAAA0000A1Z5', store_state: 'Maharashtra',
  default_gst_percent: 5.0, gst_type: 'INCLUSIVE', legal_business_name: 'ValueLife Essentials Private Limited',
  all_prices_include_tax: 1, federal_tax_rate: 0.0
};

const fallbackDbFile = path.join(__dirname, 'fallback_db.json');

const defaultCategories = [
  { id: 1, name: 'Organic Fertilizers', slug: 'organic-fertilizers', description: 'Bio-fertilizers, vermicompost & organic soil boosters', icon: '🌿', image_url: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=600&q=80' },
  { id: 2, name: 'Seeds & Gardening', slug: 'seeds-and-gardening', description: 'Hybrid vegetable, flower & herb seeds', icon: '🌱', image_url: 'https://images.unsplash.com/photo-1592417817098-8f3d6ef23a2a?auto=format&fit=crop&w=600&q=80' },
  { id: 3, name: 'Pots & Grow Bags', slug: 'pots-and-grow-bags', description: 'Heavy duty HDPE grow bags & plastic pots', icon: '🪴', image_url: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=600&q=80' },
  { id: 4, name: 'Garden Tools', slug: 'garden-tools', description: 'Pruning shears, sprayer pumps & watering cans', icon: '🛠️', image_url: 'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&fit=crop&w=600&q=80' },
  { id: 5, name: 'Pest Control & Care', slug: 'pest-control', description: 'Neem oil spray, bio insecticides & plant protection', icon: '🐛', image_url: 'https://images.unsplash.com/photo-1615811361523-6bd03d7748e7?auto=format&fit=crop&w=600&q=80' }
];

const defaultCollections = [
  { id: 1, name: 'Best Sellers 2026', slug: 'best-sellers', description: 'Top rated terrace gardening supplies', image_url: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=800&q=80', category_id: 1 }
];

const defaultSubcategories = [
  { id: 1, category_id: 1, name: 'Vermicompost & Manure', slug: 'vermicompost-manure' },
  { id: 2, category_id: 1, name: 'Bio Liquid Boosters', slug: 'bio-liquid-boosters' },
  { id: 3, category_id: 2, name: 'Vegetable Seeds', slug: 'vegetable-seeds' },
  { id: 4, category_id: 2, name: 'Flower Seeds', slug: 'flower-seeds' },
  { id: 5, category_id: 3, name: 'HDPE Grow Bags', slug: 'hdpe-grow-bags' },
  { id: 6, category_id: 4, name: 'Water Sprayers & Pumps', slug: 'water-sprayers' }
];

let fallbackStore = {
  categories: [...defaultCategories],
  subcategories: [...defaultSubcategories],
  collections: [...defaultCollections],
  products: [],
  product_variants: [],
  product_images: [],
  product_collections: [],
  orders: [],
  order_items: [],
  users: [],
  banners: [],
  coupons: [],
  custom_pages: [],
  product_filter_groups: [],
  product_filter_options: [],
  store_settings: { ...defaultStoreSettings },
  store_hero_config: { ...defaultHeroConfig },
  store_theme_config: { ...defaultThemeConfig },
  store_sections_config: { ...defaultSectionsConfig }
};

try {
  const fs = require('fs');
  if (fs.existsSync(fallbackDbFile)) {
    const raw = fs.readFileSync(fallbackDbFile, 'utf8');
    const parsed = JSON.parse(raw);
    fallbackStore = { ...fallbackStore, ...parsed };
    if (!Array.isArray(fallbackStore.categories)) fallbackStore.categories = [...defaultCategories];
    if (!Array.isArray(fallbackStore.subcategories)) fallbackStore.subcategories = [...defaultSubcategories];
    if (!Array.isArray(fallbackStore.collections)) fallbackStore.collections = [...defaultCollections];
    if (!fallbackStore.product_collections) fallbackStore.product_collections = [];
  } else {
    fs.writeFileSync(fallbackDbFile, JSON.stringify(fallbackStore, null, 2));
  }
} catch (e) {}

function saveFallbackStore() {
  try {
    const fs = require('fs');
    fs.writeFileSync(fallbackDbFile, JSON.stringify(fallbackStore, null, 2));
  } catch (e) {}
}

const dbPath = path.join(__dirname, 'ecommerce.db');
const db = Database ? new Database(dbPath) : {
  pragma: () => {},
  exec: () => {},
  prepare: (sql) => {
    const s = String(sql || '').toLowerCase();
    
    return {
      run: (...params) => {
        const nowId = Date.now();
        if (s.includes('insert into categories')) {
          const [name, slug, description, image_url, icon] = params;
          const newCat = { id: nowId, name, slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), description: description || '', image_url: image_url || '', icon: icon || '🌿' };
          fallbackStore.categories.push(newCat);
          saveFallbackStore();
          return { lastInsertRowid: nowId, changes: 1 };
        }
        if (s.includes('update categories set')) {
          const [name, slug, description, image_url, icon, id] = params;
          if (fallbackStore.categories) {
            fallbackStore.categories = fallbackStore.categories.map(c => 
              String(c.id) === String(id) ? { ...c, name, slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), description: description || '', image_url: image_url || '', icon: icon || '🌿' } : c
            );
            saveFallbackStore();
          }
          return { changes: 1 };
        }
        if (s.includes('insert into subcategories')) {
          const [category_id, name, slug] = params;
          if (!fallbackStore.subcategories) fallbackStore.subcategories = [];
          const newSub = { id: nowId, category_id: Number(category_id), name, slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-') };
          fallbackStore.subcategories.push(newSub);
          saveFallbackStore();
          return { lastInsertRowid: nowId, changes: 1 };
        }
        if (s.includes('update subcategories set name =')) {
          const [name, slug, id] = params;
          if (fallbackStore.subcategories) {
            fallbackStore.subcategories = fallbackStore.subcategories.map(sub => 
              String(sub.id) === String(id) ? { ...sub, name, slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-') } : sub
            );
            saveFallbackStore();
          }
          return { changes: 1 };
        }
        if (s.includes('delete from subcategories where id =')) {
          const [id] = params;
          if (fallbackStore.subcategories) {
            fallbackStore.subcategories = fallbackStore.subcategories.filter(sub => String(sub.id) !== String(id));
            saveFallbackStore();
          }
          return { changes: 1 };
        }
        if (s.includes('insert into collections')) {
          const [name, slug, description, image_url, category_id] = params;
          const newColl = { id: nowId, name, slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), description: description || '', image_url: image_url || '', category_id: category_id || 1, show_in_navbar: 0 };
          if (!fallbackStore.collections) fallbackStore.collections = [];
          fallbackStore.collections.push(newColl);
          saveFallbackStore();
          return { lastInsertRowid: nowId, changes: 1 };
        }
        if (s.includes('update collections') && s.includes('show_in_navbar =') && s.includes('image_url =')) {
          const [name, slug, description, image_url, category_id, show_in_navbar, id] = params;
          if (fallbackStore.collections) {
            fallbackStore.collections = fallbackStore.collections.map(c => 
              String(c.id) === String(id) ? { ...c, name, slug: slug || c.slug, description: description || '', image_url: image_url || c.image_url, category_id: category_id || c.category_id, show_in_navbar: show_in_navbar !== undefined ? show_in_navbar : c.show_in_navbar } : c
            );
            saveFallbackStore();
          }
          return { changes: 1 };
        }
        if (s.includes('update collections') && s.includes('image_url =')) {
          const [name, slug, description, image_url, category_id, id] = params;
          if (fallbackStore.collections) {
            fallbackStore.collections = fallbackStore.collections.map(c => 
              String(c.id) === String(id) ? { ...c, name, slug: slug || c.slug, description: description || '', image_url: image_url || c.image_url, category_id: category_id || c.category_id } : c
            );
            saveFallbackStore();
          }
          return { changes: 1 };
        }
        if (s.includes('update collections set show_in_navbar =')) {
          const [show_in_navbar, id] = params;
          if (fallbackStore.collections) {
            fallbackStore.collections = fallbackStore.collections.map(c => 
              String(c.id) === String(id) ? { ...c, show_in_navbar } : c
            );
            saveFallbackStore();
          }
          return { changes: 1 };
        }
        if (s.includes('delete from collections where id =')) {
          const [id] = params;
          if (fallbackStore.collections) {
            fallbackStore.collections = fallbackStore.collections.filter(c => String(c.id) !== String(id));
            saveFallbackStore();
          }
          return { changes: 1 };
        }
        if (s.includes('delete from product_collections where collection_id =')) {
          const [collection_id] = params;
          if (fallbackStore.product_collections) {
            fallbackStore.product_collections = fallbackStore.product_collections.filter(pc => String(pc.collection_id) !== String(collection_id));
            saveFallbackStore();
          }
          return { changes: 1 };
        }
        if (s.includes('insert into product_collections')) {
          const [product_id, collection_id] = params;
          if (!fallbackStore.product_collections) fallbackStore.product_collections = [];
          fallbackStore.product_collections.push({ id: nowId, product_id, collection_id });
          saveFallbackStore();
          return { lastInsertRowid: nowId, changes: 1 };
        }
        if (s.includes('delete from product_collections where product_id =')) {
          const [product_id] = params;
          if (fallbackStore.product_collections) {
            fallbackStore.product_collections = fallbackStore.product_collections.filter(pc => String(pc.product_id) !== String(product_id));
            saveFallbackStore();
          }
          return { changes: 1 };
        }
        if (s.includes('insert into products')) {
          const [title, slug, sku, barcode, status, vendor, product_type, cleanTags, category_id, subcategory_id, description, price_inr, price_usd, discount_inr, discount_usd] = params;
          const newProd = {
            id: nowId, title, slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), sku: sku || `VLE-PROD-${nowId}`,
            barcode, status: status || 'Active', vendor: vendor || 'VALUELIFE ESSENTIALS', product_type: product_type || 'Garden Supplies',
            tags: cleanTags, category_id: category_id || 1, subcategory_id, description: description || '',
            price_inr: Number(price_inr || 0), price_usd: Number(price_usd || Math.round((price_inr || 0)/40)),
            discount_inr: Number(discount_inr || price_inr || 0), discount_usd: Number(discount_usd || price_usd || Math.round((price_inr || 0)/40)),
            stock: 100, created_at: new Date().toISOString()
          };
          fallbackStore.products.push(newProd);
          saveFallbackStore();
          return { lastInsertRowid: nowId, changes: 1 };
        }
        if (s.includes('insert into product_images')) {
          const [product_id, image_url, is_primary] = params;
          fallbackStore.product_images.push({ id: nowId, product_id, image_url, is_primary: is_primary ? 1 : 0 });
          saveFallbackStore();
          return { lastInsertRowid: nowId, changes: 1 };
        }
        if (s.includes('delete from products where id =')) {
          const [id] = params;
          fallbackStore.products = fallbackStore.products.filter(p => String(p.id) !== String(id));
          if (fallbackStore.product_collections) {
            fallbackStore.product_collections = fallbackStore.product_collections.filter(pc => String(pc.product_id) !== String(id));
          }
          saveFallbackStore();
          return { changes: 1 };
        }
        if (s.includes('delete from categories where id =')) {
          const [id] = params;
          fallbackStore.categories = fallbackStore.categories.filter(c => String(c.id) !== String(id));
          saveFallbackStore();
          return { changes: 1 };
        }
        return { lastInsertRowid: nowId, changes: 1 };
      },
      get: (...params) => {
        if (s.includes('store_hero_config')) return fallbackStore.store_hero_config;
        if (s.includes('store_theme_config')) return fallbackStore.store_theme_config;
        if (s.includes('store_sections_config')) return fallbackStore.store_sections_config;
        if (s.includes('store_settings')) return fallbackStore.store_settings;
        if (s.includes('from products where id =')) {
          const [id] = params;
          return fallbackStore.products.find(p => String(p.id) === String(id)) || null;
        }
        if (s.includes('from collections where')) {
          const [p1] = params;
          return fallbackStore.collections.find(c => String(c.slug).toLowerCase() === String(p1).toLowerCase() || String(c.id) === String(p1)) || null;
        }
        if (s.includes('from users where')) {
          const [p1, p2] = params;
          return fallbackStore.users.find(u => String(u.phone) === String(p1) || String(u.email).toLowerCase() === String(p2).toLowerCase()) || null;
        }
        return { count: 0, cnt: 0 };
      },
      all: (...params) => {
        if (s.includes('from categories')) return fallbackStore.categories || [];
        if (s.includes('from subcategories')) return fallbackStore.subcategories || [];
        if (s.includes('from collections')) return fallbackStore.collections || [];
        if (s.includes('from product_collections')) return fallbackStore.product_collections || [];
        if (s.includes('from products')) return fallbackStore.products || [];
        if (s.includes('from product_variants')) return fallbackStore.product_variants || [];
        if (s.includes('from product_images')) return fallbackStore.product_images || [];
        if (s.includes('from orders')) {
          if (s.includes('customer_email') || s.includes('customer_phone') || s.includes('where lower(')) {
            const p1 = params[0] ? String(params[0]).toLowerCase() : '';
            const p2 = params[1] ? String(params[1]).toLowerCase() : p1;
            return (fallbackStore.orders || []).filter(o => {
              const emailMatch = o.customer_email && (String(o.customer_email).toLowerCase() === p1 || String(o.customer_email).toLowerCase() === p2);
              const phoneMatch = o.customer_phone && (String(o.customer_phone).toLowerCase() === p1 || String(o.customer_phone).toLowerCase() === p2);
              return emailMatch || phoneMatch;
            });
          }
          return fallbackStore.orders || [];
        }
        if (s.includes('from order_items')) {
          if (s.includes('order_id =')) {
            const oId = params[0];
            return (fallbackStore.order_items || []).filter(oi => String(oi.order_id) === String(oId));
          }
          return fallbackStore.order_items || [];
        }
        if (s.includes('from banners')) return fallbackStore.banners || [];
        if (s.includes('from coupons')) return fallbackStore.coupons || [];
        if (s.includes('from custom_pages')) return fallbackStore.custom_pages || [];
        if (s.includes('from product_filter_groups')) return fallbackStore.product_filter_groups || [];
        if (s.includes('from product_filter_options')) return fallbackStore.product_filter_options || [];
        return [];
      }
    };
  }
};

if (Database) {
  try { db.pragma('foreign_keys = ON'); } catch (e) {}
}

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS store_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      announcement_text TEXT DEFAULT 'Get 15% OFF + Free Home Delivery! Use Code: VALUELIFE15',
      announcement_code TEXT DEFAULT 'VALUELIFE15',
      contact_phone TEXT DEFAULT '+91 98765 43210',
      contact_email TEXT DEFAULT 'support@valuelifeessentials.com',
      partial_deposit_percent INTEGER DEFAULT 20,
      enable_multi_currency INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password TEXT,
      role TEXT DEFAULT 'CUSTOMER',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      image_url TEXT,
      icon TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subcategories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      image_url TEXT,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      sku TEXT UNIQUE,
      barcode TEXT,
      status TEXT DEFAULT 'Active',
      vendor TEXT DEFAULT 'OrganicBazar',
      product_type TEXT DEFAULT 'Garden Supplies',
      tags TEXT DEFAULT 'organic, terrace garden',
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      subcategory_id INTEGER REFERENCES subcategories(id) ON DELETE SET NULL,
      description TEXT,
      price_inr REAL NOT NULL,
      price_usd REAL NOT NULL,
      discount_inr REAL,
      discount_usd REAL,
      compare_price_inr REAL,
      compare_price_usd REAL,
      cost_per_item_inr REAL,
      cost_per_item_usd REAL,
      stock INTEGER DEFAULT 100,
      track_inventory INTEGER DEFAULT 1,
      weight REAL DEFAULT 0.5,
      hs_code TEXT DEFAULT '310100',
      country_of_origin TEXT DEFAULT 'India',
      is_best_product INTEGER DEFAULT 0,
      seo_title TEXT,
      seo_description TEXT,
      seo_keywords TEXT,
      specs_json TEXT,
      frequently_bought_ids TEXT,
      related_collection_ids TEXT,
      related_mode TEXT DEFAULT 'PRODUCTS',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      variant_name TEXT NOT NULL,
      sku TEXT,
      price_inr REAL NOT NULL,
      price_usd REAL NOT NULL,
      discount_inr REAL,
      discount_usd REAL,
      stock INTEGER DEFAULT 50,
      image_url TEXT
    );

    CREATE TABLE IF NOT EXISTS product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      is_primary INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS product_collections (
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      collection_id INTEGER REFERENCES collections(id) ON DELETE CASCADE,
      PRIMARY KEY (product_id, collection_id)
    );

    CREATE TABLE IF NOT EXISTS product_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      user_name TEXT NOT NULL,
      user_email TEXT,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      title TEXT,
      comment TEXT,
      is_verified_buyer INTEGER DEFAULT 1,
      status TEXT DEFAULT 'APPROVED',
      admin_reply TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS review_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id INTEGER REFERENCES product_reviews(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      discount_type TEXT CHECK (discount_type IN ('PERCENT', 'FLAT')) NOT NULL,
      discount_value REAL NOT NULL,
      min_spend_inr REAL DEFAULT 0,
      min_spend_usd REAL DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      shipping_address TEXT NOT NULL,
      country TEXT NOT NULL,
      currency TEXT NOT NULL,
      total_amount REAL NOT NULL,
      paid_amount REAL NOT NULL,
      remaining_amount REAL NOT NULL,
      payment_mode TEXT NOT NULL,
      payment_status TEXT DEFAULT 'PARTIAL_PAID',
      order_status TEXT DEFAULT 'PROCESSING',
      order_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS banners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      subtitle TEXT,
      image_url TEXT NOT NULL,
      link_url TEXT,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS analytics_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      page_url TEXT,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      action TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS custom_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL,
      seo_title TEXT,
      seo_description TEXT,
      status TEXT DEFAULT 'PUBLISHED',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Auto-migrate missing columns for users table if needed
  try { db.exec('ALTER TABLE users ADD COLUMN phone TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE users ADD COLUMN address TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE users ADD COLUMN city TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE users ADD COLUMN pincode TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE users ADD COLUMN state TEXT'); } catch(e) {}

  // Seed default CMS pages if empty
  const pageCount = db.prepare('SELECT COUNT(*) as count FROM custom_pages').get().count;
  if (pageCount === 0) {
    db.prepare(`
      INSERT INTO custom_pages (title, slug, content, seo_title, seo_description, status) VALUES
      (
        'About Us',
        'about-us',
        '# Welcome to OrganicBazar\n\nOrganicBazar is India''s premier certified **100% organic grocery and wellness store** committed to pure, chemical-free living.\n\n### Our Mission\nWe partner directly with certified organic farmers across India to deliver farm-fresh superfoods, edible seeds, cold-pressed virgin oils, Lakadong turmeric, and chemical-free skincare straight to your doorstep.\n\n### Why Choose Us?\n- **100% Certified Organic**: Zero pesticides, artificial additives, or preservatives.\n- **Direct Farm Sourcing**: Empowering local organic farmers with fair trade prices.\n- **Quality Tested**: Every batch undergoes strict purity checks in accredited labs.\n- **Sustainable Packaging**: Eco-friendly and recyclable packaging materials.',
        'About OrganicBazar - Certified 100% Organic Store',
        'Learn about OrganicBazar mission to bring certified chemical-free organic groceries and wellness products to Indian homes.',
        'PUBLISHED'
      ),
      (
        'Contact Us',
        'contact-us',
        '# Contact OrganicBazar Customer Support\n\nHave questions about your order or need product guidance? We''re here to help!\n\n### Get in Touch\n- **Email Support**: support@organicbazar.com\n- **Toll-Free Phone**: 1800-123-4567 (Mon-Sat, 9 AM - 7 PM IST)\n- **WhatsApp Assistance**: +91 98123 45678\n- **Head Office**: OrganicBazar Pvt Ltd, Green Tech Park, Sector 62, Noida, Uttar Pradesh 201309\n\nFill out our interactive inquiry form below and our wellness experts will respond within 2 hours.',
        'Contact Us - OrganicBazar Customer Support',
        'Get in touch with OrganicBazar support for order inquiries, product guidance, and customer service.',
        'PUBLISHED'
      ),
      (
        'Shipping & Delivery Policy',
        'shipping-policy',
        '# Shipping & Delivery Policy\n\nWe deliver 100% fresh organic groceries and wellness supplies across all pin codes in India.\n\n### Delivery Timelines\n- **Metro Cities**: 1 to 3 Business Days\n- **Rest of India**: 3 to 5 Business Days\n- **Same Day Dispatch**: Orders placed before 2 PM IST are dispatched on the same day.\n\n### Shipping Charges\n- **Free Shipping** on orders above ₹499.\n- Flat ₹49 shipping fee on orders below ₹499.\n\n### Order Tracking\nOnce your order is shipped, you will receive an SMS and email notification with your AWB tracking link.',
        'Shipping & Delivery Policy - OrganicBazar',
        'Read OrganicBazar fast home delivery timelines, free shipping thresholds, and order tracking policy.',
        'PUBLISHED'
      ),
      (
        'Privacy Policy',
        'privacy-policy',
        '# Privacy Policy\n\nAt OrganicBazar, protecting your personal information and privacy is our top priority.\n\n### Information We Collect\nWe collect basic details such as your name, email, phone number, and delivery address strictly to process your orders and provide customer support.\n\n### Data Security Guarantee\n- We **never sell or share** your personal information with third parties.\n- All payment transactions are encrypted using 256-bit SSL technology.\n- You can request data deletion at any time by contacting support@organicbazar.com.',
        'Privacy Policy - OrganicBazar Data Protection',
        'OrganicBazar strict privacy policy and 256-bit SSL customer data protection guarantee.',
        'PUBLISHED'
      );
    `);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS product_filter_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      filter_key TEXT UNIQUE NOT NULL,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS product_filter_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER REFERENCES product_filter_groups(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      value TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );
  `);

  // Seed default Organic Grocery & Wellness filters if empty
  const filterGroupCount = db.prepare('SELECT COUNT(*) as count FROM product_filter_groups').get().count;
  if (filterGroupCount === 0) {
    const insertGrp = db.prepare('INSERT INTO product_filter_groups (name, filter_key, sort_order) VALUES (?, ?, ?)');
    const insertOpt = db.prepare('INSERT INTO product_filter_options (group_id, label, value, sort_order) VALUES (?, ?, ?, ?)');

    const filterSeed = [
      {
        name: 'Form / Type',
        key: 'form',
        options: [
          { label: 'Organic Powders', value: 'powder' },
          { label: 'Raw Seeds', value: 'seeds' },
          { label: 'Whole Spices', value: 'spices' },
          { label: 'Purified Resin', value: 'resin' },
          { label: 'Plant Protein', value: 'protein' },
          { label: 'Natural Clay', value: 'clay' }
        ]
      },
      {
        name: 'Dietary & Certification',
        key: 'dietary',
        options: [
          { label: '100% Certified Organic', value: 'certified_organic' },
          { label: 'Vegan & Plant-Based', value: 'vegan' },
          { label: 'Gluten-Free', value: 'gluten_free' },
          { label: 'Non-GMO', value: 'non_gmo' },
          { label: 'Pesticide Free', value: 'pesticide_free' }
        ]
      },
      {
        name: 'Health Benefit',
        key: 'benefit',
        options: [
          { label: 'Immunity Booster', value: 'immunity' },
          { label: 'Stress & Stamina', value: 'stamina' },
          { label: 'Hair & Skin Care', value: 'hair_skin' },
          { label: 'Digestion & Gut Health', value: 'digestion' },
          { label: 'Weight Management', value: 'weight_management' }
        ]
      },
      {
        name: 'Price Range',
        key: 'price_range',
        options: [
          { label: 'Under ₹200', value: 'under_200' },
          { label: '₹200 - ₹500', value: '200_500' },
          { label: '₹500 - ₹1000', value: '500_1000' },
          { label: 'Above ₹1000', value: 'above_1000' }
        ]
      },
      {
        name: 'Pack Size',
        key: 'pack_size',
        options: [
          { label: '100g Jar', value: '100g' },
          { label: '250g Pack', value: '250g' },
          { label: '500g Jar', value: '500g' },
          { label: '1 Kg Family Pack', value: '1kg' }
        ]
      }
    ];

    filterSeed.forEach((grp, gIdx) => {
      const info = insertGrp.run(grp.name, grp.key, gIdx + 1);
      grp.options.forEach((opt, oIdx) => {
        insertOpt.run(info.lastInsertRowid, opt.label, opt.value, oIdx + 1);
      });
    });
  }

  try { db.exec(`ALTER TABLE coupons ADD COLUMN coupon_category TEXT DEFAULT 'amount_off_order'`); } catch (e) {}
  try { db.exec(`ALTER TABLE coupons ADD COLUMN applies_to_type TEXT DEFAULT 'all'`); } catch (e) {}
  try { db.exec(`ALTER TABLE coupons ADD COLUMN target_ids TEXT DEFAULT '[]'`); } catch (e) {}
  try { db.exec(`ALTER TABLE coupons ADD COLUMN buy_qty INTEGER DEFAULT 1`); } catch (e) {}
  try { db.exec(`ALTER TABLE coupons ADD COLUMN get_qty INTEGER DEFAULT 1`); } catch (e) {}
  try { db.exec(`ALTER TABLE coupons ADD COLUMN get_discount_type TEXT DEFAULT 'FREE'`); } catch (e) {}
  try { db.exec(`ALTER TABLE store_settings ADD COLUMN enable_multi_currency INTEGER DEFAULT 1`); } catch (e) {}
  try { db.exec(`ALTER TABLE store_settings ADD COLUMN enable_cod INTEGER DEFAULT 1`); } catch (e) {}
  try { db.exec(`ALTER TABLE store_settings ADD COLUMN enable_partial_payment INTEGER DEFAULT 1`); } catch (e) {}
  try { db.exec(`ALTER TABLE store_settings ADD COLUMN partial_payment_heading TEXT DEFAULT 'Choose Payment Breakdown Option:'`); } catch (e) {}
  try { db.exec(`ALTER TABLE store_settings ADD COLUMN partial_payment_subtext TEXT DEFAULT 'Pay rest on Delivery'`); } catch (e) {}
  try { db.exec(`ALTER TABLE store_settings ADD COLUMN prepaid_discount_percent INTEGER DEFAULT 0`); } catch (e) {}
  
  // GST Tax & Invoice Configuration Migrations
  try { db.exec(`ALTER TABLE store_settings ADD COLUMN enable_gst INTEGER DEFAULT 1`); } catch (e) {}
  try { db.exec(`ALTER TABLE store_settings ADD COLUMN gstin_number TEXT DEFAULT '27AAAAA0000A1Z5'`); } catch (e) {}
  try { db.exec(`ALTER TABLE store_settings ADD COLUMN store_state TEXT DEFAULT 'Maharashtra'`); } catch (e) {}
  try { db.exec(`ALTER TABLE store_settings ADD COLUMN default_gst_percent REAL DEFAULT 5.0`); } catch (e) {}
  try { db.exec(`ALTER TABLE store_settings ADD COLUMN gst_type TEXT DEFAULT 'INCLUSIVE'`); } catch (e) {}
  try { db.exec(`ALTER TABLE store_settings ADD COLUMN legal_business_name TEXT DEFAULT 'OrganicBazar Retail Private Limited'`); } catch (e) {}
  try { db.exec(`ALTER TABLE store_settings ADD COLUMN all_prices_include_tax INTEGER DEFAULT 1`); } catch (e) {}
  try { db.exec(`ALTER TABLE store_settings ADD COLUMN federal_tax_rate REAL DEFAULT 0.0`); } catch (e) {}

  try { db.exec(`ALTER TABLE products ADD COLUMN gst_rate REAL DEFAULT 5.0`); } catch (e) {}

  try { db.exec(`ALTER TABLE orders ADD COLUMN gst_amount REAL DEFAULT 0`); } catch (e) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN cgst_amount REAL DEFAULT 0`); } catch (e) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN sgst_amount REAL DEFAULT 0`); } catch (e) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN igst_amount REAL DEFAULT 0`); } catch (e) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN customer_gstin TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE orders ADD COLUMN order_notes TEXT`); } catch (e) {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS state_tax_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      state_name TEXT UNIQUE NOT NULL,
      tax_rate REAL DEFAULT 0.0,
      tax_label TEXT DEFAULT 'IGST',
      tax_rule TEXT DEFAULT 'INSTEAD_OF_FEDERAL',
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS collection_tax_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      collection_id INTEGER REFERENCES collections(id) ON DELETE CASCADE,
      tax_rate REAL DEFAULT 5.0,
      state_name TEXT DEFAULT 'ALL',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default 36 Indian states & union territories into state_tax_rates if empty
  const stateCount = db.prepare('SELECT COUNT(*) as count FROM state_tax_rates').get().count;
  if (stateCount === 0) {
    const indianStates = [
      'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 
      'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli', 'Daman and Diu', 'Delhi', 
      'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 
      'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 
      'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 
      'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 
      'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
    ];

    const stmt = db.prepare('INSERT INTO state_tax_rates (state_name, tax_rate, tax_label, tax_rule) VALUES (?, ?, ?, ?)');
    indianStates.forEach(st => {
      const label = st === 'Maharashtra' ? 'SGST' : 'IGST';
      const rule = st === 'Maharashtra' ? 'ADDED_TO_FEDERAL' : 'INSTEAD_OF_FEDERAL';
      stmt.run(st, 0, label, rule);
    });
  }
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS store_hero_config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      hero_enabled INTEGER DEFAULT 1,
      active_style TEXT DEFAULT 'SPLIT',
      badge_text TEXT DEFAULT '100% Certified Organic Superfoods',
      title TEXT DEFAULT 'Pure Farm-Fresh Organic Groceries & Wellness Supplies',
      subtitle TEXT DEFAULT 'Delivering chemical-free superfoods, edible seeds, virgin oils & herbal supplements straight from certified organic farms.',
      primary_btn_text TEXT DEFAULT 'Shop Catalog Now',
      primary_btn_link TEXT DEFAULT '/products',
      secondary_btn_text TEXT DEFAULT 'Explore Organic Offers',
      secondary_btn_link TEXT DEFAULT '/offers',
      image_url TEXT DEFAULT 'https://images.unsplash.com/photo-1615811361523-6bd03d7748e7?auto=format&fit=crop&w=1000&q=80',
      bg_image_url TEXT DEFAULT 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1600&q=80',
      card_1_title TEXT DEFAULT 'Edible Chia & Flax Seeds',
      card_1_sub TEXT DEFAULT 'Rich in Omega-3 & Fiber',
      card_1_img TEXT DEFAULT 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=600&q=80',
      card_2_title TEXT DEFAULT 'Pure Ashwagandha Powder',
      card_2_sub TEXT DEFAULT '100% Natural Immunity Booster',
      card_2_img TEXT DEFAULT 'https://images.unsplash.com/photo-1592417817098-8f3d6ef23a2a?auto=format&fit=crop&w=600&q=80'
    );
    INSERT OR IGNORE INTO store_hero_config (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS store_theme_config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      active_preset TEXT DEFAULT 'EMERALD',
      primary_color TEXT DEFAULT '#3b6e14',
      primary_hover TEXT DEFAULT '#2e5710',
      secondary_color TEXT DEFAULT '#f8f7f2',
      accent_color TEXT DEFAULT '#f59e0b',
      heading_font TEXT DEFAULT 'Outfit',
      body_font TEXT DEFAULT 'Inter',
      border_radius TEXT DEFAULT 'rounded-3xl',
      header_style TEXT DEFAULT 'EMERALD_DARK',
      dark_mode INTEGER DEFAULT 0
    );
    INSERT OR IGNORE INTO store_theme_config (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS store_sections_config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      show_announcement INTEGER DEFAULT 1,
      show_hero INTEGER DEFAULT 1,
      show_trust_badges INTEGER DEFAULT 1,
      show_promo_banners INTEGER DEFAULT 1,
      show_categories_slider INTEGER DEFAULT 1,
      show_bestsellers INTEGER DEFAULT 1,
      show_catalog_grid INTEGER DEFAULT 1,
      show_footer INTEGER DEFAULT 1,
      trust_badge_1_title TEXT DEFAULT '100% Pure Organic',
      trust_badge_1_sub TEXT DEFAULT 'Chemical-free bio products',
      trust_badge_2_title TEXT DEFAULT 'Fast Home Delivery',
      trust_badge_2_sub TEXT DEFAULT 'Safe packaging across India',
      trust_badge_3_title TEXT DEFAULT 'Partial Payment & COD',
      trust_badge_3_sub TEXT DEFAULT 'Pay 20% deposit online',
      trust_badge_4_title TEXT DEFAULT 'Top Rated Service',
      trust_badge_4_sub TEXT DEFAULT '4.9 ★ Average Reviews',
      category_slider_title TEXT DEFAULT 'Shop By Categories',
      bestsellers_title TEXT DEFAULT '🔥 Best Seller Products',
      bestsellers_badge TEXT DEFAULT 'HIGH DEMAND ITEMS',
      bestsellers_count INTEGER DEFAULT 8
    );
    INSERT OR IGNORE INTO store_sections_config (id) VALUES (1);
  `);

  try { db.exec('ALTER TABLE store_sections_config ADD COLUMN show_sales_ticker INTEGER DEFAULT 1'); } catch(e) {}
  try { db.exec('ALTER TABLE store_sections_config ADD COLUMN sales_ticker_json TEXT'); } catch(e) {}

  const heroCount = db.prepare('SELECT COUNT(*) as count FROM store_hero_config').get().count;
  if (heroCount === 0) {
    db.prepare(`
      INSERT INTO store_hero_config (id, hero_enabled, active_style) VALUES (1, 1, 'SPLIT')
    `).run();
  }
  try { db.exec(`ALTER TABLE order_items ADD COLUMN variant_name TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE store_theme_config ADD COLUMN card_style TEXT DEFAULT 'ORGANIC_BAZAR'`); } catch (e) {}
  try { db.exec(`ALTER TABLE order_items ADD COLUMN variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL`); } catch (e) {}
  try { db.exec(`ALTER TABLE collections ADD COLUMN image_url TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE collections ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL`); } catch (e) {}
  try { db.exec(`ALTER TABLE products ADD COLUMN status TEXT DEFAULT 'Active'`); } catch (e) {}
  try { db.exec(`ALTER TABLE products ADD COLUMN vendor TEXT DEFAULT 'OrganicBazar'`); } catch (e) {}
  try { db.exec(`ALTER TABLE products ADD COLUMN product_type TEXT DEFAULT 'Garden Supplies'`); } catch (e) {}
  try { db.exec(`ALTER TABLE products ADD COLUMN tags TEXT DEFAULT 'organic, terrace garden'`); } catch (e) {}
  try { db.exec(`ALTER TABLE products ADD COLUMN barcode TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE products ADD COLUMN compare_price_inr REAL`); } catch (e) {}
  try { db.exec(`ALTER TABLE products ADD COLUMN compare_price_usd REAL`); } catch (e) {}
  try { db.exec(`ALTER TABLE products ADD COLUMN cost_per_item_inr REAL`); } catch (e) {}
  try { db.exec(`ALTER TABLE products ADD COLUMN cost_per_item_usd REAL`); } catch (e) {}
  try { db.exec(`ALTER TABLE products ADD COLUMN weight REAL DEFAULT 0.5`); } catch (e) {}
  try { db.exec(`ALTER TABLE products ADD COLUMN hs_code TEXT DEFAULT '310100'`); } catch (e) {}
  try { db.exec(`ALTER TABLE products ADD COLUMN country_of_origin TEXT DEFAULT 'India'`); } catch (e) {}
  try { db.exec(`ALTER TABLE product_variants ADD COLUMN compare_price_inr REAL`); } catch (e) {}
  try { db.exec(`ALTER TABLE product_variants ADD COLUMN compare_price_usd REAL`); } catch (e) {}

  db.exec(`INSERT OR IGNORE INTO store_settings (id) VALUES (1)`);

  // seedInitialData disabled to prevent auto-reseeding on deleted categories
}

function seedInitialData() {
  // Disabled to prevent auto-reseeding of categories
}

if (Database) {
  try {
    initDb();
  } catch (err) {
    console.warn('⚠️ SQLite initDb notice:', err.message);
  }
}

module.exports = db;
