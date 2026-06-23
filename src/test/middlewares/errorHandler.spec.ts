import { errorHandler } from '../../middlewares/errorHandler';

const buildRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('middlewares/errorHandler', () => {
  // Silencia console.error para no contaminar la salida del runner
  let consoleSpy: jest.SpyInstance;
  beforeEach(() => { consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { consoleSpy.mockRestore(); });

  it('responde 500 con mensaje genérico', () => {
    const res = buildRes();
    const err = new Error('boom');
    errorHandler(err, {} as any, res as any, jest.fn() as any);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'Error interno del servidor' });
  });

  it('loguea el stack del error', () => {
    const res = buildRes();
    const err = new Error('detalle');
    errorHandler(err, {} as any, res as any, jest.fn() as any);
    expect(consoleSpy).toHaveBeenCalled();
  });
});
