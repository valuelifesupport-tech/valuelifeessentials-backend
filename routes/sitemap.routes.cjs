const express = require('express');
const router = express.Router();
const { executeMySQL, db } = require('../config/database.cjs');

const STOREFRONT_URL = 'https://valuelifeessentials.com';

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDate(dateVal) {
  try {
    const d = dateVal ? new Date(dateVal) : new Date();
    return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0];
  } catch (e) {
    return new Date().toISOString().split('T')[0];
  }
}

// Robots.txt Handler
router.get(['/robots.txt', '/api/robots.txt'], (req, res) => {
  res.type('text/plain');
  res.send(`# robots.txt for ValueLife Essentials (https://valuelifeessentials.com)
User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /api/

# XML Sitemap
Sitemap: ${STOREFRONT_URL}/sitemap.xml
`);
});

// Dynamic XML Sitemap Generator
router.get(['/sitemap.xml', '/api/sitemap.xml'], async (req, res) => {
  try {
    // 1. Fetch active products
    let products = [];
    try {
      products = await executeMySQL("SELECT id, title, slug, created_at FROM products WHERE status = 'Active' OR status IS NULL ORDER BY id DESC");
    } catch (e) {
      try {
        products = db.prepare("SELECT id, title, slug, created_at FROM products WHERE status = 'Active' OR status IS NULL ORDER BY id DESC").all();
      } catch (e2) {}
    }
    if (!Array.isArray(products)) products = [];

    // 2. Fetch categories
    let categories = [];
    try {
      categories = await executeMySQL("SELECT id, name, slug FROM categories ORDER BY id ASC");
    } catch (e) {
      try {
        categories = db.prepare("SELECT id, name, slug FROM categories ORDER BY id ASC").all();
      } catch (e2) {}
    }
    if (!Array.isArray(categories)) categories = [];

    // 3. Fetch published blogs
    let blogs = [];
    try {
      blogs = await executeMySQL("SELECT id, title, slug, created_at FROM blog_posts WHERE is_published = 1 ORDER BY id DESC");
    } catch (e) {
      try {
        blogs = db.prepare("SELECT id, title, slug, created_at FROM blog_posts WHERE is_published = 1 ORDER BY id DESC").all();
      } catch (e2) {}
    }
    if (!Array.isArray(blogs)) blogs = [];

    // 4. Fetch custom CMS pages
    let pages = [];
    try {
      pages = await executeMySQL("SELECT id, title, slug, created_at FROM custom_pages WHERE is_published = 1 OR is_published IS NULL ORDER BY id ASC");
    } catch (e) {
      try {
        pages = db.prepare("SELECT id, title, slug FROM custom_pages WHERE is_published = 1 OR is_published IS NULL ORDER BY id ASC").all();
      } catch (e2) {}
    }
    if (!Array.isArray(pages)) pages = [];

    // Assemble XML
    const today = new Date().toISOString().split('T')[0];
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Core Static Pages
    const staticPages = [
      { loc: `${STOREFRONT_URL}/`, priority: '1.0', changefreq: 'daily' },
      { loc: `${STOREFRONT_URL}/products`, priority: '0.9', changefreq: 'daily' },
      { loc: `${STOREFRONT_URL}/pages/about-us`, priority: '0.6', changefreq: 'monthly' },
      { loc: `${STOREFRONT_URL}/pages/contact-us`, priority: '0.6', changefreq: 'monthly' },
      { loc: `${STOREFRONT_URL}/pages/shipping-policy`, priority: '0.5', changefreq: 'monthly' }
    ];

    for (const p of staticPages) {
      xml += `  <url>\n    <loc>${p.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>\n`;
    }

    // Categories
    for (const cat of categories) {
      if (!cat.slug) continue;
      xml += `  <url>\n    <loc>${STOREFRONT_URL}/category/${escapeXml(cat.slug)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    }

    // Products (Top priority for Google E-commerce indexing)
    for (const prod of products) {
      if (!prod.slug && !prod.id) continue;
      const slug = prod.slug || String(prod.id);
      const mod = formatDate(prod.created_at);
      xml += `  <url>\n    <loc>${STOREFRONT_URL}/products/${escapeXml(slug)}</loc>\n    <lastmod>${mod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
    }

    // Blog Posts
    for (const blog of blogs) {
      if (!blog.slug) continue;
      const mod = formatDate(blog.created_at);
      xml += `  <url>\n    <loc>${STOREFRONT_URL}/blog/${escapeXml(blog.slug)}</loc>\n    <lastmod>${mod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
    }

    // Custom CMS Pages
    for (const pg of pages) {
      if (!pg.slug) continue;
      xml += `  <url>\n    <loc>${STOREFRONT_URL}/pages/${escapeXml(pg.slug)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.5</priority>\n  </url>\n`;
    }

    xml += `</urlset>`;

    res.header('Content-Type', 'application/xml; charset=utf-8');
    res.header('Cache-Control', 'public, max-age=3600'); // 1 hour browser / CDN cache
    res.send(xml);
  } catch (err) {
    console.error('Sitemap error:', err);
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
});

module.exports = router;
