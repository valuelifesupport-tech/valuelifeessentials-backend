module.exports = function errorHandler(err, req, res, next) {
  console.error('🔥 API Error:', err.stack || err.message);
  res.status(500).json({ error: true, message: err.message || 'Internal Server Error' });
};
