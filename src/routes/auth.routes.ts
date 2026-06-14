// Router principal del microservicio de autenticación
import { Router } from 'express';

// Controladores: implementan la lógica de cada endpoint
import * as AuthController from '../controllers/auth.controller';

// Middlewares de seguridad: x-api-key para internos, JWT para usuarios
import { internalAuth } from '../middlewares/internalAuth';
import { verifyToken } from '../middlewares/verifyToken';

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registro de credenciales (interno — emergencia)
 *     tags: [Auth]
 *     description: Endpoint interno legacy. Desde v2.0.0 las credenciales se crean automáticamente al consumir el evento `user.registered` del broker. Solo usar como herramienta administrativa si el evento se pierde o se necesita reparación manual.
 *     parameters:
 *       - in: header
 *         name: x-api-key
 *         required: true
 *         schema:
 *           type: string
 *         description: API key interna compartida entre microservicios
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, role]
 *             properties:
 *               email:
 *                 type: string
 *                 example: test@sanos.cl
 *               password:
 *                 type: string
 *                 example: "123456"
 *               role:
 *                 type: string
 *                 example: ciudadano
 *                 enum: [ciudadano, veterinaria, municipalidad, moderador, administrador, superadmin]
 *     responses:
 *       201:
 *         description: Credenciales creadas exitosamente
 *       400:
 *         description: El correo ya está registrado
 */
// Registro manual (legacy) — protegido con API key interna
router.post('/register', internalAuth, AuthController.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Inicio de sesión (RF-01)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: test@sanos.cl
 *               password:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Login exitoso, retorna accessToken y refreshToken
 *       401:
 *         description: Credenciales inválidas
 */
// Login público (RF-01)
router.post('/login', AuthController.login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Renovación de sesión (RF-02)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: uuid-del-refresh-token
 *     responses:
 *       200:
 *         description: Nuevo accessToken generado
 *       401:
 *         description: Refresh token inválido o expirado
 */
// Renovación de sesión (RF-02) — rota el refresh token
router.post('/refresh', AuthController.refresh);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Cierre de sesión (RF-04)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: uuid-del-refresh-token
 *     responses:
 *       200:
 *         description: Sesión cerrada correctamente
 *       400:
 *         description: Refresh token y Access token requeridos
 */
// Logout (RF-04) — revoca el access token y elimina el refresh
router.post('/logout', AuthController.logout);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Obtener perfil del usuario autenticado (desde caché Redis)
 *     tags: [Auth]
 *     description: Devuelve los datos de perfil cacheados en Redis. Funciona aunque ms-users esté caído.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos del perfil
 *       401:
 *         description: Token requerido o inválido
 *       404:
 *         description: Usuario no encontrado
 */
// Perfil del usuario autenticado — protegido por JWT
router.get('/me', verifyToken, AuthController.getMe);

/**
 * @swagger
 * /api/auth/credentials/{id}/role:
 *   patch:
 *     summary: Actualizar rol de credencial (interno — emergencia)
 *     tags: [Auth]
 *     description: Endpoint interno legacy. Desde v2.0.0 los cambios de rol se sincronizan automáticamente vía evento `user.updated` del broker. Solo usar como herramienta administrativa de emergencia.
 *     parameters:
 *       - in: header
 *         name: x-api-key
 *         required: true
 *         schema:
 *           type: string
 *         description: API key interna compartida entre microservicios
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: UUID de la credencial
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 example: moderador
 *                 enum: [ciudadano, veterinaria, municipalidad, moderador, administrador, superadmin]
 *     responses:
 *       200:
 *         description: Rol actualizado correctamente
 *       404:
 *         description: Credencial no encontrada
 */
// Actualización manual de rol (legacy) — protegido con API key interna
router.patch('/credentials/:id/role', internalAuth, AuthController.updateRole);

/**
 * @swagger
 * /api/auth/credentials/{id}/deactivate:
 *   patch:
 *     summary: Desactivar credencial (interno — emergencia)
 *     tags: [Auth]
 *     description: Endpoint interno legacy. Desde v2.0.0 las desactivaciones se sincronizan automáticamente vía evento `user.deleted` del broker. Solo usar como herramienta administrativa de emergencia.
 *     parameters:
 *       - in: header
 *         name: x-api-key
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Credencial desactivada correctamente
 *       404:
 *         description: Credencial no encontrada
 */
// Desactivación manual (legacy) — protegido con API key interna
router.patch('/credentials/:id/deactivate', internalAuth, AuthController.deactivateCredential);

/**
 * @swagger
 * /api/auth/credentials/{id}:
 *   delete:
 *     summary: Eliminar credencial (interno — emergencia)
 *     tags: [Auth]
 *     description: Endpoint interno. Herramienta administrativa de emergencia para eliminar una credencial huérfana. Desde v2.0.0, ms-users es fuente de verdad y NO hace rollback automático; los eventos quedan en cola y se procesan al recuperar conexión.
 *     parameters:
 *       - in: header
 *         name: x-api-key
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Credencial eliminada correctamente
 */
// Eliminación física (rollback) — protegido con API key interna
router.delete('/credentials/:id', internalAuth, AuthController.deleteCredential);

/**
 * @swagger
 * /api/auth/interno/por-email:
 *   post:
 *     summary: Buscar credential_id por email (interno)
 *     tags: [Auth]
 *     description: Endpoint interno. Usado por otros microservicios (ms-soporte) para resolver el credential_id a partir del email del usuario.
 *     parameters:
 *       - in: header
 *         name: x-api-key
 *         required: true
 *         schema:
 *           type: string
 *         description: API key interna compartida entre microservicios
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 example: test@sanos.cl
 *     responses:
 *       200:
 *         description: Credential encontrada (o objeto vacío si no existe)
 *       400:
 *         description: Email requerido
 *       403:
 *         description: Acceso no autorizado (x-api-key inválida)
 */
// Lookup interno por email (lo usa ms-soporte para vincular tickets)
router.post('/interno/por-email', internalAuth, AuthController.getCredentialByEmail);

export default router;
