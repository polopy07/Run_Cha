import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '@env';
import { getToken } from './client';

let socket: Socket | null = null;

export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  const token = await getToken();

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
