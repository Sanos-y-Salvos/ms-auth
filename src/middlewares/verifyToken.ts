import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/db';
import { RevokedToken } from '../models/RevokedToken';

export interface AuthRequest extends Request {
  user?: { id: string; email: string; role: string };
}

export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ ok: false, message: 'Token requerido' });
    return;
  }

  // Verificar si el token está revocado en PostgreSQL
  const revokedTokenRepo = AppDataSource.getRepository(RevokedToken);
  const revokedToken = await revokedTokenRepo.findOne({ where: { token } });
  if (revokedToken) {
    if (revokedToken.expires_at > new Date()) {
      res.status(401).json({ ok: false, message: 'Token revocado' });
      return;
    }
    await revokedTokenRepo.delete({ token });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: string; email: string; role: string;
    };
    req.user = decoded;
    next();
  } catch {
    res.status(403).json({ ok: false, message: 'Token inválido o expirado' });
  }
};
