import { useCallback, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  startBackgroundTracking,
  stopBackgroundTracking,
} from '../services/backgroundLocation';

export type LatLng = {
  latitude: number;
  longitude: number;
};

async function requestAndroidRunningPermissions(): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (Platform.OS !== 'android') {
    return { ok: true };
  }

  const fineLocation = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );

  if (fineLocation !== PermissionsAndroid.RESULTS.GRANTED) {
    return { ok: false, error: '러닝 기록을 시작하려면 위치 권한이 필요합니다.' };
  }

  if (Number(Platform.Version) >= 33) {
    const notification = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );

    if (notification !== PermissionsAndroid.RESULTS.GRANTED) {
      return { ok: false, error: '러닝 기록 알림 권한이 필요합니다.' };
    }
  }

  return { ok: true };
}

export function useGPS() {
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  const handleLocationChange = useCallback(
    (e: { nativeEvent: { coordinate?: LatLng } }) => {
      const coord = e.nativeEvent.coordinate;
      if (!coord) return;
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
