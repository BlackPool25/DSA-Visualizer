/**
 * @file rateLimiter.ts
 * @description Rate limiting middleware to prevent abuse of API endpoints.
 * Uses express-rate-limit with different limits for different endpoints:
 * - Trace endpoint: 10 requests per minute (expensive operation)
 * - Compile/Run endpoints: 30 requests per minute
 *
 * Returns 429 Too Many Requests with Retry-After header when limit exceeded.
 */

import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

/**
 * Creates a standard rate limiter with custom options.
 *
 * @param windowMs - Time window in milliseconds
 * @param maxRequests - Maximum requests allowed in the window
 * @param message - Custom error message
 * @returns Configured rate limiter middleware
 */
function createLimiter(
  windowMs: number,
  maxRequests: number,
  message: string
) {
  return rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    message: {
      success: false,
      error: message,
      retryAfter: Math.ceil(windowMs / 1000),
    },
    handler: (req, res, _next, options) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        limit: options.max,
      });

      res.status(429).json({
        success: false,
        error: options.message,
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
  });
}

/**
 * Rate limiter for the /api/trace endpoint.
 * Trace generation is expensive (involves GDB), so we limit to 10 requests per minute.
 */
export const traceRateLimiter = createLimiter(
  60 * 1000, // 1 minute window
  config.TRACE_RATE_LIMIT,
  `Too many trace requests. Maximum ${config.TRACE_RATE_LIMIT} requests per minute allowed.`
);

/**
 * Rate limiter for the /api/compile and /api/run endpoints.
 * Compilation and execution are less expensive than tracing.
 */
export const compileRateLimiter = createLimiter(
  60 * 1000, // 1 minute window
  config.COMPILE_RATE_LIMIT,
  `Too many compile/run requests. Maximum ${config.COMPILE_RATE_LIMIT} requests per minute allowed.`
);

/**
 * Standard rate limiter configuration for general API endpoints.
 * Less strict than specific endpoint limiters.
 */
export const generalRateLimiter = createLimiter(
  60 * 1000, // 1 minute window
  60, // 60 requests per minute
  'Too many requests. Please slow down.'
);
