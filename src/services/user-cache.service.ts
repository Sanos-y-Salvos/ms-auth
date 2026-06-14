// Acceso a BD para mantener la réplica local de credenciales
import { AppDataSource } from '../config/db';
import { Credential } from '../models/Credential';

// Cliente Redis para el caché de perfiles
import { redisClient } from '../config/redis';

// Payloads tipados de los eventos que consume este servicio
import type { UserRegisteredPayload, UserUpdatedPayload, UserPasswordChangedPayload } from './types';

// Helper de repositorio (lazy para respetar el orden de inicialización de TypeORM)
const credRepo = () => AppDataSource.getRepository(Credential);

// TTL del caché de perfiles en Redis
const USER_CACHE_TTL = 30 * 24 * 60 * 60; // 30 días en segundos

// Estructura completa del perfil tal como queda almacenada en Redis.
// Incluye campos de ciudadano e institución; los no aplicables quedan undefined.
export interface CachedRedisUser {
  id: string;
  email: string;
  role: string;
  permissions: string[] | null;
  name: string;
  avatarUrl?: string;
  status: string;
  tipo: 'ciudadano' | 'institucion';
  telefono?: string;
  region?: string;
  comuna?: string;
  // Campos de ciudadano
  primer_nombre?: string;
  segundo_nombre?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  run?: string;
  direccion?: string;
  // Campos de institución
  razon_social?: string;
  rut?: string;
  tipo_institucion?: string;
}

// Escribe el perfil en Redis con TTL. Falla silenciosamente si Redis no responde
// para no romper la sincronización (la BD es la fuente de verdad local).
async function setUserCache(data: CachedRedisUser): Promise<void> {
  try {
    await redisClient.set(`user:${data.id}`, JSON.stringify(data), 'EX', USER_CACHE_TTL);
  } catch (err: any) {
    console.warn(`[user-cache] No se pudo escribir en Redis para userId=${data.id}: ${err.message}`);
  }
}

// Lee el perfil cacheado. Devuelve null si no existe o si hay error de parseo.
export async function getUserCache(userId: string): Promise<CachedRedisUser | null> {
  try {
    const raw = await redisClient.get(`user:${userId}`);
    return raw ? (JSON.parse(raw) as CachedRedisUser) : null;
  } catch {
    return null;
  }
}

// Handler de user.registered: crea la credencial local y siembra el caché.
// Es idempotente: si la credencial ya existe, ignora el evento.
export const syncUserRegistered = async (data: UserRegisteredPayload): Promise<void> => {
  // Idempotencia: protegerse de eventos duplicados (Bull puede reintentar)
  const existing = await credRepo().findOne({ where: { id: data.userId } });
  if (existing) {
    console.log(`[user-cache] Credencial ${data.userId} ya existe, evento idempotente ignorado`);
    return;
  }

  // Construcción de la entidad. Notar que el id se inyecta manualmente abajo
  // para conservar el id generado por ms-users (fuente de verdad).
  // TypeORM respeta el id provisto aunque sea @PrimaryGeneratedColumn
  const cred = credRepo().create({
    email: data.email.toLowerCase(),
    password_hash: data.passwordHash,
    role: data.role,
    permissions: data.permissions,
    status: 'active',
    is_active: true,
    cached_data: {
      name: data.name,
      avatarUrl: data.avatarUrl,
      tipo: data.tipo,
      lastUpdated: new Date(),
    },
  });
  cred.id = data.userId;
  await credRepo().save(cred);

  // Siembra del caché Redis con TODOS los campos del payload
  await setUserCache({
    id: data.userId,
    email: data.email.toLowerCase(),
    role: data.role,
    permissions: data.permissions,
    name: data.name,
    avatarUrl: data.avatarUrl,
    status: 'active',
    tipo: data.tipo,
    telefono: data.telefono,
    region: data.region,
    comuna: data.comuna,
    primer_nombre: data.primer_nombre,
    segundo_nombre: data.segundo_nombre,
    apellido_paterno: data.apellido_paterno,
    apellido_materno: data.apellido_materno,
    run: data.run,
    direccion: data.direccion,
    razon_social: data.razon_social,
    rut: data.rut,
    tipo_institucion: data.tipo_institucion,
  });

  console.log(`[user-cache] Credencial creada para userId=${data.userId} (${data.email})`);
};

// Handler de user.updated: aplica diff incremental sobre la credencial y el caché.
export const syncUserUpdated = async (data: UserUpdatedPayload): Promise<void> => {
  const cred = await credRepo().findOne({ where: { id: data.userId } });
  if (!cred) {
    console.warn(`[user-cache] Credencial ${data.userId} no encontrada para actualizar`);
    return;
  }

  // Construye el objeto de update solo con los campos que llegaron en el payload
  const update: Partial<Credential> = {};
  if (data.email !== undefined) update.email = data.email.toLowerCase();
  if (data.role !== undefined) update.role = data.role;
  if (data.permissions !== undefined) update.permissions = data.permissions;
  if (data.status !== undefined) {
    update.status = data.status;
    // Mantiene en sintonía el flag is_active con el status del dominio
    update.is_active = data.status === 'active';
  }

  // Merge incremental del cached_data sin pisar campos no enviados
  const currentCached = cred.cached_data ?? { name: '', lastUpdated: new Date() };
  let cachedChanged = false;
  if (data.name !== undefined) { currentCached.name = data.name; cachedChanged = true; }
  if (data.avatarUrl !== undefined) { currentCached.avatarUrl = data.avatarUrl; cachedChanged = true; }
  if (cachedChanged) { currentCached.lastUpdated = new Date(); update.cached_data = currentCached; }

  // Persiste el diff en la BD
  await credRepo().update({ id: data.userId }, update);

  // Refrescar caché Redis preservando campos no enviados en este evento
  const updated = await credRepo().findOne({ where: { id: data.userId } });
  if (updated) {
    // Para no perder los campos que NO viajaron en este evento (ej. run, rut),
    // los recuperamos del caché previo con el operador ?? como fallback.
    const existing = await getUserCache(data.userId);
    await setUserCache({
      id: updated.id,
      email: updated.email,
      role: updated.role,
      permissions: updated.permissions,
      name: updated.cached_data?.name ?? '',
      avatarUrl: updated.cached_data?.avatarUrl,
      status: updated.status,
      tipo: existing?.tipo ?? 'ciudadano',
      telefono: data.telefono ?? existing?.telefono,
      region: data.region ?? existing?.region,
      comuna: data.comuna ?? existing?.comuna,
      primer_nombre: data.primer_nombre ?? existing?.primer_nombre,
      segundo_nombre: data.segundo_nombre ?? existing?.segundo_nombre,
      apellido_paterno: data.apellido_paterno ?? existing?.apellido_paterno,
      apellido_materno: data.apellido_materno ?? existing?.apellido_materno,
      run: existing?.run,
      direccion: data.direccion ?? existing?.direccion,
      razon_social: data.razon_social ?? existing?.razon_social,
      rut: existing?.rut,
      tipo_institucion: existing?.tipo_institucion,
    });
  }

  console.log(`[user-cache] Credencial actualizada para userId=${data.userId}`);
};

// Handler de user.password.changed: reemplaza el hash localmente
export const syncUserPasswordChanged = async (data: UserPasswordChangedPayload): Promise<void> => {
  const cred = await credRepo().findOne({ where: { id: data.userId } });
  if (!cred) {
    console.warn(`[user-cache] Credencial ${data.userId} no encontrada para actualizar contraseña`);
    return;
  }

  // Solo actualizamos el campo de contraseña; el resto queda intacto
  await credRepo().update({ id: data.userId }, { password_hash: data.passwordHash });
  console.log(`[user-cache] Password actualizado para userId=${data.userId}`);
};

// Handler de user.deleted: desactivación lógica (no se elimina la fila)
export const syncUserDeleted = async (userId: string): Promise<void> => {
  // BD: marcar como inactivo
  await credRepo().update({ id: userId }, { status: 'inactive', is_active: false });

  // Caché: reflejar el cambio de status para que las consultas no vean activo
  try {
    const raw = await redisClient.get(`user:${userId}`);
    if (raw) {
      const cached = JSON.parse(raw) as CachedRedisUser;
      cached.status = 'inactive';
      await redisClient.set(`user:${userId}`, JSON.stringify(cached), 'EX', USER_CACHE_TTL);
    }
  } catch (err: any) {
    // No bloqueamos si Redis falla; la BD ya quedó consistente
    console.warn(`[user-cache] No se pudo actualizar Redis para userId=${userId}: ${err.message}`);
  }

  console.log(`[user-cache] Credencial desactivada para userId=${userId}`);
};
