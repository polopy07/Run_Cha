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
  name: string | null;
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
  basePointRate: number;
  attackLv: number;
  defenseLv: number;
  pointLv: number;
};

export type TerritoryDetail = Omit<Territory, 'userId' | 'lastActiveAt'> & {
  owner: {
    id: number;
    nickname: string;
  };
  isMine: boolean;
  lastActiveAt: string;
  deployedCharacters: TerritoryDeployedCharacter[];
};

export type AttackTerritoryPayload = {
  runningLogId: number;
  attackerCharacterId: number;
};

export type AttackTerritoryResponse = {
  success: boolean;
  overlapRate: number;
  contestedAreaSqm: number;
  damage: number;
  occupationRateBefore: number;
  occupationRateAfter: number;
  acquiredAreaSqm: number;
  neutralAreaSqm: number;
  nextAttackAvailableAt: string | null;
  remainingDailyAttacks: number;
  message: string;
};

export async function getTerritories(bounds: TerritoryBounds, options?: RequestInit) {
  const params = new URLSearchParams({
    minLat: String(bounds.minLat),
    maxLat: String(bounds.maxLat),
    minLng: String(bounds.minLng),
    maxLng: String(bounds.maxLng),
  });
  return apiFetch<Territory[]>(`/territories?${params}`, options);
}

export async function getMyTerritories() {
  return apiFetch<Territory[]>('/territories/me');
}

export async function getTerritoryDetail(id: number) {
  return apiFetch<TerritoryDetail>(`/territories/${id}`);
}

export async function attackTerritory(
  id: number,
  payload: AttackTerritoryPayload,
) {
  return apiFetch<AttackTerritoryResponse>(`/territories/${id}/attack`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateTerritoryName(id: number, name: string | null) {
  return apiFetch<{ id: number; name: string | null }>(
    `/territories/${id}/name`,
    {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    },
  );
}
