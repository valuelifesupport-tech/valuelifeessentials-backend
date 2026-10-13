/**
 * Centralized API Error Handling Middleware
 * Provides uniform JSON responses for operational errors, validation failures, and unexpected exceptions.
 */

function errorHandler(err, req, res, next) {
  // If response headers were already sent, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  const isDev = process.env.NODE_ENV !== 'production';

  // Extract or infer HTTP status code
  let status = err.status || err.statusCode || 500;
  if (err.name === 'ValidationError') status = 400;
  if (err.name === 'UnauthorizedError' || err.code === 'UNAUTHORIZED') status = 401;
  if (err.code === 'FORBIDDEN') status = 403;
  if (err.code === 'NOT_FOUND') status = 404;

  const errorMessage = err.message || 'Internal Server Error';
  const errorCode = err.code || (status === 404 ? 'NOT_FOUND' : status === 400 ? 'BAD_REQUEST' : 'SERVER_ERROR');

  // Log error with request context (quiet on 404s/validation)
  if (status >= 500) {
    console.error(`🔥 [API Error ${status}] ${req.method} ${req.originalUrl}:`, err.stack || err.message);
  } else {
    console.log(`ℹ️ [API Handled ${status}] ${req.method} ${req.originalUrl}: ${errorMessage}`);
  }

  res.status(status).json({
    success: false,
    error: errorMessage,
    code: errorCode,
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
    ...(isDev && err.stack ? { stack: err.stack } : {})
  });
}

module.exports = errorHandler;
