import { SocketIoAdapterBuilder } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

export async function socketIORedisAdapter(
  namespace: any,
  redisUrl: string,
): Promise<void> {
  const pubClient = createClient({ url: redisUrl });
  const subClient = pubClient.duplicate();

  await Promise.all([pubClient.connect(), subClient.connect()]);

  namespace.adapter(createAdapter(pubClient, subClient));
}

export const socketIoConfig = {
  cors: {
    origin: (process.env.FRONTEND_URL || 'http://localhost:3000').split(','),
    credentials: true,
  },
  transports: ['websocket'],
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6,
};
