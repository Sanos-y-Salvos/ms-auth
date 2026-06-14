// Helpers para estandarizar las respuestas HTTP del microservicio
import { Response } from 'express';

// Respuesta de éxito: { ok: true, data: ... } con el status indicado (200 por defecto)
export const successResponse = (res: Response, data: object, status = 200) => {
  return res.status(status).json({ ok: true, data });
};

// Respuesta de error: { ok: false, message: ... } con el status indicado (400 por defecto)
export const errorResponse = (res: Response, message: string, status = 400) => {
  return res.status(status).json({ ok: false, message });
};
