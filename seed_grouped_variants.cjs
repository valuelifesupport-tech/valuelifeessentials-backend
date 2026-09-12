/**
 * ValueLife Essentials — Intelligent Product Variation Seeder
 * Groups 1,654 Amazon listings into ~780 clean product families
 * with interactive size/weight variants (100g, 250g, 500g, 1kg, etc.)
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');

const INR_TO_USD = 83;
function inrToUsd(inr) { return inr ? Math.round((inr / INR_TO_USD) * 100) / 100 : 0; }

function generateSlug(text) {
  return text.toString().toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

const CATEGORY_MAP = {
  'HERB': 'Herbs & Teas',
  'TEA': 'Herbs & Teas',
  'DRIED_PLANT': 'Herbs & Teas',
  'INCENSE': 'Herbs & Teas',
  'CEREAL': 'Cereals & Grains',
  'HERBAL_SUPPLEMENT': 'Herbal Supplements',
  'NUTRITIONAL_SUPPLEMENT': 'Herbal Supplements',
  'PROTEIN_SUPPLEMENT_POWDER': 'Herbal Supplements',
  'MINERAL_SUPPLEMENT': 'Herbal Supplements',
  'MEDICATION': 'Herbal Supplements',
  'LEGUME': 'Legumes & Pulses',
  'NUT_AND_SEED': 'Nuts & Seeds',
  'NUT_BUTTER': 'Nuts & Seeds',
  'PLANT_SEED': 'Nuts & Seeds',
  'SEEDS_AND_PLANTS': 'Nuts & Seeds',
  'SEASONING': 'Spices & Seasoning',
  'CULINARY_SALT': 'Spices & Seasoning',
  'FLOUR': 'Flours & Starches',
  'THICKENING_AGENT': 'Flours & Starches',
  'LEAVENING_AGENT': 'Flours & Starches',
  'FRUIT': 'Fruits & Snacks',
  'FRUIT_SNACK': 'Fruits & Snacks',
  'CANDY': 'Fruits & Snacks',
  'CHEWING_GUM': 'Fruits & Snacks',
  'PUFFED_SNACK': 'Fruits & Snacks',
  'SNACK_MIX': 'Fruits & Snacks',
  'POPCORN': 'Fruits & Snacks',
  'CAKE': 'Fruits & Snacks',
  'GROCERY': 'Grocery & Food',
  'FOOD': 'Grocery & Food',
  'EDIBLE_OIL_VEGETABLE': 'Grocery & Food',
  'SAUCE': 'Grocery & Food',
  'PACKAGED_SOUP_AND_STEW': 'Grocery & Food',
  'SUGAR': 'Grocery & Food',
  'SUGAR_SUBSTITUTE': 'Grocery & Food',
  'SUGAR_CANDY': 'Grocery & Food',
  'VEGETABLE': 'Grocery & Food',
  'HEALTH_PERSONAL_CARE': 'Health & Personal Care',
  'BEAUTY': 'Health & Personal Care',
  'COSMETIC_POWDER': 'Health & Personal Care',
  'HAIR_COLORING_AGENT': 'Health & Personal Care',
  'HAIR_STYLING_AGENT': 'Health & Personal Care',
  'MOUTHWASH': 'Health & Personal Care',
  'SKIN_CARE_AGENT': 'Skin & Body Care',
  'SKIN_CLEANING_AGENT': 'Skin & Body Care',
  'SKIN_MOISTURIZER': 'Skin & Body Care',
  'SKIN_TREATMENT_MASK': 'Skin & Body Care',
  'ASTRINGENT_SUBSTANCE': 'Skin & Body Care',
  'BATHWATER_ADDITIVE': 'Skin & Body Care',
  'SHAMPOO': 'Skin & Body Care',
  'PERSONAL_CARE_APPLIANCE': 'Skin & Body Care',
  'TOWEL': 'Skin & Body Care',
  'CLEANING_AGENT': 'Home & Garden',
  'DISHWASHER_DETERGENT': 'Home & Garden',
  'LAUNDRY_DETERGENT': 'Home & Garden',
  'FERTILIZER': 'Home & Garden',
  'SOIL': 'Home & Garden',
  'UTILITY_SPONGE': 'Home & Garden',
  'LAB_CHEMICAL': 'Home & Garden',
  'SECURITY_ELECTRONICS': 'Home & Garden',
  'BLANKET': 'Other',
  'WATCH_BAND': 'Other',
  'PET_FOOD': 'Other',
};

const weightPatterns = [
  /\b(\d+(?:\.\d+)?)\s*(?:g|gm|gms|gram|grams|grammes)\b/i,
  /\b(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilo|kilograms)\b/i,
  /\b(\d+(?:\.\d+)?)\s*(?:ml|l|ltr|litre|litres)\b/i,
  /\bpack\s*of\s*(\d+)\b/i,
  /\b(\d+)\s*(?:pieces|piece|pcs)\b/i,
  /\((\d+(?:\.\d+)?)\s*(?:gm|g|kg|gms|ml)\)/i,
  /\((\d+)\s*\(gm\)\)/i,
];

function extractWeightAndCleanTitle(title) {
  let raw = (title || '').trim();
  let foundWeight = null;

  const bracketMatch = raw.match(/[\(\[]\s*(\d+(?:\.\d+)?\s*(?:g|gm|gms|gram|grams|kg|kgs|ml|ltr|pieces|gm\/kg)?)\s*[\)\]]/i);
  if (bracketMatch) foundWeight = bracketMatch[1].trim();

  if (!foundWeight) {
    for (const p of weightPatterns) {
      const m = raw.match(p);
      if (m) { foundWeight = m[0].trim(); break; }
    }
  }

  let cleanTitle = raw;
  if (foundWeight) {
    cleanTitle = cleanTitle
      .replace(new RegExp('[\\(\\[]?\\s*' + foundWeight.replace(/[\(\)\[\]]/g, '') + '\\s*[\\)\\]]?', 'gi'), ' ')
      .replace(/\s*[\-\|\:\/]\s*$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  return { foundWeight: foundWeight || 'Standard Pack', cleanTitle, originalTitle: raw };
}

function parseWeightInGrams(wStr) {
  if (!wStr) return 500;
  const s = wStr.toLowerCase().replace(/\s+/g, '');
  const num = parseFloat(s);
  if (isNaN(num)) return 500;
  if (s.includes('kg') || s.includes('kilo')) return num * 1000;
  return num;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  ValueLife Essentials — Product Variations Seeder        ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const dataPath = 'C:/Users/PC/.gemini/antigravity/brain/ecf5e20e-eb28-4ea4-8667-6c8ce2eb7336/scratch/extracted_products.json';
  const extractedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  let allRawProducts = [];
  Object.values(extractedData).forEach(d => allRawProducts.push(...d.products));
  console.log('📦 Loaded ' + allRawProducts.length + ' raw Amazon products\n');

  const connection = await mysql.createConnection({
    host: 'srv831.hstgr.io',
    user: 'u439830852_admin',
    password: 'Valuelife@support1',
    database: 'u439830852_valuelife',
    port: 3306,
    connectTimeout: 15000
  });
  console.log('✅ Connected to Hostinger MySQL\n');

  // Load existing categories and subcategories
  const [cats] = await connection.query('SELECT id, name FROM categories');
  const catIdMap = {};
  cats.forEach(c => { catIdMap[c.name] = c.id; });

  const [subcats] = await connection.query('SELECT s.id, s.name, c.name as cat_name FROM subcategories s JOIN categories c ON s.category_id = c.id');
  const subCatIdMap = {};
  subcats.forEach(s => { subCatIdMap[s.cat_name + '/' + s.name] = s.id; });

  const [cols] = await connection.query('SELECT id, slug FROM collections');
  const colIdMap = {};
  cols.forEach(c => { colIdMap[c.slug] = c.id; });

  // Filter valid products with price
  const validProducts = allRawProducts.filter(p => {
    if (p.status === 'Inactive') return false;
    const price = parseFloat(p.price);
    return price && price > 0;
  });

  console.log('  Valid priced products: ' + validProducts.length);

  // Group by normalized title
  const groups = new Map();
  validProducts.forEach(p => {
    const title = (p.item_name || p.title || '').trim();
    if (!title) return;
    const { foundWeight, cleanTitle } = extractWeightAndCleanTitle(title);
    const key = cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (!groups.has(key)) {
      groups.set(key, {
        cleanTitle: cleanTitle || title,
        productType: p.product_type,
        brand: p.brand,
        description: p.description,
        bullets: p.bullets,
        keywords: p.keywords,
        items: []
      });
    }

    groups.get(key).items.push({
      originalTitle: title,
      weight: foundWeight || (p.size || 'Standard Pack'),
      weightGrams: parseWeightInGrams(foundWeight),
      price: parseFloat(p.price) || 0,
      sku: (p.sku || '').trim().toUpperCase(),
      asin: p.asin,
      images: p.images || [],
      raw: p
    });
  });

  console.log('  Consolidated into ' + groups.size + ' unique product families\n');

  // Clear products, variants, images, product_collections
  console.log('🧹 Cleaning existing product tables...');
  await connection.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of ['product_collections', 'product_images', 'product_variants', 'products']) {
    await connection.query('DELETE FROM ' + t);
    try { await connection.query('ALTER TABLE ' + t + ' AUTO_INCREMENT = 1'); } catch (e) {}
  }
  await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('  ✓ Cleaned product tables\n');

  console.log('🚀 Seeding product families and variations...');
  const usedSlugs = new Set();
  let insertedFamilies = 0;
  let insertedVariants = 0;
  let insertedImages = 0;

  const groupEntries = Array.from(groups.values());

  for (let i = 0; i < groupEntries.length; i++) {
    const g = groupEntries[i];
    try {
      // Sort variants by weight or price
      g.items.sort((a, b) => a.weightGrams - b.weightGrams || a.price - b.price);

      // Primary item is the lowest priced variant or first
      const primaryItem = g.items[0];
      const minPrice = primaryItem.price;
      const minPriceUsd = inrToUsd(minPrice);
      const comparePriceInr = Math.round(minPrice * 1.25);
      const comparePriceUsd = inrToUsd(comparePriceInr);

      // Generate unique slug
      const baseSlug = generateSlug(g.cleanTitle) || ('product-' + i);
      let slug = baseSlug;
      let counter = 1;
      while (usedSlugs.has(slug)) slug = baseSlug + '-' + (counter++);
      usedSlugs.add(slug);

      const catName = CATEGORY_MAP[g.productType] || 'Other';
      const categoryId = catIdMap[catName] || catIdMap['Other'];

      // Assign best subcategory
      let subcategoryId = null;
      const t = g.cleanTitle.toLowerCase();
      const pType = (g.productType || '').toUpperCase();
      if (catName === 'Herbs & Teas') {
        if (pType === 'TEA' || t.includes('tea')) subcategoryId = subCatIdMap['Herbs & Teas/Herbal Tea Cuts & Leafs'];
        else if (t.includes('powder')) subcategoryId = subCatIdMap['Herbs & Teas/Herb Powders'];
        else if (pType === 'INCENSE' || t.includes('dhoop')) subcategoryId = subCatIdMap['Herbs & Teas/Incense & Dhoop'];
        else subcategoryId = subCatIdMap['Herbs & Teas/Raw Whole Herbs'];
      } else if (catName === 'Cereals & Grains') {
        if (t.includes('millet')) subcategoryId = subCatIdMap['Cereals & Grains/Millets'];
        else if (t.includes('flake')) subcategoryId = subCatIdMap['Cereals & Grains/Cereal Flakes'];
        else subcategoryId = subCatIdMap['Cereals & Grains/Major Grains & Rices'];
      } else if (catName === 'Nuts & Seeds') {
        if (t.includes('seed')) subcategoryId = subCatIdMap['Nuts & Seeds/Edible Seeds'];
        else subcategoryId = subCatIdMap['Nuts & Seeds/Dry Fruits & Nuts'];
      } else {
        subcategoryId = Object.entries(subCatIdMap).find(([k]) => k.startsWith(catName + '/'))?.[1] || null;
      }

      // Collect all unique images
      const allFamilyImages = [];
      const seenImgs = new Set();
      g.items.forEach(it => {
        (it.images || []).forEach(img => {
          if (img && !seenImgs.has(img)) { seenImgs.add(img); allFamilyImages.push(img); }
        });
      });

      const primaryImage = allFamilyImages[0] || null;
      let description = (g.description || primaryItem.raw.description || '').trim();
      if (g.bullets && g.bullets.length > 0) description += '\n\n' + g.bullets.map(b => '• ' + b).join('\n');
      if (description.length > 5000) description = description.substring(0, 5000);

      const brand = (g.brand || 'VALUELIFE ESSENTIALS').trim().toUpperCase();
      const tags = (g.keywords || []).join(', ').substring(0, 500);

      // Insert product family into `products` table
      const [pRes] = await connection.query(
        'INSERT INTO products (title, slug, sku, barcode, status, vendor, product_type, tags, category_id, subcategory_id, description, price_inr, price_usd, compare_price_inr, compare_price_usd, stock, weight, hs_code, country_of_origin, is_best_product, image_url) VALUES (?, ?, ?, ?, \'Active\', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 100, ?, \'\', \'India\', 0, ?)',
        [g.cleanTitle, slug, primaryItem.sku, primaryItem.asin || null, brand, g.productType || '', tags, categoryId, subcategoryId, description, minPrice, minPriceUsd, comparePriceInr, comparePriceUsd, (primaryItem.weightGrams / 1000).toFixed(2), primaryImage]
      );
      const productId = pRes.insertId;
      insertedFamilies++;

      // Insert all variations into `product_variants`
      for (const it of g.items) {
        const vPriceInr = it.price;
        const vPriceUsd = inrToUsd(vPriceInr);
        const vCompInr = Math.round(vPriceInr * 1.25);
        const vCompUsd = inrToUsd(vCompInr);
        const vImage = it.images && it.images.length > 0 ? it.images[0] : primaryImage;

        await connection.query(
          'INSERT INTO product_variants (product_id, title, variant_name, sku, price_inr, price_usd, compare_price_inr, compare_price_usd, stock, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 100, ?)',
          [productId, it.weight, it.weight, it.sku, vPriceInr, vPriceUsd, vCompInr, vCompUsd, vImage]
        );
        insertedVariants++;
      }

      // Insert images
      for (let imgIdx = 0; imgIdx < allFamilyImages.length; imgIdx++) {
        try {
          await connection.query(
            'INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (?, ?, ?, ?)',
            [productId, allFamilyImages[imgIdx], imgIdx, imgIdx === 0 ? 1 : 0]
          );
          insertedImages++;
        } catch (e) {}
      }

      // Collections mapping
      const collectionIds = [colIdMap['offers']];
      const tl = g.cleanTitle.toLowerCase();
      if (tl.includes('organic') || tl.includes('natural') || tl.includes('pure')) collectionIds.push(colIdMap['certified-organic']);
      if (tl.includes('ayurved') || tl.includes('superfood') || catName === 'Herbal Supplements' || catName === 'Herbs & Teas') collectionIds.push(colIdMap['ayurvedic-superfoods']);
      collectionIds.push(colIdMap['bestsellers']);

      for (const cId of collectionIds) {
        if (cId) {
          try {
            await connection.query('INSERT IGNORE INTO product_collections (product_id, collection_id) VALUES (?, ?)', [productId, cId]);
          } catch (e) {}
        }
      }

      if (i > 0 && i % 150 === 0) {
        console.log('  Progress: ' + i + ' / ' + groupEntries.length + ' (' + insertedVariants + ' variants inserted)');
      }
    } catch (err) {
      console.error('  Error on group ' + g.cleanTitle + ':', err.message);
    }
  }

  // Set best products & new arrivals
  console.log('\n⭐ Setting featured & new arrivals...');
  await connection.query('UPDATE products SET is_best_product = 1 ORDER BY id DESC LIMIT 50');
  const [newProds] = await connection.query('SELECT id FROM products ORDER BY id DESC LIMIT 80');
  for (const p of newProds) {
    try {
      await connection.query('INSERT IGNORE INTO product_collections (product_id, collection_id) VALUES (?, ?)', [p.id, colIdMap['new-arrivals']]);
    } catch (e) {}
  }

  // Summary stats
  const [[{ pCount }]] = await connection.query('SELECT COUNT(*) as pCount FROM products');
  const [[{ vCount }]] = await connection.query('SELECT COUNT(*) as vCount FROM product_variants');
  const [[{ iCount }]] = await connection.query('SELECT COUNT(*) as iCount FROM product_images');

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  ✅ VARIATIONS SEED COMPLETE!                            ║');
  console.log('║  Products (Families): ' + pCount.toString().padEnd(35) + '║');
  console.log('║  Interactive Variants: ' + vCount.toString().padEnd(34) + '║');
  console.log('║  Product Images:       ' + iCount.toString().padEnd(34) + '║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Verify sample product with variants
  const [sample] = await connection.query('SELECT p.id, p.title, p.price_inr FROM products p WHERE (SELECT COUNT(*) FROM product_variants pv WHERE pv.product_id = p.id) >= 3 LIMIT 1');
  if (sample.length > 0) {
    const sId = sample[0].id;
    const [sVars] = await connection.query('SELECT title, variant_name, price_inr, sku FROM product_variants WHERE product_id = ?', [sId]);
    console.log('Sample Product:', sample[0].title, '(Base Price: ₹' + sample[0].price_inr + ')');
    sVars.forEach(v => console.log('  - Pill Option: [' + v.variant_name + '] Price: ₹' + v.price_inr + ' SKU: ' + v.sku));
  }

  await connection.end();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
