// Necesario para los decoradores de TypeORM en las entidades
import 'reflect-metadata';

// Cliente nativo de PostgreSQL: se usa para crear la BD si no existe
import { Client } from 'pg';

// App Express y dependencias propias
import app from './app';
import { AppDataSource } from './config/db';
import { startEventConsumers } from './queue/consumers';

// Carga las variables de entorno desde .env al objeto process.env
import dotenv from 'dotenv';
dotenv.config();

// Configuración leída desde variables de entorno con valores por defecto
const PORT = process.env.PORT || 3001;
const DB_NAME = process.env.DB_NAME || 'ms_auth';

// Verifica que la base de datos exista; si no, la crea
// (TypeORM con synchronize:true solo crea tablas, no la BD en sí)
async function ensureDatabase() {
  // Conectamos a la BD por defecto "postgres" para poder crear la nuestra
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: 'postgres',
  });
  await client.connect();

  // Consulta el catálogo de PostgreSQL para verificar la existencia de la BD
  const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [DB_NAME]);
  if (res.rowCount === 0) {
    // Si no existe, la creamos en caliente al primer arranque
    await client.query(`CREATE DATABASE "${DB_NAME}"`);
    console.log(`🗄️  Base de datos "${DB_NAME}" creada`);
  }
  await client.end();
}

// Secuencia de arranque del microservicio:
// 1) asegurar BD → 2) inicializar TypeORM → 3) iniciar consumidores → 4) escuchar HTTP
ensureDatabase()
  .then(() => AppDataSource.initialize())
  .then(() => {
    console.log('✅ Conexión a PostgreSQL establecida');
    // Suscribe los consumers de eventos de usuario en Bull/Redis
    startEventConsumers();
    app.listen(PORT, () => {
      console.log(`🚀 MS-Auth corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    // Captura cualquier fallo durante el arranque (BD, TypeORM, etc.)
    console.error('❌ Error al iniciar el servidor:', err);
  });
