import { apiFetch } from './client';
import { Coordinate } from '../utils/geoUtils';

type FinishRunningPayload = {
  path: Coordinate[];
  distance_km: number;
  started_at: string;
};

export async function finishRunning(payload: FinishRunningPayload) {
  return apiFetch('/running/finish', {
    method: 'POST',
    body: JSON.stringify({
      path: payload.path.map((c) => ({ lat: c.latitude, lng: c.longitude })),
      distance_km: payload.distance_km,
      started_at: payload.started_at,
    }),
  });
}
