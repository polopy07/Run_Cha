import { apiFetch } from './client';

export interface TerritoryBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export type Territory = {
  id: number;
  userId?: number;
  coordinates: { lat: number; lng: number }[];
  areaSqm: number;
  occupationRate: number;
  lastActiveAt?: string;
};

export type TerritoryDeployedCharacter = {
  id: number;
  characterId: number;
  name: string;
  grade: 'common' | 'rare' | 'epic' | 'legendary';
  type: 'attack' | 'defense' | 'buff';
  attackLv: number;
  defenseLv: number;
  speedLv: number;
  pointLv: number;
};

export type TerritoryDetail = Omit<Territory, 'userId'> & {
  owner: {
    id: number;
    nickname: string;
  };
  isMine: boolean;
  deployedCharacters: TerritoryDeployedCharacter[];
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

export async function getTerritoryDetail(id: number) {
  return apiFetch<TerritoryDetail>(`/territories/${id}`);
}
