'use strict';

/**
 * Custom memory-based rate limiting middleware.
 */

const { fail } = require('../utils/response');

function createRateLimiter({ windowMs = 15 * 60 * 1000, maxRequests = 100, message = 'Too many requests, please try again later.' } = {}) {
  const requests = new Map();

  // Periodic cleanup
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of requests.entries()) {
      if (now > entry.resetTime) {
        requests.delete(key);
      }
    }
  }, windowMs).unref();

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();

    let entry = requests.get(ip);
    if (!entry || now > entry.resetTime) {
      entry = { count: 1, resetTime: now + windowMs };
      requests.set(ip, entry);
      return next();
    }

    entry.count += 1;
    if (entry.count > maxRequests) {
      return fail(res, 429, message);
    }

    return next();
  };
}

module.exports = createRateLimiter;
