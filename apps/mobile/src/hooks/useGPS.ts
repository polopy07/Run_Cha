import { useCallback, useEffect, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
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

  useEffect(() => {
    if (Platform.OS === 'android') {
      PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    }
    // iOS는 MapView의 showsUserLocation={true}가 자동으로 권한 요청
  }, []);

  const handleLocationChange = useCallback(
    (e: { nativeEvent: { coordinate?: LatLng } }) => {
      const coord = e.nativeEvent.coordinate;
      if (!coord) return;
      setCurrentLocation(coord);
    },
    [],
  );

  const start = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
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
