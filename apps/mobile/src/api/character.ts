import { apiFetch } from './client';

export type UpgradeStat = 'attack' | 'defense' | 'speed' | 'point';

export async function getCharacters() {
  return apiFetch('/characters/me');
}

export async function upgradeCharacter(characterId: number, stat: UpgradeStat) {
  return apiFetch(`/characters/${characterId}/upgrade`, {
    method: 'PATCH',
    body: JSON.stringify({ stat }),
  });
}
