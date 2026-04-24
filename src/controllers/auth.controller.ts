import { Request, Response } from 'express';
import * as AuthService from '../services/auth.service';
import { successResponse, errorResponse } from '../utils/response';

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

// RF-05 — El rol no viene del body, lo determina MS-02
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) { errorResponse(res, 'Email y contraseña requeridos'); return; }
    if (!role) { errorResponse(res, 'Rol requerido'); return; }
    const data = await AuthService.register(email, password, role);
    successResponse(res, data, 201);
  } catch (err: any) {
    errorResponse(res, err.message);
  }
};

// Recuperar contraseña
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) { errorResponse(res, 'Email y nueva contraseña requeridos'); return; }
    if (newPassword.length < 6) { errorResponse(res, 'La contraseña debe tener al menos 6 caracteres'); return; }
    const data = await AuthService.resetPassword(email, newPassword);
    successResponse(res, data);
  } catch (err: any) {
    errorResponse(res, err.message, err.status ?? 400);
  }
};

// Interno — Solo llamado por MS-02
export const updateRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { role } = req.body;
    if (!role) { errorResponse(res, 'Rol requerido'); return; }
    await AuthService.updateRole(id, role);
    successResponse(res, { message: 'Rol actualizado correctamente' });
  } catch (err: any) {
    errorResponse(res, err.message);
  }
};