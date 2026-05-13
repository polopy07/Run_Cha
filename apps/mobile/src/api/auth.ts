import { auth } from './firebase';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

async function sendFirebaseToken(idToken: string) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ idToken }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message ?? 'Login failed');
  }

  return data;
}

export async function login(email: string, password: string) {
  const userCredential = await auth.signInWithEmailAndPassword(email, password);
  const idToken = await userCredential.user.getIdToken();

  return sendFirebaseToken(idToken);
}

export async function signup(email: string, password: string) {
  const userCredential = await auth.createUserWithEmailAndPassword(
    email,
    password,
  );
  const idToken = await userCredential.user.getIdToken();

  return sendFirebaseToken(idToken);
}
