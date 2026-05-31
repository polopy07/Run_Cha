import { apiFetch } from './client';

type DrawGachaResponse = {
  results: {
    characterId: number;
    name: string;
    grade: 'common' | 'rare' | 'epic' | 'legendary';
    type: 'attack' | 'defense' | 'buff';
    isNew: boolean;
  }[];
  remainingPoints: number;
};

export async function drawGacha(count: 1 | 10) {
  return apiFetch<DrawGachaResponse>('/gacha/draw', {
    method: 'POST',
    body: JSON.stringify({ count }),
  });
}
