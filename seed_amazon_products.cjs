require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const INR_TO_USD = 83;
function inrToUsd(inr) { return inr ? Math.round((inr / INR_TO_USD) * 100) / 100 : 0; }
function generateSlug(text) {
  return text.toString().toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
}

const CATEGORY_MAP = {
  'HERB':'Herbs & Teas','TEA':'Herbs & Teas','DRIED_PLANT':'Herbs & Teas','INCENSE':'Herbs & Teas',
  'CEREAL':'Cereals & Grains',
  'HERBAL_SUPPLEMENT':'Herbal Supplements','NUTRITIONAL_SUPPLEMENT':'Herbal Supplements','PROTEIN_SUPPLEMENT_POWDER':'Herbal Supplements','MINERAL_SUPPLEMENT':'Herbal Supplements','MEDICATION':'Herbal Supplements',
  'LEGUME':'Legumes & Pulses',
  'NUT_AND_SEED':'Nuts & Seeds','NUT_BUTTER':'Nuts & Seeds','PLANT_SEED':'Nuts & Seeds','SEEDS_AND_PLANTS':'Nuts & Seeds',
  'SEASONING':'Spices & Seasoning','CULINARY_SALT':'Spices & Seasoning',
  'FLOUR':'Flours & Starches','THICKENING_AGENT':'Flours & Starches','LEAVENING_AGENT':'Flours & Starches',
  'FRUIT':'Fruits & Snacks','FRUIT_SNACK':'Fruits & Snacks','CANDY':'Fruits & Snacks','CHEWING_GUM':'Fruits & Snacks','PUFFED_SNACK':'Fruits & Snacks','SNACK_MIX':'Fruits & Snacks','POPCORN':'Fruits & Snacks','CAKE':'Fruits & Snacks',
  'GROCERY':'Grocery & Food','FOOD':'Grocery & Food','EDIBLE_OIL_VEGETABLE':'Grocery & Food','SAUCE':'Grocery & Food','PACKAGED_SOUP_AND_STEW':'Grocery & Food','SUGAR':'Grocery & Food','SUGAR_SUBSTITUTE':'Grocery & Food','SUGAR_CANDY':'Grocery & Food','VEGETABLE':'Grocery & Food',
  'HEALTH_PERSONAL_CARE':'Health & Personal Care','BEAUTY':'Health & Personal Care','COSMETIC_POWDER':'Health & Personal Care','HAIR_COLORING_AGENT':'Health & Personal Care','HAIR_STYLING_AGENT':'Health & Personal Care','MOUTHWASH':'Health & Personal Care',
  'SKIN_CARE_AGENT':'Skin & Body Care','SKIN_CLEANING_AGENT':'Skin & Body Care','SKIN_MOISTURIZER':'Skin & Body Care','SKIN_TREATMENT_MASK':'Skin & Body Care','ASTRINGENT_SUBSTANCE':'Skin & Body Care','BATHWATER_ADDITIVE':'Skin & Body Care','SHAMPOO':'Skin & Body Care','PERSONAL_CARE_APPLIANCE':'Skin & Body Care','TOWEL':'Skin & Body Care',
  'CLEANING_AGENT':'Home & Garden','DISHWASHER_DETERGENT':'Home & Garden','LAUNDRY_DETERGENT':'Home & Garden','FERTILIZER':'Home & Garden','SOIL':'Home & Garden','UTILITY_SPONGE':'Home & Garden','LAB_CHEMICAL':'Home & Garden','SECURITY_ELECTRONICS':'Home & Garden',
  'BLANKET':'Other','WATCH_BAND':'Other','PET_FOOD':'Other'
};

const CATEGORIES = [
  {name:'Herbs & Teas',icon:'\uD83C\uDF3F',desc:'Premium herbs, herbal teas, dried plants, and natural incense products.'},
  {name:'Cereals & Grains',icon:'\uD83C\uDF3E',desc:'Millets, whole grains, rice varieties, and ancient grains.'},
  {name:'Herbal Supplements',icon:'\uD83D\uDC8A',desc:'Natural herbal supplements, nutritional supplements, protein powders.'},
  {name:'Legumes & Pulses',icon:'\uD83E\uDED8',desc:'Premium quality lentils, beans, pulses, and dal varieties.'},
  {name:'Nuts & Seeds',icon:'\uD83E\uDD5C',desc:'Dry fruits, nuts, edible seeds, nut butters, and plant seeds.'},
  {name:'Spices & Seasoning',icon:'\uD83C\uDF36\uFE0F',desc:'Whole spices, ground spices, culinary salts, and seasoning blends.'},
  {name:'Flours & Starches',icon:'\uD83E\uDED3',desc:'Grain flours, starches, thickening agents, and baking essentials.'},
  {name:'Fruits & Snacks',icon:'\uD83C\uDF47',desc:'Dried fruits, fruit snacks, healthy snacks, candies, and cakes.'},
  {name:'Grocery & Food',icon:'\uD83D\uDED2',desc:'Everyday grocery items, cooking oils, sauces, sugars, and food products.'},
  {name:'Health & Personal Care',icon:'\uD83D\uDC86',desc:'Health and beauty products, personal care, cosmetics, and hair care.'},
  {name:'Skin & Body Care',icon:'\u2728',desc:'Skincare products, body care, bath additives, face masks.'},
  {name:'Home & Garden',icon:'\uD83C\uDFE1',desc:'Cleaning products, gardening supplies, fertilizers, and home essentials.'},
  {name:'Other',icon:'\uD83D\uDCE6',desc:'Miscellaneous products including accessories and pet supplies.'}
];

const SUBCATEGORY_MAP = {
  'Herbs & Teas':['Herbal Tea Cuts & Leafs','Raw Whole Herbs','Herb Powders','Dried Plants & Flowers','Incense & Dhoop'],
  'Cereals & Grains':['Millets','Major Grains & Rices','Pseudo Grains','Cereal Flakes'],
  'Herbal Supplements':['Herbal Capsules & Tablets','Nutritional Supplements','Protein Powders','Ayurvedic Medicines'],
  'Legumes & Pulses':['Whole Lentils & Dals','Beans & Rajma','Split Pulses','Chickpeas & Chana'],
  'Nuts & Seeds':['Dry Fruits & Nuts','Edible Seeds','Nut Butters','Plant & Garden Seeds'],
  'Spices & Seasoning':['Whole Spices','Ground Spices','Culinary Salts','Seasoning Blends'],
  'Flours & Starches':['Grain Flours','Root Flours','Defatted Flour & Cakes','Starches & Thickeners'],
  'Fruits & Snacks':['Dried Fruits','Fruit Snacks','Healthy Snacks','Natural Candies'],
  'Grocery & Food':['Cooking Oils','Sugars & Sweeteners','Sauces & Condiments','Ready to Cook','Other Grocery'],
  'Health & Personal Care':['Health Products','Beauty & Cosmetics','Hair Care','Oral Care'],
  'Skin & Body Care':['Face Care','Body Care','Bath & Body','Natural Skin Treatment','Hair Wash & Shampoo'],
  'Home & Garden':['Cleaning Products','Gardening & Fertilizers','Laundry Care','Home Essentials'],
  'Other':['Accessories','Pet Supplies','Miscellaneous']
};

const COLLECTIONS = [
  {name:'Offers',slug:'offers',desc:'Special offers and discounted products'},
  {name:'Best Sellers',slug:'bestsellers',desc:'Our top selling products'},
  {name:'New Arrivals',slug:'new-arrivals',desc:'Latest additions to our catalog'},
  {name:'Certified Organic',slug:'certified-organic',desc:'Certified organic and natural products'},
  {name:'Ayurvedic Superfoods',slug:'ayurvedic-superfoods',desc:'Ayurvedic herbs, superfoods, and wellness products'}
];

async function main() {
  console.log('=== ValueLife Essentials - Amazon Products Import ===');
  const dataPath = path.resolve('C:/Users/PC/.gemini/antigravity/brain/ecf5e20e-eb28-4ea4-8667-6c8ce2eb7336/scratch/extracted_products.json');
  const extractedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  let allProducts = [];
  Object.values(extractedData).forEach(d => allProducts.push(...d.products));
  console.log('Loaded ' + allProducts.length + ' products');

  let mysqlHost = process.env.MYSQL_HOST || 'srv831.hstgr.io';
  if (mysqlHost === 'localhost') mysqlHost = 'srv831.hstgr.io';
  const connection = await mysql.createConnection({
    host: mysqlHost, user: process.env.MYSQL_USER || 'u439830852_admin',
    password: process.env.MYSQL_PASSWORD || 'Valuelife@support1',
    database: process.env.MYSQL_DATABASE || 'u439830852_valuelife',
    port: Number(process.env.MYSQL_PORT) || 3306, connectTimeout: 10000
  });
  console.log('Connected to MySQL');

  console.log('Phase 1: Cleaning...');
  await connection.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of ['product_collections','product_images','product_variants','products','subcategories','categories','collections']) {
    await connection.query('DELETE FROM ' + t);
    try { await connection.query('ALTER TABLE ' + t + ' AUTO_INCREMENT = 1'); } catch(e){}
  }
  await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('Cleaned all tables');

  console.log('Phase 2: Categories...');
  const catIdMap = {};
  for (const cat of CATEGORIES) {
    const slug = generateSlug(cat.name);
    const [result] = await connection.query('INSERT INTO categories (name, slug, description, icon) VALUES (?, ?, ?, ?)', [cat.name, slug, cat.desc, cat.icon]);
    catIdMap[cat.name] = result.insertId;
    console.log('  Cat: ' + cat.name + ' id=' + result.insertId);
  }
  for (const [catName, subs] of Object.entries(SUBCATEGORY_MAP)) {
    const catId = catIdMap[catName];
    if (!catId) continue;
    for (const subName of subs) {
      let slug = generateSlug(subName);
      try { await connection.query('INSERT INTO subcategories (category_id, name, slug) VALUES (?, ?, ?)', [catId, subName, slug]); }
      catch(e) { slug = generateSlug(subName + ' ' + catName); await connection.query('INSERT INTO subcategories (category_id, name, slug) VALUES (?, ?, ?)', [catId, subName, slug]); }
    }
  }

  console.log('Phase 3: Collections...');
  const collectionIdMap = {};
  for (const col of COLLECTIONS) {
    const [result] = await connection.query('INSERT INTO collections (name, slug, description) VALUES (?, ?, ?)', [col.name, col.slug, col.desc]);
    collectionIdMap[col.slug] = result.insertId;
  }

  console.log('Phase 4: Products...');
  const parentSkuMap = {};
  allProducts.filter(p => p.parentage && p.parentage.toLowerCase() === 'child').forEach(c => {
    if (c.parent_sku) { if (!parentSkuMap[c.parent_sku]) parentSkuMap[c.parent_sku] = []; parentSkuMap[c.parent_sku].push(c); }
  });
  const productsToInsert = allProducts.filter(p => !p.parentage || p.parentage.toLowerCase() !== 'child');
  const validProducts = productsToInsert.filter(p => {
    if (p.status === 'Inactive') return false;
    if (!p.price && !parentSkuMap[p.sku]) return false;
    return true;
  });
  console.log('Valid products: ' + validProducts.length);

  const usedSlugs = new Set();
  const usedSkus = new Set();
  let insertedCount = 0, imageCount = 0, variantCount = 0, skippedCount = 0;

  for (let i = 0; i < validProducts.length; i++) {
    const p = validProducts[i];
    try {
      const title = (p.item_name || p.title || '').trim();
      if (!title) { skippedCount++; continue; }
      let priceInr = p.price ? parseFloat(p.price) : 0;
      const children = parentSkuMap[p.sku] || [];
      if (!priceInr && children.length > 0) {
        const childPrices = children.map(c => parseFloat(c.price)).filter(Boolean);
        priceInr = childPrices.length > 0 ? Math.min(...childPrices) : 0;
      }
      if (priceInr <= 0) { skippedCount++; continue; }
      const priceUsd = inrToUsd(priceInr);
      const catName = CATEGORY_MAP[p.product_type] || 'Other';
      const categoryId = catIdMap[catName] || catIdMap['Other'];
      let baseSlug = generateSlug(title) || generateSlug(p.sku || 'product-' + i);
      let slug = baseSlug;
      let counter = 1;
      while (usedSlugs.has(slug)) slug = baseSlug + '-' + (counter++);
      usedSlugs.add(slug);
      let sku = (p.sku || '').trim().toUpperCase() || ('VLE-' + Date.now() + '-' + i);
      if (usedSkus.has(sku)) sku = sku + '-' + counter;
      usedSkus.add(sku);
      let description = (p.description || '').trim();
      if (p.bullets && p.bullets.length > 0) description += '\n\n' + p.bullets.map(b => '• ' + b).join('\n');
      if (description.length > 5000) description = description.substring(0, 5000);
      const stock = p.quantity ? parseInt(p.quantity) || 100 : 100;
      const tags = (p.keywords || []).join(', ').substring(0, 500);
      const weight = p.weight ? parseFloat(p.weight) || 0.5 : 0.5;
      const primaryImage = p.images && p.images.length > 0 ? p.images[0] : null;

      const [result] = await connection.query(
        'INSERT INTO products (title, slug, sku, barcode, status, vendor, product_type, tags, category_id, description, price_inr, price_usd, stock, weight, hs_code, country_of_origin, is_best_product, image_url) VALUES (?, ?, ?, ?, \'Active\', ?, ?, ?, ?, ?, ?, ?, ?, ?, \'\', \'India\', 0, ?)',
        [title, slug, sku, p.asin || null, 'VALUELIFE ESSENTIALS', p.product_type || '', tags, categoryId, description, priceInr, priceUsd, stock, weight, primaryImage]
      );
      const productId = result.insertId;
      insertedCount++;

      if (p.images && p.images.length > 0) {
        for (let imgIdx = 0; imgIdx < p.images.length; imgIdx++) {
          try { await connection.query('INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (?, ?, ?, ?)', [productId, p.images[imgIdx], imgIdx, imgIdx === 0 ? 1 : 0]); imageCount++; } catch(e){}
        }
      }

      if (children.length > 0) {
        for (const child of children) {
          const childPrice = parseFloat(child.price) || priceInr;
          const childTitle = child.size || child.color || child.flavor || child.item_name || child.title || 'Variant';
          const childSku = (child.sku || '').trim().toUpperCase();
          const childStock = child.quantity ? parseInt(child.quantity) || 50 : 50;
          try { await connection.query('INSERT INTO product_variants (product_id, title, variant_name, sku, price_inr, price_usd, stock) VALUES (?, ?, ?, ?, ?, ?, ?)', [productId, childTitle, childTitle, childSku || sku+'-V'+variantCount, childPrice, inrToUsd(childPrice), childStock]); variantCount++; } catch(e){}
          if (child.images && child.images.length > 0) { for (const img of child.images) { try { await connection.query('INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)', [productId, img, imageCount]); imageCount++; } catch(e){} } }
        }
      }

      const collectionIds = [];
      const tl = title.toLowerCase(), dl = description.toLowerCase();
      if (tl.includes('organic') || dl.includes('organic') || tl.includes('natural')) collectionIds.push(collectionIdMap['certified-organic']);
      if (tl.includes('ayurved') || tl.includes('superfood') || catName === 'Herbal Supplements' || catName === 'Herbs & Teas' || dl.includes('ayurved')) collectionIds.push(collectionIdMap['ayurvedic-superfoods']);
      if (stock > 100) collectionIds.push(collectionIdMap['bestsellers']);
      for (const colId of collectionIds) { if (colId) try { await connection.query('INSERT IGNORE INTO product_collections (product_id, collection_id) VALUES (?, ?)', [productId, colId]); } catch(e){} }

      if (i % 200 === 0) console.log('  Progress: ' + i + '/' + validProducts.length);
    } catch (e) {
      skippedCount++;
      if (e.code !== 'ER_DUP_ENTRY') console.error('  Error: ' + e.message.substring(0, 120));
    }
  }

  console.log('Inserted=' + insertedCount + ' Images=' + imageCount + ' Variants=' + variantCount + ' Skipped=' + skippedCount);

  const [topProducts] = await connection.query('SELECT id FROM products WHERE stock > 50 ORDER BY price_inr DESC LIMIT 50');
  for (const p of topProducts) await connection.query('UPDATE products SET is_best_product = 1 WHERE id = ?', [p.id]);
  const [newProds] = await connection.query('SELECT id FROM products ORDER BY id DESC LIMIT 100');
  for (const p of newProds) try { await connection.query('INSERT IGNORE INTO product_collections (product_id, collection_id) VALUES (?, ?)', [p.id, collectionIdMap['new-arrivals']]); } catch(e){}

  const [[{c1}]] = await connection.query('SELECT COUNT(*) as c1 FROM products');
  const [[{c2}]] = await connection.query('SELECT COUNT(*) as c2 FROM product_images');
  const [[{c3}]] = await connection.query('SELECT COUNT(*) as c3 FROM product_variants');
  const [[{c4}]] = await connection.query('SELECT COUNT(*) as c4 FROM categories');
  console.log('FINAL: Products=' + c1 + ' Images=' + c2 + ' Variants=' + c3 + ' Categories=' + c4);

  const [catProds] = await connection.query('SELECT c.name, COUNT(p.id) as cnt FROM categories c LEFT JOIN products p ON p.category_id = c.id GROUP BY c.id, c.name ORDER BY cnt DESC');
  catProds.forEach(r => console.log('  ' + r.name + ': ' + r.cnt));
  await connection.end();
  console.log('=== IMPORT COMPLETE ===');
}
main().catch(err => { console.error('FATAL:', err); process.exit(1); });
