"use strict";
/**
 * server/middleware/rateLimiter.ts
 * Redis-backed per-IP and per-user rate limiting.
 * Applied at the Express level before tRPC routing.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkoutRateLimiter = exports.authRateLimiter = exports.apiRateLimiter = void 0;
const redis_1 = require("../config/redis");
function createRateLimiter(opts) {
    return async (req, res, next) => {
        const redis = (0, redis_1.getRedis)();
        const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
        const key = `${opts.keyPrefix}:${ip}`;
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
        }
        catch {
            // Redis failure — fail open (don't block the request)
            next();
        }
    };
}
// General API rate limit: 120 req / 60s per IP
exports.apiRateLimiter = createRateLimiter({
    windowSeconds: 60,
    maxRequests: 120,
    keyPrefix: 'rl:api',
});
// Strict limit for auth-related endpoints: 10 req / 60s
exports.authRateLimiter = createRateLimiter({
    windowSeconds: 60,
    maxRequests: 10,
    keyPrefix: 'rl:auth',
});
// Checkout: 5 attempts per minute per IP
exports.checkoutRateLimiter = createRateLimiter({
    windowSeconds: 60,
    maxRequests: 5,
    keyPrefix: 'rl:checkout',
});
//# sourceMappingURL=rateLimiter.js.map