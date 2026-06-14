// Framework HTTP y middlewares de terceros
import express, { Application } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';

// Configuración y módulos propios
import swaggerSpec from './config/swagger';
import authRoutes from './routes/auth.routes';
import { notFound } from './middlewares/notFound';
import { errorHandler } from './middlewares/errorHandler';

// Instancia principal de Express
const app: Application = express();

// Middlewares globales: CORS, logging HTTP y parseo de body
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Documentación OpenAPI/Swagger disponible en /api/docs
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Endpoint de salud / verificación rápida del microservicio
app.get('/', (_req, res) => {
  res.json({ message: 'MS-Auth operativo ✅' });
});

// Montaje de las rutas de autenticación bajo /api/auth
app.use('/api/auth', authRoutes);

// Manejadores finales: 404 y errores no controlados
app.use(notFound);
app.use(errorHandler);

export default app;
