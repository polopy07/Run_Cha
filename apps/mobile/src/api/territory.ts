import { apiFetch } from './client';

export interface TerritoryBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export async function getTerritories(bounds: TerritoryBounds) {
  const params = new URLSearchParams({
    minLat: String(bounds.minLat),
    maxLat: String(bounds.maxLat),
    minLng: String(bounds.minLng),
    maxLng: String(bounds.maxLng),
  });
  return apiFetch(`/territories?${params}`);
}
