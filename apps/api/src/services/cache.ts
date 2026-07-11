import { Redis } from "ioredis";

type RedisClient = InstanceType<typeof Redis>;

let redis: RedisClient | null = null;
const memory = new Map<string, { value: string; expires: number }>();

export function getRedis(): RedisClient | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!redis) {
    try {
      redis = new Redis(url, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        enableOfflineQueue: false,
      });
      redis.on("error", () => {
        /* fall back to memory */
      });
      void redis.connect().catch(() => {
        redis = null;
      });
    } catch {
      redis = null;
    }
  }
  return redis;
}

export async function cacheGet(key: string): Promise<string | null> {
  const r = getRedis();
  if (r) {
    try {
      return await r.get(key);
    } catch {
      /* memory fallback */
    }
  }
  const hit = memory.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    memory.delete(key);
    return null;
  }
  return hit.value;
}

export async function cacheSet(key: string, value: string, ttlSec = 30): Promise<void> {
  const r = getRedis();
  if (r) {
    try {
      await r.set(key, value, "EX", ttlSec);
      return;
    } catch {
      /* memory fallback */
    }
  }
  memory.set(key, { value, expires: Date.now() + ttlSec * 1000 });
}

export async function cacheDel(patternPrefix: string): Promise<void> {
  for (const k of memory.keys()) {
    if (k.startsWith(patternPrefix)) memory.delete(k);
  }
}
