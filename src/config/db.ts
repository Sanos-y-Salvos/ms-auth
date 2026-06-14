// DataSource de TypeORM: punto único de conexión a PostgreSQL
import { DataSource } from 'typeorm';

// Entidades que TypeORM debe mapear a tablas
import { Credential } from '../models/Credential';
import { RefreshToken } from '../models/RefreshToken';
import { RevokedToken } from '../models/RevokedToken';

// Carga del .env para poder usar process.env en este módulo
import dotenv from 'dotenv';
dotenv.config();

// Configuración del DataSource. synchronize:true mantiene el esquema en
// sintonía con las entidades durante desarrollo (no recomendado en producción).
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  synchronize: true,
  logging: false,
  entities: [Credential, RefreshToken, RevokedToken],
});
