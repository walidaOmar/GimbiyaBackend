/**
 * server/middleware/rateLimiter.ts
 * Redis-backed per-IP and per-user rate limiting.
 * Applied at the Express level before tRPC routing.
 */
import { Request, Response, NextFunction } from 'express';
export declare const apiRateLimiter: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const authRateLimiter: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const checkoutRateLimiter: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=rateLimiter.d.ts.map