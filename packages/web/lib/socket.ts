import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

let socket: Socket | null = null;

/** Tek Socket.IO baglantisi dondurur (singleton) */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: false,
    });
  }
  return socket;
}

/** Socket'i JWT token ile authenticate et. Store'dan guncel token alinir. */
export function authenticateSocket(): void {
  const s = getSocket();
  const token = useAuthStore.getState().accessToken;
  if (token) {
    s.emit('authenticate', token);
  }
}

/** Socket baglantisini kapat ve singleton'i temizle */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
