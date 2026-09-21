/**
 * Default configuration objects for store settings, hero, theme, sections,
 * categories, collections, and subcategories.
 */

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

module.exports = {
  defaultHeroConfig,
  defaultThemeConfig,
  defaultSectionsConfig,
  defaultStoreSettings,
  defaultCategories,
  defaultCollections,
  defaultSubcategories
};
