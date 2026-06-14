// Middleware "catch-all" para rutas no registradas
import { Request, Response } from 'express';

// Se monta al final de la cadena; cualquier petición que no haya matcheado
// una ruta válida cae acá y responde 404 con un mensaje consistente.
export const notFound = (_req: Request, res: Response) => {
  res.status(404).json({ ok: false, message: 'Ruta no encontrada' });
};
