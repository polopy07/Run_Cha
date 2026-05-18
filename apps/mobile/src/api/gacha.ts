import { apiFetch } from './client';

export async function drawGacha() {
  return apiFetch('/gacha/draw', { method: 'POST' });
}
