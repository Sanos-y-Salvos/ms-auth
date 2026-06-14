// Tipos de Express
import { Request, Response } from 'express';

// Capa de servicios (lógica de negocio)
import * as AuthService from '../services/auth.service';

// Helpers de respuesta consistente (ok/data o ok:false/message)
import { successResponse, errorResponse } from '../utils/response';

// Request extendido con el usuario autenticado (poblado por verifyToken)
import { AuthRequest } from '../middlewares/verifyToken';

// RF-01 — Inicio de sesión: valida credenciales y emite tokens
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    // Validación mínima: campos obligatorios
    if (!email || !password) { errorResponse(res, 'Email y contraseña requeridos'); return; }
    const data = await AuthService.login(email, password);
    successResponse(res, data);
  } catch (err: any) {
    // Cualquier error en login se traduce como 401 (credenciales inválidas)
    errorResponse(res, err.message, 401);
  }
};

// RF-02 — Renovación de sesión usando refresh token (rota el refresh emitido)
export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) { errorResponse(res, 'Refresh token requerido'); return; }
    const data = await AuthService.refreshSession(refreshToken);
    successResponse(res, data);
  } catch (err: any) {
    // Token inválido o expirado → 401
    errorResponse(res, err.message, 401);
  }
};

// RF-04 — Cierre de sesión: revoca el access token y elimina el refresh
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    // Se requiere también el access token desde el header Authorization
    const authHeader = req.headers['authorization'];
    const accessToken = authHeader && authHeader.split(' ')[1];

    if (!refreshToken || !accessToken) {
      errorResponse(res, 'Refresh token y Access token requeridos');
      return;
    }

    await AuthService.logout(refreshToken, accessToken);
    successResponse(res, { message: 'Sesión cerrada correctamente' });
  } catch (err: any) {
    errorResponse(res, err.message);
  }
};

// Lista blanca de roles válidos del dominio (sincronizada con ms-users)
const ROLES_VALIDOS = ['ciudadano', 'veterinaria', 'municipalidad', 'moderador', 'administrador', 'superadmin'];

// RF-05 — Registro legacy: el flujo normal crea credenciales vía evento `user.registered`
// Este endpoint queda como herramienta interna de emergencia.
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, role } = req.body;
    // Validaciones de campos y reglas de negocio mínimas
    if (!email || !password) { errorResponse(res, 'Email y contraseña requeridos'); return; }
    if (!role) { errorResponse(res, 'Rol requerido'); return; }
    if (!ROLES_VALIDOS.includes(role)) { errorResponse(res, 'Rol inválido'); return; }
    if (password.length < 6) { errorResponse(res, 'La contraseña debe tener al menos 6 caracteres'); return; }
    const data = await AuthService.register(email, password, role);
    // 201: recurso creado
    successResponse(res, data, 201);
  } catch (err: any) {
    errorResponse(res, err.message);
  }
};

// Interno — Endpoint legacy: actualización manual de rol (emergencia)
export const updateRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { role } = req.body;
    if (!role) { errorResponse(res, 'Rol requerido'); return; }
    if (!ROLES_VALIDOS.includes(role)) { errorResponse(res, 'Rol inválido'); return; }
    await AuthService.updateRole(id, role);
    // Línea de auditoría: queda en logs para trazabilidad de cambios sensibles
    console.log(`[AUDIT] ${new Date().toISOString()} — rol actualizado id=${id} nuevo_rol=${role}`);
    successResponse(res, { message: 'Rol actualizado correctamente' });
  } catch (err: any) {
    errorResponse(res, err.message);
  }
};

// Interno — Desactivación manual de credencial (emergencia)
export const deactivateCredential = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await AuthService.deactivateCredential(id);
    // Auditoría de la desactivación
    console.log(`[AUDIT] ${new Date().toISOString()} — credencial desactivada id=${id}`);
    successResponse(res, { message: 'Credencial desactivada correctamente' });
  } catch (err: any) {
    // 404 si la credencial no existe
    errorResponse(res, err.message, 404);
  }
};

// Perfil del usuario autenticado, leído desde el caché Redis (fallback a BD en el servicio)
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // verifyToken garantiza que req.user existe en este punto
    const data = await AuthService.getMe(req.user!.id);
    successResponse(res, data);
  } catch (err: any) {
    // Respeta el status que pueda venir del servicio (ej. 404 si no se encuentra)
    errorResponse(res, err.message, err.status ?? 500);
  }
};

// Interno — Eliminación de credencial (usado como rollback de registro fallido)
export const deleteCredential = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await AuthService.deleteCredential(id);
    successResponse(res, { message: 'Credencial eliminada correctamente' });
  } catch (err: any) {
    errorResponse(res, err.message);
  }
};

// Interno — Resolución de credential_id a partir de email
// (usado por otros microservicios como ms-soporte para vincular tickets)
export const getCredentialByEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) { errorResponse(res, 'Email requerido'); return; }
    const data = await AuthService.getCredentialByEmail(email);
    // Si no existe, se devuelve objeto vacío para no exponer si el email está registrado
    successResponse(res, data ?? {});
  } catch (err: any) {
    errorResponse(res, err.message);
  }
};
