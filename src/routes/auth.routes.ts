import { Router } from 'express';
import * as AuthController from '../controllers/auth.controller';

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registro de credenciales (RF-05)
 *     tags: [Auth]
 *     description: Llamado exclusivamente por MS-02. El rol es determinado por MS-02 según el tipo de registro.
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
 *                 enum: [ciudadano, veterinaria, municipalidad, moderador, administrador]
 *     responses:
 *       201:
 *         description: Credenciales creadas exitosamente
 *       400:
 *         description: El correo ya está registrado
 */
router.post('/register', AuthController.register);

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
router.post('/logout', AuthController.logout);

/**
 * @swagger
 * /api/auth/credentials/{id}/role:
 *   patch:
 *     summary: Actualizar rol de credencial
 *     tags: [Auth]
 *     description: Endpoint interno. Solo llamado por MS-02 cuando el rol de un usuario cambia.
 *     parameters:
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
 *                 enum: [ciudadano, veterinaria, municipalidad, moderador, administrador]
 *     responses:
 *       200:
 *         description: Rol actualizado correctamente
 *       404:
 *         description: Credencial no encontrada
 */
/**
 * @swagger
 * /api/auth/reset-password:
 *   patch:
 *     summary: Recuperar contraseña
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, newPassword]
 *             properties:
 *               email:
 *                 type: string
 *                 example: test@sanos.cl
 *               newPassword:
 *                 type: string
 *                 example: "nuevapass123"
 *     responses:
 *       200:
 *         description: Contraseña actualizada correctamente
 *       400:
 *         description: Campos requeridos faltantes o contraseña demasiado corta
 *       404:
 *         description: Correo no registrado
 */
router.patch('/reset-password', AuthController.resetPassword);

router.patch('/credentials/:id/role', AuthController.updateRole);

export default router;