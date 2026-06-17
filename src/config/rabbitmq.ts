import amqp, { ChannelModel, Channel } from 'amqplib';

export const EXCHANGE = 'user.events';
export const QUEUE    = 'ms-auth.user-events';
export const BINDING  = 'user.#';

let connection: ChannelModel | null = null;
let channel: Channel | null = null;

export async function connectRabbitMQ(): Promise<Channel> {
  const url = process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672';

  const conn = await amqp.connect(url);
  connection = conn;

  const ch = await conn.createChannel();
  channel = ch;

  await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
  await ch.assertQueue(QUEUE, { durable: true });
  await ch.bindQueue(QUEUE, EXCHANGE, BINDING);
  ch.prefetch(1);

  conn.on('close', () => {
    console.error('[rabbitmq] Conexión cerrada, reintentando en 5s...');
    connection = null;
    channel = null;
    setTimeout(connectRabbitMQ, 5000);
  });

  conn.on('error', (err: Error) => {
    console.error('[rabbitmq] Error de conexión:', err.message);
  });

  console.log('[rabbitmq] Conectado a RabbitMQ');
  return ch;
}

export function getChannel(): Channel {
  if (!channel) throw new Error('[rabbitmq] Canal no inicializado');
  return channel;
}
