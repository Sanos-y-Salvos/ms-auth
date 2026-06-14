// === Mocks de dependencias externas ===
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  decode: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'uuid-fijo'),
}));

// === Mock de los repos vía AppDataSource.getRepository ===
const credentialRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};
const refreshTokenRepo = {
  findOne: jest.fn(),
  count: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
};
const revokedTokenRepo = {
  upsert: jest.fn(),
};

jest.mock('../../src/config/db', () => ({
  AppDataSource: {
    getRepository: jest.fn((entity: any) => {
      // Discrimina por nombre de la entidad para devolver el mock correcto
      const name = entity?.name ?? entity;
      if (name === 'Credential') return credentialRepo;
      if (name === 'RefreshToken') return refreshTokenRepo;
      if (name === 'RevokedToken') return revokedTokenRepo;
      return {};
    }),
  },
}));

// Caché de usuario mockeado
jest.mock('../../src/services/user-cache.service', () => ({
  getUserCache: jest.fn(),
}));

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as AuthService from '../../src/services/auth.service';
import { getUserCache } from '../../src/services/user-cache.service';

const resetAllRepos = () => {
  Object.values(credentialRepo).forEach((fn: any) => fn.mockReset());
  Object.values(refreshTokenRepo).forEach((fn: any) => fn.mockReset());
  Object.values(revokedTokenRepo).forEach((fn: any) => fn.mockReset());
};

describe('services/auth.service', () => {
  const ORIGINAL_ENV = process.env;
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, JWT_SECRET: 'test-secret' };
    resetAllRepos();
    (bcrypt.hash as jest.Mock).mockReset();
    (bcrypt.compare as jest.Mock).mockReset();
    (jwt.sign as jest.Mock).mockReset();
    (jwt.decode as jest.Mock).mockReset();
    (getUserCache as jest.Mock).mockReset();
  });
  afterAll(() => { process.env = ORIGINAL_ENV; });

  // ============== login ==============
  describe('login', () => {
    it('retorna tokens y usuario cuando las credenciales son válidas (caché Redis)', async () => {
      credentialRepo.findOne.mockResolvedValue({
        id: 'c1', email: 'a@b.cl', password_hash: 'h', role: 'ciudadano',
        permissions: [], cached_data: { name: 'Ana' }, status: 'active',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('access-jwt');
      refreshTokenRepo.count.mockResolvedValue(2);
      refreshTokenRepo.save.mockResolvedValue(undefined);
      (getUserCache as jest.Mock).mockResolvedValue({ id: 'c1', email: 'a@b.cl', name: 'Ana' });

      const out = await AuthService.login('A@B.cl', '123456');

      expect(out.accessToken).toBe('access-jwt');
      expect(out.refreshToken).toBe('uuid-fijo');
      expect(out.user).toEqual({ id: 'c1', email: 'a@b.cl', name: 'Ana' });
      expect(refreshTokenRepo.save).toHaveBeenCalled();
    });

    it('expulsa el refresh token más antiguo cuando hay 5 sesiones activas', async () => {
      credentialRepo.findOne.mockResolvedValue({
        id: 'c1', email: 'a@b.cl', password_hash: 'h', role: 'ciudadano',
        permissions: [], cached_data: null, status: 'active',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('jwt');
      refreshTokenRepo.count.mockResolvedValue(5);
      refreshTokenRepo.find.mockResolvedValue([{ token: 'oldest' }]);
      refreshTokenRepo.save.mockResolvedValue(undefined);
      (getUserCache as jest.Mock).mockResolvedValue(null);

      await AuthService.login('a@b.cl', '123456');

      expect(refreshTokenRepo.delete).toHaveBeenCalledWith({ token: 'oldest' });
    });

    it('construye el usuario desde BD si no hay caché', async () => {
      credentialRepo.findOne.mockResolvedValue({
        id: 'c1', email: 'a@b.cl', password_hash: 'h', role: 'ciudadano',
        permissions: ['p1'], cached_data: { name: 'Ana', avatarUrl: 'url' }, status: 'active',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('jwt');
      refreshTokenRepo.count.mockResolvedValue(0);
      (getUserCache as jest.Mock).mockResolvedValue(null);

      const out = await AuthService.login('a@b.cl', '123456');

      expect(out.user).toMatchObject({
        id: 'c1', email: 'a@b.cl', role: 'ciudadano',
        permissions: ['p1'], name: 'Ana', avatarUrl: 'url', status: 'active',
      });
    });

    it('lanza error si la credencial no existe', async () => {
      credentialRepo.findOne.mockResolvedValue(null);
      await expect(AuthService.login('x@x.cl', '123')).rejects.toThrow('Credenciales inválidas');
    });

    it('lanza error si la contraseña no coincide', async () => {
      credentialRepo.findOne.mockResolvedValue({ id: 'c1', password_hash: 'h' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(AuthService.login('a@b.cl', 'mala')).rejects.toThrow('Credenciales inválidas');
    });
  });

  // ============== refreshSession ==============
  describe('refreshSession', () => {
    it('rota el refresh y devuelve nuevos tokens', async () => {
      refreshTokenRepo.findOne.mockResolvedValue({
        token: 'old', credential_id: 'c1',
        expires_at: new Date(Date.now() + 60_000),
      });
      credentialRepo.findOne.mockResolvedValue({
        id: 'c1', email: 'a@b.cl', role: 'ciudadano',
      });
      (jwt.sign as jest.Mock).mockReturnValue('new-jwt');
      refreshTokenRepo.save.mockResolvedValue(undefined);

      const out = await AuthService.refreshSession('old');

      expect(refreshTokenRepo.delete).toHaveBeenCalledWith({ token: 'old' });
      expect(out.accessToken).toBe('new-jwt');
      expect(out.refreshToken).toBe('uuid-fijo');
    });

    it('lanza error y borra el token si está expirado', async () => {
      refreshTokenRepo.findOne.mockResolvedValue({
        token: 'old', credential_id: 'c1',
        expires_at: new Date(Date.now() - 60_000),
      });
      await expect(AuthService.refreshSession('old')).rejects.toThrow('Refresh token inválido o expirado');
      expect(refreshTokenRepo.delete).toHaveBeenCalledWith({ token: 'old' });
    });

    it('lanza error si el refresh no existe', async () => {
      refreshTokenRepo.findOne.mockResolvedValue(null);
      await expect(AuthService.refreshSession('ghost')).rejects.toThrow('Refresh token inválido o expirado');
    });

    it('lanza error si la credencial no existe / no está activa', async () => {
      refreshTokenRepo.findOne.mockResolvedValue({
        token: 'old', credential_id: 'c1',
        expires_at: new Date(Date.now() + 60_000),
      });
      credentialRepo.findOne.mockResolvedValue(null);
      await expect(AuthService.refreshSession('old')).rejects.toThrow('Usuario no encontrado');
    });
  });

  // ============== logout ==============
  describe('logout', () => {
    it('elimina el refresh y registra el access como revocado', async () => {
      (jwt.decode as jest.Mock).mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 600,
      });
      revokedTokenRepo.upsert.mockResolvedValue(undefined);

      await AuthService.logout('rt', 'at');

      expect(refreshTokenRepo.delete).toHaveBeenCalledWith({ token: 'rt' });
      expect(revokedTokenRepo.upsert).toHaveBeenCalled();
    });

    it('no registra como revocado si el access ya expiró', async () => {
      (jwt.decode as jest.Mock).mockReturnValue({
        exp: Math.floor(Date.now() / 1000) - 60,
      });
      await AuthService.logout('rt', 'at');
      expect(revokedTokenRepo.upsert).not.toHaveBeenCalled();
    });

    it('tolera tokens no decodificables', async () => {
      (jwt.decode as jest.Mock).mockReturnValue(null);
      await expect(AuthService.logout('rt', 'at')).resolves.toBeUndefined();
      expect(revokedTokenRepo.upsert).not.toHaveBeenCalled();
    });
  });

  // ============== register ==============
  describe('register', () => {
    it('crea una credencial nueva', async () => {
      credentialRepo.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hash');
      const entity = { id: 'c1', email: 'a@b.cl', role: 'ciudadano' };
      credentialRepo.create.mockReturnValue(entity);
      credentialRepo.save.mockResolvedValue(entity);

      const out = await AuthService.register('A@B.cl', '123456', 'ciudadano');

      expect(bcrypt.hash).toHaveBeenCalledWith('123456', 10);
      expect(credentialRepo.create).toHaveBeenCalledWith({
        email: 'a@b.cl', password_hash: 'hash', role: 'ciudadano',
      });
      expect(out).toEqual({ id: 'c1', email: 'a@b.cl', role: 'ciudadano' });
    });

    it('lanza si el email ya existe', async () => {
      credentialRepo.findOne.mockResolvedValue({ id: 'x' });
      await expect(AuthService.register('a@b.cl', '123', 'ciudadano')).rejects.toThrow('El correo ya está registrado');
    });

    it('aplica el rol por defecto "ciudadano"', async () => {
      credentialRepo.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hash');
      credentialRepo.create.mockReturnValue({ id: 'c1', email: 'a@b.cl', role: 'ciudadano' });
      credentialRepo.save.mockResolvedValue(undefined);

      await AuthService.register('a@b.cl', 'pass');

      expect(credentialRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'ciudadano' })
      );
    });
  });

  // ============== updateRole ==============
  describe('updateRole', () => {
    it('actualiza si la credencial existe', async () => {
      credentialRepo.findOne.mockResolvedValue({ id: 'c1' });
      await AuthService.updateRole('c1', 'moderador');
      expect(credentialRepo.update).toHaveBeenCalledWith({ id: 'c1' }, { role: 'moderador' });
    });

    it('lanza si la credencial no existe', async () => {
      credentialRepo.findOne.mockResolvedValue(null);
      await expect(AuthService.updateRole('x', 'admin')).rejects.toThrow('Credencial no encontrada');
    });
  });

  // ============== deactivateCredential ==============
  describe('deactivateCredential', () => {
    it('baja el flag is_active', async () => {
      credentialRepo.findOne.mockResolvedValue({ id: 'c1' });
      await AuthService.deactivateCredential('c1');
      expect(credentialRepo.update).toHaveBeenCalledWith({ id: 'c1' }, { is_active: false });
    });

    it('lanza si la credencial no existe', async () => {
      credentialRepo.findOne.mockResolvedValue(null);
      await expect(AuthService.deactivateCredential('x')).rejects.toThrow('Credencial no encontrada');
    });
  });

  // ============== deleteCredential ==============
  describe('deleteCredential', () => {
    it('llama a delete por id', async () => {
      await AuthService.deleteCredential('c1');
      expect(credentialRepo.delete).toHaveBeenCalledWith({ id: 'c1' });
    });
  });

  // ============== getMe ==============
  describe('getMe', () => {
    it('devuelve el perfil cacheado si existe', async () => {
      (getUserCache as jest.Mock).mockResolvedValue({ id: 'c1', email: 'a@b.cl' });
      const out = await AuthService.getMe('c1');
      expect(out).toEqual({ id: 'c1', email: 'a@b.cl' });
    });

    it('lee de BD y construye el perfil si no hay caché', async () => {
      (getUserCache as jest.Mock).mockResolvedValue(null);
      credentialRepo.findOne.mockResolvedValue({
        id: 'c1', email: 'a@b.cl', role: 'ciudadano',
        permissions: [], cached_data: { name: 'Ana', avatarUrl: 'url', tipo: 'institucion' },
        status: 'active',
      });
      const out = await AuthService.getMe('c1');
      expect(out).toMatchObject({
        id: 'c1', name: 'Ana', tipo: 'institucion', status: 'active',
      });
    });

    it('lanza 404 si la credencial no existe ni en caché ni en BD', async () => {
      (getUserCache as jest.Mock).mockResolvedValue(null);
      credentialRepo.findOne.mockResolvedValue(null);
      await expect(AuthService.getMe('x')).rejects.toMatchObject({
        message: 'Usuario no encontrado',
        status: 404,
      });
    });

    it('aplica el valor por defecto "ciudadano" si cached_data.tipo es undefined', async () => {
      (getUserCache as jest.Mock).mockResolvedValue(null);
      credentialRepo.findOne.mockResolvedValue({
        id: 'c1', email: 'a@b.cl', role: 'ciudadano',
        permissions: [], cached_data: null, status: 'active',
      });
      const out = await AuthService.getMe('c1');
      expect((out as any).tipo).toBe('ciudadano');
    });
  });

  // ============== getCredentialByEmail ==============
  describe('getCredentialByEmail', () => {
    it('devuelve { id } si encuentra la credencial', async () => {
      credentialRepo.findOne.mockResolvedValue({ id: 'c1' });
      const out = await AuthService.getCredentialByEmail('A@B.cl');
      expect(out).toEqual({ id: 'c1' });
    });

    it('devuelve null si no encuentra', async () => {
      credentialRepo.findOne.mockResolvedValue(null);
      const out = await AuthService.getCredentialByEmail('x@x.cl');
      expect(out).toBeNull();
    });
  });
});
