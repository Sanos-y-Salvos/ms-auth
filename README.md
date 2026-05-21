# MS-Auth — Sanos y Salvos

Microservicio de **autenticación** de la plataforma **Sanos y Salvos**. Su única responsabilidad es validar credenciales, emitir tokens JWT y gestionar el ciclo de vida de las sesiones. Mantiene una **réplica local de credenciales** sincronizada vía broker desde `ms-users`, lo que le permite autenticar usuarios incluso cuando `ms-users` está caído.

---

## Responsabilidades

| Sí hace | No hace |
|---|---|
| Login y emisión de tokens | Registrar usuarios (lo hace ms-users) |
| Refresh de Access Token | Cambiar contraseña (lo hace ms-users) |
| Logout y revocación | Recuperar contraseña por OTP (lo hace ms-users) |
| Servir perfil cacheado (`/me`) | Editar datos de perfil (lo hace ms-users) |
| Mantener réplica de credenciales | Ser fuente de verdad de datos de usuario |

---

## Tecnologías

| Herramienta | Uso |
|---|---|
| Node.js 20 | Entorno de ejecución |
| Express 5 | Servidor HTTP |
| TypeScript 5 | Tipado estático |
| PostgreSQL 16 | Persistencia de credenciales y tokens |
| TypeORM 0.3 | ORM y sincronización de esquema |
| Bull + Redis | Cola de eventos desde ms-users (broker) |
| ioredis | Cliente Redis para caché KV de perfiles |
| jsonwebtoken | Generación y verificación de Access Tokens JWT |
| bcrypt | Verificación de contraseñas |
| Swagger / OpenAPI 3.0 | Documentación interactiva |
| Docker | Contenerización |

---

## Arquitectura

### Patrón de arquitectura

**Arquitectura en capas + Event-Driven (consumidor)**

```
src/routes/ → src/controllers/ → src/services/ → src/models/
                                        ↑
                                src/queue/consumers (eventos del broker)
```

- **Capas**: cada capa solo conoce la inmediatamente inferior. Las rutas reciben HTTP, los controllers validan, los services aplican lógica de negocio, los models persisten.
- **Event-Driven**: `ms-auth` consume eventos publicados por `ms-users` (`user.registered`, `user.updated`, `user.deleted`, `user.password.changed`) sin necesidad de llamar HTTP directo, lo que lo hace independiente del ciclo de vida de `ms-users`.

### Patrones de diseño

| Patrón | Ubicación | Propósito |
|---|---|---|
| **Repository** (via TypeORM) | `AppDataSource.getRepository(Entidad)` | Encapsular acceso a BD, desacoplar del motor SQL |
| **Factory Method** | `src/factories/CredentialFactory.ts` | Centralizar construcción de credenciales y refresh tokens |
| **Singleton** | `src/config/db.ts`, `src/config/redis.ts` | Una sola conexión a PG, una sola cola Bull, un solo cliente Redis KV |

### Comunicación con otros microservicios

```
ms-users  ──▶ user.registered        ──▶ ms-auth crea Credential réplica
ms-users  ──▶ user.updated           ──▶ ms-auth actualiza cached_data
ms-users  ──▶ user.deleted           ──▶ ms-auth marca como inactiva
ms-users  ──▶ user.password.changed  ──▶ ms-auth actualiza password_hash
```

`ms-auth` **nunca** llama HTTP a `ms-users`. Toda la sincronización es asíncrona vía broker.

---

## Requisitos previos

- Node.js 20+
- PostgreSQL 16+
- Redis (broker)

---

## Variables de entorno

Archivo `.env` en la raíz:

```env
PORT=3001

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=ms_auth

# Redis broker (cola compartida con ms-users)
REDIS_BROKER_URL=redis://localhost:6379

# Redis cache propio (perfiles cacheados para /me)
REDIS_CACHE_URL=redis://localhost:6379

# JWT — debe coincidir con ms-users
JWT_SECRET=tu_secreto_minimo_64_caracteres

# API key interna — debe coincidir con ms-users
INTERNAL_API_KEY=clave_compartida_con_ms_users

NODE_ENV=development
```

> `JWT_SECRET` e `INTERNAL_API_KEY` deben ser **idénticos** a los de `ms-users`.

---

## Instalación y ejecución

```bash
git clone <url-del-repositorio>
cd ms-auth
npm install

# Desarrollo (hot reload)
npm run dev

# Producción
npm run build && npm start
```

La base de datos se crea automáticamente al iniciar si no existe (`ensureDatabase()` en `server.ts`).

### Con Docker

```bash
cd ms-auth
docker compose up -d
```

Levanta:
- PostgreSQL propio (`ms-auth-db`)
- Redis KV propio (`ms-auth-redis`)
- Servicio `ms-auth`

> Requiere que el `broker` esté corriendo previamente.

---

## Documentación interactiva

```
http://localhost:3001/api/docs
```

---

## Endpoints

### Públicos

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/login` | Login. Devuelve `accessToken` + `refreshToken` |
| `POST` | `/api/auth/refresh` | Renueva el accessToken usando un refreshToken válido |
| `POST` | `/api/auth/logout` | Cierra sesión y revoca ambos tokens |

### Autenticados (Bearer Token)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/auth/me` | Perfil del usuario autenticado (desde caché Redis) |

### Internos (header `x-api-key`)

Endpoints administrativos protegidos por `x-api-key`. **Desde v2.0.0** la sincronización normal entre microservicios viaja por el **broker** (eventos), por lo que la mayoría de estos endpoints son **herramientas legacy de emergencia** para reparación manual cuando un evento se pierde.

| Método | Ruta | Uso |
|---|---|---|
| `POST` | `/api/auth/register` | Legacy — credenciales se crean vía evento `user.registered` |
| `PATCH` | `/api/auth/credentials/:id/role` | Legacy — rol se sincroniza vía evento `user.updated` |
| `PATCH` | `/api/auth/credentials/:id/deactivate` | Legacy — desactivación vía evento `user.deleted` |
| `DELETE` | `/api/auth/credentials/:id` | Emergencia — eliminar credencial huérfana |
| `POST` | `/api/auth/interno/por-email` | **Activo** — usado por ms-soporte para resolver `credential_id` por email |

---

## Postman — Listo para probar

> **URL base:** `http://localhost:3001`

### Variables de entorno sugeridas

En Postman, crea una environment con:

| Variable | Valor inicial |
|---|---|
| `baseUrl` | `http://localhost:3001` |
| `accessToken` | _(vacío — se completa tras login)_ |
| `refreshToken` | _(vacío — se completa tras login)_ |

> **Tip:** En la pestaña **Tests** del request de login, pega esto para guardar tokens automáticamente en la environment:
> ```javascript
> const res = pm.response.json();
> pm.environment.set("accessToken", res.data.accessToken);
> pm.environment.set("refreshToken", res.data.refreshToken);
> ```

### 1. Login

```http
POST {{baseUrl}}/api/auth/login
Content-Type: application/json
```

```json
{
  "email": "fe.ruizr@duocuc.cl",
  "password": "123456q"
}
```

### 2. Ver perfil autenticado

```http
GET {{baseUrl}}/api/auth/me
Authorization: Bearer {{accessToken}}
```

_(Sin body)_

### 3. Refresh Token

```http
POST {{baseUrl}}/api/auth/refresh
Content-Type: application/json
```

```json
{
  "refreshToken": "{{refreshToken}}"
}
```

### 4. Logout

```http
POST {{baseUrl}}/api/auth/logout
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```

```json
{
  "refreshToken": "{{refreshToken}}"
}
```

### 5. Buscar credencial por email (interno)

```http
POST {{baseUrl}}/api/auth/interno/por-email
x-api-key: {{INTERNAL_API_KEY}}
Content-Type: application/json
```

```json
{
  "email": "fe.ruizr@duocuc.cl"
}
```

---

## Modelo de datos

### Tabla `credentials`

Réplica local de las credenciales. La fuente de verdad es `ms-users.users`; este servicio mantiene una copia sincronizada vía eventos para poder autenticar sin depender de ms-users.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID (PK) | Mismo UUID que `users.credential_id` en ms-users |
| `email` | string único | Correo del usuario |
| `password_hash` | string | Hash bcrypt sincronizado desde ms-users |
| `role` | string | Rol replicado |
| `permissions` | string[] | Permisos replicados |
| `cached_data` | jsonb | Snapshot del perfil (nombre, avatar, tipo) |
| `status` | string | `active` / `inactive` |
| `is_active` | boolean | Estado de la cuenta |
| `created_at` | timestamp | — |
| `updated_at` | timestamp | — |

### Tabla `refresh_tokens`

| Campo | Tipo | Descripción |
|---|---|---|
| `token` | UUID (PK) | Refresh token |
| `credential_id` | UUID | FK lógica a `credentials.id` |
| `expires_at` | timestamptz | TTL 7 días |
| `created_at` | timestamp | — |

### Tabla `revoked_tokens`

| Campo | Tipo | Descripción |
|---|---|---|
| `token` | text (PK) | Access Token revocado |
| `expires_at` | timestamptz | Expiración original del JWT |
| `created_at` | timestamp | Fecha de revocación |

---

## Estructura del proyecto

```
ms-auth/
├── src/
│   ├── config/
│   │   ├── db.ts                   # Conexión PostgreSQL + TypeORM (Singleton)
│   │   ├── redis.ts                # Cola Bull + cliente Redis KV (Singleton)
│   │   └── swagger.ts              # Configuración OpenAPI 3.0
│   ├── controllers/
│   │   └── auth.controller.ts      # Handlers HTTP
│   ├── factories/
│   │   └── CredentialFactory.ts    # Factory para crear credenciales y refresh tokens
│   ├── middlewares/
│   │   ├── errorHandler.ts
│   │   ├── internalAuth.ts         # Verificación x-api-key para endpoints internos
│   │   ├── notFound.ts
│   │   └── verifyToken.ts          # Verificación JWT
│   ├── models/
│   │   ├── Credential.ts
│   │   ├── RefreshToken.ts
│   │   └── RevokedToken.ts
│   ├── queue/
│   │   └── consumers.ts            # Consumers de eventos desde ms-users
│   ├── routes/
│   │   └── auth.routes.ts
│   ├── services/
│   │   ├── auth.service.ts         # Lógica de autenticación
│   │   ├── types.ts                # Tipado de payloads de eventos
│   │   └── user-cache.service.ts   # Sincronización desde eventos del broker
│   ├── utils/
│   │   └── response.ts             # Helpers de respuesta HTTP estandarizada
│   ├── app.ts
│   └── server.ts                   # Entry point — crea BD si no existe, levanta consumers
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

---

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Hot reload con nodemon + ts-node |
| `npm run build` | Compila TypeScript a `/dist` |
| `npm start` | Ejecuta la versión compilada |
| `docker compose up -d` | Levanta ms-auth + PG + Redis KV |
| `docker compose down -v` | Detiene y limpia datos |

---

## Flujo de un login completo

```
1. Cliente → POST /api/auth/login (email, password)
2. ms-auth busca Credential.email en su réplica local (PG)
3. ms-auth verifica password_hash con bcrypt
4. ms-auth emite accessToken (15 min) y refreshToken (7 días)
5. ms-auth consulta perfil cacheado en Redis (user:<id>)
6. Cliente recibe tokens + perfil
```

Si Redis cache está vacío, ms-auth reconstruye el perfil desde el campo `cached_data` de PostgreSQL — sigue siendo operativo aunque ms-users esté caído.

---

## Crear el primer superadmin

Como `ms-users` es la fuente de verdad del rol en v2.0.0, el procedimiento completo está documentado en **[ms-users/README.md → Crear el primer superadmin](../ms-users/README.md#crear-el-primer-superadmin-con-docker-corriendo)**.

Resumen del flujo:

1. Registrar usuario normal vía `POST /api/users/register/ciudadano`
2. `UPDATE users SET rol='superadmin'` en `ms-users-db`
3. `UPDATE credentials SET role='superadmin'` en `ms-auth-db` (réplica)
4. `FLUSHDB` en `ms-auth-redis` para invalidar caché

---

## Diagnóstico

| Síntoma | Causa probable | Solución |
|---|---|---|
| `Credenciales inválidas` siempre | Réplica desincronizada | Verificar logs del consumer: `[consumer] user.registered recibido` |
| `Token inválido o expirado` | Access token expiró (15 min) | Hacer refresh |
| ms-auth no procesa eventos | Broker no levantado | Levantar `broker/` antes |
| `password.changed` no se aplica | Consumer no registrado | Verificar `src/queue/consumers.ts` |
