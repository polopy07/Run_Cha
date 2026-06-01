import { Platform } from 'react-native';

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function startBackgroundTracking(): Promise<{ ok: boolean; error?: string }> {
  if (Platform.OS === 'ios') {
    // iOS는 UIBackgroundModes: location으로 백그라운드 GPS 처리
    return { ok: true };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const BackgroundService = require('react-native-background-actions').default;

    const backgroundTask = async () => {
      while (BackgroundService.isRunning()) {
        await sleep(3000);
      }
    };

    const options = {
      taskName: 'RunTerritory',
      taskTitle: 'Run Territory',
      taskDesc: '러닝 중 GPS를 기록하고 있습니다',
      taskIcon: { name: 'ic_launcher', type: 'mipmap' },
      color: '#3EEBBE',
      linkingURI: undefined,
      parameters: { delay: 3000 },
    };

    await BackgroundService.start(backgroundTask, options);
    return { ok: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn('[BackgroundLocation] start failed:', msg);
    return { ok: false, error: msg };
  }
}

export async function stopBackgroundTracking(): Promise<void> {
  if (Platform.OS === 'ios') {
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const BackgroundService = require('react-native-background-actions').default;
    await BackgroundService.stop();
  } catch (e) {
    console.warn('[BackgroundLocation] stop failed:', e);
  }
}
