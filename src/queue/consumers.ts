// Bull: librería de colas sobre Redis
import Bull from 'bull';

// Cola compartida con ms-users (productor) → ms-auth (consumidor)
import { userEventsQueue } from '../config/redis';

// Handlers de sincronización del caché local de usuarios
import {
  syncUserRegistered,
  syncUserUpdated,
  syncUserDeleted,
  syncUserPasswordChanged,
} from '../services/user-cache.service';

// Payloads tipados de cada evento (deben coincidir con los de ms-users)
import type {
  UserRegisteredPayload,
  UserUpdatedPayload,
  UserDeletedPayload,
  UserPasswordChangedPayload,
} from '../services/types';

// Suscribe todos los consumers a la cola de eventos de usuario.
// Se invoca una sola vez al arrancar el servidor (ver server.ts).
export const startEventConsumers = (): void => {
  // user.registered → crea la credencial local y cachea el perfil
  userEventsQueue.process('user.registered', async (job: Bull.Job<UserRegisteredPayload>) => {
    console.log(`[consumer] user.registered recibido → userId=${job.data.userId}`);
    await syncUserRegistered(job.data);
  });

  // user.updated → aplica diff incremental sobre la credencial y el caché
  userEventsQueue.process('user.updated', async (job: Bull.Job<UserUpdatedPayload>) => {
    console.log(`[consumer] user.updated recibido → userId=${job.data.userId}`);
    await syncUserUpdated(job.data);
  });

  // user.deleted → marca la credencial como inactiva (no la borra físicamente)
  userEventsQueue.process('user.deleted', async (job: Bull.Job<UserDeletedPayload>) => {
    console.log(`[consumer] user.deleted recibido → userId=${job.data.userId}`);
    await syncUserDeleted(job.data.userId);
  });

  // user.password.changed → reemplaza el password_hash replicado
  userEventsQueue.process('user.password.changed', async (job: Bull.Job<UserPasswordChangedPayload>) => {
    console.log(`[consumer] user.password.changed recibido → userId=${job.data.userId}`);
    await syncUserPasswordChanged(job.data);
  });

  // Observabilidad: fallos, completions y jobs estancados
  userEventsQueue.on('failed', (job: Bull.Job, err: Error) => {
    console.error(
      `[consumer] Job fallido: id=${job.id} name=${job.name} intento=${job.attemptsMade}/5 → ${err.message}`
    );
  });

  userEventsQueue.on('completed', (job: Bull.Job) => {
    console.log(`[consumer] Job completado: id=${job.id} name=${job.name}`);
  });

  userEventsQueue.on('stalled', (job: Bull.Job) => {
    // "Stalled" = el worker no envió heartbeat a tiempo; Bull lo reintentará
    console.warn(`[consumer] Job estancado (stalled): id=${job.id} name=${job.name}`);
  });

  console.log('[consumer] Consumers de eventos de usuario iniciados');
};
