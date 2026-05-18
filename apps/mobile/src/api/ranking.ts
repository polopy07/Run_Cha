import { apiFetch } from './client';

export async function getRankings() {
  return apiFetch('/ranking');
}
