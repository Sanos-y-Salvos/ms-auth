import Bull from 'bull';
import { userEventsQueue } from '../config/redis';
import {
  syncUserRegistered,
  syncUserUpdated,
  syncUserDeleted,
  syncUserPasswordChanged,
} from '../services/user-cache.service';
import type {
  UserRegisteredPayload,
  UserUpdatedPayload,
  UserDeletedPayload,
  UserPasswordChangedPayload,
} from '../services/types';

export const startEventConsumers = (): void => {
  userEventsQueue.process('user.registered', async (job: Bull.Job<UserRegisteredPayload>) => {
    console.log(`[consumer] user.registered recibido → userId=${job.data.userId}`);
    await syncUserRegistered(job.data);
  });

  userEventsQueue.process('user.updated', async (job: Bull.Job<UserUpdatedPayload>) => {
    console.log(`[consumer] user.updated recibido → userId=${job.data.userId}`);
    await syncUserUpdated(job.data);
  });

  userEventsQueue.process('user.deleted', async (job: Bull.Job<UserDeletedPayload>) => {
    console.log(`[consumer] user.deleted recibido → userId=${job.data.userId}`);
    await syncUserDeleted(job.data.userId);
  });

  userEventsQueue.process('user.password.changed', async (job: Bull.Job<UserPasswordChangedPayload>) => {
    console.log(`[consumer] user.password.changed recibido → userId=${job.data.userId}`);
    await syncUserPasswordChanged(job.data);
  });

  userEventsQueue.on('failed', (job: Bull.Job, err: Error) => {
    console.error(
      `[consumer] Job fallido: id=${job.id} name=${job.name} intento=${job.attemptsMade}/5 → ${err.message}`
    );
  });

  userEventsQueue.on('completed', (job: Bull.Job) => {
    console.log(`[consumer] Job completado: id=${job.id} name=${job.name}`);
  });

  userEventsQueue.on('stalled', (job: Bull.Job) => {
    console.warn(`[consumer] Job estancado (stalled): id=${job.id} name=${job.name}`);
  });

  console.log('[consumer] Consumers de eventos de usuario iniciados');
};
