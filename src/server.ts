import 'reflect-metadata';
import app from './app';
import { AppDataSource } from './config/db';
import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT || 3001;

AppDataSource.initialize()
  .then(() => {
    console.log('✅ Conexión a PostgreSQL establecida');
    app.listen(PORT, () => {
      console.log(`🚀 MS-Auth corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Error al conectar la base de datos:', err);
  });

// Autenticación con JWT #4
// Refresh Token y Renovación #5
// Recuperación de Contraseña #6
// Cierre de Sesión (Logout) #7