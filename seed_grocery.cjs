const db = require('./db.cjs');

console.log('Seeding Grocery & Wellness catalog from uploaded chart...');

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

// Insert 13 Categories from uploaded chart
const categoriesData = [
  { name: 'Skin Treatment', icon: '🧴', slug: 'skin-treatment', description: 'Aloe Vera, Acne Care, Anti-Aging & Herbal Skincare' },
  { name: 'Food & Nutrition', icon: '🌿', slug: 'food-nutrition', description: 'Superfoods, Organic Flours, Pulses, Millets & Dry Fruits' },
  { name: 'Nutrition Supplements', icon: '🥤', slug: 'nutrition-supplements', description: 'Plant Protein, Herbal Powders & Protein Mixes' },
  { name: 'Spices', icon: '🌶️', slug: 'spices', description: 'Whole Spices, Powders, Seasonings & Masala Blends' },
  { name: 'Edible Seeds', icon: '🥜', slug: 'edible-seeds', description: 'Chia, Flax, Pumpkin, Sunflower, Sesame & Sabja Seeds' },
  { name: 'Ready to Cook', icon: '🍲', slug: 'ready-to-cook', description: 'Instant Idli, Dosa, Upma, Soup & Pakoda Mixes' },
  { name: 'Hair Treatment', icon: '💇‍♀️', slug: 'hair-treatment', description: 'Organic Hair Oils, Reetha, Shikakai & Herbal Powders' },
  { name: 'Digestive Probiotic', icon: '🍵', slug: 'digestive-probiotic', description: 'Triphala, Isabgol, ACV, Kombucha & Probiotics' },
  { name: 'Health & Beauty', icon: '🌸', slug: 'health-beauty', description: 'Body Wash, Biotin, Essential Oils & Herbal Teas' },
  { name: 'Skin Care', icon: '✨', slug: 'skin-care', description: 'Face Wash, Charcoal Masks, Rose Water & Scrubs' },
  { name: 'Household Care & Supplies', icon: '🧹', slug: 'household-care', description: 'Laundry Care, Floor Cleaners, Camphor & Kitchen Powder' }
];

const insertCat = db.prepare('INSERT INTO categories (name, icon, slug, description) VALUES (?, ?, ?, ?)');
const catMap = {};

categoriesData.forEach(cat => {
  const info = insertCat.run(cat.name, cat.icon, cat.slug, cat.description);
  catMap[cat.name] = info.lastInsertRowid;
});

// Insert Subcategories
const subcatData = [
  // Skin Treatment
  { cat: 'Skin Treatment', name: 'Face Care', slug: 'face-care' },
  { cat: 'Skin Treatment', name: 'Acne Care', slug: 'acne-care' },
  { cat: 'Skin Treatment', name: 'Anti-Aging', slug: 'anti-aging' },
  { cat: 'Skin Treatment', name: 'Herbal Skin Care', slug: 'herbal-skin-care' },

  // Food & Nutrition
  { cat: 'Food & Nutrition', name: 'Superfoods', slug: 'superfoods' },
  { cat: 'Food & Nutrition', name: 'Flours', slug: 'flours' },
  { cat: 'Food & Nutrition', name: 'Pulses', slug: 'pulses' },
  { cat: 'Food & Nutrition', name: 'Millets', slug: 'millets' },
  { cat: 'Food & Nutrition', name: 'Healthy Snacks', slug: 'healthy-snacks' },

  // Spices
  { cat: 'Spices', name: 'Whole Spices', slug: 'whole-spices' },
  { cat: 'Spices', name: 'Spice Powders', slug: 'spice-powders' },
  { cat: 'Spices', name: 'Seasonings', slug: 'seasonings' },
  { cat: 'Spices', name: 'Masala Blends', slug: 'masala-blends' },

  // Edible Seeds
  { cat: 'Edible Seeds', name: 'Super Seeds', slug: 'super-seeds' },
  { cat: 'Edible Seeds', name: 'Healthy Seeds', slug: 'healthy-seeds' },
  { cat: 'Edible Seeds', name: 'Oil Seeds', slug: 'oil-seeds' },
  { cat: 'Edible Seeds', name: 'Traditional Seeds', slug: 'traditional-seeds' },

  // Ready to Cook
  { cat: 'Ready to Cook', name: 'Breakfast Mix', slug: 'breakfast-mix' },
  { cat: 'Ready to Cook', name: 'Soup Mix', slug: 'soup-mix' },
  { cat: 'Ready to Cook', name: 'Snack Mix', slug: 'snack-mix' },

  // Hair Treatment
  { cat: 'Hair Treatment', name: 'Hair Oils', slug: 'hair-oils' },
  { cat: 'Hair Treatment', name: 'Hair Powders', slug: 'hair-powders' },
  { cat: 'Hair Treatment', name: 'Anti-Dandruff', slug: 'anti-dandruff' },

  // Digestive Probiotic
  { cat: 'Digestive Probiotic', name: 'Digestive Powders', slug: 'digestive-powders' },
  { cat: 'Digestive Probiotic', name: 'Gut Health', slug: 'gut-health' },

  // Skin Care
  { cat: 'Skin Care', name: 'Face Wash', slug: 'face-wash' },
  { cat: 'Skin Care', name: 'Face Mask', slug: 'face-mask' },
  { cat: 'Skin Care', name: 'Scrubs', slug: 'scrubs' }
];

const insertSubcat = db.prepare('INSERT INTO subcategories (category_id, name, slug) VALUES (?, ?, ?)');
const subcatMap = {};

subcatData.forEach(sub => {
  const catId = catMap[sub.cat];
  const info = insertSubcat.run(catId, sub.name, sub.slug);
  subcatMap[sub.name] = info.lastInsertRowid;
});

// Collections
db.exec(`
  INSERT INTO collections (name, slug, description, image_url, category_id) VALUES
  ('Superfoods & Organic Seeds Best Sellers', 'superfoods-bestsellers', 'Top organic nutrition powders & edible seeds', 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80', 2),
  ('Herbal Skincare & Oils Mega Sale', 'skincare-mega-sale', 'Pure cold pressed oils and herbal face powders', 'https://images.unsplash.com/photo-1608248597262-838198f12c1c?auto=format&fit=crop&w=800&q=80', 1);
`);

// Insert 15 Products matching chart items
const productsData = [
  {
    title: 'Organic Moringa Leaf Powder 250g',
    slug: 'organic-moringa-powder-250g',
    sku: 'ORG-MOR-250',
    cat: 'Food & Nutrition',
    subcat: 'Superfoods',
    desc: '100% pure organic moringa oleifera leaf powder. Rich in antioxidants, iron, vitamin A & essential amino acids.',
    price_inr: 299, price_usd: 8, discount_inr: 199, discount_usd: 5, stock: 200, is_best: 1,
    img: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
    variants: [
      { name: '100g Pouch', sku: 'ORG-MOR-100', price_inr: 149, price_usd: 4, discount_inr: 99, discount_usd: 3, stock: 150 },
      { name: '250g Pouch', sku: 'ORG-MOR-250', price_inr: 299, price_usd: 8, discount_inr: 199, discount_usd: 5, stock: 200 },
      { name: '500g Pack', sku: 'ORG-MOR-500', price_inr: 549, price_usd: 14, discount_inr: 389, discount_usd: 10, stock: 90 }
    ]
  },
  {
    title: 'Raw Raw Organic Chia Seeds 500g',
    slug: 'raw-organic-chia-seeds-500g',
    sku: 'ORG-CHIA-500',
    cat: 'Edible Seeds',
    subcat: 'Super Seeds',
    desc: 'Premium quality raw chia seeds packed with Omega-3 fatty acids, dietary fiber, and plant protein for weight loss & digestion.',
    price_inr: 399, price_usd: 10, discount_inr: 249, discount_usd: 6, stock: 300, is_best: 1,
    img: 'https://images.unsplash.com/photo-1514733670139-4d87a1941d55?auto=format&fit=crop&w=800&q=80',
    variants: [
      { name: '250g Jar', sku: 'ORG-CHIA-250', price_inr: 229, price_usd: 6, discount_inr: 149, discount_usd: 4, stock: 180 },
      { name: '500g Jar', sku: 'ORG-CHIA-500', price_inr: 399, price_usd: 10, discount_inr: 249, discount_usd: 6, stock: 300 },
      { name: '1 Kg Family Pack', sku: 'ORG-CHIA-1K', price_inr: 749, price_usd: 19, discount_inr: 469, discount_usd: 12, stock: 110 }
    ]
  },
  {
    title: 'Pure Cold Pressed Virgin Coconut Oil 500ml',
    slug: 'pure-cold-pressed-virgin-coconut-oil-500ml',
    sku: 'ORG-COC-500',
    cat: 'Hair Treatment',
    subcat: 'Hair Oils',
    desc: '100% natural wood pressed raw virgin coconut oil for hair growth, scalp nourishment, and skin moisturizing.',
    price_inr: 449, price_usd: 12, discount_inr: 329, discount_usd: 8, stock: 160, is_best: 1,
    img: 'https://images.unsplash.com/photo-1608248597262-838198f12c1c?auto=format&fit=crop&w=800&q=80',
    variants: [
      { name: '250ml Glass Bottle', sku: 'ORG-COC-250', price_inr: 249, price_usd: 6, discount_inr: 189, discount_usd: 5, stock: 120 },
      { name: '500ml Glass Bottle', sku: 'ORG-COC-500', price_inr: 449, price_usd: 12, discount_inr: 329, discount_usd: 8, stock: 160 },
      { name: '1 Litre Can', sku: 'ORG-COC-1L', price_inr: 849, price_usd: 21, discount_inr: 629, discount_usd: 16, stock: 75 }
    ]
  },
  {
    title: 'Natural Multani Mitti Face Pack Powder 200g',
    slug: 'natural-multani-mitti-face-pack-powder-200g',
    sku: 'ORG-MULT-200',
    cat: 'Skin Care',
    subcat: 'Face Mask',
    desc: '100% pure Fuller’s Earth Multani Mitti clay powder. Removes excess oil, clears acne marks, and deep cleanses pores naturally.',
    price_inr: 149, price_usd: 4, discount_inr: 99, discount_usd: 3, stock: 250, is_best: 0,
    img: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80',
    variants: [
      { name: '200g Pouch', sku: 'ORG-MULT-200', price_inr: 149, price_usd: 4, discount_inr: 99, discount_usd: 3, stock: 250 },
      { name: '500g Value Pack', sku: 'ORG-MULT-500', price_inr: 299, price_usd: 8, discount_inr: 189, discount_usd: 5, stock: 140 }
    ]
  },
  {
    title: 'Authentic Organic Lakadong Turmeric Powder 250g',
    slug: 'authentic-organic-lakadong-turmeric-powder-250g',
    sku: 'ORG-TURM-250',
    cat: 'Spices',
    subcat: 'Spice Powders',
    desc: 'High curcumin (7-9%) organic Lakadong haldi powder sourced from Meghalaya. High immunity booster and medicinal spice.',
    price_inr: 249, price_usd: 6, discount_inr: 169, discount_usd: 4, stock: 350, is_best: 1,
    img: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=800&q=80',
    variants: [
      { name: '250g Jar', sku: 'ORG-TURM-250', price_inr: 249, price_usd: 6, discount_inr: 169, discount_usd: 4, stock: 350 },
      { name: '500g Refill Pack', sku: 'ORG-TURM-500', price_inr: 449, price_usd: 11, discount_inr: 319, discount_usd: 8, stock: 200 }
    ]
  },
  {
    title: 'Raw Flax Seeds (Alsi) 500g',
    slug: 'raw-flax-seeds-alsi-500g',
    sku: 'ORG-FLAX-500',
    cat: 'Edible Seeds',
    subcat: 'Super Seeds',
    desc: 'Organic raw roasted brown flax seeds. Excellent source of lignans, plant protein, and heart-healthy fats.',
    price_inr: 249, price_usd: 6, discount_inr: 159, discount_usd: 4, stock: 220, is_best: 0,
    img: 'https://images.unsplash.com/photo-1514733670139-4d87a1941d55?auto=format&fit=crop&w=800&q=80',
    variants: [
      { name: '250g Pack', sku: 'ORG-FLAX-250', price_inr: 139, price_usd: 3.5, discount_inr: 89, discount_usd: 2.5, stock: 120 },
      { name: '500g Pack', sku: 'ORG-FLAX-500', price_inr: 249, price_usd: 6, discount_inr: 159, discount_usd: 4, stock: 220 }
    ]
  },
  {
    title: 'Instant Multi-Grain Dosa & Idli Mix 500g',
    slug: 'instant-multigrain-dosa-idli-mix-500g',
    sku: 'ORG-DOSA-500',
    cat: 'Ready to Cook',
    subcat: 'Breakfast Mix',
    desc: 'Healthy blend of ragi, bajra, jowar, oats, and urad dal. Make crispy high-protein dosas in just 10 minutes without fermentation.',
    price_inr: 199, price_usd: 5, discount_inr: 139, discount_usd: 3.5, stock: 180, is_best: 0,
    img: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80',
    variants: [
      { name: '500g Pack', sku: 'ORG-DOSA-500', price_inr: 199, price_usd: 5, discount_inr: 139, discount_usd: 3.5, stock: 180 },
      { name: '1 Kg Value Pack', sku: 'ORG-DOSA-1K', price_inr: 349, price_usd: 9, discount_inr: 249, discount_usd: 6, stock: 100 }
    ]
  },
  {
    title: 'Traditional Triphala Powder 250g',
    slug: 'traditional-triphala-powder-250g',
    sku: 'ORG-TRIP-250',
    cat: 'Digestive Probiotic',
    subcat: 'Digestive Powders',
    desc: 'Ayurvedic blend of Amla, Haritaki, and Bibhitaki. Supports healthy digestion, bowel regularity, and body detoxification.',
    price_inr: 199, price_usd: 5, discount_inr: 129, discount_usd: 3.5, stock: 300, is_best: 1,
    img: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
    variants: [
      { name: '100g Jar', sku: 'ORG-TRIP-100', price_inr: 99, price_usd: 2.5, discount_inr: 69, discount_usd: 1.8, stock: 150 },
      { name: '250g Jar', sku: 'ORG-TRIP-250', price_inr: 199, price_usd: 5, discount_inr: 129, discount_usd: 3.5, stock: 300 }
    ]
  }
];

const insertProd = db.prepare(`
  INSERT INTO products (
    title, slug, sku, category_id, subcategory_id, description,
    price_inr, price_usd, discount_inr, discount_usd, stock, is_best_product,
    seo_title, seo_description, seo_keywords
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertVar = db.prepare(`
  INSERT INTO product_variants (
    product_id, variant_name, sku, price_inr, price_usd, discount_inr, discount_usd, stock
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertImg = db.prepare(`
  INSERT INTO product_images (product_id, image_url, is_primary) VALUES (?, ?, 1)
`);

productsData.forEach(prod => {
  const catId = catMap[prod.cat];
  const subcatId = subcatMap[prod.subcat] || null;

  const info = insertProd.run(
    prod.title, prod.slug, prod.sku, catId, subcatId, prod.desc,
    prod.price_inr, prod.price_usd, prod.discount_inr, prod.discount_usd, prod.stock, prod.is_best,
    `${prod.title} Online`, `Buy organic ${prod.title} at best prices.`, `${prod.title}, organic grocery`
  );

  const productId = info.lastInsertRowid;
  insertImg.run(productId, prod.img);

  if (prod.variants && prod.variants.length > 0) {
    prod.variants.forEach(v => {
      insertVar.run(productId, v.name, v.sku, v.price_inr, v.price_usd, v.discount_inr, v.discount_usd, v.stock);
    });
  }
});

console.log('✓ Successfully populated Grocery & Wellness catalog database from uploaded chart!');
db.close();
