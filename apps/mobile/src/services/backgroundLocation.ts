import { Platform } from 'react-native';

// iOS는 UIBackgroundModes: location으로 백그라운드 GPS 처리 → 네이티브 모듈 불필요
if (Platform.OS === 'ios') {
  module.exports = {
    startBackgroundTracking: async () => ({ ok: true }),
    stopBackgroundTracking: async () => {},
  };
} else {
  const BackgroundService = require('react-native-background-actions').default;

  const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

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

  module.exports = {
    startBackgroundTracking: async (): Promise<{ ok: boolean; error?: string }> => {
      try {
        await BackgroundService.start(backgroundTask, options);
        return { ok: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn('[BackgroundLocation] start failed:', msg);
        return { ok: false, error: msg };
      }
    },
    stopBackgroundTracking: async (): Promise<void> => {
      try {
        await BackgroundService.stop();
      } catch (e) {
        console.warn('[BackgroundLocation] stop failed:', e);
      }
    },
  };
}
