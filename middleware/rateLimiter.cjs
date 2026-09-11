function rateLimiter(maxRequests = 50, windowMs = 60000) {
  const ipMap = new Map();
  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = ipMap.get(ip) || { count: 0, resetTime: now + windowMs };

    if (now > entry.resetTime) {
      entry.count = 1;
      entry.resetTime = now + windowMs;
    } else {
      entry.count += 1;
    }

    ipMap.set(ip, entry);

    if (entry.count > maxRequests) {
      return res.status(429).json({ error: 'Too many requests, please slow down and try again later.' });
    }
    next();
  };
}

module.exports = rateLimiter;
