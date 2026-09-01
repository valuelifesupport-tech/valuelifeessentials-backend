const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'ecommerce.db');
const db = new Database(dbPath);

console.log('Seeding rich organic content and high-resolution images...');

// 1. Enforce Banners
db.exec(`DELETE FROM banners;`);
const insertBanner = db.prepare(`
  INSERT INTO banners (title, subtitle, image_url, link_url, sort_order)
  VALUES (?, ?, ?, ?, ?)
`);
insertBanner.run(
  '100% Certified Organic Fertilizers & Soil Boosters',
  'Boost your terrace garden yield naturally with premium Bio-Fertilizers, Seaweed Extract & HDPE Grow Bags.',
  'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1400&q=80',
  '/products',
  1
);
insertBanner.run(
  'Terrace Garden Hybrid Vegetable Seeds Collection',
  'High germination rate organic seeds for Tomato, Brinjal, Spinach, Chilli & Flowering Plants.',
  'https://images.unsplash.com/photo-1592417817098-8f3d6ef23a2a?auto=format&fit=crop&w=1400&q=80',
  '/products',
  2
);
insertBanner.run(
  'UV Stabilized HDPE Heavy Duty Grow Bags',
  'Heavy duty 260 GSM green grow bags designed for 5+ years of all-weather terrace gardening.',
  'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1400&q=80',
  '/products',
  3
);

// 2. Enforce Categories
const categories = [
  { name: 'Organic Fertilizers', slug: 'organic-fertilizers', description: 'Bio-fertilizers, vermicompost & organic soil boosters', image_url: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=600&q=80', icon: '🌿' },
  { name: 'Seeds & Gardening', slug: 'seeds-and-gardening', description: 'Hybrid vegetable, flower & herb seeds', image_url: 'https://images.unsplash.com/photo-1592417817098-8f3d6ef23a2a?auto=format&fit=crop&w=600&q=80', icon: '🌱' },
  { name: 'Pots & Grow Bags', slug: 'pots-and-grow-bags', description: 'Heavy duty HDPE grow bags & plastic pots', image_url: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=600&q=80', icon: '🪴' },
  { name: 'Garden Tools', slug: 'garden-tools', description: 'Pruning shears, sprayer pumps & watering cans', image_url: 'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&fit=crop&w=600&q=80', icon: '🛠️' },
  { name: 'Pest Control & Care', slug: 'pest-control', description: 'Neem oil spray, bio insecticides & plant protection', image_url: 'https://images.unsplash.com/photo-1615811361523-6bd03d7748e7?auto=format&fit=crop&w=600&q=80', icon: '🐛' },
  { name: 'Natural Powders', slug: 'natural-powders', description: 'Ayurvedic herbal powders for hair, skin & wellness', image_url: 'https://images.unsplash.com/photo-1608248597262-838198f12c1c?auto=format&fit=crop&w=600&q=80', icon: '🍃' },
  { name: 'Organic Superfoods', slug: 'organic-superfoods', description: 'Raw chia seeds, Himalayan shilajit & pink salt', image_url: 'https://images.unsplash.com/photo-1514733670139-4d87a1941d55?auto=format&fit=crop&w=600&q=80', icon: '🥗' }
];

const catStmt = db.prepare(`
  INSERT INTO categories (name, slug, description, image_url, icon)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(slug) DO UPDATE SET name=excluded.name, description=excluded.description, image_url=excluded.image_url, icon=excluded.icon
`);

categories.forEach(c => catStmt.run(c.name, c.slug, c.description, c.image_url, c.icon));

// 3. Enforce Products
const productsData = [
  {
    title: 'Raw Organic Chia Seeds 500g',
    slug: 'raw-organic-chia-seeds-500g',
    sku: 'SEED-CHIA-500',
    category_slug: 'organic-superfoods',
    description: 'Premium quality raw chia seeds packed with Omega-3 fatty acids, dietary fiber, and plant protein for weight loss & digestion.',
    price_inr: 399, price_usd: 10, discount_inr: 249, discount_usd: 6, stock: 300, is_best: 1,
    image_url: 'https://images.unsplash.com/photo-1514733670139-4d87a1941d55?auto=format&fit=crop&w=800&q=80',
    rating: 5, reviews: 42
  },
  {
    title: 'Terrace Garden Hybrid Vegetable Seeds Pack',
    slug: 'terrace-garden-hybrid-vegetable-seeds-pack',
    sku: 'SEED-VEG-15',
    category_slug: 'seeds-and-gardening',
    description: 'High germination rate vegetable seeds including Tomato, Brinjal, Spinach, Chilli & Cucumber.',
    price_inr: 299, price_usd: 8, discount_inr: 199, discount_usd: 5, stock: 250, is_best: 1,
    image_url: 'https://images.unsplash.com/photo-1592417817098-8f3d6ef23a2a?auto=format&fit=crop&w=800&q=80',
    rating: 5, reviews: 38
  },
  {
    title: 'Organic Moringa Leaf Powder 250g',
    slug: 'organic-moringa-leaf-powder-250g',
    sku: 'POW-MOR-250',
    category_slug: 'natural-powders',
    description: '100% pure organic moringa leaf powder. Rich in antioxidants, iron, and immunity vitamins.',
    price_inr: 299, price_usd: 8, discount_inr: 199, discount_usd: 5, stock: 200, is_best: 1,
    image_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
    rating: 5, reviews: 29
  },
  {
    title: 'Natural Multani Mitti Face Pack Powder 200g',
    slug: 'natural-multani-mitti-face-pack-powder-200g',
    sku: 'POW-MULT-200',
    category_slug: 'natural-powders',
    description: '100% pure Fuller\'s Earth Multani Mitti clay powder. Removes excess oil and clears acne naturally.',
    price_inr: 149, price_usd: 4, discount_inr: 99, discount_usd: 3, stock: 250, is_best: 1,
    image_url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80',
    rating: 5, reviews: 56
  },
  {
    title: 'Pure Reetha & Shikakai Hair Powder 250g',
    slug: 'pure-reetha-shikakai-hair-powder-250g',
    sku: 'POW-HAIR-250',
    category_slug: 'natural-powders',
    description: 'Ayurvedic herbal hair cleanser powder for shiny, strong hair and dandruff control.',
    price_inr: 249, price_usd: 6, discount_inr: 169, discount_usd: 4, stock: 180, is_best: 1,
    image_url: 'https://images.unsplash.com/photo-1608248597262-838198f12c1c?auto=format&fit=crop&w=800&q=80',
    rating: 5, reviews: 24
  },
  {
    title: 'Organic Vermicompost Fertilizer 5Kg',
    slug: 'organic-vermicompost-fertilizer-5kg',
    sku: 'OB-VERM-5',
    category_slug: 'organic-fertilizers',
    description: 'Premium grade 100% pure vermicompost enriched with essential nitrogen, phosphorus, and potassium.',
    price_inr: 499, price_usd: 12, discount_inr: 349, discount_usd: 9, stock: 150, is_best: 1,
    image_url: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=800&q=80',
    rating: 5, reviews: 84
  },
  {
    title: 'Seaweed Liquid Concentrate Booster 500ml',
    slug: 'seaweed-liquid-concentrate-booster-500ml',
    sku: 'OB-SEA-500',
    category_slug: 'organic-fertilizers',
    description: 'Cold-extracted seaweed liquid extract packed with trace minerals and growth hormones.',
    price_inr: 399, price_usd: 10, discount_inr: 299, discount_usd: 7, stock: 200, is_best: 1,
    image_url: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=800&q=80',
    rating: 5, reviews: 62
  },
  {
    title: 'HDPE Heavy Duty Grow Bags 12x12 Inch',
    slug: 'hdpe-heavy-duty-grow-bags-12x12',
    sku: 'OB-GB-1212',
    category_slug: 'pots-and-grow-bags',
    description: 'UV stabilized 260 GSM heavy duty green HDPE grow bags designed to last 5+ years in harsh sun.',
    price_inr: 599, price_usd: 15, discount_inr: 449, discount_usd: 11, stock: 100, is_best: 1,
    image_url: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=800&q=80',
    rating: 5, reviews: 95
  },
  {
    title: 'Organic Pink Himalayan Salt Powder 1Kg',
    slug: 'organic-pink-himalayan-salt-powder-1kg',
    sku: 'SALT-PINK-1K',
    category_slug: 'organic-superfoods',
    description: 'Pure 100% natural Himalayan pink salt powder packed with 84+ essential trace minerals.',
    price_inr: 199, price_usd: 5, discount_inr: 129, discount_usd: 3, stock: 400, is_best: 1,
    image_url: 'https://images.unsplash.com/photo-1615811361523-6bd03d7748e7?auto=format&fit=crop&w=800&q=80',
    rating: 5, reviews: 31
  },
  {
    title: 'Pure Himalayan Shilajit Resin 50g',
    slug: 'pure-himalayan-shilajit-resin-50g',
    sku: 'SHIL-50G',
    category_slug: 'organic-superfoods',
    description: '100% authentic purified Himalayan Shilajit resin with 80%+ fulvic acid for energy & stamina.',
    price_inr: 1299, price_usd: 30, discount_inr: 899, discount_usd: 22, stock: 120, is_best: 1,
    image_url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80',
    rating: 5, reviews: 78
  },
  {
    title: 'Authentic Lakadong Turmeric Powder 250g',
    slug: 'authentic-lakadong-turmeric-powder-250g',
    sku: 'TURM-LAK-250',
    category_slug: 'organic-superfoods',
    description: 'High curcumin (7-9%) authentic Lakadong turmeric powder directly sourced from Meghalaya farms.',
    price_inr: 249, price_usd: 6, discount_inr: 169, discount_usd: 4, stock: 220, is_best: 1,
    image_url: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=800&q=80',
    rating: 5, reviews: 45
  },
  {
    title: 'Cold Pressed Neem Oil Spray 250ml',
    slug: 'cold-pressed-neem-oil-spray-250ml',
    sku: 'OB-NEEM-250',
    category_slug: 'pest-control',
    description: '100% natural organic neem oil water-soluble emulsion for plant protection against pests and fungi.',
    price_inr: 249, price_usd: 6, discount_inr: 179, discount_usd: 4, stock: 180, is_best: 0,
    image_url: 'https://images.unsplash.com/photo-1615811361523-6bd03d7748e7?auto=format&fit=crop&w=800&q=80',
    rating: 5, reviews: 18
  }
];

const prodStmt = db.prepare(`
  INSERT INTO products (
    title, slug, sku, category_id, description, price_inr, price_usd, discount_inr, discount_usd, stock, is_best_product
  )
  VALUES (?, ?, ?, (SELECT id FROM categories WHERE slug = ?), ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(slug) DO UPDATE SET 
    title=excluded.title, sku=excluded.sku, description=excluded.description, 
    price_inr=excluded.price_inr, price_usd=excluded.price_usd, 
    discount_inr=excluded.discount_inr, discount_usd=excluded.discount_usd, 
    stock=excluded.stock, is_best_product=excluded.is_best_product
`);

const imgStmt = db.prepare(`
  INSERT INTO product_images (product_id, image_url, is_primary)
  VALUES (?, ?, 1)
`);

productsData.forEach(p => {
  prodStmt.run(p.title, p.slug, p.sku, p.category_slug, p.description, p.price_inr, p.price_usd, p.discount_inr, p.discount_usd, p.stock, p.is_best);
  const prodObj = db.prepare('SELECT id FROM products WHERE slug = ?').get(p.slug);
  if (prodObj) {
    db.prepare('DELETE FROM product_images WHERE product_id = ?').run(prodObj.id);
    imgStmt.run(prodObj.id, p.image_url);

    // Seed variants if missing
    const varCount = db.prepare('SELECT COUNT(*) as cnt FROM product_variants WHERE product_id = ?').get(prodObj.id).cnt;
    if (varCount === 0) {
      db.prepare(`
        INSERT INTO product_variants (product_id, variant_name, sku, price_inr, price_usd, discount_inr, discount_usd, stock)
        VALUES (?, 'Standard Pack', ?, ?, ?, ?, ?, ?)
      `).run(prodObj.id, p.sku, p.price_inr, p.price_usd, p.discount_inr, p.discount_usd, p.stock);
    }

    // Seed verified customer reviews
    const revCount = db.prepare('SELECT COUNT(*) as cnt FROM product_reviews WHERE product_id = ?').get(prodObj.id).cnt;
    if (revCount === 0) {
      const r1 = db.prepare(`
        INSERT INTO product_reviews (product_id, user_name, user_email, rating, title, comment, is_verified_buyer, status, admin_reply)
        VALUES (?, 'Ega Doyc', 'ega@valuelifeessentials.com', 5, 'Outstanding Quality & Fast Delivery!', 'Untreated Radish White Long Seeds For Organic Gardening - 250 Seeds (Mooli/ मूली के बीज). Super fast germination within 3 days!', 1, 'APPROVED', 'Thank you Ega for your wonderful feedback! Wish you happy gardening!')
      `).run(prodObj.id);

      db.prepare('INSERT INTO review_images (review_id, image_url) VALUES (?, ?)').run(r1.lastInsertRowid, 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=200');

      const r2 = db.prepare(`
        INSERT INTO product_reviews (product_id, user_name, user_email, rating, title, comment, is_verified_buyer, status, admin_reply)
        VALUES (?, 'SUKHJEET SINGH', 'sukhjeet@gmail.com', 5, 'High Germination Success Rate', 'Used these organic products on my terrace garden and got 95% germination. Highly recommended for home gardeners!', 1, 'APPROVED', 'We are thrilled to hear about your great terrace harvest!')
      `).run(prodObj.id);

      db.prepare('INSERT INTO review_images (review_id, image_url) VALUES (?, ?)').run(r2.lastInsertRowid, 'https://images.unsplash.com/photo-1592417817098-8f3d6eb1b7a5?w=200');

      db.prepare(`
        INSERT INTO product_reviews (product_id, user_name, user_email, rating, title, comment, is_verified_buyer, status, admin_reply)
        VALUES (?, 'Vijay Kumar', 'vijay.k@gmail.com', 5, 'Excellent Packaging & Authentic Product', 'Packaging was top notch with complete user instructions. Value for money.', 1, 'APPROVED', 'Thank you Vijay!')
      `).run(prodObj.id);
    }
  }
});

console.log('Successfully enriched DB with rich products, categories, banners, customer reviews, and images!');
db.close();
