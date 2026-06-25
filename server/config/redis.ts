/**
 * server/config/redis.ts
 * Upstash Redis client for session caching, rate limiting, and hot-data storage.
 */

import Redis from 'ioredis';

let redisClient: Redis | null = null;

export function getRedis(): Redis {
  if (redisClient) return redisClient;

  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn('[Redis] REDIS_URL not set. Redis features will be unavailable.');
    // Return a no-op mock so the app doesn't crash in dev without Redis
    return createMockRedis();
  }

  redisClient = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: true,
  });

  redisClient.on('connect', () => console.log('[Redis] Connected.'));
  redisClient.on('error', (err) => console.error('[Redis] Error:', err.message));

  return redisClient;
}

// Minimal mock for local development without Redis
function createMockRedis(): Redis {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string) => { store.set(key, value); return 'OK'; },
    setex: async (key: string, _ttl: number, value: string) => { store.set(key, value); return 'OK'; },
    del: async (key: string) => { store.delete(key); return 1; },
    incr: async (key: string) => {
      const v = parseInt(store.get(key) ?? '0') + 1;
      store.set(key, String(v));
      return v;
    },
    expire: async () => 1,
    on: () => {},
  } as unknown as Redis;
}

export default getRedis;
