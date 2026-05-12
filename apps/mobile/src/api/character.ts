const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function getCharacters() {
  const response = await fetch(`${API_URL}/characters`);

  if (!response.ok) {
    throw new Error('Failed to fetch characters');
  }

  return response.json();
}
