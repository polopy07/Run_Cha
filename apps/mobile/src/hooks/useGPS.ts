import { useCallback, useEffect, useState } from 'react';
import Geolocation from '@react-native-community/geolocation';
import {
  startBackgroundTracking,
  stopBackgroundTracking,
} from '../services/backgroundLocation';
import { requestAndroidRunningPermissions } from '../services/runningPermissions';

export type LatLng = {
  latitude: number;
  longitude: number;
};

// Module-level singleton watcher — shared across all hook instances
let lastLocation: LatLng | null = null;
let watchId: number | null = null;
const locationListeners = new Set<(loc: LatLng) => void>();

Geolocation.setRNConfiguration({
  skipPermissionRequests: false,
  authorizationLevel: 'always',
  enableBackgroundLocationUpdates: true,
  locationProvider: 'auto',
});

function startWatcher() {
  if (watchId !== null) return;
  watchId = Geolocation.watchPosition(
    (pos) => {
      const coord: LatLng = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      lastLocation = coord;
      locationListeners.forEach((fn) => fn(coord));
    },
    (err) => {
      console.warn('[useGPS] watchPosition error:', err.code, err.message);
      watchId = null;
    },
    {
      enableHighAccuracy: true,
      distanceFilter: 3,
      interval: 3000,
      fastestInterval: 1000,
    },
  );
}

export function getLastLocation() {
  return lastLocation;
}

export function updateSharedLocation(loc: LatLng) {
  lastLocation = loc;
}

export function useGPS() {
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(lastLocation);
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    locationListeners.add(setCurrentLocation);

    // Request system permission, then start singleton watcher
    Geolocation.requestAuthorization(
      () => startWatcher(),
      (err) => console.warn('[useGPS] requestAuthorization error:', err.message),
    );

    return () => {
      locationListeners.delete(setCurrentLocation);
    };
  }, []);

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
    start,
    stop,
  };
}
