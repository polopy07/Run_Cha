import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';

import { auth } from './firebase';

const API_URL = 'http://localhost:3000';

export async function login(email: string, password: string) {
  // Firebase 로그인
  const userCredential = await signInWithEmailAndPassword(
    auth,
    email,
    password
  );

  // Firebase ID Token 발급
  const idToken = await userCredential.user.getIdToken();

  console.log('ID TOKEN:', idToken);

  // Nest 서버로 토큰 전송
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      idToken,
    }),
  });

  const data = await response.json();

  console.log('SERVER RESPONSE:', data);

  return data;
}

export async function signup(email: string, password: string) {
  // Firebase 회원가입
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  // Firebase ID Token 발급
  const idToken = await userCredential.user.getIdToken();

  console.log('SIGNUP TOKEN:', idToken);

  // Nest 서버로 토큰 전송
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      idToken,
    }),
  });

  const data = await response.json();

  console.log('SERVER RESPONSE:', data);

  return data;
}