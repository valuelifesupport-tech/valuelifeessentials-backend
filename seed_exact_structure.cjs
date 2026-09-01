const db = require('./db.cjs');

console.log('Seeding exact requested Website Category Structure...');

// Clear existing catalog data cleanly
db.exec(`
  DELETE FROM order_items;
  DELETE FROM orders;
  DELETE FROM product_reviews;
  DELETE FROM review_images;
  DELETE FROM product_images;
  DELETE FROM product_variants;
  DELETE FROM product_collections;
  DELETE FROM products;
  DELETE FROM subcategories;
  DELETE FROM categories;
  DELETE FROM collections;
  DELETE FROM sqlite_sequence WHERE name IN ('categories', 'subcategories', 'products', 'product_variants', 'collections');
`);

// Insert the exact 11 Parent Categories requested
const categoriesData = [
  { name: 'Grains & Staples', icon: '🌾', slug: 'grains-staples', description: 'Organic Wheat, Rice, Flours, Pulses & Millets' },
  { name: 'Dry Fruits & Nuts', icon: '🌰', slug: 'dry-fruits-nuts', description: 'Almonds, Walnuts, Cashews, Raisins & Mixed Nuts' },
  { name: 'Seeds', icon: '🥜', slug: 'seeds', description: 'Edible Super Seeds & High-Germination Plant Seeds' },
  { name: 'Herbs & Seasonings', icon: '🌿', slug: 'herbs-seasonings', description: 'Organic Oregano, Thyme, Rosemary & Dried Herbs' },
  { name: 'Spices & Masalas', icon: '🌶️', slug: 'spices-masalas', description: 'Whole Spices, Lakadong Turmeric & Garam Masala Blends' },
  { name: 'Salt, Sugar & Sweeteners', icon: '🍯', slug: 'salt-sugar-sweeteners', description: 'Himalayan Pink Salt, Organic Jaggery & Raw Honey' },
  { name: 'Tea & Beverages', icon: '🍵', slug: 'tea-beverages', description: 'Herbal Detox Teas, Green Teas & Organic Infusions' },
  { name: 'Health & Wellness', icon: '🧘', slug: 'health-wellness', description: 'Ashwagandha, Shilajit Resin, Triphala & Supplements' },
  { name: 'Baking Essentials', icon: '🧁', slug: 'baking-essentials', description: 'Baking Soda, Organic Cocoa & Natural Thickening Powders' },
  { name: 'Natural Powders', icon: '✨', slug: 'natural-powders', description: 'Food Powders, Face Care Powders & Hair Care Powders' },
  { name: 'Value Life Collection', icon: '💎', slug: 'value-life-collection', description: 'Premium Handpicked Organic Living & Gift Combos' }
];

const insertCat = db.prepare('INSERT INTO categories (name, icon, slug, description) VALUES (?, ?, ?, ?)');
const catMap = {};

categoriesData.forEach(cat => {
  const info = insertCat.run(cat.name, cat.icon, cat.slug, cat.description);
  catMap[cat.name] = info.lastInsertRowid;
});

// Insert Nested Subcategories requested
const subcatData = [
  // Seeds subcategories
  { cat: 'Seeds', name: 'Edible Seeds', slug: 'edible-seeds' },
  { cat: 'Seeds', name: 'Plant Seeds', slug: 'plant-seeds' },

  // Natural Powders subcategories
  { cat: 'Natural Powders', name: 'Food Powders', slug: 'food-powders' },
  { cat: 'Natural Powders', name: 'Face Care Powders', slug: 'face-care-powders' },
  { cat: 'Natural Powders', name: 'Hair Care Powders', slug: 'hair-care-powders' }
];

const insertSubcat = db.prepare('INSERT INTO subcategories (category_id, name, slug) VALUES (?, ?, ?)');
const subcatMap = {};

subcatData.forEach(sub => {
  const catId = catMap[sub.cat];
  const info = insertSubcat.run(catId, sub.name, sub.slug);
  subcatMap[`${sub.cat}_${sub.name}`] = info.lastInsertRowid;
});

// Insert Collections
db.exec(`
  INSERT INTO collections (name, slug, description, image_url, category_id) VALUES
  ('Best Sellers Mega Savings', 'best-sellers', 'Top customer rated organic groceries & wellness items', 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80', 1),
  ('New Arrivals Organic Special', 'new-arrivals', 'Freshly harvested organic superfoods & powders', 'https://images.unsplash.com/photo-1514733670139-4d87a1941d55?auto=format&fit=crop&w=800&q=80', 2);
`);

// Insert Sample Products mapped to these exact new categories
const productsData = [
  {
    title: 'Raw Organic Chia Seeds 500g',
    slug: 'raw-organic-chia-seeds-500g',
    sku: 'SEED-CHIA-500',
    cat: 'Seeds',
    subcat: 'Seeds_Edible Seeds',
    desc: 'Premium quality raw chia seeds packed with Omega-3 fatty acids, dietary fiber, and plant protein for weight loss & digestion.',
    price_inr: 399, price_usd: 10, discount_inr: 249, discount_usd: 6, stock: 300, is_best: 1,
    img: 'https://images.unsplash.com/photo-1514733670139-4d87a1941d55?auto=format&fit=crop&w=800&q=80',
    variants: [
      { name: '250g Jar', sku: 'SEED-CHIA-250', price_inr: 229, price_usd: 6, discount_inr: 149, discount_usd: 4, stock: 180 },
      { name: '500g Jar', sku: 'SEED-CHIA-500', price_inr: 399, price_usd: 10, discount_inr: 249, discount_usd: 6, stock: 300 }
    ]
  },
  {
    title: 'Terrace Garden Hybrid Vegetable Seeds Pack',
    slug: 'terrace-garden-hybrid-vegetable-seeds-pack',
    sku: 'SEED-VEG-15',
    cat: 'Seeds',
    subcat: 'Seeds_Plant Seeds',
    desc: 'High germination rate vegetable seeds including Tomato, Brinjal, Spinach, Chilli & Cucumber.',
    price_inr: 299, price_usd: 8, discount_inr: 199, discount_usd: 5, stock: 250, is_best: 1,
    img: 'https://images.unsplash.com/photo-1592417817098-8f3d6ef23a2a?auto=format&fit=crop&w=800&q=80',
    variants: [
      { name: 'Pack of 15 Varieties', sku: 'SEED-VEG-15V', price_inr: 299, price_usd: 8, discount_inr: 199, discount_usd: 5, stock: 250 }
    ]
  },
  {
    title: 'Organic Moringa Leaf Powder 250g',
    slug: 'organic-moringa-leaf-powder-250g',
    sku: 'POW-MOR-250',
    cat: 'Natural Powders',
    subcat: 'Natural Powders_Food Powders',
    desc: '100% pure organic moringa leaf powder. Rich in antioxidants, iron, and immunity vitamins.',
    price_inr: 299, price_usd: 8, discount_inr: 199, discount_usd: 5, stock: 200, is_best: 1,
    img: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
    variants: [
      { name: '250g Pouch', sku: 'POW-MOR-250', price_inr: 299, price_usd: 8, discount_inr: 199, discount_usd: 5, stock: 200 }
    ]
  },
  {
    title: 'Natural Multani Mitti Face Pack Powder 200g',
    slug: 'natural-multani-mitti-face-pack-powder-200g',
    sku: 'POW-MULT-200',
    cat: 'Natural Powders',
    subcat: 'Natural Powders_Face Care Powders',
    desc: '100% pure Fuller’s Earth Multani Mitti clay powder. Removes excess oil and clears acne naturally.',
    price_inr: 149, price_usd: 4, discount_inr: 99, discount_usd: 3, stock: 250, is_best: 0,
    img: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80',
    variants: [
      { name: '200g Pouch', sku: 'POW-MULT-200', price_inr: 149, price_usd: 4, discount_inr: 99, discount_usd: 3, stock: 250 }
    ]
  },
  {
    title: 'Pure Reetha & Shikakai Hair Powder 250g',
    slug: 'pure-reetha-shikakai-hair-powder-250g',
    sku: 'POW-HAIR-250',
    cat: 'Natural Powders',
    subcat: 'Natural Powders_Hair Care Powders',
    desc: 'Ayurvedic herbal hair cleanser powder for shiny, strong hair and dandruff control.',
    price_inr: 249, price_usd: 6, discount_inr: 169, discount_usd: 4, stock: 180, is_best: 1,
    img: 'https://images.unsplash.com/photo-1608248597262-838198f12c1c?auto=format&fit=crop&w=800&q=80',
    variants: [
      { name: '250g Pack', sku: 'POW-HAIR-250', price_inr: 249, price_usd: 6, discount_inr: 169, discount_usd: 4, stock: 180 }
    ]
  },
  {
    title: 'Authentic Lakadong Turmeric Powder 250g',
    slug: 'authentic-lakadong-turmeric-powder-250g',
    sku: 'SPI-TURM-250',
    cat: 'Spices & Masalas',
    subcat: null,
    desc: 'High curcumin (7-9%) organic Lakadong haldi powder sourced from Meghalaya.',
    price_inr: 249, price_usd: 6, discount_inr: 169, discount_usd: 4, stock: 350, is_best: 1,
    img: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=800&q=80',
    variants: [
      { name: '250g Jar', sku: 'SPI-TURM-250', price_inr: 249, price_usd: 6, discount_inr: 169, discount_usd: 4, stock: 350 }
    ]
  },
  {
    title: 'Pure Himalayan Shilajit Resin 50g',
    slug: 'pure-himalayan-shilajit-resin-50g',
    sku: 'WEL-SHIL-50',
    cat: 'Health & Wellness',
    subcat: null,
    desc: '100% original purified Himalayan Shilajit resin with >80% Fulvic Acid. Enhances vitality and physical strength.',
    price_inr: 1299, price_usd: 32, discount_inr: 899, discount_usd: 22, stock: 100, is_best: 1,
    img: 'https://images.unsplash.com/photo-1615811361523-6bd03d7748e7?auto=format&fit=crop&w=800&q=80',
    variants: [
      { name: '50g Glass Jar', sku: 'WEL-SHIL-50', price_inr: 1299, price_usd: 32, discount_inr: 899, discount_usd: 22, stock: 100 }
    ]
  },
  {
    title: 'Organic Pink Himalayan Salt Powder 1Kg',
    slug: 'organic-pink-himalayan-salt-powder-1kg',
    sku: 'SALT-PINK-1K',
    cat: 'Salt, Sugar & Sweeteners',
    subcat: null,
    desc: '100% natural unrefined mineral-rich pink salt for daily healthy cooking.',
    price_inr: 199, price_usd: 5, discount_inr: 129, discount_usd: 3.5, stock: 400, is_best: 1,
    img: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=800&q=80',
    variants: [
      { name: '1 Kg Pouch', sku: 'SALT-PINK-1K', price_inr: 199, price_usd: 5, discount_inr: 129, discount_usd: 3.5, stock: 400 }
    ]
  }
];

const insertProd = db.prepare(`
  INSERT INTO products (
    title, slug, sku, category_id, subcategory_id, description,
    price_inr, price_usd, discount_inr, discount_usd, stock, is_best_product,
    seo_title, seo_description, seo_keywords
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
`);

const insertVar = db.prepare(`
  INSERT INTO product_variants (
    product_id, variant_name, sku, price_inr, price_usd, discount_inr, discount_usd, stock
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertImg = db.prepare(`
  INSERT INTO product_images (product_id, image_url, is_primary) VALUES (?, ?, 1)
`);

productsData.forEach(p => {
  const catId = catMap[p.cat];
  const subcatId = p.subcat ? subcatMap[p.subcat] : null;

  const info = insertProd.run(
    p.title, p.slug, p.sku, catId, subcatId, p.desc,
    p.price_inr, p.price_usd, p.discount_inr, p.discount_usd, p.stock,
    `${p.title} Online`, `Buy organic ${p.title} at best price`, `${p.title}, organic grocery`
  );
  const prodId = info.lastInsertRowid;
  insertImg.run(prodId, p.img);

  if (p.variants) {
    p.variants.forEach(v => {
      insertVar.run(prodId, v.name, v.sku, v.price_inr, v.price_usd, v.discount_inr, v.discount_usd, v.stock);
    });
  }
});

console.log('✓ Successfully populated exact requested Website Category Structure into SQLite database!');
