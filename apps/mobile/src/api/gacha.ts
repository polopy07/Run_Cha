import { apiFetch } from './client';

export async function drawGacha(count: 1 | 10) {
  return apiFetch('/gacha/draw', {
    method: 'POST',
    body: JSON.stringify({ count }),
  });
}
