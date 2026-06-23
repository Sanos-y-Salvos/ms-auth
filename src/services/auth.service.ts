// Dependencias para hashing, firma JWT y generación de UUIDs
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

// Acceso a la BD y entidades involucradas
import { AppDataSource } from '../config/db';
import { Credential } from '../models/Credential';
import { RefreshToken } from '../models/RefreshToken';
import { RevokedToken } from '../models/RevokedToken';

// Lectura del caché de perfil en Redis
import { getUserCache } from './user-cache.service';

// Helpers de repositorio (factory functions para no cachear instancias antes
// de que TypeORM esté inicializado)
const credentialRepo = () => AppDataSource.getRepository(Credential);
const refreshTokenRepo = () => AppDataSource.getRepository(RefreshToken);
const revokedTokenRepo = () => AppDataSource.getRepository(RevokedToken);

// Tiempos de vida de los tokens
const ACCESS_TOKEN_TTL = 15 * 60; // 15 minutos en segundos
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 días en segundos

// Construye un refresh token nuevo (UUID + fecha de expiración)
const buildRefreshToken = (credentialId: string): Pick<RefreshToken, 'token' | 'credential_id' | 'expires_at'> => ({
  token: uuidv4(),
  credential_id: credentialId,
  expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL * 1000),
});

// RF-01 — Login
export const login = async (email: string, password: string) => {
  // Normaliza el email (case-insensitive)
  email = email.toLowerCase();

  // Busca la credencial activa; si no existe, error genérico para no filtrar
  // si el email está registrado o no
  const credential = await credentialRepo().findOne({ where: { email, is_active: true } });
  if (!credential) throw new Error('Credenciales inválidas');

  // Compara la contraseña con el hash bcrypt
  const valid = await bcrypt.compare(password, credential.password_hash);
  if (!valid) throw new Error('Credenciales inválidas');

  // Firma del access token JWT con los claims mínimos del usuario
  const accessToken = jwt.sign(
    { id: credential.id, email: credential.email, role: credential.role },
    process.env.JWT_SECRET as string,
    { expiresIn: ACCESS_TOKEN_TTL }
  );

  // Política de sesiones: máximo 5 refresh tokens activos por credencial.
  // Si se alcanza el tope, expulsamos el más antiguo (FIFO).
  const activeSessions = await refreshTokenRepo().count({ where: { credential_id: credential.id } });
  if (activeSessions >= 5) {
    const oldest = await refreshTokenRepo().find({
      where: { credential_id: credential.id },
      order: { created_at: 'ASC' },
      take: 1,
    });
    if (oldest.length) await refreshTokenRepo().delete({ token: oldest[0].token });
  }

  // Emite y persiste el nuevo refresh token
  const { token: refreshToken, ...refreshTokenData } = buildRefreshToken(credential.id);
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

// RF-02 — Refresh Token (rotación: se invalida el viejo y se emite uno nuevo)
export const refreshSession = async (token: string) => {
  // Busca el registro del refresh enviado por el cliente
  const refreshRecord = await refreshTokenRepo().findOne({ where: { token } });

  // Si no existe o expiró, lo eliminamos y rechazamos
  if (!refreshRecord || refreshRecord.expires_at <= new Date()) {
    await refreshTokenRepo().delete({ token });
    throw new Error('Refresh token inválido o expirado');
  }

  // Verifica que la credencial dueña del token siga activa
  const credential = await credentialRepo().findOne({
    where: { id: refreshRecord.credential_id, is_active: true },
  });
  if (!credential) throw new Error('Usuario no encontrado');

  // Rotación: invalidamos el token usado
  await refreshTokenRepo().delete({ token });

  // Nuevo access token
  const accessToken = jwt.sign(
    { id: credential.id, email: credential.email, role: credential.role },
    process.env.JWT_SECRET as string,
    { expiresIn: ACCESS_TOKEN_TTL }
  );

  // Nuevo refresh token persistido
  const { token: newRefreshToken, ...newRefreshTokenData } = buildRefreshToken(credential.id);
  await refreshTokenRepo().save({ token: newRefreshToken, ...newRefreshTokenData });

  return { accessToken, refreshToken: newRefreshToken };
};

// RF-04 — Logout: revoca access y refresh token
export const logout = async (refreshToken: string, accessToken: string) => {
  // Elimina el refresh token (no se podrá usar para renovar más)
  await refreshTokenRepo().delete({ token: refreshToken });

  // Decodifica el access token sin verificar firma — solo necesitamos su exp
  const decoded = jwt.decode(accessToken) as jwt.JwtPayload | string | null;
  if (decoded && typeof decoded !== 'string' && decoded.exp) {
    // Solo registramos como revocado si aún no expira (de lo contrario es inútil)
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      // upsert evita duplicados si el cliente hace logout dos veces con el mismo token
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

  // Verifica unicidad del email
  const exists = await credentialRepo().findOne({ where: { email } });
  if (exists) throw new Error('El correo ya está registrado');

  // Hash de la contraseña y persistencia
  const password_hash = await bcrypt.hash(password, 10);
  const credential = credentialRepo().create({ email, password_hash, role });
  await credentialRepo().save(credential);

  // Solo devolvemos los campos seguros (nunca el hash)
  return { id: credential.id, email: credential.email, role: credential.role };
};

// Interno — Actualización de rol legacy (flujo normal usa evento `user.updated` del broker)
export const updateRole = async (credentialId: string, role: string) => {
  // Asegura que la credencial exista antes de actualizar
  const credential = await credentialRepo().findOne({ where: { id: credentialId } });
  if (!credential) throw new Error('Credencial no encontrada');

  await credentialRepo().update({ id: credentialId }, { role });
};

// Interno — Desactivar credencial legacy (flujo normal usa evento `user.deleted` del broker)
export const deactivateCredential = async (credentialId: string) => {
  const credential = await credentialRepo().findOne({ where: { id: credentialId } });
  if (!credential) throw new Error('Credencial no encontrada');

  await credentialRepo().update({ id: credentialId }, { is_active: false, status: 'inactive' });
};

// Interno — Activar credencial (complemento de deactivateCredential)
export const activateCredential = async (credentialId: string) => {
  const credential = await credentialRepo().findOne({ where: { id: credentialId } });
  if (!credential) throw new Error('Credencial no encontrada');

  await credentialRepo().update({ id: credentialId }, { is_active: true, status: 'active' });
};

// Interno — Eliminar credencial (rollback de registro fallido)
export const deleteCredential = async (credentialId: string) => {
  await credentialRepo().delete({ id: credentialId });
};

// Perfil desde caché Redis (fallback a DB si no hay entrada)
export const getMe = async (credentialId: string) => {
  // Camino feliz: caché en Redis
  const cached = await getUserCache(credentialId);
  if (cached) return cached;

  // Fallback: leer directamente de la BD si Redis no tiene el perfil
  const credential = await credentialRepo().findOne({ where: { id: credentialId, is_active: true } });
  if (!credential) throw Object.assign(new Error('Usuario no encontrado'), { status: 404 });

  // Construcción manual del perfil con valores por defecto razonables
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
