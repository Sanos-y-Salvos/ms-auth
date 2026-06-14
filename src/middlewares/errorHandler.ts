// Middleware terminal de Express para errores no controlados
import { Request, Response, NextFunction } from 'express';

// Captura cualquier excepción que no haya sido manejada en los controladores.
// Loguea el stack completo y devuelve un 500 genérico para no filtrar detalles.
export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ ok: false, message: 'Error interno del servidor' });
};
