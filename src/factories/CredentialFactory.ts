import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '../config/db';
import { Credential } from '../models/Credential';
import { RefreshToken } from '../models/RefreshToken';

const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 días en segundos

export class CredentialFactory {
  static async crearCredencial(email: string, password: string, role: string): Promise<Credential> {
    const password_hash = await bcrypt.hash(password, 10);
    const repo = AppDataSource.getRepository(Credential);
    return repo.create({ email: email.toLowerCase(), password_hash, role });
  }

  static crearRefreshToken(credentialId: string): Pick<RefreshToken, 'token' | 'credential_id' | 'expires_at'> {
    return {
      token: uuidv4(),
      credential_id: credentialId,
      expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL * 1000),
    };
  }
}
