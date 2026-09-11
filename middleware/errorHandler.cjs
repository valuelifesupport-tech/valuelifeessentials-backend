function errorHandler(err, req, res, next) {
  console.error('🔥 Central API Error Handler:', err.message || err);
  if (res.headersSent) {
    return next(err);
  }
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error',
    code: err.code || 'SERVER_ERROR'
  });
}

module.exports = errorHandler;
