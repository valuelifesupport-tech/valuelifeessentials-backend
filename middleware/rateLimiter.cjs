function rateLimiter(maxRequests = 50, windowMs = 60000) {
  const ipMap = new Map();
  const MAX_MAP_SIZE = 10000; // Prevent memory exhaustion

  // Periodic cleanup every 5 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of ipMap) {
      if (now > entry.resetTime) {
        ipMap.delete(ip);
      }
    }
  }, 5 * 60 * 1000);
  cleanupInterval.unref(); // Don't prevent process exit

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

    // Evict oldest entries if map grows too large
    if (ipMap.size > MAX_MAP_SIZE) {
      const keysIter = ipMap.keys();
      for (let i = 0; i < 1000; i++) {
        const key = keysIter.next().value;
        if (key) ipMap.delete(key);
      }
    }

    if (entry.count > maxRequests) {
      return res.status(429).json({ error: 'Too many requests, please slow down and try again later.' });
    }
    next();
  };
}

module.exports = rateLimiter;
