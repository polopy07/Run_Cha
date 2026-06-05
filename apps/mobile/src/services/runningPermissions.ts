import { PermissionsAndroid, Platform } from 'react-native';

export async function requestAndroidRunningPermissions(): Promise<{
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
