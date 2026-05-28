import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import useRunningStore from '../store/runningStore';

const TASK_NAME = 'background-location-task';

TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
  if (error) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations || locations.length === 0) return;

  const store = useRunningStore.getState();
  if (!store.isRunning) return;

  for (const loc of locations) {
    store.updatePosition({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    });
  }
});

export async function requestLocationPermissions(): Promise<boolean> {
  const { status: foreground } = await Location.requestForegroundPermissionsAsync();
  if (foreground !== 'granted') return false;

  const { status: background } = await Location.requestBackgroundPermissionsAsync();
  return background === 'granted';
}

export async function startBackgroundTracking(): Promise<boolean> {
  const hasPermission = await requestLocationPermissions();
  if (!hasPermission) return false;

  const isStarted = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false);
  if (isStarted) return true;

  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: 3000,
    distanceInterval: 5,
    foregroundService: {
      notificationTitle: 'Run Territory',
      notificationBody: '러닝 중 GPS를 기록하고 있습니다',
      notificationColor: '#3EEBBE',
    },
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
  });

  return true;
}

export async function stopBackgroundTracking(): Promise<void> {
  const isStarted = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false);
  if (isStarted) {
    await Location.stopLocationUpdatesAsync(TASK_NAME);
  }
}
