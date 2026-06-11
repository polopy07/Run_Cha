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

type SocketHandlers = {
  onConnect: () => void;
  onDisconnect: () => void;
  onBroadcast: (data: OnlineUser) => void;
  onUserOnline: (data: OnlineUser) => void;
  onUserOffline: (data: { userId: number }) => void;
  onRankingUpdate: () => void;
  onTerritoryUpdate: () => void;
};

export function useSocket(options?: SocketOptions) {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn);
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState<Map<number, OnlineUser & { lastSeen: number }>>(new Map());
  const staleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbacksRef = useRef(options);
  callbacksRef.current = options;
  const handlersRef = useRef<SocketHandlers | null>(null);

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

        const onConnect = () => { if (mounted) setIsConnected(true); };
        const onDisconnect = () => { if (mounted) setIsConnected(false); };
        const onBroadcast = (data: OnlineUser) => {
          if (!mounted) return;
          setNearbyUsers(prev => {
            const next = new Map(prev);
            next.set(data.userId, { ...data, lastSeen: Date.now() });
            return next;
          });
        };
        const onUserOnline = (data: OnlineUser) => {
          if (!mounted) return;
          setNearbyUsers(prev => {
            const next = new Map(prev);
            next.set(data.userId, { ...data, lastSeen: Date.now() });
            return next;
          });
        };
        const onUserOffline = (data: { userId: number }) => {
          if (!mounted) return;
          setNearbyUsers(prev => {
            const next = new Map(prev);
            next.delete(data.userId);
            return next;
          });
        };
        const onRankingUpdate = () => { if (mounted) callbacksRef.current?.onRankingUpdate?.(); };
        const onTerritoryUpdate = () => { if (mounted) callbacksRef.current?.onTerritoryUpdate?.(); };

        sock.on('connect', onConnect);
        sock.on('disconnect', onDisconnect);
        sock.on('location:broadcast', onBroadcast);
        sock.on('user:online', onUserOnline);
        sock.on('user:offline', onUserOffline);
        sock.on('ranking:update', onRankingUpdate);
        sock.on('territory:update', onTerritoryUpdate);

        handlersRef.current = { onConnect, onDisconnect, onBroadcast, onUserOnline, onUserOffline, onRankingUpdate, onTerritoryUpdate };

        if (sock.connected) setIsConnected(true);
      } catch (e) {
        if (mounted) console.warn('[useSocket] connectSocket 실패', e);
      }
    })();

    staleTimerRef.current = setInterval(() => {
      if (!mounted) return;
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
      const h = handlersRef.current;
      if (sock && h) {
        sock.off('connect', h.onConnect);
        sock.off('disconnect', h.onDisconnect);
        sock.off('location:broadcast', h.onBroadcast);
        sock.off('user:online', h.onUserOnline);
        sock.off('user:offline', h.onUserOffline);
        sock.off('ranking:update', h.onRankingUpdate);
        sock.off('territory:update', h.onTerritoryUpdate);
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
