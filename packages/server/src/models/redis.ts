import Redis from 'ioredis';
import dotenv from 'dotenv';
import { redisLogger } from '../lib/logger.js';

dotenv.config({ path: '../../.env' });

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 5000);
    return delay;
  },
});

redis.on('connect', () => {
  redisLogger.info('Bağlantı kuruldu');
});

redis.on('error', (err) => {
  redisLogger.error({ err: err.message }, 'Redis hatası');
});

// Cache yardımcıları
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      redisLogger.warn({ key }, 'Redis cache bozuk JSON — siliniyor');
      await redis.del(key);
      return null;
    }
  },

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  },

  async del(key: string): Promise<void> {
    await redis.del(key);
  },

  async invalidateBoard(boardId: string): Promise<void> {
    // SCAN kullan (KEYS O(N) ve production'da blocking risk)
    const pattern = `board:${boardId}:*`;
    const stream = redis.scanStream({ match: pattern, count: 100 });
    const pipeline = redis.pipeline();

    for await (const keys of stream) {
      for (const key of keys as string[]) {
        pipeline.del(key);
      }
    }

    await pipeline.exec();
  },
};
