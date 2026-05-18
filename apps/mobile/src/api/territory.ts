import { apiFetch } from './client';

export async function getTerritories() {
  return apiFetch('/territories');
}
