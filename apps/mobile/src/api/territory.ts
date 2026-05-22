import { apiFetch } from './client';

export interface TerritoryBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export type Territory = {
  id: number;
  userId: number;
  coordinates: { lat: number; lng: number }[];
  areaSqm: number;
  occupationRate: number;
  centerLat?: number;
  centerLng?: number;
  center_lat?: number;
  center_lng?: number;
  lastActiveAt?: string;
};

export async function getTerritories(bounds: TerritoryBounds) {
  const params = new URLSearchParams({
    minLat: String(bounds.minLat),
    maxLat: String(bounds.maxLat),
    minLng: String(bounds.minLng),
    maxLng: String(bounds.maxLng),
  });
  return apiFetch(`/territories?${params}`);
}

export async function getMyTerritories() {
  return apiFetch<Territory[]>('/territories/me');
}
