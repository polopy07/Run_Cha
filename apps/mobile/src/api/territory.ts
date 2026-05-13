const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function getTerritories() {
  const response = await fetch(`${API_URL}/territories`);

  if (!response.ok) {
    throw new Error('Failed to fetch territories');
  }

  return response.json();
}
