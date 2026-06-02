import { apiFetch } from './client';
import type { Character } from '../store/characterStore';

export type UpgradeStat = 'attack' | 'defense';

export type DismantleCharactersResponse = {
  dismantledCount: number;
  earnedStatPoints: number;
  statPoints: number;
  remainingCharacterCount: number;
};

export async function getCharacters() {
  return apiFetch<Character[]>('/characters/me');
}

export async function upgradeCharacter(characterId: number, stat: UpgradeStat) {
  return apiFetch(`/characters/${characterId}/upgrade`, {
    method: 'PATCH',
    body: JSON.stringify({ stat }),
  });
}

export async function deployCharacter(
  characterId: number,
  territoryId: number | null,
) {
  return apiFetch<Character>(`/characters/${characterId}/deploy`, {
    method: 'PATCH',
    body: JSON.stringify({ territory_id: territoryId }),
  });
}

export async function dismantleCharacters(userCharacterIds: number[]) {
  return apiFetch<DismantleCharactersResponse>('/characters/dismantle', {
    method: 'POST',
    body: JSON.stringify({ userCharacterIds }),
  });
}
