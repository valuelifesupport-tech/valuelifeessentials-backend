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
    // Normalize content field
    rows = rows.map(r => ({
      ...r,
      content: r.content || r.content_html || ''
    }));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Page by Slug
router.get('/api/pages/:slug', async (req, res) => {
  try {
    let slug = (req.params.slug || '').trim().toLowerCase();
    if (slug === 'contact') slug = 'contact-us';
    if (slug === 'about') slug = 'about-us';
    if (slug === 'returns-refund') slug = 'refund-policy';

    let pageData = null;
    let page = await executeMySQL('SELECT * FROM custom_pages WHERE slug = ?', [slug]);
    if (page && page.length > 0) {
      pageData = { ...page[0] };
    } else {
      const row = db.prepare('SELECT * FROM custom_pages WHERE slug = ?').get(slug);
      if (row) pageData = { ...row };
    }

    if (pageData) {
      if (!pageData.content && pageData.content_html) {
        pageData.content = pageData.content_html;
      }
    }

    // Fallback template content for core pages
    const fallbacks = {
      'about-us': {
        title: 'About ValueLife Essentials',
        content: `<h2>Pure Nature, Pure Health: The ValueLife Story</h2>
<p>ValueLife Essentials was founded with a single, clear objective: to bring honest, authentic, and certified natural wellness products into everyday Indian homes.</p>
<p>In a market flooded with artificial fillers, preservatives, and synthetics, we partner directly with certified ethical growers and producers across India. From single-origin cold-pressed oils and wild-harvested herbs to natural essentials, every product is rigorously lab-tested for chemical-free purity.</p>
<h3>Our Guiding Principles</h3>
<ul>
  <li><strong>100% Transparency:</strong> Zero hidden chemicals, heavy metals, or undisclosed synthetic compounds.</li>
  <li><strong>Direct Source Integrity:</strong> Ensuring fair prices for farmers and peak harvest freshness for you.</li>
  <li><strong>Accessible Wellness:</strong> High standard health essentials delivered affordably across all Indian pin codes.</li>
</ul>`
      },
      'contact-us': {
        title: 'Contact Us',
        content: `<h2>Get in Touch with ValueLife Essentials</h2>
<p>Have questions about your order, tracking, or natural wellness products? Our customer support desk is ready to help you every step of the way.</p>
<h3>Customer Support Contacts</h3>
<ul>
  <li><strong>Customer Care Email:</strong> <a href="mailto:valuelifesupport@gmail.com">valuelifesupport@gmail.com</a></li>
  <li><strong>Helpline Numbers:</strong> <a href="tel:+917675941899">+91 76759 41899</a> / <a href="tel:+917893100755">+91 78931 00755</a></li>
  <li><strong>WhatsApp Support:</strong> <a href="https://wa.me/917675941899">+91 76759 41899</a> (Mon-Sat, 9:00 AM - 7:00 PM IST)</li>
  <li><strong>Registered Office & Dispatch:</strong> Indore, Madhya Pradesh, India</li>
</ul>
<p>You can also send us a message using the inquiry form below, and we will get back to you within 2 hours.</p>`
      },
      'privacy-policy': {
        title: 'Privacy Policy',
        content: `<h2>ValueLife Essentials Privacy Commitment</h2>
<p>At ValueLife Essentials, your privacy is strictly respected. We collect your delivery details, contact numbers, and email solely to fulfill your orders and keep you informed about shipment status.</p>
<p>We do not sell, rent, or trade your personal information. All payment processing is handled through RBI-regulated, PCI-DSS Level 1 secure payment gateways with 256-bit encryption.</p>`
      },
      'terms-of-service': {
        title: 'Terms of Service',
        content: `<h2>Terms of Service</h2>
<p>By accessing and placing orders on ValueLife Essentials (valuelifeessentials.com), you agree to our standard terms and conditions.</p>
<p>All products offered on our platform comply with applicable Indian food safety and consumer standards. Prices are listed in INR (₹) inclusive of all taxes unless specified otherwise.</p>`
      },
      'shipping-policy': {
        title: 'Shipping & Delivery Policy',
        content: `<h2>Fast Pan-India Express Delivery</h2>
<p>We ship to 20,000+ pin codes across India with our trusted logistics partners (Bluedart, Delhivery, DTDC, India Post).</p>
<ul>
  <li><strong>Free Express Shipping:</strong> Available on all orders above ₹499.</li>
  <li><strong>Dispatch Time:</strong> Orders are verified and dispatched within 24 hours (Monday to Saturday).</li>
  <li><strong>Delivery Estimates:</strong> 2–4 business days for metro cities, 3–6 business days for rest of India.</li>
  <li><strong>Live Tracking:</strong> Real-time AWB tracking is shared via SMS and Email once your order is dispatched.</li>
</ul>`
      },
      'refund-policy': {
        title: 'Refund & Return Policy',
        content: `<h2>Hassle-Free 7-Day Return & Replacement Policy</h2>
<p>At ValueLife Essentials, customer satisfaction is our top priority. If you receive a damaged, leaked, expired, or incorrect product, we provide an immediate replacement or 100% refund.</p>
<ul>
  <li><strong>Window:</strong> Report issues within 7 days of package delivery.</li>
  <li><strong>Support:</strong> Simply WhatsApp us at <a href="https://wa.me/917675941899">+91 76759 41899</a> or email <a href="mailto:valuelifesupport@gmail.com">valuelifesupport@gmail.com</a> with photos of the damaged item.</li>
  <li><strong>Processing:</strong> Refunds are credited to the original payment source within 3–5 banking business days.</li>
</ul>`
      },
      'faq': {
        title: 'Frequently Asked Questions (FAQ)',
        content: `<h2>Frequently Asked Questions</h2>
<p>Find answers to common questions about our products, shipping, and payment options.</p>
<ul>
  <li><strong>Are ValueLife products 100% natural?</strong> Yes, all products are natural, lab-tested, and free of synthetic toxins.</li>
  <li><strong>Do you offer Cash on Delivery (COD)?</strong> Yes, COD is available across most Indian postal pin codes.</li>
  <li><strong>How do I track my order?</strong> Use the Track Order page or contact us on WhatsApp at +91 76759 41899 with your Order ID.</li>
</ul>`
      }
    };

    if (pageData && (pageData.content || pageData.content_html)) {
      return res.json({
        ...pageData,
        content: pageData.content || pageData.content_html
      });
    }

    if (fallbacks[slug]) {
      return res.json({
        id: pageData ? pageData.id : 0,
        slug,
        title: pageData ? pageData.title : fallbacks[slug].title,
        content: fallbacks[slug].content,
        content_html: fallbacks[slug].content,
        is_published: 1,
        seo_title: `${fallbacks[slug].title} - ValueLife Essentials`,
        seo_description: `ValueLife Essentials ${fallbacks[slug].title}. 100% pure, natural essentials in India.`
      });
    }

    if (pageData) return res.json(pageData);
    res.status(404).json({ error: 'Page not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Submit Contact Inquiry
router.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    // Ensure contact_inquiries table exists
    try {
      await executeMySQL(`
        CREATE TABLE IF NOT EXISTS contact_inquiries (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          phone VARCHAR(50),
          subject VARCHAR(255),
          message TEXT NOT NULL,
          status VARCHAR(50) DEFAULT 'NEW',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (e) {}

    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS contact_inquiries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          phone TEXT,
          subject TEXT,
          message TEXT NOT NULL,
          status TEXT DEFAULT 'NEW',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (e) {}

    let inquiryId = Date.now();
    try {
      const myRes = await executeMySQL(
        'INSERT INTO contact_inquiries (name, email, phone, subject, message, status) VALUES (?, ?, ?, ?, ?, ?)',
        [name, email, phone || '', subject || 'Website Inquiry', message, 'NEW']
      );
      if (myRes && myRes.insertId) inquiryId = myRes.insertId;
    } catch (err) {
      console.warn('MySQL inquiry save warning:', err.message);
    }

    try {
      db.prepare(
        'INSERT INTO contact_inquiries (name, email, phone, subject, message, status) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(name, email, phone || '', subject || 'Website Inquiry', message, 'NEW');
    } catch (err) {
      console.warn('SQLite inquiry save warning:', err.message);
    }

    res.json({
      success: true,
      inquiryId,
      message: 'Thank you! Your message has been received. Our support team will get back to you within 2 hours.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Admin Inquiries List
router.get('/api/admin/inquiries', requireAdminAuth, async (req, res) => {
  try {
    let rows = await executeMySQL('SELECT * FROM contact_inquiries ORDER BY created_at DESC LIMIT 100');
    if (!rows || rows.length === 0) {
      try {
        rows = db.prepare('SELECT * FROM contact_inquiries ORDER BY created_at DESC LIMIT 100').all() || [];
      } catch (e) {
        rows = [];
      }
    }
    res.json(rows || []);
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
      'INSERT INTO custom_pages (title, slug, content_html, is_published, seo_title, seo_description) VALUES (?, ?, ?, ?, ?, ?)',
      [title, slug, content || '', is_published ? 1 : 0, meta_title || '', meta_description || '']
    );
    const newId = myRes ? myRes.insertId : Date.now();

    try {
      db.prepare('INSERT OR REPLACE INTO custom_pages (id, title, slug, content, is_published, seo_title, seo_description) VALUES (?, ?, ?, ?, ?, ?, ?)')
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
      'UPDATE custom_pages SET title = COALESCE(?, title), slug = COALESCE(?, slug), content_html = COALESCE(?, content_html), is_published = COALESCE(?, is_published), seo_title = COALESCE(?, seo_title), seo_description = COALESCE(?, seo_description) WHERE id = ?',
      [title, slug, content, is_published !== undefined ? (is_published ? 1 : 0) : null, meta_title, meta_description, id]
    );

    try {
      db.prepare('UPDATE custom_pages SET title = COALESCE(?, title), slug = COALESCE(?, slug), content = COALESCE(?, content), is_published = COALESCE(?, is_published), seo_title = COALESCE(?, seo_title), seo_description = COALESCE(?, seo_description) WHERE id = ?')
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
