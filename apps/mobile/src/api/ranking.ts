import { apiFetch } from './client';

export async function getAreaRanking() {
  return apiFetch('/ranking/area');
}

export async function getDistanceRanking() {
  return apiFetch('/ranking/distance');
}
