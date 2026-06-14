// Middleware para proteger endpoints internos (comunicación entre microservicios)
import { Request, Response, NextFunction } from 'express';

// Valida el header x-api-key contra la API key compartida entre microservicios.
// Si falta o no coincide, corta la cadena con 403 sin pasar a la siguiente capa.
export const internalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'];

  // Comparación directa contra la variable de entorno INTERNAL_API_KEY
  if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
    res.status(403).json({ ok: false, message: 'Acceso no autorizado' });
    return;
  }

  // Si la API key es válida, continúa con el siguiente middleware/handler
  next();
};
