// Middleware de autenticación JWT
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Acceso a la tabla de tokens revocados
import { AppDataSource } from '../config/db';
import { RevokedToken } from '../models/RevokedToken';

// Extensión del Request de Express para tipar el usuario autenticado
export interface AuthRequest extends Request {
  user?: { id: string; email: string; role: string };
}

// Valida el JWT del header Authorization. Si es válido y no está revocado,
// inyecta el payload en req.user y deja pasar la petición.
export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  // Formato esperado: "Authorization: Bearer <token>"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // Sin token → 401 sin pasar a la siguiente capa
  if (!token) {
    res.status(401).json({ ok: false, message: 'Token requerido' });
    return;
  }

  // Verifica si el token está en la lista de revocados (logout previo)
  const revokedTokenRepo = AppDataSource.getRepository(RevokedToken);
  const revokedToken = await revokedTokenRepo.findOne({ where: { token } });
  if (revokedToken) {
    // Si aún no expiró, es un token revocado vigente → rechazar
    if (revokedToken.expires_at > new Date()) {
      res.status(401).json({ ok: false, message: 'Token revocado' });
      return;
    }
    // Si ya expiró, lo limpiamos para no inflar la tabla
    await revokedTokenRepo.delete({ token });
  }

  try {
    // Verifica firma y expiración del JWT con la clave secreta del entorno
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: string; email: string; role: string;
    };
    // Inyecta los datos del usuario para que los controladores los puedan usar
    req.user = decoded;
    next();
  } catch {
    // Firma inválida, expirado o malformado
    res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
  }
};
