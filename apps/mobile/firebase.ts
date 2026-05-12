import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAdEFFv2jVzQkuFaU8yP8qvJo40AwoFrEI",
  authDomain: "run-territory-41475.firebaseapp.com",
  projectId: "run-territory-41475",
  storageBucket: "run-territory-41475.firebasestorage.app",
  messagingSenderId: "490856729817",
  appId: "1:490856729817:web:fb04229da21558b0f602c8",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);