// Cliente Bull para colas de eventos y cliente Redis para caché KV
import Bull from 'bull';
import Redis from 'ioredis';

// URLs separadas: una para el broker de eventos y otra para el caché
const REDIS_BROKER_URL = process.env.REDIS_BROKER_URL || 'redis://localhost:6379';
const REDIS_CACHE_URL  = process.env.REDIS_CACHE_URL  || 'redis://localhost:6379';

// Cola de eventos de usuario — ms-auth solo CONSUME estos eventos.
// ms-users es el productor (single source of truth).
export const userEventsQueue = new Bull('user-events', REDIS_BROKER_URL);

// Log de errores del broker para no perder fallos silenciosos
userEventsQueue.on('error', (err) => {
  console.error('[redis] Error en queue user-events:', err.message);
});

// Cliente Redis propio de ms-auth — usado como caché key-value
// para perfiles de usuario (clave: user:<id>)
export const redisClient = new Redis(REDIS_CACHE_URL);

// Log de errores del cliente Redis
redisClient.on('error', (err) => {
  console.error('[redis] Error en cliente KV:', err.message);
});
