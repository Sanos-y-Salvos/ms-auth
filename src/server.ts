import 'reflect-metadata';
import { Client } from 'pg';
import app from './app';
import { AppDataSource } from './config/db';
import { startEventConsumers } from './queue/consumers';
import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT || 3001;
const DB_NAME = process.env.DB_NAME || 'ms_auth';

async function ensureDatabase() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
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

ensureDatabase()
  .then(() => AppDataSource.initialize())
  .then(() => {
    console.log('✅ Conexión a PostgreSQL establecida');
    startEventConsumers();
    app.listen(PORT, () => {
      console.log(`🚀 MS-Auth corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Error al iniciar el servidor:', err);
  });
