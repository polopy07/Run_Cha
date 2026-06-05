import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import {
  startBackgroundTracking,
  stopBackgroundTracking,
} from '../services/backgroundLocation';
import { getSocket } from '../api/socket';

export type LatLng = {
  latitude: number;
  longitude: number;
};

let _lastLocation: LatLng | null = null;
export const getLastLocation = () => _lastLocation;
export const updateSharedLocation = (loc: LatLng) => { _lastLocation = loc; };

const EMIT_INTERVAL_MS = 3000;

export function useGPS() {
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(_lastLocation);
  const [isTracking, setIsTracking] = useState(false);
  const lastEmitRef = useRef(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void (async () => {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('위치 권한 필요', 'GPS 사용을 위해 위치 권한을 허용해주세요.');
      }
    })();
  }, []);

  const handleLocationChange = useCallback(
    (e: { nativeEvent: { coordinate?: LatLng } }) => {
      const coord = e.nativeEvent.coordinate;
      if (!coord) return;
      _lastLocation = coord;
      setCurrentLocation(coord);

      const now = Date.now();
      if (now - lastEmitRef.current >= EMIT_INTERVAL_MS) {
        lastEmitRef.current = now;
        getSocket()?.emit('location:update', {
          lat: coord.latitude,
          lng: coord.longitude,
        });
      }
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
