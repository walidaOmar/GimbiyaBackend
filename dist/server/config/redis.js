"use strict";
/**
 * server/config/redis.ts
 * Upstash Redis client for session caching, rate limiting, and hot-data storage.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedis = getRedis;
const ioredis_1 = __importDefault(require("ioredis"));
let redisClient = null;
function getRedis() {
    if (redisClient)
        return redisClient;
    const url = process.env.REDIS_URL;
    if (!url) {
        console.warn('[Redis] REDIS_URL not set. Redis features will be unavailable.');
        // Return a no-op mock so the app doesn't crash in dev without Redis
        return createMockRedis();
    }
    redisClient = new ioredis_1.default(url, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: false,
        lazyConnect: true,
    });
    redisClient.on('connect', () => console.log('[Redis] Connected.'));
    redisClient.on('error', (err) => console.error('[Redis] Error:', err.message));
    return redisClient;
}
// Minimal mock for local development without Redis
function createMockRedis() {
    const store = new Map();
    return {
        get: async (key) => store.get(key) ?? null,
        set: async (key, value) => { store.set(key, value); return 'OK'; },
        setex: async (key, _ttl, value) => { store.set(key, value); return 'OK'; },
        del: async (key) => { store.delete(key); return 1; },
        incr: async (key) => {
            const v = parseInt(store.get(key) ?? '0') + 1;
            store.set(key, String(v));
            return v;
        },
        expire: async () => 1,
        on: () => { },
    };
}
exports.default = getRedis;
//# sourceMappingURL=redis.js.map