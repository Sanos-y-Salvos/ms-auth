// Seed de credencial de administrador fijo en ms-auth
// Se ejecuta en cada arranque. Es idempotente: si el email ya existe no hace nada.
// Las credenciales deben coincidir con las del seed de ms-users (mismo email y password).

import bcrypt from 'bcrypt';
import { AppDataSource } from '../config/db';
import { Credential } from '../models/Credential';

// ── Mismas variables de entorno que en ms-users/src/seed/adminSeed.ts ────────
const ADMIN_EMAIL    = process.env.SEED_ADMIN_EMAIL    || 'admin@sanosysalvos.cl';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin1234!';
const ADMIN_NOMBRE   = process.env.SEED_ADMIN_NOMBRE   || 'Administrador';
const ADMIN_APELLIDO = process.env.SEED_ADMIN_APELLIDO || 'Sistema';

export async function seedAdminCredential(): Promise<void> {
  const credRepo = AppDataSource.getRepository(Credential);

  // Verificar si la credencial ya existe (idempotente)
  const existente = await credRepo.findOne({ where: { email: ADMIN_EMAIL.toLowerCase() } });
  if (existente) {
    console.log(`[seed-auth] Credencial de admin ya existe (${ADMIN_EMAIL}), omitiendo creación.`);
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const credencial = credRepo.create({
    email:         ADMIN_EMAIL.toLowerCase(),
    password_hash: passwordHash,
    role:          'superadmin',
    is_active:     true,
    status:        'active',
    cached_data: {
      name:        `${ADMIN_NOMBRE} ${ADMIN_APELLIDO}`,
      lastUpdated: new Date(),
    },
  });

  await credRepo.save(credencial);

  console.log(`[seed-auth] ✅ Credencial de admin creada: ${ADMIN_EMAIL} (rol: superadmin)`);
}
