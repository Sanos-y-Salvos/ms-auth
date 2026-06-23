// Mock de jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

// Mock del DataSource: usamos una fábrica de repos controlable por test
const revokedRepo = {
  findOne: jest.fn(),
  delete: jest.fn(),
};
jest.mock('../../config/db', () => ({
  AppDataSource: {
    getRepository: jest.fn(() => revokedRepo),
  },
}));

import jwt from 'jsonwebtoken';
import { verifyToken } from '../../middlewares/verifyToken';

const buildRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('middlewares/verifyToken', () => {
  const ORIGINAL_ENV = process.env;
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, JWT_SECRET: 'test-secret' };
    revokedRepo.findOne.mockReset();
    revokedRepo.delete.mockReset();
    (jwt.verify as jest.Mock).mockReset();
  });
  afterAll(() => { process.env = ORIGINAL_ENV; });

  it('responde 401 si no hay header Authorization', async () => {
    const req: any = { headers: {} };
    const res = buildRes();
    const next = jest.fn();
    await verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'Token requerido' });
    expect(next).not.toHaveBeenCalled();
  });

  it('responde 401 si el token está revocado y vigente', async () => {
    revokedRepo.findOne.mockResolvedValue({
      token: 't',
      expires_at: new Date(Date.now() + 60_000),
    });
    const req: any = { headers: { authorization: 'Bearer t' } };
    const res = buildRes();
    const next = jest.fn();
    await verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'Token revocado' });
    expect(next).not.toHaveBeenCalled();
  });

  it('purga un revoked vencido y continúa la verificación', async () => {
    revokedRepo.findOne.mockResolvedValue({
      token: 't',
      expires_at: new Date(Date.now() - 60_000),
    });
    (jwt.verify as jest.Mock).mockReturnValue({ id: '1', email: 'a@b.cl', role: 'ciudadano' });

    const req: any = { headers: { authorization: 'Bearer t' } };
    const res = buildRes();
    const next = jest.fn();

    await verifyToken(req, res, next);
    expect(revokedRepo.delete).toHaveBeenCalledWith({ token: 't' });
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: '1', email: 'a@b.cl', role: 'ciudadano' });
  });

  it('inyecta req.user y llama a next() con token válido', async () => {
    revokedRepo.findOne.mockResolvedValue(null);
    (jwt.verify as jest.Mock).mockReturnValue({ id: '1', email: 'a@b.cl', role: 'ciudadano' });

    const req: any = { headers: { authorization: 'Bearer ok' } };
    const res = buildRes();
    const next = jest.fn();

    await verifyToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: '1', email: 'a@b.cl', role: 'ciudadano' });
  });

  it('responde 401 si jwt.verify lanza error', async () => {
    revokedRepo.findOne.mockResolvedValue(null);
    (jwt.verify as jest.Mock).mockImplementation(() => { throw new Error('expired'); });

    const req: any = { headers: { authorization: 'Bearer mal' } };
    const res = buildRes();
    const next = jest.fn();

    await verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'Token inválido o expirado' });
    expect(next).not.toHaveBeenCalled();
  });
});
