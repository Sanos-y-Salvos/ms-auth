// === Mock del repo de credenciales ===
const credRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
};
jest.mock('../../src/config/db', () => ({
  AppDataSource: { getRepository: jest.fn(() => credRepo) },
}));

// === Mock del cliente Redis ===
const redisClient = {
  set: jest.fn(),
  get: jest.fn(),
};
jest.mock('../../src/config/redis', () => ({
  redisClient,
}));

import {
  syncUserRegistered,
  syncUserUpdated,
  syncUserDeleted,
  syncUserPasswordChanged,
  getUserCache,
} from '../../src/services/user-cache.service';

const basePayload = {
  event: 'user.registered' as const,
  userId: 'u1',
  email: 'A@B.cl',
  passwordHash: 'h',
  role: 'ciudadano',
  permissions: ['p1'],
  name: 'Ana',
  avatarUrl: 'url',
  tipo: 'ciudadano' as const,
  telefono: '900',
  region: 'RM',
  comuna: 'Santiago',
  primer_nombre: 'Ana',
  apellido_paterno: 'Pérez',
  run: '11.111.111-1',
  direccion: 'Calle 1',
  timestamp: new Date(),
};

describe('services/user-cache.service', () => {
  // Silencia los console.log/warn del servicio durante los tests
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    Object.values(credRepo).forEach((fn: any) => fn.mockReset());
    redisClient.set.mockReset();
    redisClient.get.mockReset();
  });
  afterEach(() => { logSpy.mockRestore(); warnSpy.mockRestore(); });

  // ============== getUserCache ==============
  describe('getUserCache', () => {
    it('devuelve el perfil parseado si existe en Redis', async () => {
      redisClient.get.mockResolvedValue(JSON.stringify({ id: 'u1', email: 'a@b.cl' }));
      const out = await getUserCache('u1');
      expect(out).toEqual({ id: 'u1', email: 'a@b.cl' });
    });

    it('devuelve null si no existe la clave', async () => {
      redisClient.get.mockResolvedValue(null);
      const out = await getUserCache('u1');
      expect(out).toBeNull();
    });

    it('devuelve null si Redis falla', async () => {
      redisClient.get.mockRejectedValue(new Error('redis down'));
      const out = await getUserCache('u1');
      expect(out).toBeNull();
    });
  });

  // ============== syncUserRegistered ==============
  describe('syncUserRegistered', () => {
    it('crea la credencial y siembra el caché', async () => {
      credRepo.findOne.mockResolvedValue(null);
      credRepo.create.mockReturnValue({});
      credRepo.save.mockResolvedValue(undefined);
      redisClient.set.mockResolvedValue('OK');

      await syncUserRegistered(basePayload);

      expect(credRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'a@b.cl', password_hash: 'h', role: 'ciudadano' })
      );
      expect(credRepo.save).toHaveBeenCalled();
      expect(redisClient.set).toHaveBeenCalled();
    });

    it('es idempotente: ignora el evento si ya existe', async () => {
      credRepo.findOne.mockResolvedValue({ id: 'u1' });
      await syncUserRegistered(basePayload);
      expect(credRepo.create).not.toHaveBeenCalled();
      expect(credRepo.save).not.toHaveBeenCalled();
    });

    it('no rompe si Redis falla al cachear', async () => {
      credRepo.findOne.mockResolvedValue(null);
      credRepo.create.mockReturnValue({});
      credRepo.save.mockResolvedValue(undefined);
      redisClient.set.mockRejectedValue(new Error('redis-down'));

      await expect(syncUserRegistered(basePayload)).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  // ============== syncUserUpdated ==============
  describe('syncUserUpdated', () => {
    const existingCred = {
      id: 'u1', email: 'old@b.cl', role: 'ciudadano',
      permissions: ['p'], status: 'active',
      cached_data: { name: 'Old', lastUpdated: new Date() },
    };

    it('aplica diff completo y refresca el caché', async () => {
      credRepo.findOne
        .mockResolvedValueOnce(existingCred)
        .mockResolvedValueOnce({ ...existingCred, email: 'new@b.cl', cached_data: { name: 'Nuevo', lastUpdated: new Date() } });
      credRepo.update.mockResolvedValue(undefined);
      redisClient.get.mockResolvedValue(JSON.stringify({ tipo: 'ciudadano', telefono: '999' }));
      redisClient.set.mockResolvedValue('OK');

      await syncUserUpdated({
        event: 'user.updated',
        userId: 'u1',
        email: 'NEW@b.cl',
        role: 'moderador',
        permissions: ['p2'],
        name: 'Nuevo',
        avatarUrl: 'url2',
        status: 'inactive',
        telefono: '111',
        timestamp: new Date(),
      });

      expect(credRepo.update).toHaveBeenCalledWith(
        { id: 'u1' },
        expect.objectContaining({
          email: 'new@b.cl', role: 'moderador',
          permissions: ['p2'], status: 'inactive', is_active: false,
        })
      );
      expect(redisClient.set).toHaveBeenCalled();
    });

    it('emite warning si la credencial no existe', async () => {
      credRepo.findOne.mockResolvedValue(null);
      await syncUserUpdated({ event: 'user.updated', userId: 'x', timestamp: new Date() });
      expect(credRepo.update).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    });

    it('aplica solo los campos enviados (no toca los no enviados)', async () => {
      credRepo.findOne
        .mockResolvedValueOnce(existingCred)
        .mockResolvedValueOnce(existingCred);
      credRepo.update.mockResolvedValue(undefined);
      redisClient.get.mockResolvedValue(null);

      await syncUserUpdated({
        event: 'user.updated',
        userId: 'u1',
        role: 'admin',
        timestamp: new Date(),
      });

      const updateArg = credRepo.update.mock.calls[0][1];
      expect(updateArg).toEqual({ role: 'admin' });
    });
  });

  // ============== syncUserPasswordChanged ==============
  describe('syncUserPasswordChanged', () => {
    it('actualiza el password_hash si la credencial existe', async () => {
      credRepo.findOne.mockResolvedValue({ id: 'u1' });
      await syncUserPasswordChanged({
        event: 'user.password.changed',
        userId: 'u1',
        passwordHash: 'nuevo',
        timestamp: new Date(),
      });
      expect(credRepo.update).toHaveBeenCalledWith({ id: 'u1' }, { password_hash: 'nuevo' });
    });

    it('emite warning si la credencial no existe', async () => {
      credRepo.findOne.mockResolvedValue(null);
      await syncUserPasswordChanged({
        event: 'user.password.changed',
        userId: 'x',
        passwordHash: 'h',
        timestamp: new Date(),
      });
      expect(credRepo.update).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  // ============== syncUserDeleted ==============
  describe('syncUserDeleted', () => {
    it('desactiva en BD y actualiza el caché si existe', async () => {
      redisClient.get.mockResolvedValue(JSON.stringify({ id: 'u1', status: 'active' }));
      redisClient.set.mockResolvedValue('OK');
      await syncUserDeleted('u1');
      expect(credRepo.update).toHaveBeenCalledWith(
        { id: 'u1' }, { status: 'inactive', is_active: false }
      );
      expect(redisClient.set).toHaveBeenCalled();
    });

    it('no rompe si no hay entrada en Redis', async () => {
      redisClient.get.mockResolvedValue(null);
      await syncUserDeleted('u1');
      expect(redisClient.set).not.toHaveBeenCalled();
    });

    it('tolera errores de Redis', async () => {
      redisClient.get.mockRejectedValue(new Error('redis-down'));
      await expect(syncUserDeleted('u1')).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();
    });
  });
});
