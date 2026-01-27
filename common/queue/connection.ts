import Redis from 'ioredis';

const REDIS_HOST = process.env['REDIS_HOST'] || 'localhost';
const REDIS_PORT = parseInt(process.env['REDIS_PORT'] || '6379', 10);
const REDIS_PASSWORD = process.env['REDIS_PASSWORD'];

interface RedisCache {
  connection: Redis | null;
}

declare global {
  // eslint-disable-next-line no-var
  var redisCache: RedisCache | undefined;
}

const cached: RedisCache = global.redisCache ?? {
  connection: null,
};

if (!global.redisCache) {
  global.redisCache = cached;
}

export function getRedisConnection(): Redis {
  if (cached.connection) {
    return cached.connection;
  }

  const connection = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  connection.on('connect', () => {
    console.log('Connected to Redis');
  });

  connection.on('error', (err) => {
    console.error('Redis connection error:', err);
  });

  cached.connection = connection;
  return connection;
}

export async function closeRedisConnection(): Promise<void> {
  if (cached.connection) {
    await cached.connection.quit();
    cached.connection = null;
    console.log('Disconnected from Redis');
  }
}
