import { apiFetch } from './client';

export async function getCharacters() {
  return apiFetch('/characters/me');
}

export async function upgradeCharacter(characterId: number) {
  return apiFetch(`/characters/${characterId}/upgrade`, {
    method: 'PATCH',
  });
}
