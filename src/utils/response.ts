import { Response } from 'express';

export const successResponse = (res: Response, data: object, status = 200) => {
  return res.status(status).json({ ok: true, data });
};

export const errorResponse = (res: Response, message: string, status = 400) => {
  return res.status(status).json({ ok: false, message });
};