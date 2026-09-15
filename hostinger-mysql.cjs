/**
 * Hostinger Free MySQL Database Migration & Helper Utility
 * Run this script to export local data and initialize Hostinger MySQL Database.
 * Usage: node server/hostinger-mysql.cjs
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const sqliteDb = require('./db.cjs');

async function setupHostingerMySQL() {
  console.log('=== STARTING HOSTINGER FREE MYSQL DATABASE MIGRATION ===\n');

  let mysqlHost = process.env.MYSQL_HOST || '127.0.0.1';
  if (mysqlHost === 'localhost') mysqlHost = '127.0.0.1';

  const config = {
    host: mysqlHost,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: Number(process.env.MYSQL_PORT) || 3306,
    connectTimeout: 5000
  };

  if (!config.user || !config.password || !config.database) {
    console.warn('⚠️ Hostinger MySQL credentials not set in .env; skipping MySQL schema migration.');
    return false;
  }

  try {
    console.log(`Connecting to Hostinger MySQL Database "${config.database}" at ${config.host}:${config.port}...`);
    const connection = await mysql.createConnection(config);
    console.log('✅ Connected successfully to Hostinger MySQL!');

    console.log('Ensuring all schema tables exist in Hostinger MySQL...');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS store_settings (
        id INT PRIMARY KEY DEFAULT 1,
        announcement_text TEXT,
        announcement_code VARCHAR(255) DEFAULT 'VALUELIFE15',
        contact_phone VARCHAR(255) DEFAULT '+91 98765 43210',
        contact_email VARCHAR(255) DEFAULT 'support@valuelifeessentials.com',
        partial_deposit_percent INT DEFAULT 20,
        enable_multi_currency INT DEFAULT 1,
        enable_cod INT DEFAULT 1,
        enable_partial_payment INT DEFAULT 1,
        partial_payment_heading VARCHAR(255) DEFAULT 'Pay 20% Online Deposit, Rest Cash on Delivery!',
        partial_payment_subtext TEXT,
        prepaid_discount_percent INT DEFAULT 5,
        enable_gst INT DEFAULT 1,
        gstin_number VARCHAR(255) DEFAULT '27AAAAA0000A1Z5',
        store_state VARCHAR(255) DEFAULT 'Maharashtra',
        default_gst_percent DECIMAL(5,2) DEFAULT 5.00,
        gst_type VARCHAR(50) DEFAULT 'INCLUSIVE',
        legal_business_name VARCHAR(255) DEFAULT 'ValueLife Essentials Private Limited',
        all_prices_include_tax INT DEFAULT 1,
        federal_tax_rate DECIMAL(5,2) DEFAULT 0.00
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(255),
        password VARCHAR(255),
        address TEXT,
        role VARCHAR(50) DEFAULT 'CUSTOMER',
        is_verified INT DEFAULT 0,
        email_otp VARCHAR(50),
        email_otp_expires VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    try { await connection.query(`ALTER TABLE users ADD COLUMN is_verified INT DEFAULT 0`); } catch(e){}
    try { await connection.query(`ALTER TABLE users ADD COLUMN email_otp VARCHAR(50)`); } catch(e){}
    try { await connection.query(`ALTER TABLE users ADD COLUMN email_otp_expires VARCHAR(50)`); } catch(e){}

    await connection.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        image_url TEXT,
        icon VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS subcategories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category_id INT,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS collections (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        image_url TEXT,
        category_id INT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        sku VARCHAR(255) UNIQUE,
        barcode VARCHAR(255),
        status VARCHAR(50) DEFAULT 'Active',
        vendor VARCHAR(255) DEFAULT 'VALUELIFE ESSENTIALS',
        product_type VARCHAR(255) DEFAULT 'Garden Supplies',
        tags TEXT,
        category_id INT,
        subcategory_id INT,
        description TEXT,
        price_inr DECIMAL(10,2) NOT NULL,
        price_usd DECIMAL(10,2) NOT NULL,
        discount_inr DECIMAL(10,2),
        discount_usd DECIMAL(10,2),
        compare_price_inr DECIMAL(10,2),
        compare_price_usd DECIMAL(10,2),
        cost_per_item_inr DECIMAL(10,2),
        cost_per_item_usd DECIMAL(10,2),
        stock INT DEFAULT 100,
        track_inventory INT DEFAULT 1,
        weight DECIMAL(8,2) DEFAULT 0.5,
        hs_code VARCHAR(50) DEFAULT '310100',
        country_of_origin VARCHAR(100) DEFAULT 'India',
        is_best_product INT DEFAULT 0,
        seo_title VARCHAR(255),
        seo_description TEXT,
        seo_keywords TEXT,
        specs_json TEXT,
        frequently_bought_ids TEXT,
        related_collection_ids TEXT,
        related_mode VARCHAR(50) DEFAULT 'PRODUCTS',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
        FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_number VARCHAR(255) UNIQUE NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(255) NOT NULL,
        shipping_address TEXT NOT NULL,
        country VARCHAR(100) NOT NULL,
        currency VARCHAR(10) NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        paid_amount DECIMAL(10,2) NOT NULL,
        remaining_amount DECIMAL(10,2) NOT NULL,
        payment_mode VARCHAR(50) NOT NULL,
        payment_status VARCHAR(50) DEFAULT 'PARTIAL_PAID',
        order_status VARCHAR(50) DEFAULT 'PROCESSING',
        order_notes TEXT,
        gst_amount DECIMAL(10,2) DEFAULT 0.00,
        cgst_amount DECIMAL(10,2) DEFAULT 0.00,
        sgst_amount DECIMAL(10,2) DEFAULT 0.00,
        igst_amount DECIMAL(10,2) DEFAULT 0.00,
        customer_gstin VARCHAR(50),
        cancellation_reason TEXT,
        cancellation_notes TEXT,
        courier_name VARCHAR(100),
        tracking_number VARCHAR(100),
        transaction_id VARCHAR(100),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transaction_id VARCHAR(100) UNIQUE NOT NULL,
        order_id VARCHAR(100) NULL,
        order_number VARCHAR(100) NULL,
        user_id INT NULL,
        customer_name VARCHAR(255) NULL,
        customer_email VARCHAR(255) NULL,
        customer_phone VARCHAR(50) NULL,
        gateway VARCHAR(50) NOT NULL DEFAULT 'razorpay',
        gateway_order_id VARCHAR(100) NULL,
        gateway_payment_id VARCHAR(100) NULL,
        gateway_signature TEXT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'INR',
        amount DECIMAL(10,2) NOT NULL,
        amount_paise BIGINT NOT NULL,
        step VARCHAR(50) NOT NULL DEFAULT '1_PAYMENT_REQ',
        status VARCHAR(50) NOT NULL DEFAULT 'INITIATED',
        error_code VARCHAR(100) NULL,
        error_description TEXT NULL,
        request_payload LONGTEXT NULL,
        response_payload LONGTEXT NULL,
        verification_payload LONGTEXT NULL,
        ip_address VARCHAR(100) NULL,
        user_agent TEXT NULL,
        verified_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_txn_id (transaction_id),
        INDEX idx_order_id (order_id),
        INDEX idx_order_num (order_number),
        INDEX idx_gw_order_id (gateway_order_id),
        INDEX idx_gw_payment_id (gateway_payment_id),
        INDEX idx_status (status),
        INDEX idx_step (step)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS product_images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        image_url TEXT NOT NULL,
        sort_order INT DEFAULT 0,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS product_variants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        sku VARCHAR(255),
        price_inr DECIMAL(10,2) NOT NULL,
        price_usd DECIMAL(10,2) NOT NULL,
        stock INT DEFAULT 100,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS product_collections (
        product_id INT NOT NULL,
        collection_id INT NOT NULL,
        PRIMARY KEY (product_id, collection_id),
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS product_filter_groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        filter_key VARCHAR(255) UNIQUE NOT NULL,
        is_active INT DEFAULT 1,
        sort_order INT DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS product_filter_options (
        id INT AUTO_INCREMENT PRIMARY KEY,
        group_id INT NOT NULL,
        label VARCHAR(255) NOT NULL,
        value VARCHAR(255) NOT NULL,
        sort_order INT DEFAULT 0,
        FOREIGN KEY (group_id) REFERENCES product_filter_groups(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT,
        product_title VARCHAR(255) NOT NULL,
        quantity INT NOT NULL,
        price_inr DECIMAL(10,2) NOT NULL,
        price_usd DECIMAL(10,2) NOT NULL,
        image_url TEXT,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS banners (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        subtitle TEXT,
        image_url TEXT NOT NULL,
        link_url VARCHAR(255) DEFAULT '/products',
        sort_order INT DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(100) UNIQUE NOT NULL,
        discount_type VARCHAR(20) DEFAULT 'PERCENT',
        discount_value DECIMAL(10,2) NOT NULL,
        min_order_amount DECIMAL(10,2) DEFAULT 0,
        is_active INT DEFAULT 1,
        expiry_date DATETIME
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS product_reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255),
        rating INT NOT NULL,
        review_title VARCHAR(255),
        review_text TEXT,
        status VARCHAR(50) DEFAULT 'APPROVED',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS custom_pages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        content_html TEXT,
        seo_title VARCHAR(255),
        seo_description TEXT,
        is_published INT DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS analytics_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL,
        page_url VARCHAR(255),
        product_id INT,
        action VARCHAR(50) DEFAULT 'VIEW',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS state_tax_rates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        state_name VARCHAR(255) UNIQUE NOT NULL,
        tax_rate DECIMAL(5,2) NOT NULL,
        is_active INT DEFAULT 1
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS collection_tax_overrides (
        id INT AUTO_INCREMENT PRIMARY KEY,
        collection_id INT NOT NULL,
        tax_rate DECIMAL(5,2) NOT NULL,
        state_name VARCHAR(255) DEFAULT 'ALL',
        FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS store_hero_config (
        id INT PRIMARY KEY DEFAULT 1,
        hero_enabled INT DEFAULT 1,
        active_style VARCHAR(50) DEFAULT 'SPLIT',
        badge_text VARCHAR(255) DEFAULT '100% Certified Organic Superfoods',
        title VARCHAR(255) DEFAULT 'Pure Farm-Fresh Organic Groceries & Wellness Supplies',
        subtitle TEXT,
        primary_btn_text VARCHAR(100) DEFAULT 'Shop Catalog Now',
        primary_btn_link VARCHAR(255) DEFAULT '/products',
        secondary_btn_text VARCHAR(100) DEFAULT 'Explore Organic Offers',
        secondary_btn_link VARCHAR(255) DEFAULT '/offers',
        image_url TEXT,
        bg_image_url TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS hero_slides (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title_part1 VARCHAR(255) NOT NULL,
        title_part2 VARCHAR(255),
        tagline VARCHAR(255) DEFAULT 'NATURAL • HEALTHY • SUSTAINABLE',
        description TEXT,
        cta_text VARCHAR(100) DEFAULT 'Shop Now',
        cta_link VARCHAR(255) DEFAULT '/products',
        packaging_img TEXT,
        jars_img TEXT,
        script_quote VARCHAR(255) DEFAULT 'Good Products, Brighter Days.',
        sort_order INT DEFAULT 0,
        is_active INT DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS instagram_posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        image_url TEXT NOT NULL,
        post_url VARCHAR(500) DEFAULT 'https://www.instagram.com/valuelife_essentials/?hl=en',
        sort_order INT DEFAULT 0,
        is_active INT DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS editorial_promo_config (
        id INT PRIMARY KEY DEFAULT 1,
        badge_text VARCHAR(255) DEFAULT 'LIMITED TIME OFFER',
        title_part1 VARCHAR(255) DEFAULT 'Pure Products',
        title_part2 VARCHAR(255) DEFAULT 'Happier Lives',
        subtitle TEXT,
        cta_text VARCHAR(100) DEFAULT 'Shop the Collection',
        cta_link VARCHAR(255) DEFAULT '/offers',
        image_url TEXT,
        script_quote VARCHAR(255) DEFAULT 'Nature Nurtures You',
        quote_subtext VARCHAR(255) DEFAULT '🌿 Handcrafted with Care',
        is_enabled INT DEFAULT 1,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS brand_story_config (
        id INT PRIMARY KEY DEFAULT 1,
        badge_text VARCHAR(255) DEFAULT 'WHO WE ARE',
        heading VARCHAR(255) DEFAULT 'Our Story',
        overlay_title VARCHAR(255) DEFAULT 'A Healthier',
        overlay_subtitle VARCHAR(255) DEFAULT 'Tomorrow Together',
        description TEXT,
        cta_text VARCHAR(100) DEFAULT 'Learn More',
        cta_link VARCHAR(255) DEFAULT '/pages/about-us',
        image_url TEXT,
        is_enabled INT DEFAULT 1,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS store_sections_config (
        id INT PRIMARY KEY DEFAULT 1,
        show_announcement INT DEFAULT 1,
        show_hero INT DEFAULT 1,
        show_trust_badges INT DEFAULT 1,
        show_promo_banners INT DEFAULT 1,
        show_categories_slider INT DEFAULT 1,
        show_featured_products INT DEFAULT 1,
        show_editorial_promo INT DEFAULT 1,
        show_why_choose_us INT DEFAULT 1,
        show_bestsellers INT DEFAULT 1,
        show_brand_story INT DEFAULT 1,
        show_testimonials INT DEFAULT 1,
        show_blog_section INT DEFAULT 1,
        show_instagram_feed INT DEFAULT 1,
        show_newsletter INT DEFAULT 1,
        show_footer INT DEFAULT 1,
        show_sales_ticker INT DEFAULT 1,
        sales_ticker_json TEXT,
        trust_badge_1_title VARCHAR(255) DEFAULT '100% Natural',
        trust_badge_1_sub VARCHAR(255) DEFAULT 'Pure origin',
        trust_badge_2_title VARCHAR(255) DEFAULT 'Safe for Family',
        trust_badge_2_sub VARCHAR(255) DEFAULT 'Zero toxics',
        trust_badge_3_title VARCHAR(255) DEFAULT 'Eco Friendly',
        trust_badge_3_sub VARCHAR(255) DEFAULT 'Sustainable',
        trust_badge_4_title VARCHAR(255) DEFAULT 'Trusted Quality',
        trust_badge_4_sub VARCHAR(255) DEFAULT 'Lab verified',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS store_theme_config (
        id INT PRIMARY KEY DEFAULT 1,
        active_preset VARCHAR(50) DEFAULT 'EMERALD',
        primary_color VARCHAR(50) DEFAULT '#164e3f',
        primary_hover VARCHAR(50) DEFAULT '#0f382d',
        secondary_color VARCHAR(50) DEFAULT '#52b788',
        accent_color VARCHAR(50) DEFAULT '#f59e0b',
        heading_font VARCHAR(100) DEFAULT 'Outfit',
        body_font VARCHAR(100) DEFAULT 'Inter',
        card_style VARCHAR(50) DEFAULT 'ORGANIC_BAZAR',
        header_style VARCHAR(50) DEFAULT 'EMERALD_DARK',
        dark_mode INT DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS review_images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        review_id INT NOT NULL,
        image_url TEXT NOT NULL,
        sort_order INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS blog_posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        category VARCHAR(100) DEFAULT 'General Wellness',
        excerpt TEXT,
        content LONGTEXT NOT NULL,
        featured_image VARCHAR(500),
        author_name VARCHAR(150) DEFAULT 'ValueLife Editorial',
        author_avatar VARCHAR(500) DEFAULT '',
        author_role VARCHAR(150) DEFAULT 'Ayurvedic Specialist',
        read_time VARCHAR(50) DEFAULT '5 min read',
        tags VARCHAR(255) DEFAULT 'Organic, Wellness, Ayurveda',
        views_count INT DEFAULT 0,
        is_published TINYINT(1) DEFAULT 1,
        is_featured TINYINT(1) DEFAULT 0,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('Ensuring all schema columns and tables exist in Hostinger MySQL...');

    const orderCols = [
      'ADD COLUMN IF NOT EXISTS state_name VARCHAR(100)',
      'ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2) DEFAULT 0',
      'ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0',
      'ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(100)',
      'ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0',
      'ADD COLUMN IF NOT EXISTS shipping_amount DECIMAL(10,2) DEFAULT 0',
      'ADD COLUMN IF NOT EXISTS payable_amount DECIMAL(10,2) DEFAULT 0',
      'ADD COLUMN IF NOT EXISTS cod_balance_amount DECIMAL(10,2) DEFAULT 0',
      'ADD COLUMN IF NOT EXISTS is_partial_payment TINYINT DEFAULT 0',
      'ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50)',
      'ADD COLUMN IF NOT EXISTS remark TEXT',
      'ADD COLUMN IF NOT EXISTS items_json LONGTEXT'
    ];
    for (const c of orderCols) {
      try { await connection.query('ALTER TABLE orders ' + c); } catch (e) {}
    }

    const itemCols = [
      'ADD COLUMN IF NOT EXISTS product_name VARCHAR(255)',
      'ADD COLUMN IF NOT EXISTS variant_id INT',
      'ADD COLUMN IF NOT EXISTS variant_name VARCHAR(255)',
      'ADD COLUMN IF NOT EXISTS price DECIMAL(10,2) DEFAULT 0',
      'ADD COLUMN IF NOT EXISTS total DECIMAL(10,2) DEFAULT 0',
      'ADD COLUMN IF NOT EXISTS variant_title VARCHAR(255)'
    ];
    for (const c of itemCols) {
      try { await connection.query('ALTER TABLE order_items ' + c); } catch (e) {}
    }

    console.log('Seeding initial records into Hostinger MySQL tables if empty...');

    await connection.query(`
      INSERT IGNORE INTO store_settings (id, announcement_text, announcement_code, contact_phone, contact_email) 
      VALUES (1, 'Get 15% OFF + Free Home Delivery! Use Code: VALUELIFE15', 'VALUELIFE15', '+91 98765 43210', 'support@valuelifeessentials.com');
    `);

    await connection.query(`
      INSERT IGNORE INTO users (id, name, email, phone, role) 
      VALUES (1, 'Master Admin', 'support@valuelifeessentials.com', '+919876543210', 'ADMIN');
    `);

    console.log('✅ All tables & essential settings verified in Hostinger MySQL!');
    await connection.end();
    console.log('\n=== HOSTINGER MYSQL READY FOR LIVE PRODUCTION USE ===');
  } catch (err) {
    console.error('❌ Hostinger MySQL Setup Error:', err.message);
  }
}

let poolInstance = null;

function getMySQLPool() {
  if (poolInstance) return poolInstance;
  let mysqlHost = process.env.MYSQL_HOST || 'srv831.hstgr.io';
  if (mysqlHost === 'localhost') mysqlHost = 'srv831.hstgr.io';

  const user = process.env.MYSQL_USER || 'u439830852_admin';
  const password = process.env.MYSQL_PASSWORD || 'Valuelife@support1';
  const database = process.env.MYSQL_DATABASE || 'u439830852_valuelife';
  const port = Number(process.env.MYSQL_PORT) || 3306;

  try {
    poolInstance = mysql.createPool({
      host: mysqlHost,
      user,
      password,
      database,
      port,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 3000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000
    });
  } catch (err) {
    console.warn('MySQL pool create notice:', err.message);
    return null;
  }

  return poolInstance;
}

if (require.main === module) {
  setupHostingerMySQL();
}

module.exports = { setupHostingerMySQL, getMySQLPool };
