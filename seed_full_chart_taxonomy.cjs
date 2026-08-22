const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'ecommerce.db');
const db = new Database(dbPath);

console.log('Seeding FULL taxonomy from chart: Categories, Sub-categories, and Products...');

const taxonomyData = [
  {
    name: 'Skin Treatment',
    slug: 'skin-treatment',
    icon: '🧴',
    description: 'Herbal skin treatment, acne care, anti-aging & face serums',
    image_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&q=80',
    subcategories: [
      {
        name: 'Face Care',
        slug: 'face-care',
        products: [
          { name: 'Pure Aloe Vera Gel 250ml', price_inr: 249, discount_inr: 199, price_usd: 3.5, discount_usd: 2.8, img: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=80' },
          { name: 'Vitamin E Hydrating Cream 100g', price_inr: 349, discount_inr: 279, price_usd: 4.8, discount_usd: 3.9, img: 'https://images.unsplash.com/photo-1608248597309-9069d3129849?w=600&q=80' },
          { name: 'Natural Radiance Face Serum 30ml', price_inr: 599, discount_inr: 449, price_usd: 7.9, discount_usd: 5.9, img: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600&q=80' }
        ]
      },
      {
        name: 'Acne Care',
        slug: 'acne-care',
        products: [
          { name: 'Organic Neem Powder 200g', price_inr: 149, discount_inr: 119, price_usd: 2.2, discount_usd: 1.8, img: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&q=80' },
          { name: 'Pure Tea Tree Oil 15ml', price_inr: 399, discount_inr: 299, price_usd: 5.2, discount_usd: 3.9, img: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600&q=80' },
          { name: 'Herbal Anti-Acne Gel 50g', price_inr: 299, discount_inr: 229, price_usd: 3.9, discount_usd: 2.9, img: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&q=80' }
        ]
      },
      {
        name: 'Anti-Aging',
        slug: 'anti-aging',
        products: [
          { name: 'Retinol Youth Cream 50g', price_inr: 699, discount_inr: 529, price_usd: 8.9, discount_usd: 6.8, img: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=600&q=80' },
          { name: 'Plant Collagen Firming Cream 50g', price_inr: 749, discount_inr: 599, price_usd: 9.5, discount_usd: 7.8, img: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80' }
        ]
      },
      {
        name: 'Herbal Skin Care',
        slug: 'herbal-skin-care',
        products: [
          { name: 'Pure Multani Mitti Powder 250g', price_inr: 99, discount_inr: 79, price_usd: 1.5, discount_usd: 1.2, img: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&q=80' },
          { name: 'Sandalwood Powder 100g', price_inr: 349, discount_inr: 279, price_usd: 4.8, discount_usd: 3.9, img: 'https://images.unsplash.com/photo-1617897903246-719242758050?w=600&q=80' },
          { name: 'Organic Rose Petal Powder 150g', price_inr: 179, discount_inr: 139, price_usd: 2.5, discount_usd: 1.9, img: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&q=80' }
        ]
      }
    ]
  },
  {
    name: 'Food & Nutrition',
    slug: 'food-nutrition',
    icon: '🥗',
    description: 'Organic superfoods, nutrient-rich flours, pulses, millets & healthy dry fruits',
    image_url: 'https://images.unsplash.com/photo-1490818387583-1baba5e638af?w=600&q=80',
    subcategories: [
      {
        name: 'Superfoods',
        slug: 'superfoods',
        products: [
          { name: 'Organic Moringa Leaf Powder 250g', price_inr: 299, discount_inr: 199, price_usd: 3.9, discount_usd: 2.8, img: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80' },
          { name: 'Pure Spirulina Powder 100g', price_inr: 449, discount_inr: 349, price_usd: 5.9, discount_usd: 4.5, img: 'https://images.unsplash.com/photo-1577401239170-897942555fb3?w=600&q=80' },
          { name: 'Organic Wheatgrass Powder 200g', price_inr: 399, discount_inr: 299, price_usd: 5.2, discount_usd: 3.9, img: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80' }
        ]
      },
      {
        name: 'Flours',
        slug: 'flours',
        products: [
          { name: 'Yellow Corn Flour (Makka Atta) 1kg', price_inr: 149, discount_inr: 119, price_usd: 2.2, discount_usd: 1.8, img: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=600&q=80' },
          { name: 'Organic Soya Flour 500g', price_inr: 129, discount_inr: 99, price_usd: 1.9, discount_usd: 1.4, img: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80' },
          { name: 'Buckwheat Flour (Kuttu Atta) 500g', price_inr: 179, discount_inr: 149, price_usd: 2.5, discount_usd: 2.0, img: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=600&q=80' },
          { name: 'Brown Rice Flour 1kg', price_inr: 169, discount_inr: 139, price_usd: 2.4, discount_usd: 1.9, img: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=600&q=80' },
          { name: 'Organic Whole Wheat Chakki Atta 5kg', price_inr: 349, discount_inr: 299, price_usd: 4.9, discount_usd: 4.1, img: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80' }
        ]
      },
      {
        name: 'Pulses',
        slug: 'pulses',
        products: [
          { name: 'Organic White Rajma 500g', price_inr: 189, discount_inr: 149, price_usd: 2.7, discount_usd: 2.1, img: 'https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=600&q=80' },
          { name: 'Jammu Red Rajma 500g', price_inr: 199, discount_inr: 159, price_usd: 2.8, discount_usd: 2.2, img: 'https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=600&q=80' },
          { name: 'Unpolished Horse Gram (Kulthi Dal) 500g', price_inr: 139, discount_inr: 109, price_usd: 2.0, discount_usd: 1.5, img: 'https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=600&q=80' },
          { name: 'Whole Green Gram (Sabut Moong) 1kg', price_inr: 229, discount_inr: 179, price_usd: 3.2, discount_usd: 2.5, img: 'https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=600&q=80' },
          { name: 'White Soya Beans 500g', price_inr: 149, discount_inr: 119, price_usd: 2.2, discount_usd: 1.8, img: 'https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=600&q=80' }
        ]
      },
      {
        name: 'Millets',
        slug: 'millets',
        products: [
          { name: 'Organic Foxtail Millet 1kg', price_inr: 199, discount_inr: 159, price_usd: 2.8, discount_usd: 2.2, img: 'https://images.unsplash.com/photo-1574316071802-0d684efa7bf5?w=600&q=80' },
          { name: 'Barnyard Millet (Sanwa) 500g', price_inr: 139, discount_inr: 109, price_usd: 2.0, discount_usd: 1.5, img: 'https://images.unsplash.com/photo-1574316071802-0d684efa7bf5?w=600&q=80' },
          { name: 'Little Millet (Kutki) 500g', price_inr: 149, discount_inr: 119, price_usd: 2.2, discount_usd: 1.8, img: 'https://images.unsplash.com/photo-1574316071802-0d684efa7bf5?w=600&q=80' }
        ]
      },
      {
        name: 'Healthy Snacks',
        slug: 'healthy-snacks',
        products: [
          { name: 'Premium Mixed Nuts & Berries 250g', price_inr: 499, discount_inr: 399, price_usd: 6.5, discount_usd: 5.2, img: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=600&q=80' },
          { name: 'Organic Dry Fruits Combo 500g', price_inr: 799, discount_inr: 649, price_usd: 9.9, discount_usd: 8.5, img: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=600&q=80' }
        ]
      }
    ]
  },
  {
    name: 'Nutrition Supplements',
    slug: 'nutrition-supplements',
    icon: '🌿',
    description: 'Plant protein, Shilajit, Ashwagandha & organic herbal supplements',
    image_url: 'https://images.unsplash.com/photo-1577401239170-897942555fb3?w=600&q=80',
    subcategories: [
      {
        name: 'Plant Protein',
        slug: 'plant-protein',
        products: [
          { name: 'Organic Soya Protein Powder 500g', price_inr: 499, discount_inr: 399, price_usd: 6.5, discount_usd: 5.2, img: 'https://images.unsplash.com/photo-1577401239170-897942555fb3?w=600&q=80' },
          { name: 'Pure Pea Protein Isolate 500g', price_inr: 699, discount_inr: 549, price_usd: 8.9, discount_usd: 7.2, img: 'https://images.unsplash.com/photo-1577401239170-897942555fb3?w=600&q=80' }
        ]
      },
      {
        name: 'Herbal Supplements',
        slug: 'herbal-supplements',
        products: [
          { name: 'Pure Ashwagandha Root Powder 250g', price_inr: 349, discount_inr: 249, price_usd: 4.8, discount_usd: 3.5, img: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&q=80' },
          { name: 'Organic Moringa Powder 250g', price_inr: 299, discount_inr: 199, price_usd: 3.9, discount_usd: 2.8, img: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80' },
          { name: 'Pure Himalayan Shilajit Resin 50g', price_inr: 1299, discount_inr: 899, price_usd: 16.9, discount_usd: 11.9, img: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&q=80' },
          { name: 'Organic Giloy Powder 200g', price_inr: 229, discount_inr: 169, price_usd: 3.2, discount_usd: 2.4, img: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&q=80' }
        ]
      },
      {
        name: 'Protein Mix',
        slug: 'protein-mix',
        products: [
          { name: 'Herbal Meal Replacement Shake 500g', price_inr: 799, discount_inr: 599, price_usd: 9.9, discount_usd: 7.9, img: 'https://images.unsplash.com/photo-1577401239170-897942555fb3?w=600&q=80' },
          { name: 'Superfood Protein Mix 400g', price_inr: 649, discount_inr: 499, price_usd: 8.5, discount_usd: 6.5, img: 'https://images.unsplash.com/photo-1577401239170-897942555fb3?w=600&q=80' }
        ]
      }
    ]
  },
  {
    name: 'Spices',
    slug: 'spices',
    icon: '🌶️',
    description: 'Whole spices, fresh ground spice powders, aromatic seasonings & masala blends',
    image_url: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80',
    subcategories: [
      {
        name: 'Whole Spices',
        slug: 'whole-spices',
        products: [
          { name: 'Organic Cumin Seeds (Jeera) 250g', price_inr: 199, discount_inr: 149, price_usd: 2.8, discount_usd: 2.1, img: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80' },
          { name: 'Coriander Seeds (Dhania) 250g', price_inr: 129, discount_inr: 99, price_usd: 1.9, discount_usd: 1.4, img: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80' },
          { name: 'Black Pepper Whole (Kali Mirch) 100g', price_inr: 249, discount_inr: 189, price_usd: 3.5, discount_usd: 2.7, img: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80' },
          { name: 'Organic Cloves (Laung) 50g', price_inr: 179, discount_inr: 139, price_usd: 2.5, discount_usd: 1.9, img: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80' },
          { name: 'Ceylon Cinnamon Sticks (Dalchini) 100g', price_inr: 299, discount_inr: 229, price_usd: 3.9, discount_usd: 2.9, img: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80' }
        ]
      },
      {
        name: 'Spice Powders',
        slug: 'spice-powders',
        products: [
          { name: 'Authentic Lakadong Turmeric Powder 250g', price_inr: 249, discount_inr: 169, price_usd: 3.5, discount_usd: 2.4, img: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&q=80' },
          { name: 'Coriander Powder 250g', price_inr: 139, discount_inr: 109, price_usd: 2.0, discount_usd: 1.5, img: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80' },
          { name: 'Kashmiri Red Chilli Powder 200g', price_inr: 199, discount_inr: 159, price_usd: 2.8, discount_usd: 2.2, img: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80' }
        ]
      },
      {
        name: 'Seasonings',
        slug: 'seasonings',
        products: [
          { name: 'Dried Oregano Flakes 50g', price_inr: 149, discount_inr: 119, price_usd: 2.2, discount_usd: 1.8, img: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80' },
          { name: 'Organic Rosemary Leaves 50g', price_inr: 179, discount_inr: 139, price_usd: 2.5, discount_usd: 1.9, img: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80' },
          { name: 'Dried Thyme Herbs 50g', price_inr: 169, discount_inr: 129, price_usd: 2.4, discount_usd: 1.8, img: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80' }
        ]
      },
      {
        name: 'Masala Blends',
        slug: 'masala-blends',
        products: [
          { name: 'Organic Garam Masala 100g', price_inr: 169, discount_inr: 129, price_usd: 2.4, discount_usd: 1.8, img: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80' },
          { name: 'Kitchen King Masala 100g', price_inr: 149, discount_inr: 119, price_usd: 2.2, discount_usd: 1.8, img: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80' },
          { name: 'South Indian Sambar Powder 200g', price_inr: 179, discount_inr: 139, price_usd: 2.5, discount_usd: 1.9, img: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80' },
          { name: 'Traditional Rasam Powder 150g', price_inr: 159, discount_inr: 119, price_usd: 2.3, discount_usd: 1.7, img: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80' }
        ]
      }
    ]
  },
  {
    name: 'Edible Seeds',
    slug: 'edible-seeds',
    icon: '🌱',
    description: 'Raw Chia, Flax, Pumpkin, Sunflower, Hemp & Sabja seeds',
    image_url: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=600&q=80',
    subcategories: [
      {
        name: 'Super Seeds',
        slug: 'super-seeds',
        products: [
          { name: 'Raw Organic Chia Seeds 500g', price_inr: 399, discount_inr: 249, price_usd: 5.2, discount_usd: 3.5, img: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=600&q=80' },
          { name: 'Raw Roasted Flax Seeds 250g', price_inr: 199, discount_inr: 149, price_usd: 2.8, discount_usd: 2.1, img: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=600&q=80' },
          { name: 'Shelled Hemp Hearts 200g', price_inr: 499, discount_inr: 399, price_usd: 6.5, discount_usd: 5.2, img: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=600&q=80' }
        ]
      },
      {
        name: 'Healthy Seeds',
        slug: 'healthy-seeds',
        products: [
          { name: 'Raw Pumpkin Seeds 250g', price_inr: 299, discount_inr: 229, price_usd: 3.9, discount_usd: 2.9, img: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=600&q=80' },
          { name: 'Sunflower Seeds 250g', price_inr: 229, discount_inr: 169, price_usd: 3.2, discount_usd: 2.4, img: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=600&q=80' },
          { name: 'Watermelon Seeds 200g', price_inr: 249, discount_inr: 189, price_usd: 3.5, discount_usd: 2.7, img: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=600&q=80' }
        ]
      },
      {
        name: 'Oil Seeds',
        slug: 'oil-seeds',
        products: [
          { name: 'White Sesame Seeds (Til) 250g', price_inr: 169, discount_inr: 129, price_usd: 2.4, discount_usd: 1.8, img: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=600&q=80' },
          { name: 'Black Mustard Seeds (Rai) 250g', price_inr: 119, discount_inr: 89, price_usd: 1.8, discount_usd: 1.3, img: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=600&q=80' }
        ]
      },
      {
        name: 'Traditional Seeds',
        slug: 'traditional-seeds',
        products: [
          { name: 'Garden Cress Seeds (Halim) 200g', price_inr: 159, discount_inr: 119, price_usd: 2.3, discount_usd: 1.7, img: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=600&q=80' },
          { name: 'Sabja Seeds (Sweet Basil Seeds) 250g', price_inr: 189, discount_inr: 139, price_usd: 2.7, discount_usd: 1.9, img: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=600&q=80' }
        ]
      }
    ]
  },
  {
    name: 'Ready to Cook',
    slug: 'ready-to-cook',
    icon: '🍲',
    description: 'Instant Idli, Dosa, Upma, Soups, Pakoda & Khichdi mixes',
    image_url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&q=80',
    subcategories: [
      {
        name: 'Breakfast Mix',
        slug: 'breakfast-mix',
        products: [
          { name: 'Instant Rice Idli Mix 500g', price_inr: 149, discount_inr: 119, price_usd: 2.2, discount_usd: 1.8, img: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&q=80' },
          { name: 'Crispy Rava Dosa Mix 500g', price_inr: 159, discount_inr: 129, price_usd: 2.3, discount_usd: 1.8, img: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&q=80' },
          { name: 'Roasted Vegetable Upma Mix 400g', price_inr: 139, discount_inr: 109, price_usd: 2.0, discount_usd: 1.5, img: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&q=80' }
        ]
      },
      {
        name: 'Soup Mix',
        slug: 'soup-mix',
        products: [
          { name: 'Organic Tomato Soup Mix 200g', price_inr: 179, discount_inr: 139, price_usd: 2.5, discount_usd: 1.9, img: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80' },
          { name: 'Healthy Vegetable Soup Mix 200g', price_inr: 169, discount_inr: 129, price_usd: 2.4, discount_usd: 1.8, img: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80' }
        ]
      },
      {
        name: 'Snack Mix',
        slug: 'snack-mix',
        products: [
          { name: 'Crispy Pakoda Mix 400g', price_inr: 129, discount_inr: 99, price_usd: 1.9, discount_usd: 1.4, img: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&q=80' },
          { name: 'Kanda Bhaji Mix 400g', price_inr: 139, discount_inr: 109, price_usd: 2.0, discount_usd: 1.5, img: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&q=80' }
        ]
      },
      {
        name: 'Flour Mix',
        slug: 'flour-mix',
        products: [
          { name: 'Multigrain Atta Mix 1kg', price_inr: 199, discount_inr: 159, price_usd: 2.8, discount_usd: 2.2, img: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=600&q=80' },
          { name: 'Nutritious Khichdi Mix 500g', price_inr: 149, discount_inr: 119, price_usd: 2.2, discount_usd: 1.8, img: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&q=80' }
        ]
      }
    ]
  },
  {
    name: 'Hair Treatment',
    slug: 'hair-treatment',
    icon: '💇‍♀️',
    description: 'Cold pressed hair oils, Reetha, Shikakai, Bhringraj & anti-dandruff powders',
    image_url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80',
    subcategories: [
      {
        name: 'Hair Oils',
        slug: 'hair-oils',
        products: [
          { name: 'Virgin Cold Pressed Coconut Oil 250ml', price_inr: 249, discount_inr: 189, price_usd: 3.5, discount_usd: 2.7, img: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80' },
          { name: 'Herbal Amla Hair Oil 200ml', price_inr: 299, discount_inr: 229, price_usd: 3.9, discount_usd: 2.9, img: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80' },
          { name: 'Pure Bhringraj Hair Oil 200ml', price_inr: 349, discount_inr: 269, price_usd: 4.8, discount_usd: 3.8, img: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80' }
        ]
      },
      {
        name: 'Hair Powders',
        slug: 'hair-powders',
        products: [
          { name: 'Pure Reetha Powder 250g', price_inr: 169, discount_inr: 129, price_usd: 2.4, discount_usd: 1.8, img: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&q=80' },
          { name: 'Organic Shikakai Powder 250g', price_inr: 179, discount_inr: 139, price_usd: 2.5, discount_usd: 1.9, img: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&q=80' },
          { name: 'Hibiscus Petal Hair Powder 150g', price_inr: 199, discount_inr: 149, price_usd: 2.8, discount_usd: 2.1, img: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&q=80' }
        ]
      },
      {
        name: 'Hair Growth',
        slug: 'hair-growth',
        products: [
          { name: 'Rosemary Powder for Hair 100g', price_inr: 299, discount_inr: 229, price_usd: 3.9, discount_usd: 2.9, img: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&q=80' },
          { name: 'Bhringraj Powder 200g', price_inr: 229, discount_inr: 179, price_usd: 3.2, discount_usd: 2.5, img: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&q=80' }
        ]
      },
      {
        name: 'Anti-Dandruff',
        slug: 'anti-dandruff',
        products: [
          { name: 'Neem Leaf Hair Powder 200g', price_inr: 149, discount_inr: 119, price_usd: 2.2, discount_usd: 1.8, img: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&q=80' },
          { name: 'Fenugreek (Methi) Powder 250g', price_inr: 139, discount_inr: 109, price_usd: 2.0, discount_usd: 1.5, img: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&q=80' }
        ]
      }
    ]
  },
  {
    name: 'Digestive Probiotic',
    slug: 'digestive-probiotic',
    icon: '🍵',
    description: 'Triphala, Isabgol, Apple Cider Vinegar, Ajwain & digestive gut health',
    image_url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&q=80',
    subcategories: [
      {
        name: 'Digestive Powders',
        slug: 'digestive-powders',
        products: [
          { name: 'Organic Triphala Powder 250g', price_inr: 229, discount_inr: 169, price_usd: 3.2, discount_usd: 2.4, img: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&q=80' },
          { name: 'Pure Isabgol Husk 100g', price_inr: 179, discount_inr: 139, price_usd: 2.5, discount_usd: 1.9, img: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&q=80' }
        ]
      },
      {
        name: 'Herbal Digestive',
        slug: 'herbal-digestive',
        products: [
          { name: 'Ajwain Powder 200g', price_inr: 139, discount_inr: 109, price_usd: 2.0, discount_usd: 1.5, img: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80' },
          { name: 'Jeera Powder 250g', price_inr: 159, discount_inr: 119, price_usd: 2.3, discount_usd: 1.7, img: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80' }
        ]
      },
      {
        name: 'Gut Health',
        slug: 'gut-health',
        products: [
          { name: 'Raw Apple Cider Vinegar with Mother 500ml', price_inr: 399, discount_inr: 299, price_usd: 5.2, discount_usd: 3.9, img: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&q=80' },
          { name: 'Organic Green Tea Kombucha 250ml', price_inr: 199, discount_inr: 149, price_usd: 2.8, discount_usd: 2.1, img: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&q=80' }
        ]
      },
      {
        name: 'Probiotics',
        slug: 'probiotics',
        products: [
          { name: 'Herbal Probiotic Capsules 60s', price_inr: 599, discount_inr: 449, price_usd: 7.9, discount_usd: 5.9, img: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&q=80' }
        ]
      }
    ]
  },
  {
    name: 'Health & Beauty',
    slug: 'health-beauty',
    icon: '🌸',
    description: 'Body care, Biotin, Collagen, Lavender essential oils & herbal teas',
    image_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&q=80',
    subcategories: [
      {
        name: 'Personal Care',
        slug: 'personal-care',
        products: [
          { name: 'Organic Body Wash 300ml', price_inr: 349, discount_inr: 269, price_usd: 4.8, discount_usd: 3.8, img: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&q=80' },
          { name: 'Nourishing Body Lotion 250ml', price_inr: 299, discount_inr: 229, price_usd: 3.9, discount_usd: 2.9, img: 'https://images.unsplash.com/photo-1608248597309-9069d3129849?w=600&q=80' }
        ]
      },
      {
        name: 'Beauty Supplements',
        slug: 'beauty-supplements',
        products: [
          { name: 'Organic Biotin Tablets 60s', price_inr: 549, discount_inr: 399, price_usd: 7.2, discount_usd: 5.2, img: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&q=80' },
          { name: 'Herbal Collagen Booster Powder 200g', price_inr: 699, discount_inr: 549, price_usd: 8.9, discount_usd: 7.2, img: 'https://images.unsplash.com/photo-1577401239170-897942555fb3?w=600&q=80' }
        ]
      },
      {
        name: 'Essential Oils',
        slug: 'essential-oils',
        products: [
          { name: 'Pure Lavender Essential Oil 15ml', price_inr: 449, discount_inr: 349, price_usd: 5.9, discount_usd: 4.5, img: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600&q=80' },
          { name: 'Pure Tea Tree Essential Oil 15ml', price_inr: 399, discount_inr: 299, price_usd: 5.2, discount_usd: 3.9, img: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600&q=80' }
        ]
      },
      {
        name: 'Wellness',
        slug: 'wellness',
        products: [
          { name: 'Organic Herbal Green Tea 100g', price_inr: 249, discount_inr: 189, price_usd: 3.5, discount_usd: 2.7, img: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&q=80' },
          { name: 'Daily Detox Herbal Tea 100g', price_inr: 279, discount_inr: 219, price_usd: 3.8, discount_usd: 2.9, img: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&q=80' }
        ]
      }
    ]
  },
  {
    name: 'Skin Care',
    slug: 'skin-care',
    icon: '✨',
    description: 'Herbal face wash, masks, toners, aloe moisturizers & coffee scrubs',
    image_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&q=80',
    subcategories: [
      {
        name: 'Face Wash',
        slug: 'face-wash',
        products: [
          { name: 'Herbal Neem & Tulsi Face Wash 150ml', price_inr: 199, discount_inr: 149, price_usd: 2.8, discount_usd: 2.1, img: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&q=80' }
        ]
      },
      {
        name: 'Face Mask',
        slug: 'face-mask',
        products: [
          { name: 'Activated Charcoal Detox Face Mask 100g', price_inr: 299, discount_inr: 229, price_usd: 3.9, discount_usd: 2.9, img: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&q=80' },
          { name: 'Multani Mitti Pack 200g', price_inr: 129, discount_inr: 99, price_usd: 1.9, discount_usd: 1.4, img: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&q=80' }
        ]
      },
      {
        name: 'Toner',
        slug: 'toner',
        products: [
          { name: 'Pure Steam-Distilled Rose Water 200ml', price_inr: 179, discount_inr: 139, price_usd: 2.5, discount_usd: 1.9, img: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&q=80' },
          { name: 'Cooling Cucumber Face Toner 200ml', price_inr: 189, discount_inr: 149, price_usd: 2.7, discount_usd: 2.1, img: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&q=80' }
        ]
      },
      {
        name: 'Moisturizer',
        slug: 'moisturizer',
        products: [
          { name: 'Aloe Vera Moisturizing Cream 100g', price_inr: 249, discount_inr: 189, price_usd: 3.5, discount_usd: 2.7, img: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=80' }
        ]
      },
      {
        name: 'Scrub',
        slug: 'scrub',
        products: [
          { name: 'Natural Walnut Exfoliating Scrub 100g', price_inr: 229, discount_inr: 179, price_usd: 3.2, discount_usd: 2.5, img: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&q=80' },
          { name: 'Coffee Face & Body Scrub 100g', price_inr: 249, discount_inr: 189, price_usd: 3.5, discount_usd: 2.7, img: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&q=80' }
        ]
      }
    ]
  },
  {
    name: 'Household Care & Supplies',
    slug: 'household-care',
    icon: '🧹',
    description: 'Laundry starch, natural cleaners, camphor air fresheners & pest control',
    image_url: 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=600&q=80',
    subcategories: [
      {
        name: 'Laundry Care',
        slug: 'laundry-care',
        products: [
          { name: 'Natural Laundry Starch Powder 500g', price_inr: 149, discount_inr: 119, price_usd: 2.2, discount_usd: 1.8, img: 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=600&q=80' },
          { name: 'Eco Fabric Whitener Powder 400g', price_inr: 169, discount_inr: 129, price_usd: 2.4, discount_usd: 1.8, img: 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=600&q=80' }
        ]
      },
      {
        name: 'Cleaning Supplies',
        slug: 'cleaning-supplies',
        products: [
          { name: 'Herbal Dish Wash Powder 500g', price_inr: 119, discount_inr: 89, price_usd: 1.8, discount_usd: 1.3, img: 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=600&q=80' },
          { name: 'Organic Floor Cleaner Liquid 1L', price_inr: 229, discount_inr: 179, price_usd: 3.2, discount_usd: 2.5, img: 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=600&q=80' }
        ]
      },
      {
        name: 'Air Fresheners',
        slug: 'air-fresheners',
        products: [
          { name: 'Pure Camphor Tablets 100g', price_inr: 199, discount_inr: 149, price_usd: 2.8, discount_usd: 2.1, img: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600&q=80' },
          { name: 'Natural Herbal Room Freshener Spray 200ml', price_inr: 249, discount_inr: 189, price_usd: 3.5, discount_usd: 2.7, img: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600&q=80' }
        ]
      },
      {
        name: 'Pest Control',
        slug: 'pest-control',
        products: [
          { name: 'Organic Neem Powder for Pest Control 1kg', price_inr: 249, discount_inr: 179, price_usd: 3.5, discount_usd: 2.5, img: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&q=80' }
        ]
      },
      {
        name: 'Kitchen Supplies',
        slug: 'kitchen-supplies',
        products: [
          { name: 'Pure Food Grade Baking Soda 500g', price_inr: 99, discount_inr: 79, price_usd: 1.5, discount_usd: 1.2, img: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=600&q=80' },
          { name: 'Organic Citric Acid Crystals 250g', price_inr: 129, discount_inr: 99, price_usd: 1.9, discount_usd: 1.4, img: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=600&q=80' }
        ]
      }
    ]
  }
];

const catStmt = db.prepare(`
  INSERT INTO categories (name, slug, description, image_url, icon)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(slug) DO UPDATE SET 
    name=excluded.name, description=excluded.description, image_url=excluded.image_url, icon=excluded.icon
`);

const subcatStmt = db.prepare(`
  INSERT INTO subcategories (category_id, name, slug)
  VALUES (?, ?, ?)
  ON CONFLICT(slug) DO UPDATE SET name=excluded.name
`);

const prodStmt = db.prepare(`
  INSERT INTO products (
    title, slug, sku, category_id, subcategory_id, description, price_inr, price_usd, discount_inr, discount_usd, stock, is_best_product
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(slug) DO UPDATE SET 
    title=excluded.title, sku=excluded.sku, category_id=excluded.category_id, subcategory_id=excluded.subcategory_id,
    description=excluded.description, price_inr=excluded.price_inr, price_usd=excluded.price_usd, 
    discount_inr=excluded.discount_inr, discount_usd=excluded.discount_usd, stock=excluded.stock
`);

const imgStmt = db.prepare(`
  INSERT INTO product_images (product_id, image_url, is_primary)
  VALUES (?, ?, 1)
`);

let totalCategories = 0;
let totalSubcategories = 0;
let totalProducts = 0;

taxonomyData.forEach(cat => {
  catStmt.run(cat.name, cat.slug, cat.description, cat.image_url, cat.icon);
  const catObj = db.prepare('SELECT id FROM categories WHERE slug = ?').get(cat.slug);
  totalCategories++;

  cat.subcategories.forEach(sub => {
    subcatStmt.run(catObj.id, sub.name, sub.slug);
    const subObj = db.prepare('SELECT id FROM subcategories WHERE slug = ?').get(sub.slug);
    totalSubcategories++;

    sub.products.forEach((p, idx) => {
      const prodSlug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      const sku = `SKU-${catObj.id}-${subObj.id}-${idx + 1}-${Math.floor(1000 + Math.random() * 9000)}`;
      const desc = `Authentic 100% organic ${p.name} sourced directly from certified organic farms. Free from synthetic chemicals, pesticides, and artificial additives. Ideal for daily health, wellness & home care.`;
      
      prodStmt.run(p.name, prodSlug, sku, catObj.id, subObj.id, desc, p.price_inr, p.price_usd, p.discount_inr, p.discount_usd, 100, Math.random() > 0.6 ? 1 : 0);
      
      const prodObj = db.prepare('SELECT id FROM products WHERE slug = ?').get(prodSlug);
      if (prodObj) {
        db.prepare('DELETE FROM product_images WHERE product_id = ?').run(prodObj.id);
        imgStmt.run(prodObj.id, p.img);
        totalProducts++;
      }
    });
  });
});

console.log(`Success! Seeded ${totalCategories} Categories, ${totalSubcategories} Sub-categories, and ${totalProducts} Products into SQLite!`);
db.close();
