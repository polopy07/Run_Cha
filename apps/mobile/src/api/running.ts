import { apiFetch } from './client';
import { Coordinate } from '../utils/geoUtils';

type FinishRunningPayload = {
  path: Coordinate[];
  distance_km: number;
  started_at: string;
  territory_name?: string;
};

export type RunningLogSummary = {
  id: number;
  distanceKm: number;
  earnedPoints: number;
  avgPace: number;
  areaSqm: number;
  startedAt: string;
  endedAt: string | null;
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

export async function getRunningLogs() {
  return apiFetch<RunningLogSummary[]>('/running/logs');
}

export async function finishRunning(payload: FinishRunningPayload) {
  return apiFetch<FinishRunningResponse>('/running/finish', {
    method: 'POST',
    body: JSON.stringify({
      path: payload.path.map((c) => ({ lat: c.latitude, lng: c.longitude })),
      distance_km: payload.distance_km,
      started_at: payload.started_at,
      ...(payload.territory_name !== undefined && {
        territory_name: payload.territory_name,
      }),
    }),
  });
}
