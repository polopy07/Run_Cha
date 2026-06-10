import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@env';
import { auth } from './firebase';

const TOKEN_KEY = 'accessToken';
let refreshPromise: Promise<string | null> | null = null;
const BASE_URL = (API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

function buildUrl(path: string) {
  return `${BASE_URL}/${path.replace(/^\/+/, '')}`;
}

export async function saveToken(token: string) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function removeToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) return null;

      const idToken = await firebaseUser.getIdToken(true);
      const res = await fetch(buildUrl('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) return null;

      const data = await res.json();
      await saveToken(data.accessToken);
      return data.accessToken as string;
    } catch {
      return null;
    }
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
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

  const response = await fetch(buildUrl(path), {
    ...options,
    headers,
  });

  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      const retry = await fetch(buildUrl(path), { ...options, headers });
      if (retry.ok) return retry.json();

      let retryMessage = `Request failed: ${path}`;
      try {
        const error = await retry.json();
        if (error?.message) retryMessage = error.message;
      } catch {}
      throw new Error(retryMessage);
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
