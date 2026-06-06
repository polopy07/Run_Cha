import { useCallback, useState } from 'react';
import {
  startBackgroundTracking,
  stopBackgroundTracking,
} from '../services/backgroundLocation';
import { requestAndroidRunningPermissions } from '../services/runningPermissions';

export type LatLng = {
  latitude: number;
  longitude: number;
};

let lastLocation: LatLng | null = null;

export function getLastLocation() {
  return lastLocation;
}

export function useGPS() {
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  const handleLocationChange = useCallback(
    (e: { nativeEvent: { coordinate?: LatLng } }) => {
      const coord = e.nativeEvent.coordinate;
      if (!coord) return;
      lastLocation = coord;
      setCurrentLocation(coord);
    },
    [],
  );

  const start = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    const permissionResult = await requestAndroidRunningPermissions();
    if (!permissionResult.ok) {
      setIsTracking(false);
      return permissionResult;
    }

    const result = await startBackgroundTracking();
    setIsTracking(result.ok);
    return result;
  }, []);

  const stop = useCallback(async () => {
    await stopBackgroundTracking();
    setIsTracking(false);
  }, []);

  return {
    currentLocation,
    isTracking,
    handleLocationChange,
    start,
    stop,
  };
}
