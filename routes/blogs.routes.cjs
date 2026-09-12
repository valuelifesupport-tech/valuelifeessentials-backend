const express = require('express');
const router = express.Router();
const { db, executeMySQL } = require('../config/database.cjs');
const { requireAdminAuth } = require('../middleware/auth.cjs');

// Helper to sanitize/generate slug
function generateSlug(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// 1. GET All Published Blogs (Public Storefront)
router.get('/api/blogs', async (req, res) => {
  try {
    const { category, search, tag, limit, featured } = req.query;
    let sql = 'SELECT * FROM blog_posts WHERE is_published = 1';
    const params = [];

    if (category && category !== 'All') {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (tag) {
      sql += ' AND tags LIKE ?';
      params.push('%' + tag + '%');
    }

    if (featured === 'true' || featured === '1') {
      sql += ' AND is_featured = 1';
    }

    if (search) {
      sql += ' AND (title LIKE ? OR excerpt LIKE ? OR content LIKE ? OR tags LIKE ?)';
      const term = '%' + search + '%';
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY is_featured DESC, sort_order ASC, created_at DESC';

    if (limit && !isNaN(limit)) {
      sql += ' LIMIT ' + Number(limit);
    }

    let rows = await executeMySQL(sql, params);

    // Fallback to SQLite if MySQL fails
    if (!rows || rows.length === 0) {
      try {
        let sqliteSql = 'SELECT * FROM blog_posts WHERE is_published = 1';
        const sqliteParams = [];

        if (category && category !== 'All') {
          sqliteSql += ' AND category = ?';
          sqliteParams.push(category);
        }
        if (search) {
          sqliteSql += ' AND (title LIKE ? OR excerpt LIKE ?)';
          sqliteParams.push('%' + search + '%', '%' + search + '%');
        }
        sqliteSql += ' ORDER BY is_featured DESC, sort_order ASC, created_at DESC';
        if (limit && !isNaN(limit)) {
          sqliteSql += ' LIMIT ' + Number(limit);
        }
        rows = db.prepare(sqliteSql).all(...sqliteParams) || [];
      } catch (e) {}
    }

    res.json(rows || []);
  } catch (err) {
    console.error('Error fetching blogs:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. GET Blog Categories with counts
router.get('/api/blogs/categories', async (req, res) => {
  try {
    let rows = await executeMySQL(
      'SELECT category, COUNT(*) as count FROM blog_posts WHERE is_published = 1 GROUP BY category ORDER BY count DESC'
    );
    if (!rows || rows.length === 0) {
      try {
        rows = db.prepare('SELECT category, COUNT(*) as count FROM blog_posts WHERE is_published = 1 GROUP BY category ORDER BY count DESC').all() || [];
      } catch (e) {}
    }
    res.json(rows || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. GET Single Blog by Slug or ID (Public Storefront)
router.get('/api/blogs/:slugOrId', async (req, res) => {
  try {
    const slugOrId = req.params.slugOrId;
    const isId = !isNaN(slugOrId);

    let blog = null;
    if (isId) {
      const rows = await executeMySQL('SELECT * FROM blog_posts WHERE id = ? AND is_published = 1', [Number(slugOrId)]);
      if (rows && rows.length > 0) blog = rows[0];
    } else {
      const rows = await executeMySQL('SELECT * FROM blog_posts WHERE slug = ? AND is_published = 1', [slugOrId]);
      if (rows && rows.length > 0) blog = rows[0];
    }

    // Fallback SQLite
    if (!blog) {
      try {
        if (isId) {
          blog = db.prepare('SELECT * FROM blog_posts WHERE id = ? AND is_published = 1').get(Number(slugOrId));
        } else {
          blog = db.prepare('SELECT * FROM blog_posts WHERE slug = ? AND is_published = 1').get(slugOrId);
        }
      } catch (e) {}
    }

    if (!blog) {
      return res.status(404).json({ error: 'Blog post not found' });
    }

    // Increment view count asynchronously
    try {
      executeMySQL('UPDATE blog_posts SET views_count = views_count + 1 WHERE id = ?', [blog.id]);
      db.prepare('UPDATE blog_posts SET views_count = views_count + 1 WHERE id = ?').run(blog.id);
    } catch (e) {}

    // Fetch related articles (same category or latest, excluding current)
    let related = await executeMySQL(
      'SELECT id, title, slug, category, excerpt, featured_image, read_time, created_at FROM blog_posts WHERE is_published = 1 AND id != ? AND (category = ? OR 1=1) ORDER BY (category = ?) DESC, created_at DESC LIMIT 3',
      [blog.id, blog.category, blog.category]
    );

    if (!related || related.length === 0) {
      try {
        related = db.prepare(
          'SELECT id, title, slug, category, excerpt, featured_image, read_time, created_at FROM blog_posts WHERE is_published = 1 AND id != ? ORDER BY created_at DESC LIMIT 3'
        ).all(blog.id) || [];
      } catch (e) {}
    }

    res.json({
      ...blog,
      related_posts: related || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ADMIN BLOG MANAGEMENT ENDPOINTS
// ==========================================

// 4. GET All Blogs (Admin - includes drafts & unpublished)
router.get(['/api/admin/blogs', '/api/admin/blog-posts'], async (req, res) => {
  try {
    let rows = await executeMySQL('SELECT * FROM blog_posts ORDER BY sort_order ASC, created_at DESC');
    if (!rows || rows.length === 0) {
      try {
        rows = db.prepare('SELECT * FROM blog_posts ORDER BY sort_order ASC, created_at DESC').all() || [];
      } catch (e) {}
    }
    res.json(rows || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. POST Create Blog (Admin)
router.post(['/api/admin/blogs', '/api/admin/blog-posts'], requireAdminAuth, async (req, res) => {
  try {
    const {
      title,
      slug: customSlug,
      category = 'General Wellness',
      excerpt = '',
      content = '',
      featured_image = '',
      author_name = 'ValueLife Editorial',
      author_avatar = '',
      author_role = 'Ayurvedic Specialist',
      read_time = '5 min read',
      tags = 'Organic, Wellness',
      is_published = 1,
      is_featured = 0,
      sort_order = 0
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Blog title is required' });
    }

    let finalSlug = generateSlug(customSlug || title);
    if (!finalSlug) finalSlug = 'blog-' + Date.now();

    let existing = await executeMySQL('SELECT id FROM blog_posts WHERE slug = ?', [finalSlug]);
    if (existing && existing.length > 0) {
      finalSlug = finalSlug + '-' + Date.now().toString().slice(-4);
    }

    const myRes = await executeMySQL(
      'INSERT INTO blog_posts (title, slug, category, excerpt, content, featured_image, author_name, author_avatar, author_role, read_time, tags, is_published, is_featured, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        title,
        finalSlug,
        category,
        excerpt,
        content,
        featured_image,
        author_name,
        author_avatar,
        author_role,
        read_time,
        tags,
        Number(is_published) ?? 1,
        Number(is_featured) || 0,
        Number(sort_order) || 0
      ]
    );

    const newId = myRes ? myRes.insertId : Date.now();

    try {
      db.prepare(
        'INSERT OR REPLACE INTO blog_posts (id, title, slug, category, excerpt, content, featured_image, author_name, author_avatar, author_role, read_time, tags, is_published, is_featured, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        newId,
        title,
        finalSlug,
        category,
        excerpt,
        content,
        featured_image,
        author_name,
        author_avatar,
        author_role,
        read_time,
        tags,
        Number(is_published) ?? 1,
        Number(is_featured) || 0,
        Number(sort_order) || 0
      );
    } catch (e) {}

    res.json({
      success: true,
      id: newId,
      title,
      slug: finalSlug,
      category,
      message: 'Blog post created successfully'
    });
  } catch (err) {
    console.error('Create blog error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. PUT Update Blog (Admin)
router.put(['/api/admin/blogs/:id', '/api/admin/blog-posts/:id'], requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const {
      title,
      slug,
      category,
      excerpt,
      content,
      featured_image,
      author_name,
      author_avatar,
      author_role,
      read_time,
      tags,
      is_published,
      is_featured,
      sort_order
    } = req.body;

    const updates = [];
    const params = [];

    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (slug !== undefined) { updates.push('slug = ?'); params.push(generateSlug(slug)); }
    if (category !== undefined) { updates.push('category = ?'); params.push(category); }
    if (excerpt !== undefined) { updates.push('excerpt = ?'); params.push(excerpt); }
    if (content !== undefined) { updates.push('content = ?'); params.push(content); }
    if (featured_image !== undefined) { updates.push('featured_image = ?'); params.push(featured_image); }
    if (author_name !== undefined) { updates.push('author_name = ?'); params.push(author_name); }
    if (author_avatar !== undefined) { updates.push('author_avatar = ?'); params.push(author_avatar); }
    if (author_role !== undefined) { updates.push('author_role = ?'); params.push(author_role); }
    if (read_time !== undefined) { updates.push('read_time = ?'); params.push(read_time); }
    if (tags !== undefined) { updates.push('tags = ?'); params.push(tags); }
    if (is_published !== undefined) { updates.push('is_published = ?'); params.push(Number(is_published)); }
    if (is_featured !== undefined) { updates.push('is_featured = ?'); params.push(Number(is_featured)); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(Number(sort_order)); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);
    await executeMySQL('UPDATE blog_posts SET ' + updates.join(', ') + ' WHERE id = ?', params);

    try {
      db.prepare('UPDATE blog_posts SET ' + updates.join(', ') + ' WHERE id = ?').run(...params);
    } catch (e) {}

    res.json({ success: true, message: 'Blog post updated successfully' });
  } catch (err) {
    console.error('Update blog error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 7. DELETE Blog (Admin)
router.delete(['/api/admin/blogs/:id', '/api/admin/blog-posts/:id'], requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    await executeMySQL('DELETE FROM blog_posts WHERE id = ?', [id]);
    try {
      db.prepare('DELETE FROM blog_posts WHERE id = ?').run(id);
    } catch (e) {}
    res.json({ success: true, message: 'Blog post deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
