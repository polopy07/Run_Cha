import { create } from 'zustand';
import { auth } from '../api/firebase';
import { apiFetch, saveToken, getToken, removeToken } from '../api/client';

export type User = {
  id: number;
  email: string;
  nickname: string;
  points: number;
  totalDistance: number;
  pityCount: number;
};

type LoginResponse = User & { accessToken: string };

function toUser(data: User): User {
  return {
    id: data.id,
    email: data.email,
    nickname: data.nickname,
    points: data.points,
    totalDistance: data.totalDistance,
    pityCount: data.pityCount,
  };
}

type AuthState = {
  user: User | null;
  accessToken: string | null;
  isLoggedIn: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  fetchMe: () => Promise<void>;
};

async function authenticateWithServer(
  idToken: string,
  set: (state: Partial<AuthState>) => void,
) {
  const data = await apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });

  await saveToken(data.accessToken);
  set({ user: toUser(data), accessToken: data.accessToken, isLoggedIn: true });
}

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isLoggedIn: false,
  isLoading: true,

  login: async (email, password) => {
    const credential = await auth.signInWithEmailAndPassword(email, password);
    const idToken = await credential.user.getIdToken();
    await authenticateWithServer(idToken, set);
  },

  signup: async (email, password) => {
    const credential = await auth.createUserWithEmailAndPassword(
      email,
      password,
    );
    const idToken = await credential.user.getIdToken();
    await authenticateWithServer(idToken, set);
  },

  logout: async () => {
    await auth.signOut();
    await removeToken();
    set({ user: null, accessToken: null, isLoggedIn: false });
  },

  restoreSession: async () => {
    try {
      const token = await getToken();
      const firebaseUser = auth.currentUser;

      if (!firebaseUser) {
        return;
      }

      if (token) {
        const data = await apiFetch<User>('/users/me');
        set({ user: toUser(data), accessToken: token, isLoggedIn: true });
      } else {
        const idToken = await firebaseUser.getIdToken(true);
        await authenticateWithServer(idToken, set);
      }
    } catch {
      await removeToken();
      set({ user: null, accessToken: null, isLoggedIn: false });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMe: async () => {
    const data = await apiFetch<User>('/users/me');
    set({ user: toUser(data) });
  },
}));

export default useAuthStore;
