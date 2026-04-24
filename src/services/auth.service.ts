import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '../config/db';
import { Credential } from '../models/Credential';
import { RefreshToken } from '../models/RefreshToken';
import { RevokedToken } from '../models/RevokedToken';

const credentialRepo = () => AppDataSource.getRepository(Credential);
const refreshTokenRepo = () => AppDataSource.getRepository(RefreshToken);
const revokedTokenRepo = () => AppDataSource.getRepository(RevokedToken);

// RF-01 — Login
export const login = async (email: string, password: string) => {
  const credential = await credentialRepo().findOne({ where: { email, is_active: true } });
  if (!credential) throw new Error('Credenciales inválidas');

  const valid = await bcrypt.compare(password, credential.password_hash);
  if (!valid) throw new Error('Credenciales inválidas');

  const accessToken = jwt.sign(
    { id: credential.id, email: credential.email, role: credential.role },
    process.env.JWT_SECRET as string,
    { expiresIn: process.env.JWT_EXPIRES_IN as string } as jwt.SignOptions
  );

  const refreshToken = uuidv4();
  const refreshExpiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000));
  await refreshTokenRepo().save({
    token: refreshToken,
    credential_id: credential.id,
    expires_at: refreshExpiresAt,
  });

  return { accessToken, refreshToken };
};

// RF-02 — Refresh Token
export const refreshSession = async (token: string) => {
  const refreshRecord = await refreshTokenRepo().findOne({ where: { token } });
  if (!refreshRecord) throw new Error('Refresh token inválido o expirado');

  if (refreshRecord.expires_at <= new Date()) {
    await refreshTokenRepo().delete({ token });
    throw new Error('Refresh token inválido o expirado');
  }

  const credential = await credentialRepo().findOne({
    where: { id: refreshRecord.credential_id, is_active: true },
  });
  if (!credential) throw new Error('Usuario no encontrado');

  const accessToken = jwt.sign(
    { id: credential.id, email: credential.email, role: credential.role },
    process.env.JWT_SECRET as string,
    { expiresIn: process.env.JWT_EXPIRES_IN as string } as jwt.SignOptions
  );

  return { accessToken };
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

// RF-05 — Registro (el rol lo determina MS-02, por defecto ciudadano)
export const register = async (email: string, password: string, role: string = 'ciudadano') => {
  const exists = await credentialRepo().findOne({ where: { email } });
  if (exists) throw new Error('El correo ya está registrado');

  const password_hash = await bcrypt.hash(password, 10);
  const credential = credentialRepo().create({ email, password_hash, role });
  await credentialRepo().save(credential);

  return { id: credential.id, email: credential.email, role: credential.role };
};

// Recuperar contraseña
export const resetPassword = async (email: string, newPassword: string) => {
  const credential = await credentialRepo().findOne({ where: { email } });
  if (!credential) throw Object.assign(new Error('Correo no registrado'), { status: 404 });

  const password_hash = await bcrypt.hash(newPassword, 10);
  await credentialRepo().update({ email }, { password_hash });

  return { message: 'Contraseña actualizada correctamente' };
};

// Interno — Actualización de rol llamada por MS-02
export const updateRole = async (credentialId: string, role: string) => {
  const credential = await credentialRepo().findOne({ where: { id: credentialId } });
  if (!credential) throw new Error('Credencial no encontrada');

  await credentialRepo().update({ id: credentialId }, { role });
};
