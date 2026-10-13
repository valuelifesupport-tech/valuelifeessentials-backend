const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { upload, uploadsDir, sendSvgFallback } = require('../utils/fileStorage.cjs');
const { db, executeMySQL } = require('../config/database.cjs');
const { requireAdminAuth } = require('../middleware/auth.cjs');

// Serve uploaded image file with fallback
router.get(['/uploads/:filename', '/api/uploads/:filename', '/api/media/file/:filename'], (req, res) => {
  const filename = path.basename(req.params.filename);

  const searchDirs = [
    uploadsDir,
    '/home/u439830852/domains/backend.valuelifeessentials.com/uploads_persistent',
    '/home/u439830852/uploads_persistent',
    path.resolve(__dirname, '../uploads'),
    path.resolve(__dirname, '../../server/uploads'),
    path.resolve(__dirname, '../../public/uploads'),
    path.resolve(__dirname, '../../../public_html/uploads'),
    path.resolve(process.cwd(), 'uploads'),
    path.resolve(process.cwd(), 'server/uploads'),
    path.resolve(process.cwd(), 'public/uploads')
  ];

  for (const dir of searchDirs) {
    const candidate = path.join(dir, filename);
    if (fs.existsSync(candidate)) {
      return res.sendFile(candidate);
    }
  }

  // Derive human label from filename (e.g. category or brand name)
  let label = filename.replace(/\.(png|jpg|jpeg|webp|svg|gif)$/i, '').replace(/^\d+-/, '').replace(/[^a-zA-Z0-9 ]+/g, ' ').trim();
  // If the label is just a hex hash / UUID or empty, fall back to "ValueLife Essentials"
  if (!label || /^[a-f0-9\s-]{12,}$/i.test(label) || label.length > 25) {
    label = 'ValueLife Essentials';
  }
  return sendSvgFallback(res, label);
});

// Upload File - accepts 'file', 'image', or any field name
router.post('/api/upload', requireAdminAuth, (req, res) => {
  upload.any()(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    try {
      const file = (req.files && req.files.length > 0) ? req.files[0] : req.file;
      if (file) {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
        if (!allowedMimes.includes(file.mimetype)) {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          return res.status(400).json({ error: 'Invalid file type. Only images are allowed.' });
        }
        const url = `/uploads/${file.filename}`;
        return res.json({
          url,
          imageUrl: url,
          fullUrl: url,
          filename: file.filename,
          originalName: file.originalname,
          size: file.size
        });
      }

      // Base64 Data URL fallback
      if (req.body && req.body.dataUrl) {
        const match = req.body.dataUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        if (match) {
          const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
          const filename = `${Date.now()}-base64.${ext}`;
          const buffer = Buffer.from(match[2], 'base64');
          fs.writeFileSync(path.join(uploadsDir, filename), buffer);
          const url = `/uploads/${filename}`;
          return res.json({ url, imageUrl: url, fullUrl: url, filename });
        }
      }

      return res.status(400).json({ error: 'No file or valid dataUrl uploaded' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
});

// List Media Files
router.get(['/api/media', '/api/admin/media'], async (req, res) => {
  try {
    const files = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];
    const mediaList = files
      .filter(f => /\.(jpg|jpeg|png|webp|svg|gif)$/i.test(f))
      .map(f => {
        const stat = fs.statSync(path.join(uploadsDir, f));
        return {
          filename: f,
          url: `/uploads/${f}`,
          size: stat.size,
          createdAt: stat.birthtime
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(mediaList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Media File
router.delete(['/api/media/:filename', '/api/admin/media/:filename'], requireAdminAuth, async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(uploadsDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    // Clean from product_images in SQLite & MySQL
    const cleanUrl = `%/uploads/${filename}`;
    try {
      db.prepare('DELETE FROM product_images WHERE image_url LIKE ?').run(cleanUrl);
    } catch (e) {}
    try {
      await executeMySQL('DELETE FROM product_images WHERE image_url LIKE ?', [cleanUrl]);
    } catch (e) {}

    res.json({ success: true, message: 'Media asset deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Replace Media File
router.post(['/api/media/replace', '/api/admin/media/replace'], requireAdminAuth, upload.single('file'), async (req, res) => {
  try {
    const targetFilename = req.body.targetFilename;
    if (!targetFilename || !req.file) {
      return res.status(400).json({ error: 'targetFilename and file are required' });
    }
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedMimes.includes(req.file.mimetype)) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Invalid file type. Only images are allowed.' });
    }

    const cleanTarget = path.basename(targetFilename);
    const targetPath = path.join(uploadsDir, cleanTarget);

    fs.copyFileSync(req.file.path, targetPath);
    if (req.file.path !== targetPath && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.json({ success: true, url: `/uploads/${cleanTarget}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// High-performance image proxy for CDN / Amazon images
router.get('/api/media/proxy', async (req, res) => {
  try {
    const rawUrl = req.query.url;
    if (!rawUrl || typeof rawUrl !== 'string') {
      return sendSvgFallback(res);
    }
    const targetUrl = decodeURIComponent(rawUrl).trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      return sendSvgFallback(res);
    }
    
    let urlObj;
    try {
      urlObj = new URL(targetUrl);
    } catch (e) {
      return sendSvgFallback(res);
    }
    const hostname = urlObj.hostname;
    if (['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254'].includes(hostname) || hostname.startsWith('10.') || hostname.startsWith('192.168.') || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) {
      return sendSvgFallback(res);
    }

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      return sendSvgFallback(res);
    }

    const rawContentType = (response.headers.get('content-type') || '').toLowerCase().split(';')[0].trim();
    // Strictly restrict to safe bitmap/raster image types - disallow html, js, and remote svg scripts
    const SAFE_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
    const effectiveContentType = SAFE_IMAGE_TYPES.has(rawContentType) ? rawContentType : 'image/jpeg';

    res.setHeader('Content-Type', effectiveContentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');

    const arrayBuffer = await response.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    return sendSvgFallback(res);
  }
});

module.exports = router;
