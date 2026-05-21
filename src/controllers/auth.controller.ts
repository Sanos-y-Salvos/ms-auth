import { Request, Response } from 'express';
import * as AuthService from '../services/auth.service';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../middlewares/verifyToken';

// RF-01
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) { errorResponse(res, 'Email y contraseña requeridos'); return; }
    const data = await AuthService.login(email, password);
    successResponse(res, data);
  } catch (err: any) {
    errorResponse(res, err.message, 401);
  }
};

// RF-02
export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) { errorResponse(res, 'Refresh token requerido'); return; }
    const data = await AuthService.refreshSession(refreshToken);
    successResponse(res, data);
  } catch (err: any) {
    errorResponse(res, err.message, 401);
  }
};

// RF-04
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
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

const ROLES_VALIDOS = ['ciudadano', 'veterinaria', 'municipalidad', 'moderador', 'administrador', 'superadmin'];

// RF-05 — Endpoint legacy: el flujo normal crea credenciales vía evento `user.registered` del broker
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) { errorResponse(res, 'Email y contraseña requeridos'); return; }
    if (!role) { errorResponse(res, 'Rol requerido'); return; }
    if (!ROLES_VALIDOS.includes(role)) { errorResponse(res, 'Rol inválido'); return; }
    if (password.length < 6) { errorResponse(res, 'La contraseña debe tener al menos 6 caracteres'); return; }
    const data = await AuthService.register(email, password, role);
    successResponse(res, data, 201);
  } catch (err: any) {
    errorResponse(res, err.message);
  }
};

// Interno — Endpoint legacy de emergencia
export const updateRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { role } = req.body;
    if (!role) { errorResponse(res, 'Rol requerido'); return; }
    if (!ROLES_VALIDOS.includes(role)) { errorResponse(res, 'Rol inválido'); return; }
    await AuthService.updateRole(id, role);
    console.log(`[AUDIT] ${new Date().toISOString()} — rol actualizado id=${id} nuevo_rol=${role}`);
    successResponse(res, { message: 'Rol actualizado correctamente' });
  } catch (err: any) {
    errorResponse(res, err.message);
  }
};

// Interno — Desactivar credencial
export const deactivateCredential = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await AuthService.deactivateCredential(id);
    console.log(`[AUDIT] ${new Date().toISOString()} — credencial desactivada id=${id}`);
    successResponse(res, { message: 'Credencial desactivada correctamente' });
  } catch (err: any) {
    errorResponse(res, err.message, 404);
  }
};

// Perfil del usuario autenticado (desde Redis)
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = await AuthService.getMe(req.user!.id);
    successResponse(res, data);
  } catch (err: any) {
    errorResponse(res, err.message, err.status ?? 500);
  }
};

// Interno — Eliminar credencial (rollback)
export const deleteCredential = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await AuthService.deleteCredential(id);
    successResponse(res, { message: 'Credencial eliminada correctamente' });
  } catch (err: any) {
    errorResponse(res, err.message);
  }
};
// Interno — Buscar credential_id por email
export const getCredentialByEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) { errorResponse(res, 'Email requerido'); return; }
    const data = await AuthService.getCredentialByEmail(email);
    successResponse(res, data ?? {});
  } catch (err: any) {
    errorResponse(res, err.message);
  }
};
