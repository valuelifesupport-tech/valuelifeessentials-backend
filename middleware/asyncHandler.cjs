/**
 * Async Route Handler Wrapper
 * Catches any unhandled rejection in asynchronous route controllers
 * and passes the error to Express's next() error handling chain.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
