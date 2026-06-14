import { successResponse, errorResponse } from '../../src/utils/response';

// Mock mínimo del Response de Express con encadenamiento status().json()
const buildRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('utils/response', () => {
  describe('successResponse', () => {
    it('devuelve 200 por defecto con { ok: true, data }', () => {
      const res = buildRes();
      const payload = { id: 'abc' };
      successResponse(res, payload);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ ok: true, data: payload });
    });

    it('respeta el status explícito', () => {
      const res = buildRes();
      successResponse(res, { x: 1 }, 201);
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('errorResponse', () => {
    it('devuelve 400 por defecto con { ok: false, message }', () => {
      const res = buildRes();
      errorResponse(res, 'algo falló');
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'algo falló' });
    });

    it('respeta el status explícito', () => {
      const res = buildRes();
      errorResponse(res, 'no autorizado', 401);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
