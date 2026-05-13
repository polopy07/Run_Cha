const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function drawGacha() {
  const response = await fetch(`${API_URL}/gacha/draw`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to draw gacha');
  }

  return response.json();
}
