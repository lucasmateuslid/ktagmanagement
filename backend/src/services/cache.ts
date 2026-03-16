import { createClient, RedisClientType } from 'redis';

const globalForRedis = globalThis as unknown as { redis?: RedisClientType };

let redisClient: RedisClientType | null = globalForRedis.redis ?? null;

export const getRedisClient = async () => {
  if (!process.env.REDIS_URL) {
    return null;
  }

  if (!redisClient) {
    redisClient = createClient({ url: process.env.REDIS_URL });
      redisClient.on('error', (error: unknown) => {
      console.error('Redis connection error:', error);
    });

    await redisClient.connect();

    if (process.env.NODE_ENV !== 'production') {
      globalForRedis.redis = redisClient;
    }
  }

  return redisClient;
};

export const cacheService = {
  get: async <T>(key: string): Promise<T | null> => {
    const client = await getRedisClient();
    if (!client) return null;

    const value = await client.get(key);
    return value ? (JSON.parse(value) as T) : null;
  },

  set: async (key: string, value: unknown, ttlSeconds?: number) => {
    const client = await getRedisClient();
    if (!client) return;

    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await client.set(key, serialized, { EX: ttlSeconds });
      return;
    }

    await client.set(key, serialized);
  },

  del: async (key: string) => {
    const client = await getRedisClient();
    if (!client) return;
    await client.del(key);
  }
};
