import type { Channel } from 'amqplib';
import { QUEUE } from '../config/rabbitmq';
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

export const startEventConsumers = (channel: Channel): void => {
  channel.consume(QUEUE, async (msg) => {
    if (!msg) return;

    let payload: any;

    try {
      payload = JSON.parse(msg.content.toString());
    } catch {
      console.error('[consumer] Mensaje con formato inválido, descartado');
      channel.nack(msg, false, false);
      return;
    }

    try {
      const { event } = payload;
      console.log(`[consumer] ${event} recibido → userId=${payload.userId}`);

      if (event === 'user.registered') {
        await syncUserRegistered(payload as UserRegisteredPayload);
      } else if (event === 'user.updated') {
        await syncUserUpdated(payload as UserUpdatedPayload);
      } else if (event === 'user.deleted') {
        await syncUserDeleted((payload as UserDeletedPayload).userId);
      } else if (event === 'user.password.changed') {
        await syncUserPasswordChanged(payload as UserPasswordChangedPayload);
      } else {
        console.warn(`[consumer] Evento desconocido: ${event}`);
      }

      channel.ack(msg);
    } catch (err: any) {
      console.error(`[consumer] Error procesando ${payload?.event}: ${err.message}`);
      // Reencola el mensaje para reintento (resilencia ante fallos transitorios)
      channel.nack(msg, false, true);
    }
  });

  console.log('[consumer] Consumers de eventos de usuario iniciados');
};
