import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { connectSocket, disconnectSocket } from '../api/socket';
import useAuthStore from '../store/authStore';

export type OnlineUser = {
  userId: number;
  nickname: string;
  lat: number;
  lng: number;
  character: {
    name: string;
    type: 'attack' | 'defense' | 'buff';
    grade: 'common' | 'rare' | 'epic' | 'legendary';
    imageUrl: string | null;
  } | null;
};

const STALE_TIMEOUT_MS = 30_000;

type SocketOptions = {
  onRankingUpdate?: () => void;
  onTerritoryUpdate?: () => void;
};

export function useSocket(options?: SocketOptions) {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn);
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState<Map<number, OnlineUser & { lastSeen: number }>>(new Map());
  const staleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  useEffect(() => {
    if (!isLoggedIn) {
      disconnectSocket();
      socketRef.current = null;
      setIsConnected(false);
      setNearbyUsers(new Map());
      return;
    }

    let mounted = true;

    void (async () => {
      try {
        const sock = await connectSocket();
        if (!mounted) return;
        socketRef.current = sock;

        sock.on('connect', () => {
          if (mounted) setIsConnected(true);
        });

        sock.on('disconnect', () => {
          if (mounted) setIsConnected(false);
        });

        sock.on('location:broadcast', (data: OnlineUser) => {
          if (!mounted) return;
          setNearbyUsers(prev => {
            const next = new Map(prev);
            next.set(data.userId, { ...data, lastSeen: Date.now() });
            return next;
          });
        });

        sock.on('user:online', (data: OnlineUser) => {
          if (!mounted) return;
          setNearbyUsers(prev => {
            const next = new Map(prev);
            next.set(data.userId, { ...data, lastSeen: Date.now() });
            return next;
          });
        });

        sock.on('user:offline', (data: { userId: number }) => {
          if (!mounted) return;
          setNearbyUsers(prev => {
            const next = new Map(prev);
            next.delete(data.userId);
            return next;
          });
        });

        sock.on('ranking:update', () => {
          if (mounted) callbacksRef.current?.onRankingUpdate?.();
        });

        sock.on('territory:update', () => {
          if (mounted) callbacksRef.current?.onTerritoryUpdate?.();
        });

        if (sock.connected) setIsConnected(true);
      } catch (e) {
        if (mounted) console.warn('[useSocket] connectSocket 실패', e);
      }
    })();

    staleTimerRef.current = setInterval(() => {
      const now = Date.now();
      setNearbyUsers(prev => {
        let changed = false;
        const next = new Map(prev);
        for (const [id, user] of next) {
          if (now - user.lastSeen > STALE_TIMEOUT_MS) {
            next.delete(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 10_000);

    return () => {
      mounted = false;
      if (staleTimerRef.current) clearInterval(staleTimerRef.current);
      const sock = socketRef.current;
      if (sock) {
        sock.off('connect');
        sock.off('disconnect');
        sock.off('location:broadcast');
        sock.off('user:online');
        sock.off('user:offline');
        sock.off('ranking:update');
        sock.off('territory:update');
      }
    };
  }, [isLoggedIn]);

  const emitLocation = useCallback((lat: number, lng: number) => {
    socketRef.current?.emit('location:update', { lat, lng });
  }, []);

  const nearbyUsersArray = Array.from(nearbyUsers.values()).map(
    ({ lastSeen: _, ...user }) => user,
  );

  return {
    isConnected,
    nearbyUsers: nearbyUsersArray,
    emitLocation,
  };
}
