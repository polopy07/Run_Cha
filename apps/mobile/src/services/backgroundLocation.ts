import BackgroundService from 'react-native-background-actions';

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

const backgroundTask = async () => {
  while (BackgroundService.isRunning()) {
    // 위치 수신은 MapView.onUserLocationChange + useGPS가 처리
    // 이 서비스는 앱을 백그라운드에서도 살려두는 역할
    await sleep(3000);
  }
};

const options = {
  taskName: 'RunTerritory',
  taskTitle: 'Run Territory',
  taskDesc: '러닝 중 GPS를 기록하고 있습니다',
  taskIcon: {
    name: 'ic_launcher',
    type: 'mipmap',
  },
  color: '#3EEBBE',
  linkingURI: undefined,
  parameters: { delay: 3000 },
};

export async function startBackgroundTracking(): Promise<{ ok: boolean; error?: string }> {
  try {
    await BackgroundService.start(backgroundTask, options);
    return { ok: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn('[BackgroundLocation] start failed:', msg);
    return { ok: false, error: msg };
  }
}

export async function stopBackgroundTracking(): Promise<void> {
  try {
    await BackgroundService.stop();
  } catch (e) {
    console.warn('[BackgroundLocation] stop failed:', e);
  }
}
