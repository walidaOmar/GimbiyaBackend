/**
 * server/middleware/rateLimiter.ts
 * Redis-backed per-IP and per-user rate limiting.
 * Applied at the Express level before tRPC routing.
 */

import { Request, Response, NextFunction } from 'express';
import { getRedis } from '../config/redis';

interface RateLimitOptions {
  windowSeconds: number;  // Time window in seconds
  maxRequests:   number;  // Max allowed requests in window
  keyPrefix:     string;  // Redis key namespace
}

function createRateLimiter(opts: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const redis = getRedis();
    const ip    = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const key   = `${opts.keyPrefix}:${ip}`;

    try {
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, opts.windowSeconds);
      }
      if (current > opts.maxRequests) {
        res.status(429).json({
          error: 'Too many requests. Please slow down.',
          retryAfterSeconds: opts.windowSeconds,
        });
        return;
      }
      next();
    } catch {
      // Redis failure — fail open (don't block the request)
      next();
    }
  };
}

// General API rate limit: 120 req / 60s per IP
export const apiRateLimiter = createRateLimiter({
  windowSeconds: 60,
  maxRequests:   120,
  keyPrefix:     'rl:api',
});

// Strict limit for auth-related endpoints: 10 req / 60s
export const authRateLimiter = createRateLimiter({
  windowSeconds: 60,
  maxRequests:   10,
  keyPrefix:     'rl:auth',
});

// Checkout: 5 attempts per minute per IP
export const checkoutRateLimiter = createRateLimiter({
  windowSeconds: 60,
  maxRequests:   5,
  keyPrefix:     'rl:checkout',
});
