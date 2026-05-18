import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const TOKEN_KEY = 'accessToken';

export async function saveToken(token: string) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function removeToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `Request failed: ${path}`;
    try {
      const error = await response.json();
      if (error?.message) {
        message = error.message;
      }
    } catch {}
    throw new Error(message);
  }

  return response.json();
}
