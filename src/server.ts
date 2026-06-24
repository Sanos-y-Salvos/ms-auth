import 'reflect-metadata';
import { Client } from 'pg';
import app from './app';
import { AppDataSource } from './config/db';
import { connectRabbitMQ } from './config/rabbitmq';
import { startEventConsumers } from './queue/consumers';
import { seedAdminCredential } from './seed/adminSeed';
import dotenv from 'dotenv';
dotenv.config();

const PORT   = process.env.PORT    || 3001;
const DB_NAME = process.env.DB_NAME || 'ms_auth';

async function ensureDatabase() {
  const client = new Client({
    host:     process.env.DB_HOST     || 'localhost',
    port:     Number(process.env.DB_PORT) || 5432,
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: 'postgres',
  });
  await client.connect();
  const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [DB_NAME]);
  if (res.rowCount === 0) {
    await client.query(`CREATE DATABASE "${DB_NAME}"`);
    console.log(`🗄️  Base de datos "${DB_NAME}" creada`);
  }
  await client.end();
}

async function connectWithRetry(retries = 10, delayMs = 5000): Promise<void> {
  for (let i = 1; i <= retries; i++) {
    try {
      const channel = await connectRabbitMQ();
      startEventConsumers(channel);
      return;
    } catch (err: any) {
      console.error(`[rabbitmq] Intento ${i}/${retries} fallido: ${err.message}`);
      if (i < retries) await new Promise(r => setTimeout(r, delayMs));
    }
  }
  console.error('[rabbitmq] No se pudo conectar después de varios intentos. El servidor sigue activo sin consumidores.');
}

ensureDatabase()
  .then(() => AppDataSource.initialize())
  .then(async () => {
    console.log('✅ Conexión a PostgreSQL establecida');
    // Seed idempotente: crea la credencial del admin fijo si aún no existe
    await seedAdminCredential();
    app.listen(PORT, () => {
      console.log(`🚀 MS-Auth corriendo en http://localhost:${PORT}`);
    });
    // RabbitMQ en background — no bloquea el arranque del servidor
    connectWithRetry().catch((err) => console.error('[rabbitmq] Error inesperado:', err));
  })
  .catch((err) => {
    console.error('❌ Error al iniciar el servidor:', err);
    process.exit(1);
  });
