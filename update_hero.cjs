const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'ecommerce.db'));

db.prepare(`
  UPDATE store_hero_config SET 
    title = '100% CERTIFIED ORGANIC FARMING & GARDEN SUPPLIES',
    subtitle = 'Boost your home garden yield naturally with chemical-free bio-fertilizers, hybrid seeds, and heavy-duty HDPE grow bags.',
    badge_text = '🌿 100% PURE & CERTIFIED ORGANIC',
    primary_btn_text = '🛒 SHOP ORGANIC CATALOG',
    card_1_title = 'Verified Lab Tested Pure Batch',
    card_1_sub = '100% Chemical & Pesticide Free Guarantee'
  WHERE id = 1
`).run();

console.log('Hero configuration updated to ultra-attractive marketing copy!');
db.close();
