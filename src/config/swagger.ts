// Generador de la spec OpenAPI a partir de comentarios JSDoc en las rutas
import swaggerJsdoc from 'swagger-jsdoc';

// Configuración base de la documentación OpenAPI
const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MS-Auth — Sanos y Salvos',
      version: '2.0.0',
      description:
        'Microservicio de autenticación: login, refresh, logout y perfil cacheado. Mantiene una réplica de credenciales sincronizada desde ms-users vía broker.',
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Servidor de desarrollo',
      },
    ],
    components: {
      // Esquema de seguridad Bearer JWT, referenciable en cada ruta
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  // En producción la doc se lee del JS compilado; en desarrollo, del TS fuente
  apis: process.env.NODE_ENV === 'production'
    ? ['./dist/routes/*.js']
    : ['./src/routes/*.ts'],
};

// Exporta la spec compilada lista para servir con swagger-ui-express
export default swaggerJsdoc(options);
