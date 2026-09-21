/**
 * JSON fallback store — simulates SQLite database when better-sqlite3 is unavailable.
 * Provides a proxy db object with prepare().run/get/all methods that operate on in-memory JSON.
 */
const path = require('path');
const {
  defaultStoreSettings,
  defaultHeroConfig,
  defaultThemeConfig,
  defaultSectionsConfig
} = require('./defaults.cjs');

const fallbackDbFile = path.join(__dirname, '..', 'fallback_db.json');

let fallbackStore = {
  categories: [],
  subcategories: [],
  collections: [],
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
    if (!Array.isArray(fallbackStore.categories)) fallbackStore.categories = [];
    if (!Array.isArray(fallbackStore.subcategories)) fallbackStore.subcategories = [];
    if (!Array.isArray(fallbackStore.collections)) fallbackStore.collections = [];
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

function getNextFallbackId(collectionName) {
  const items = (fallbackStore && fallbackStore[collectionName]) || [];
  let maxId = 0;
  for (const item of items) {
    const num = Number(item.id);
    if (!isNaN(num) && num < 1000000 && num > maxId) {
      maxId = num;
    }
  }
  return Math.max(maxId, 40) + 1;
}

/**
 * Creates a proxy database object that mimics the better-sqlite3 API
 * but operates on the in-memory fallbackStore JSON.
 */
function createFallbackDb() {
  return {
    pragma: () => {},
    exec: () => {},
    prepare: (sql) => {
      const s = String(sql || '').toLowerCase();
      
      return {
        run: (...params) => {
          let targetTable = 'misc';
          if (s.includes('categories')) targetTable = 'categories';
          else if (s.includes('subcategories')) targetTable = 'subcategories';
          else if (s.includes('products')) targetTable = 'products';
          else if (s.includes('product_images')) targetTable = 'product_images';
          else if (s.includes('product_variants')) targetTable = 'product_variants';
          else if (s.includes('collections')) targetTable = 'collections';
          else if (s.includes('coupons')) targetTable = 'coupons';
          else if (s.includes('orders')) targetTable = 'orders';
          const nowId = getNextFallbackId(targetTable);
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
          if (s.includes('insert into product_variants')) {
            const [product_id, variant_name, sku, price_inr, price_usd, discount_inr, discount_usd, compare_price_inr, compare_price_usd, stock, image_url] = params;
            if (!fallbackStore.product_variants) fallbackStore.product_variants = [];
            fallbackStore.product_variants.push({
              id: nowId,
              product_id: Number(product_id),
              variant_name: variant_name || 'Standard Pack',
              sku: sku || `OB-VAR-${nowId}`,
              price_inr: Number(price_inr || 0),
              price_usd: Number(price_usd || (price_inr > 0 ? Number((price_inr/95).toFixed(2)) : 0)),
              discount_inr: Number(discount_inr || price_inr || 0),
              discount_usd: Number(discount_usd || price_usd || 0),
              compare_price_inr: compare_price_inr ? Number(compare_price_inr) : null,
              compare_price_usd: compare_price_usd ? Number(compare_price_usd) : null,
              stock: Number(stock || 50),
              image_url: image_url || null
            });
            saveFallbackStore();
            return { lastInsertRowid: nowId, changes: 1 };
          }
          if (s.includes('delete from product_variants')) {
            if (s.includes('where product_id =')) {
              const [product_id] = params;
              fallbackStore.product_variants = (fallbackStore.product_variants || []).filter(v => String(v.product_id) !== String(product_id));
            } else if (s.includes('where id =')) {
              const [id] = params;
              fallbackStore.product_variants = (fallbackStore.product_variants || []).filter(v => String(v.id) !== String(id));
            } else {
              fallbackStore.product_variants = [];
            }
            saveFallbackStore();
            return { changes: 1 };
          }
          if (s.includes('delete from product_images')) {
            fallbackStore.product_images = [];
            saveFallbackStore();
            return { changes: 1 };
          }
          if (s.includes('delete from product_collections')) {
            fallbackStore.product_collections = [];
            saveFallbackStore();
            return { changes: 1 };
          }
          if (s.includes('delete from products')) {
            if (s.includes('where id =')) {
              const [id] = params;
              fallbackStore.products = (fallbackStore.products || []).filter(p => String(p.id) !== String(id));
              if (fallbackStore.product_collections) {
                fallbackStore.product_collections = fallbackStore.product_collections.filter(pc => String(pc.product_id) !== String(id));
              }
            } else {
              fallbackStore.products = [];
              fallbackStore.product_collections = [];
            }
            saveFallbackStore();
            return { changes: 1 };
          }
          if (s.includes('delete from subcategories')) {
            if (s.includes('where id =')) {
              const [id] = params;
              fallbackStore.subcategories = (fallbackStore.subcategories || []).filter(sub => String(sub.id) !== String(id));
            } else {
              fallbackStore.subcategories = [];
            }
            saveFallbackStore();
            return { changes: 1 };
          }
          if (s.includes('delete from collections')) {
            if (s.includes('where id =')) {
              const [id] = params;
              fallbackStore.collections = (fallbackStore.collections || []).filter(c => String(c.id) !== String(id));
            } else {
              fallbackStore.collections = [];
            }
            saveFallbackStore();
            return { changes: 1 };
          }
          if (s.includes('delete from categories')) {
            if (s.includes('where id =')) {
              const [id] = params;
              fallbackStore.categories = (fallbackStore.categories || []).filter(c => String(c.id) !== String(id));
            } else {
              fallbackStore.categories = [];
            }
            saveFallbackStore();
            return { changes: 1 };
          }
          if (s.includes('delete from product_filter_options')) {
            fallbackStore.product_filter_options = [];
            saveFallbackStore();
            return { changes: 1 };
          }
          if (s.includes('delete from product_filter_groups')) {
            fallbackStore.product_filter_groups = [];
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
          if (s.includes('from products')) {
            const [p1, p2, p3] = params;
            const searchVal = String(p1 || '').toLowerCase();
            return (fallbackStore.products || []).find(p => 
              String(p.id) === String(p1) || 
              String(p.slug || '').toLowerCase() === searchVal ||
              String(p.slug || '').toLowerCase() === String(p2 || '').toLowerCase() ||
              String(p.id) === String(p3 || '') ||
              String(p.title || '').toLowerCase() === searchVal
            ) || null;
          }
          if (s.includes('from collections where')) {
            const [p1] = params;
            return (fallbackStore.collections || []).find(c => String(c.slug).toLowerCase() === String(p1).toLowerCase() || String(c.id) === String(p1)) || null;
          }
          if (s.includes('from users where')) {
            const [p1, p2] = params;
            return (fallbackStore.users || []).find(u => String(u.phone) === String(p1) || String(u.email).toLowerCase() === String(p2).toLowerCase()) || null;
          }
          if (s.includes('count(') || s.includes('avg(')) {
            return { count: 0, cnt: 0, avg_rating: 0, total_reviews: 0 };
          }
          return null;
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
}

module.exports = {
  fallbackStore,
  saveFallbackStore,
  getNextFallbackId,
  createFallbackDb
};
