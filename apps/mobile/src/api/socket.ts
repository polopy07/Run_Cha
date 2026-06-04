import { io, Socket } from 'socket.io-client';
import { SOCKET_URL, API_URL } from '@env';
import { getToken } from './client';

const RESOLVED_SOCKET_URL = SOCKET_URL || API_URL;
if (!RESOLVED_SOCKET_URL) {
  console.warn('[socket] SOCKET_URL, API_URL 모두 미설정 — .env를 확인해주세요.');
}

let socket: Socket | null = null;
let connectingPromise: Promise<Socket> | null = null;

export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;
  if (connectingPromise) return connectingPromise;

  connectingPromise = (async () => {
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
    }

    const token = await getToken();

    socket = io(RESOLVED_SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    return socket;
  })().finally(() => {
    connectingPromise = null;
  });

  return connectingPromise;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  connectingPromise = null;
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
