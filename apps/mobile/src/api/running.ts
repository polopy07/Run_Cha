import { apiFetch } from './client';
import { Coordinate } from '../utils/geoUtils';

type FinishRunningPayload = {
  path: Coordinate[];
  distance_km: number;
  started_at: string;
};

export type FinishRunningResponse = {
  log: {
    id: number;
    distance_km: number;
    earned_points: number;
    area_sqm: number;
    avg_pace: number;
    started_at: string;
    ended_at: string;
  };
  territory: {
    id: number;
    coordinates: { lat: number; lng: number }[];
    area_sqm: number;
    occupation_rate: number;
  } | null;
  earned_points: number;
  area_sqm: number;
};

export async function finishRunning(payload: FinishRunningPayload) {
  return apiFetch<FinishRunningResponse>('/running/finish', {
    method: 'POST',
    body: JSON.stringify({
      path: payload.path.map((c) => ({ lat: c.latitude, lng: c.longitude })),
      distance_km: payload.distance_km,
      started_at: payload.started_at,
    }),
  });
}
