import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/db';
import { Credential } from '../models/Credential';
import { RefreshToken } from '../models/RefreshToken';
import { RevokedToken } from '../models/RevokedToken';
import { getUserCache } from './user-cache.service';
import { CredentialFactory } from '../factories/CredentialFactory';

const credentialRepo = () => AppDataSource.getRepository(Credential);
const refreshTokenRepo = () => AppDataSource.getRepository(RefreshToken);
const revokedTokenRepo = () => AppDataSource.getRepository(RevokedToken);

const ACCESS_TOKEN_TTL = 15 * 60; // 15 minutos en segundos

// RF-01 — Login
export const login = async (email: string, password: string) => {
  email = email.toLowerCase();
  const credential = await credentialRepo().findOne({ where: { email, is_active: true } });
  if (!credential) throw new Error('Credenciales inválidas');

  const valid = await bcrypt.compare(password, credential.password_hash);
  if (!valid) throw new Error('Credenciales inválidas');

  const accessToken = jwt.sign(
    { id: credential.id, email: credential.email, role: credential.role },
    process.env.JWT_SECRET as string,
    { expiresIn: ACCESS_TOKEN_TTL }
  );

  const activeSessions = await refreshTokenRepo().count({ where: { credential_id: credential.id } });
  if (activeSessions >= 5) {
    const oldest = await refreshTokenRepo().find({
      where: { credential_id: credential.id },
      order: { created_at: 'ASC' },
      take: 1,
    });
    if (oldest.length) await refreshTokenRepo().delete({ token: oldest[0].token });
  }

  const { token: refreshToken, ...refreshTokenData } = CredentialFactory.crearRefreshToken(credential.id);
  await refreshTokenRepo().save({ token: refreshToken, ...refreshTokenData });

  // Datos de usuario desde Redis; si no están, construir desde la credencial en DB
  const cached = await getUserCache(credential.id);
  const user = cached ?? {
    id: credential.id,
    email: credential.email,
    role: credential.role,
    permissions: credential.permissions,
    name: credential.cached_data?.name ?? '',
    avatarUrl: credential.cached_data?.avatarUrl,
    status: credential.status,
  };

  return { accessToken, refreshToken, user };
};

// RF-02 — Refresh Token
export const refreshSession = async (token: string) => {
  const refreshRecord = await refreshTokenRepo().findOne({ where: { token } });

  if (!refreshRecord || refreshRecord.expires_at <= new Date()) {
    await refreshTokenRepo().delete({ token });
    throw new Error('Refresh token inválido o expirado');
  }

  const credential = await credentialRepo().findOne({
    where: { id: refreshRecord.credential_id, is_active: true },
  });
  if (!credential) throw new Error('Usuario no encontrado');

  await refreshTokenRepo().delete({ token });

  const accessToken = jwt.sign(
    { id: credential.id, email: credential.email, role: credential.role },
    process.env.JWT_SECRET as string,
    { expiresIn: ACCESS_TOKEN_TTL }
  );

  const { token: newRefreshToken, ...newRefreshTokenData } = CredentialFactory.crearRefreshToken(credential.id);
  await refreshTokenRepo().save({ token: newRefreshToken, ...newRefreshTokenData });

  return { accessToken, refreshToken: newRefreshToken };
};

// RF-04 — Logout
export const logout = async (refreshToken: string, accessToken: string) => {
  await refreshTokenRepo().delete({ token: refreshToken });

  const decoded = jwt.decode(accessToken) as jwt.JwtPayload | string | null;
  if (decoded && typeof decoded !== 'string' && decoded.exp) {
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await revokedTokenRepo().upsert(
        {
          token: accessToken,
          expires_at: new Date(decoded.exp * 1000),
        },
        ['token']
      );
    }
  }
};

// RF-05 — Registro legacy (flujo normal usa evento `user.registered` del broker)
export const register = async (email: string, password: string, role: string = 'ciudadano') => {
  email = email.toLowerCase();
  const exists = await credentialRepo().findOne({ where: { email } });
  if (exists) throw new Error('El correo ya está registrado');

  const credential = await CredentialFactory.crearCredencial(email, password, role);
  await credentialRepo().save(credential);

  return { id: credential.id, email: credential.email, role: credential.role };
};

// Interno — Actualización de rol legacy (flujo normal usa evento `user.updated` del broker)
export const updateRole = async (credentialId: string, role: string) => {
  const credential = await credentialRepo().findOne({ where: { id: credentialId } });
  if (!credential) throw new Error('Credencial no encontrada');

  await credentialRepo().update({ id: credentialId }, { role });
};

// Interno — Desactivar credencial legacy (flujo normal usa evento `user.deleted` del broker)
export const deactivateCredential = async (credentialId: string) => {
  const credential = await credentialRepo().findOne({ where: { id: credentialId } });
  if (!credential) throw new Error('Credencial no encontrada');

  await credentialRepo().update({ id: credentialId }, { is_active: false });
};

// Interno — Eliminar credencial (rollback de registro fallido)
export const deleteCredential = async (credentialId: string) => {
  await credentialRepo().delete({ id: credentialId });
};

// Perfil desde caché Redis (fallback a DB si no hay entrada)
export const getMe = async (credentialId: string) => {
  const cached = await getUserCache(credentialId);
  if (cached) return cached;

  const credential = await credentialRepo().findOne({ where: { id: credentialId, is_active: true } });
  if (!credential) throw Object.assign(new Error('Usuario no encontrado'), { status: 404 });

  return {
    id: credential.id,
    email: credential.email,
    role: credential.role,
    permissions: credential.permissions,
    name: credential.cached_data?.name ?? '',
    avatarUrl: credential.cached_data?.avatarUrl,
    status: credential.status,
    tipo: credential.cached_data?.tipo ?? 'ciudadano',
  };
};

// Interno — Buscar credential_id por email (usado por ms-soporte para vincular tickets)
export const getCredentialByEmail = async (email: string): Promise<{ id: string } | null> => {
  const credential = await credentialRepo().findOne({ where: { email: email.toLowerCase(), is_active: true } });
  return credential ? { id: credential.id } : null;
};
