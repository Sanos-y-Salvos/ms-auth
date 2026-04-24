npm run dev

docker compose up --build

docker compose down

# MS-Auth — Sanos y Salvos

Microservicio de autenticación de la plataforma **Sanos y Salvos**. Gestiona el ciclo completo de identidad: registro de credenciales, emisión de tokens JWT, renovación de sesión y cierre de sesión con invalidación inmediata persistida en PostgreSQL.

---

## Tecnologías

| Herramienta | Uso |
|---|---|
| Node.js + Express | Servidor HTTP |
| TypeScript | Tipado estático |
| PostgreSQL + TypeORM | Persistencia de credenciales, refresh tokens y tokens revocados |
| JWT (jsonwebtoken) | Emisión y verificación de tokens |
| bcrypt | Hashing de contraseñas |
| Swagger (OpenAPI 3.0) | Documentación de endpoints |

---

## Requisitos previos

- Node.js 18+
- PostgreSQL 16+

---

## Instalación

```bash
git clone <url-del-repositorio>
cd ms-auth
npm install
```

---

## Variables de entorno

Crea un archivo `.env` en la raíz del proyecto basándote en `.env.example`:

```env
PORT=3001

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=tu_password
DB_NAME=ms_auth

# JWT
JWT_SECRET=tu_secreto_super_seguro
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=tu_secreto_refresh
JWT_REFRESH_EXPIRES_IN=7d

NODE_ENV=development
```

---

## Base de datos

Crea la base de datos en PostgreSQL:

```bash
psql postgres
CREATE DATABASE ms_auth;
\q
```

TypeORM con `synchronize: true` crea las tablas automáticamente al levantar el servidor.

---

## Levantar el servidor

```bash
# Desarrollo
npm run dev

# Producción
npm run build
npm start
```

Salida esperada:
```
✅ Conexión a PostgreSQL establecida
🚀 MS-Auth corriendo en http://localhost:3001
```

---

## Documentación Swagger

Con el servidor corriendo, abre en el navegador:

```
http://localhost:3001/api/docs
```

Desde ahí puedes visualizar y probar todos los endpoints directamente.

---

## Endpoints

| Método | Ruta | RF | Descripción | Auth requerida |
|---|---|---|---|---|
| POST | `/api/auth/register` | RF-05 | Registro de credenciales (llamado por MS-02) | No |
| POST | `/api/auth/login` | RF-01 | Login, emite JWT y Refresh Token | No |
| POST | `/api/auth/refresh` | RF-02 | Renueva el Access Token | No |
| POST | `/api/auth/logout` | RF-04 | Cierra sesión e invalida tokens | Sí |
| PATCH | `/api/auth/credentials/:id/role` | — | Actualiza rol (llamado por MS-02) | No |

---

## Pruebas en Postman

### Prueba 1 — Registro (RF-05)
```
POST http://localhost:3001/api/auth/register
```
Body:
```json
{
    "email": "test@sanos.cl",
    "password": "123456",
    "role": "ciudadano"
}
```
Respuesta esperada:
```json
{
    "ok": true,
    "data": {
        "id": "uuid-generado",
        "email": "test@sanos.cl",
        "role": "ciudadano"
    }
}
```
> Este endpoint es llamado exclusivamente por MS-02, nunca por el frontend directamente.

---

### Prueba 2 — Login (RF-01)
```
POST http://localhost:3001/api/auth/login
```
Body:
```json
{
    "email": "test@sanos.cl",
    "password": "123456"
}
```
Respuesta esperada:
```json
{
    "ok": true,
    "data": {
        "accessToken": "eyJ...",
        "refreshToken": "uuid-generado"
    }
}
```
> Guardar `accessToken` y `refreshToken` para las siguientes pruebas.

---

### Prueba 3 — Refresh (RF-02)
```
POST http://localhost:3001/api/auth/refresh
```
Body:
```json
{
    "refreshToken": "uuid-recibido-en-login"
}
```
Respuesta esperada:
```json
{
    "ok": true,
    "data": {
        "accessToken": "eyJ...nuevo-token"
    }
}
```

---

### Prueba 4 — Logout (RF-04)
```
POST http://localhost:3001/api/auth/logout
```
Header:
```
Authorization: Bearer <accessToken-recibido-en-login>
```
Body:
```json
{
    "refreshToken": "uuid-recibido-en-login"
}
```
Respuesta esperada:
```json
{
    "ok": true,
    "data": {
        "message": "Sesión cerrada correctamente"
    }
}
```

---

### Prueba 5 — Verificar invalidación post-logout
```
POST http://localhost:3001/api/auth/refresh
```
Body:
```json
{
    "refreshToken": "el-mismo-uuid-usado-en-logout"
}
```
Respuesta esperada:
```json
{
    "ok": false,
    "message": "Refresh token inválido o expirado"
}
```

---

### Prueba 6 — Actualizar rol (interno MS-02)
```
PATCH http://localhost:3001/api/auth/credentials/:id/role
```
Body:
```json
{
    "role": "moderador"
}
```
Respuesta esperada:
```json
{
    "ok": true,
    "data": {
        "message": "Rol actualizado correctamente"
    }
}
```
> Este endpoint solo debe ser llamado por MS-02, nunca por el frontend.

---

## Verificación en PostgreSQL

```bash
psql -U postgres -d ms_auth

SELECT token, credential_id, expires_at FROM refresh_tokens;
SELECT expires_at FROM revoked_tokens;
```

---

## Arquitectura de seguridad

El microservicio implementa un sistema de doble invalidación en logout:

| Mecanismo | Qué protege | Dónde vive |
|---|---|---|
| `refresh_tokens.token` | Refresh Token activo | PostgreSQL (`expires_at` a 7 días) |
| `revoked_tokens.token` | Access Token revocado | PostgreSQL (`expires_at` = expiración original del JWT) |

La expiración se valida con la columna `expires_at`; cuando un token vencido se reutiliza, se elimina del registro.

---

## Estructura del proyecto

```
ms-auth/
├── src/
│   ├── config/
│   │   ├── db.ts           # Conexión PostgreSQL + TypeORM
│   │   └── swagger.ts      # Configuración OpenAPI
│   ├── controllers/
│   │   └── auth.controller.ts
│   ├── middlewares/
│   │   ├── errorHandler.ts
│   │   ├── notFound.ts
│   │   └── verifyToken.ts  # Verifica JWT + consulta tokens revocados
│   ├── models/
│   │   ├── Credential.ts   # Entidad de credenciales
│   │   ├── RefreshToken.ts # Refresh tokens activos
│   │   └── RevokedToken.ts # Access tokens revocados
│   ├── routes/
│   │   └── auth.routes.ts  # Rutas + documentación Swagger
│   ├── services/
│   │   └── auth.service.ts # Lógica de negocio
│   ├── utils/
│   │   └── response.ts     # Helpers de respuesta HTTP
│   ├── app.ts
│   └── server.ts
├── .env
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
└── README.md
```

---

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor en modo desarrollo con hot reload |
| `npm run build` | Compila TypeScript a JavaScript |
| `npm start` | Ejecuta la versión compilada |
| `docker-compose up --build` | Levanta todos los servicios en Docker |
| `docker-compose down` | Detiene todos los servicios |
| `docker-compose down -v` | Detiene y elimina volúmenes de datos |

---

## Decisiones técnicas

- **PostgreSQL para tokens:** refresh tokens y revocación se persisten junto a credenciales en el mismo motor, usando `expires_at` para validar vigencia.
- **Rol determinado por MS-02:** el rol no es elegido por el usuario ni asignado por MS-Auth. MS-02 lo determina según el tipo de registro (ciudadano, veterinaria, municipalidad) y se lo comunica a MS-Auth al crear las credenciales. Cuando el rol cambia, MS-02 notifica a MS-Auth vía `PATCH /credentials/:id/role` para mantener el JWT sincronizado.
- **bcrypt con salt 10:** balance entre seguridad y rendimiento para el contexto del proyecto.
- **UUID como identificador:** previene enumeración maliciosa de recursos (IDOR).
