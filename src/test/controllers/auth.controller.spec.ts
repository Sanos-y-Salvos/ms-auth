// Mock completo del servicio para aislar el controlador
jest.mock('../../services/auth.service', () => ({
  login: jest.fn(),
  refreshSession: jest.fn(),
  logout: jest.fn(),
  register: jest.fn(),
  updateRole: jest.fn(),
  deactivateCredential: jest.fn(),
  activateCredential: jest.fn(),
  getMe: jest.fn(),
  deleteCredential: jest.fn(),
  getCredentialByEmail: jest.fn(),
}));

import * as AuthService from '../../services/auth.service';
import * as Controller from '../../controllers/auth.controller';

const buildRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('controllers/auth.controller', () => {
  let logSpy: jest.SpyInstance;
  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => { logSpy.mockRestore(); });

  // ============== login ==============
  describe('login', () => {
    it('responde 200 con los datos del servicio', async () => {
      (AuthService.login as jest.Mock).mockResolvedValue({ accessToken: 't' });
      const req: any = { body: { email: 'a@b.cl', password: '123' } };
      const res = buildRes();
      await Controller.login(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ ok: true, data: { accessToken: 't' } });
    });

    it('responde 400 si faltan campos', async () => {
      const req: any = { body: {} };
      const res = buildRes();
      await Controller.login(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('responde 401 si el servicio lanza', async () => {
      (AuthService.login as jest.Mock).mockRejectedValue(new Error('bad'));
      const req: any = { body: { email: 'a@b.cl', password: '123' } };
      const res = buildRes();
      await Controller.login(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  // ============== refresh ==============
  describe('refresh', () => {
    it('responde 200 con los datos del servicio', async () => {
      (AuthService.refreshSession as jest.Mock).mockResolvedValue({ accessToken: 't' });
      const req: any = { body: { refreshToken: 'r' } };
      const res = buildRes();
      await Controller.refresh(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('responde 400 si falta refreshToken', async () => {
      const req: any = { body: {} };
      const res = buildRes();
      await Controller.refresh(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('responde 401 si el servicio lanza', async () => {
      (AuthService.refreshSession as jest.Mock).mockRejectedValue(new Error('expired'));
      const req: any = { body: { refreshToken: 'r' } };
      const res = buildRes();
      await Controller.refresh(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  // ============== logout ==============
  describe('logout', () => {
    it('responde 200 cuando todo sale bien', async () => {
      (AuthService.logout as jest.Mock).mockResolvedValue(undefined);
      const req: any = {
        body: { refreshToken: 'rt' },
        headers: { authorization: 'Bearer at' },
      };
      const res = buildRes();
      await Controller.logout(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('responde 400 si faltan tokens', async () => {
      const req: any = { body: {}, headers: {} };
      const res = buildRes();
      await Controller.logout(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('responde 400 si el servicio lanza', async () => {
      (AuthService.logout as jest.Mock).mockRejectedValue(new Error('x'));
      const req: any = {
        body: { refreshToken: 'rt' },
        headers: { authorization: 'Bearer at' },
      };
      const res = buildRes();
      await Controller.logout(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ============== register ==============
  describe('register', () => {
    it('responde 201 al crear', async () => {
      (AuthService.register as jest.Mock).mockResolvedValue({ id: 'c1' });
      const req: any = { body: { email: 'a@b.cl', password: '123456', role: 'ciudadano' } };
      const res = buildRes();
      await Controller.register(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('responde 400 si faltan email/password', async () => {
      const req: any = { body: { role: 'ciudadano' } };
      const res = buildRes();
      await Controller.register(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('responde 400 si falta rol', async () => {
      const req: any = { body: { email: 'a@b.cl', password: '123456' } };
      const res = buildRes();
      await Controller.register(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('responde 400 si el rol no está en la lista', async () => {
      const req: any = { body: { email: 'a@b.cl', password: '123456', role: 'pirata' } };
      const res = buildRes();
      await Controller.register(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('responde 400 si la contraseña tiene <6 caracteres', async () => {
      const req: any = { body: { email: 'a@b.cl', password: '123', role: 'ciudadano' } };
      const res = buildRes();
      await Controller.register(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('responde 400 si el servicio lanza', async () => {
      (AuthService.register as jest.Mock).mockRejectedValue(new Error('ya existe'));
      const req: any = { body: { email: 'a@b.cl', password: '123456', role: 'ciudadano' } };
      const res = buildRes();
      await Controller.register(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ============== updateRole ==============
  describe('updateRole', () => {
    it('responde 200 cuando se actualiza', async () => {
      (AuthService.updateRole as jest.Mock).mockResolvedValue(undefined);
      const req: any = { params: { id: 'c1' }, body: { role: 'moderador' } };
      const res = buildRes();
      await Controller.updateRole(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('responde 400 si falta el rol', async () => {
      const req: any = { params: { id: 'c1' }, body: {} };
      const res = buildRes();
      await Controller.updateRole(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('responde 400 si el rol no está en la lista', async () => {
      const req: any = { params: { id: 'c1' }, body: { role: 'pirata' } };
      const res = buildRes();
      await Controller.updateRole(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('responde 400 si el servicio lanza', async () => {
      (AuthService.updateRole as jest.Mock).mockRejectedValue(new Error('no'));
      const req: any = { params: { id: 'c1' }, body: { role: 'moderador' } };
      const res = buildRes();
      await Controller.updateRole(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ============== deactivateCredential ==============
  describe('deactivateCredential', () => {
    it('responde 200 cuando se desactiva', async () => {
      (AuthService.deactivateCredential as jest.Mock).mockResolvedValue(undefined);
      const req: any = { params: { id: 'c1' } };
      const res = buildRes();
      await Controller.deactivateCredential(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('responde 404 si el servicio lanza', async () => {
      (AuthService.deactivateCredential as jest.Mock).mockRejectedValue(new Error('no'));
      const req: any = { params: { id: 'c1' } };
      const res = buildRes();
      await Controller.deactivateCredential(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // ============== getMe ==============
  describe('getMe', () => {
    it('responde 200 con los datos del servicio', async () => {
      (AuthService.getMe as jest.Mock).mockResolvedValue({ id: 'c1' });
      const req: any = { user: { id: 'c1' } };
      const res = buildRes();
      await Controller.getMe(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('respeta el status del servicio si viene en el error', async () => {
      const err: any = new Error('not found');
      err.status = 404;
      (AuthService.getMe as jest.Mock).mockRejectedValue(err);
      const req: any = { user: { id: 'x' } };
      const res = buildRes();
      await Controller.getMe(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('default 500 si el error no tiene status', async () => {
      (AuthService.getMe as jest.Mock).mockRejectedValue(new Error('x'));
      const req: any = { user: { id: 'x' } };
      const res = buildRes();
      await Controller.getMe(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ============== deleteCredential ==============
  describe('deleteCredential', () => {
    it('responde 200 al eliminar', async () => {
      (AuthService.deleteCredential as jest.Mock).mockResolvedValue(undefined);
      const req: any = { params: { id: 'c1' } };
      const res = buildRes();
      await Controller.deleteCredential(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('responde 400 si el servicio lanza', async () => {
      (AuthService.deleteCredential as jest.Mock).mockRejectedValue(new Error('x'));
      const req: any = { params: { id: 'c1' } };
      const res = buildRes();
      await Controller.deleteCredential(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ============== getCredentialByEmail ==============
  describe('getCredentialByEmail', () => {
    it('responde 200 con la credencial encontrada', async () => {
      (AuthService.getCredentialByEmail as jest.Mock).mockResolvedValue({ id: 'c1' });
      const req: any = { body: { email: 'a@b.cl' } };
      const res = buildRes();
      await Controller.getCredentialByEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ ok: true, data: { id: 'c1' } });
    });

    it('responde 200 con objeto vacío si no encuentra', async () => {
      (AuthService.getCredentialByEmail as jest.Mock).mockResolvedValue(null);
      const req: any = { body: { email: 'x@x.cl' } };
      const res = buildRes();
      await Controller.getCredentialByEmail(req, res);
      expect(res.json).toHaveBeenCalledWith({ ok: true, data: {} });
    });

    it('responde 400 si falta email', async () => {
      const req: any = { body: {} };
      const res = buildRes();
      await Controller.getCredentialByEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('responde 400 si el servicio lanza', async () => {
      (AuthService.getCredentialByEmail as jest.Mock).mockRejectedValue(new Error('x'));
      const req: any = { body: { email: 'a@b.cl' } };
      const res = buildRes();
      await Controller.getCredentialByEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ============== activateCredential ==============
  describe('activateCredential', () => {
    it('responde 200 al activar una credencial', async () => {
      (AuthService.activateCredential as jest.Mock).mockResolvedValue(undefined);
      const req: any = { params: { id: 'c1' } };
      const res = buildRes();
      await Controller.activateCredential(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });

    it('responde 404 si el servicio lanza', async () => {
      (AuthService.activateCredential as jest.Mock).mockRejectedValue(new Error('Credencial no encontrada'));
      const req: any = { params: { id: 'x' } };
      const res = buildRes();
      await Controller.activateCredential(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
