const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Robust uploads directory finder: resolves to backend/uploads or server/uploads
const candidates = [
  path.resolve(__dirname, '../uploads'),
  path.resolve(__dirname, '../../server/uploads'),
  path.resolve(process.cwd(), 'uploads'),
  path.resolve(process.cwd(), 'server/uploads')
];

let uploadsDir = candidates[0];
for (const cand of candidates) {
  if (fs.existsSync(cand)) {
    uploadsDir = cand;
    break;
  }
}

if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (e) {}
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }
});

function getCleanSvg(label = 'ValueLife Essentials') {
  const safeLabel = String(label || 'ValueLife Essentials')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <defs>
      <linearGradient id="vleBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f7fbf8"/>
        <stop offset="100%" stop-color="#eaf3ee"/>
      </linearGradient>
      <filter id="vleShadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#164e3f" flood-opacity="0.12"/>
      </filter>
    </defs>
    <rect width="400" height="400" rx="32" fill="url(#vleBg)"/>
    <circle cx="200" cy="180" r="80" fill="#ffffff" filter="url(#vleShadow)"/>
    <path d="M200,125 C165,125 145,155 145,185 C145,215 170,235 200,235 C230,235 255,215 255,185 C255,155 235,125 200,125 Z M200,145 C215,168 220,186 220,198 C206,198 192,192 182,180 C182,168 190,154 200,145 Z" fill="#164e3f"/>
    <circle cx="200" cy="180" r="8" fill="#52b788"/>
    <text x="200" y="295" text-anchor="middle" fill="#164e3f" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="700" font-size="22" letter-spacing="0.5">${safeLabel}</text>
    <text x="200" y="325" text-anchor="middle" fill="#52b788" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="600" font-size="14" letter-spacing="1">100% PURE &amp; ORGANIC</text>
  </svg>`;
}

function sendSvgFallback(res, label) {
  const svg = getCleanSvg(label);
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(svg);
}

module.exports = {
  upload,
  uploadsDir,
  sendSvgFallback,
  getCleanSvg
};
