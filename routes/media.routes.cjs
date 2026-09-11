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
  const filePath = path.join(uploadsDir, filename);

  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  // Check public/uploads
  const altPath = path.resolve(__dirname, '../../public/uploads', filename);
  if (fs.existsSync(altPath)) {
    return res.sendFile(altPath);
  }

  return sendSvgFallback(res);
});

// Upload File
router.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (req.file) {
      const url = `/uploads/${req.file.filename}`;
      return res.json({
        url,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size
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
        return res.json({ url: `/uploads/${filename}`, filename });
      }
    }

    return res.status(400).json({ error: 'No file or valid dataUrl uploaded' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List Media Files
router.get('/api/media', async (req, res) => {
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
router.delete('/api/media/:filename', requireAdminAuth, async (req, res) => {
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
router.post('/api/media/replace', requireAdminAuth, upload.single('file'), async (req, res) => {
  try {
    const targetFilename = req.body.targetFilename;
    if (!targetFilename || !req.file) {
      return res.status(400).json({ error: 'targetFilename and file are required' });
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

module.exports = router;
