import Redis from 'ioredis';

// Redis exclusivo de ms-auth — caché key-value de perfiles de usuario (user:<id>)
const REDIS_CACHE_URL = process.env.REDIS_CACHE_URL || 'redis://localhost:6379';

export const redisClient = new Redis(REDIS_CACHE_URL);

redisClient.on('error', (err) => {
  console.error('[redis] Error en cliente KV:', err.message);
});
