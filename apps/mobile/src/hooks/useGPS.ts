import { useCallback, useEffect, useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import {
  startBackgroundTracking,
  stopBackgroundTracking,
} from '../services/backgroundLocation';

export type LatLng = {
  latitude: number;
  longitude: number;
};

// 화면 간 마지막 위치 공유 (각 useGPS() 인스턴스가 독립적 state를 가져서)
let _lastLocation: LatLng | null = null;
export const getLastLocation = () => _lastLocation;

export function useGPS() {
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(_lastLocation);
  const [isTracking, setIsTracking] = useState(false);

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
