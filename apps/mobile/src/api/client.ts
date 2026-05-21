import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@env';
import { auth } from './firebase';

const TOKEN_KEY = 'accessToken';
let isRefreshing = false;

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

  if (response.status === 401 && !isRefreshing) {
    isRefreshing = true;
    try {
      const firebaseUser = auth.currentUser;
      if (firebaseUser) {
        const idToken = await firebaseUser.getIdToken(true);
        const loginRes = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
        if (loginRes.ok) {
          const data = await loginRes.json();
          await saveToken(data.accessToken);
          headers.Authorization = `Bearer ${data.accessToken}`;
          const retry = await fetch(`${API_URL}${path}`, { ...options, headers });
          if (retry.ok) {
            return retry.json();
          }
        }
      }
    } finally {
      isRefreshing = false;
    }
  }

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
