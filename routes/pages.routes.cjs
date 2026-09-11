const express = require('express');
const router = express.Router();
const { db, executeMySQL } = require('../config/database.cjs');
const { requireAdminAuth } = require('../middleware/auth.cjs');

// GET All Published Pages
router.get('/api/pages', async (req, res) => {
  try {
    let rows = await executeMySQL('SELECT * FROM custom_pages WHERE is_published = 1 ORDER BY title ASC');
    if (!rows || rows.length === 0) {
      rows = db.prepare('SELECT * FROM custom_pages WHERE is_published = 1 ORDER BY title ASC').all() || [];
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Page by Slug
router.get('/api/pages/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    let page = await executeMySQL('SELECT * FROM custom_pages WHERE slug = ?', [slug]);
    if (page && page.length > 0) return res.json(page[0]);

    const row = db.prepare('SELECT * FROM custom_pages WHERE slug = ?').get(slug);
    if (row) return res.json(row);

    // Fallback template content for core pages
    const fallbacks = {
      'about-us': {
        title: 'About ValueLife Essentials',
        content: '<p>Welcome to ValueLife Essentials. We are passionate about providing 100% pure, natural, and certified organic health and wellness essentials.</p>'
      },
      'contact-us': {
        title: 'Contact Us',
        content: '<p>Have questions? Reach our team at support@valuelifeessentials.com or call +91 98765 43210.</p>'
      },
      'privacy-policy': {
        title: 'Privacy Policy',
        content: '<p>Your privacy is important to us. We protect your personal data with 256-bit encryption.</p>'
      },
      'terms-of-service': {
        title: 'Terms of Service',
        content: '<p>By accessing ValueLife Essentials, you agree to our standard terms of service.</p>'
      },
      'shipping-policy': {
        title: 'Shipping Policy',
        content: '<p>Free express delivery across India on orders above ₹499. Orders dispatch within 24-48 hours.</p>'
      },
      'refund-policy': {
        title: 'Refund & Return Policy',
        content: '<p>We offer hassle-free returns within 7 days of receiving your order.</p>'
      },
      'blog': {
        title: 'ValueLife Wellness & Organic Blog',
        content: `<div class="space-y-10">
  <div class="text-center max-w-2xl mx-auto space-y-3">
    <span class="inline-block text-xs font-black uppercase tracking-widest text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">Natural Living & Ayurveda</span>
    <h2 class="text-2xl sm:text-3xl font-black text-slate-900">Wisdom for a Purer, Healthier Life</h2>
    <p class="text-slate-600 text-sm leading-relaxed">Explore science-backed nutritional insights, ancient Ayurvedic remedies, and guides to 100% chemical-free organic living curated by our certified herbalists.</p>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose">
    <article class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div class="h-44 bg-gradient-to-br from-emerald-800 to-emerald-950 p-6 flex flex-col justify-end text-white relative">
        <span class="text-3xl mb-1">🌿</span>
        <span class="text-[11px] font-bold text-emerald-300 uppercase tracking-wider">Superfoods & Ayurveda</span>
        <h3 class="text-lg font-black text-white">The Power of Pure Ashwagandha: Ancient Wisdom for Modern Vitality</h3>
      </div>
      <div class="p-5 space-y-3">
        <p class="text-slate-600 text-xs leading-relaxed">
          Known as "Indian Ginseng", organic Ashwagandha root is revered for its adaptogenic properties. Learn how regular intake supports cortisol balance, deep REM sleep, cognitive clarity, and sustained natural energy without caffeine crashes.
        </p>
        <div class="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 font-semibold">
          <span>By Dr. V. Sharma • 5 min read</span>
          <span class="text-emerald-700 font-bold">Ayurvedic Guide</span>
        </div>
      </div>
    </article>

    <article class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div class="h-44 bg-gradient-to-br from-amber-700 to-amber-950 p-6 flex flex-col justify-end text-white relative">
        <span class="text-3xl mb-1">🌾</span>
        <span class="text-[11px] font-bold text-amber-300 uppercase tracking-wider">Organic Nutrition</span>
        <h3 class="text-lg font-black text-white">Why 100% Certified Organic Food Matters for Your Family</h3>
      </div>
      <div class="p-5 space-y-3">
        <p class="text-slate-600 text-xs leading-relaxed">
          Pesticides and synthetic chemicals in commercial farming leave persistent residues in daily food. Discover how switching to certified chemical-free pulses, cold-pressed oils, and stone-ground flours drastically reduces inflammatory burden.
        </p>
        <div class="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 font-semibold">
          <span>By ValueLife Research Team • 4 min read</span>
          <span class="text-emerald-700 font-bold">Nutrition</span>
        </div>
      </div>
    </article>

    <article class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div class="h-44 bg-gradient-to-br from-teal-800 to-slate-900 p-6 flex flex-col justify-end text-white relative">
        <span class="text-3xl mb-1">🍵</span>
        <span class="text-[11px] font-bold text-teal-300 uppercase tracking-wider">Immunity & Detox</span>
        <h3 class="text-lg font-black text-white">Lakadong Turmeric vs Regular Haldi: The Curcumin Difference</h3>
      </div>
      <div class="p-5 space-y-3">
        <p class="text-slate-600 text-xs leading-relaxed">
          Grown in the pristine hills of Meghalaya, Lakadong turmeric naturally contains an astounding 7% to 12% curcumin, compared to standard 2-3%. See why this golden spice is a potent natural anti-inflammatory agent.
        </p>
        <div class="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 font-semibold">
          <span>By Nutrition Desk • 6 min read</span>
          <span class="text-emerald-700 font-bold">Herbal Science</span>
        </div>
      </div>
    </article>

    <article class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div class="h-44 bg-gradient-to-br from-lime-800 to-emerald-950 p-6 flex flex-col justify-end text-white relative">
        <span class="text-3xl mb-1">🌱</span>
        <span class="text-[11px] font-bold text-lime-300 uppercase tracking-wider">Daily Wellness</span>
        <h3 class="text-lg font-black text-white">Cold-Pressed Virgin Oils: Why Heat-Free Extraction Preserves Purity</h3>
      </div>
      <div class="p-5 space-y-3">
        <p class="text-slate-600 text-xs leading-relaxed">
          Industrial refined oils use high heat and chemical solvents like hexane. Traditional wood-churned (kachi ghani) extraction maintains all vital antioxidants, Omega-3s, and natural flavors in their uncompromised biological state.
        </p>
        <div class="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 font-semibold">
          <span>By Culinary Team • 4 min read</span>
          <span class="text-emerald-700 font-bold">Clean Cooking</span>
        </div>
      </div>
    </article>
  </div>

  <div class="bg-emerald-50 rounded-2xl p-6 border border-emerald-200 text-center space-y-3">
    <h3 class="text-lg font-bold text-emerald-900">Want weekly wellness articles & organic recipes?</h3>
    <p class="text-xs text-emerald-800 max-w-lg mx-auto">Subscribe to the ValueLife Essentials newsletter for seasonal farm updates, exclusive recipes, and herbal wellness guides directly to your inbox.</p>
  </div>
</div>`
      }
    };

    if (fallbacks[slug]) {
      return res.json({
        id: 0,
        slug,
        title: fallbacks[slug].title,
        content: fallbacks[slug].content,
        is_published: 1
      });
    }

    res.status(404).json({ error: 'Page not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Create Custom Page
router.post('/api/admin/pages', requireAdminAuth, async (req, res) => {
  try {
    const { title, slug, content, is_published = 1, meta_title, meta_description } = req.body;
    if (!title || !slug) return res.status(400).json({ error: 'Title and slug are required' });

    const myRes = await executeMySQL(
      'INSERT INTO custom_pages (title, slug, content, is_published, meta_title, meta_description) VALUES (?, ?, ?, ?, ?, ?)',
      [title, slug, content || '', is_published ? 1 : 0, meta_title || '', meta_description || '']
    );
    const newId = myRes ? myRes.insertId : Date.now();

    try {
      db.prepare('INSERT OR REPLACE INTO custom_pages (id, title, slug, content, is_published, meta_title, meta_description) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(newId, title, slug, content || '', is_published ? 1 : 0, meta_title || '', meta_description || '');
    } catch (e) {}

    res.json({ id: newId, title, slug, is_published });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT Update Custom Page
router.put('/api/admin/pages/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { title, slug, content, is_published, meta_title, meta_description } = req.body;

    await executeMySQL(
      'UPDATE custom_pages SET title = COALESCE(?, title), slug = COALESCE(?, slug), content = COALESCE(?, content), is_published = COALESCE(?, is_published), meta_title = COALESCE(?, meta_title), meta_description = COALESCE(?, meta_description) WHERE id = ?',
      [title, slug, content, is_published !== undefined ? (is_published ? 1 : 0) : null, meta_title, meta_description, id]
    );

    try {
      db.prepare('UPDATE custom_pages SET title = COALESCE(?, title), slug = COALESCE(?, slug), content = COALESCE(?, content), is_published = COALESCE(?, is_published), meta_title = COALESCE(?, meta_title), meta_description = COALESCE(?, meta_description) WHERE id = ?')
        .run(title, slug, content, is_published !== undefined ? (is_published ? 1 : 0) : null, meta_title, meta_description, id);
    } catch (e) {}

    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Custom Page
router.delete('/api/admin/pages/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    await executeMySQL('DELETE FROM custom_pages WHERE id = ?', [id]);
    try {
      db.prepare('DELETE FROM custom_pages WHERE id = ?').run(id);
    } catch (e) {}
    res.json({ success: true, message: 'Page deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
