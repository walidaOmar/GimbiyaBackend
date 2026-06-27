/**
 * server/config/redis.ts
 * Upstash Redis client for session caching, rate limiting, and hot-data storage.
 */

import Redis from 'ioredis';

let redisClient: Redis | null = null;

export function getRedis(): Redis {
  if (redisClient) return redisClient;

  let url = process.env.REDIS_URL;
  
  // Clean up any accidental wrapping quotes or spaces from the string
  if (url) {
    url = url.replace(/['"]/g, '').trim();
  }

  if (!url) {
    console.warn('[Redis] REDIS_URL not set or empty. Redis features will be unavailable.');
    return createMockRedis();
  }

  try {
    // Attempt instantiation with the sanitized URL string
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: true,
    });

    redisClient.on('connect', () => console.log('[Redis] Connected.'));
    redisClient.on('error', (err) => console.error('[Redis] Connection Error:', err.message));

    return redisClient;
  } catch (error: any) {
    console.error('[Redis] critical parsing error:', error.message);
    console.warn('[Redis] Falling back to Mock Redis to prevent server crash.');
    return createMockRedis();
  }
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