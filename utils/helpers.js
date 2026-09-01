function slugify(text) {
  if (!text) return '';
  return text.toString().toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

module.exports = { slugify };
