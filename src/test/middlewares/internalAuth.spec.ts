import { internalAuth } from '../../middlewares/internalAuth';

const buildRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('middlewares/internalAuth', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, INTERNAL_API_KEY: 'secreta-123' };
  });

  afterAll(() => { process.env = ORIGINAL_ENV; });

  it('llama a next() si la api key coincide', () => {
    const req: any = { headers: { 'x-api-key': 'secreta-123' } };
    const res = buildRes();
    const next = jest.fn();
    internalAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('responde 403 si falta la api key', () => {
    const req: any = { headers: {} };
    const res = buildRes();
    const next = jest.fn();
    internalAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'Acceso no autorizado' });
    expect(next).not.toHaveBeenCalled();
  });

  it('responde 403 si la api key no coincide', () => {
    const req: any = { headers: { 'x-api-key': 'otra' } };
    const res = buildRes();
    const next = jest.fn();
    internalAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
