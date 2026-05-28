import { useCallback, useRef, useState } from 'react';
import {
  startBackgroundTracking,
  stopBackgroundTracking,
} from '../services/backgroundLocation';

export type LatLng = {
  latitude: number;
  longitude: number;
};

export function useGPS() {
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const initialMoveDone = useRef(false);

  const handleLocationChange = useCallback(
    (e: { nativeEvent: { coordinate?: LatLng } }) => {
      const coord = e.nativeEvent.coordinate;
      if (!coord) return;
      setCurrentLocation(coord);
    },
    [],
  );

  const start = useCallback(async (): Promise<boolean> => {
    const granted = await startBackgroundTracking();
    setIsTracking(granted);
    return granted;
  }, []);

  const stop = useCallback(async () => {
    await stopBackgroundTracking();
    setIsTracking(false);
  }, []);

  const resetInitialMove = useCallback(() => {
    initialMoveDone.current = false;
  }, []);

  const consumeInitialMove = useCallback((): boolean => {
    if (initialMoveDone.current) return false;
    initialMoveDone.current = true;
    return true;
  }, []);

  return {
    currentLocation,
    isTracking,
    handleLocationChange,
    start,
    stop,
    resetInitialMove,
    consumeInitialMove,
    // TODO: Socket.io 연동 시 추가 예정
    // emitLocation: (coord: LatLng) => socket.emit('location', coord),
  };
}
