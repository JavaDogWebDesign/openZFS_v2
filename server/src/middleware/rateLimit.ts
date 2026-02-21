/**
 * Rate limiters using express-rate-limit.
 *
 * Two limiters are exported:
 *   - authLimiter  : strict limiter for login endpoints (5 req / min)
 *   - apiLimiter   : general API limiter (100 req / min)
 */

import rateLimit from 'express-rate-limit';

/**
 * Strict rate limiter for authentication endpoints.
 * Prevents brute-force login attempts.
 *
 * 5 requests per 1-minute window per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 5,                    // 5 attempts per window
  standardHeaders: true,     // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,      // Disable X-RateLimit-* headers
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT',
      message: 'Too many authentication attempts. Please try again later.',
    },
  },
});

/**
 * General API rate limiter.
 * Applies to all authenticated API routes.
 *
 * 100 requests per 1-minute window per IP.
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 100,                  // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT',
      message: 'Too many requests. Please slow down.',
    },
  },
});
