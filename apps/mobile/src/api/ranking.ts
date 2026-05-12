const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function getRankings() {
  const response = await fetch(`${API_URL}/ranking`);

  if (!response.ok) {
    throw new Error('Failed to fetch rankings');
  }

  return response.json();
}
