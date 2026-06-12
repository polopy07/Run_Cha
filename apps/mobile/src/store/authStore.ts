import { create } from 'zustand';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth } from '../api/firebase';
import { apiFetch, saveToken, getToken, removeToken } from '../api/client';

export type RepresentativeCharacter = {
  id: number;
  characterId: number;
  name: string;
  type: 'attack' | 'defense' | 'buff';
  grade: 'common' | 'rare' | 'epic' | 'legendary';
  imageUrl: string | null;
  level: number;
  experience: number;
  nextLevelExperience: number | null;
};

export type User = {
  id: number;
  email: string;
  nickname: string;
  points: number;
  statPoints: number;
  totalDistance: number;
  representativeCharacter: RepresentativeCharacter | null;
};

type LoginResponse = User & { accessToken: string };

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
  setRepresentative: (userCharacterId: number | null) => Promise<void>;
  updateNickname: (nickname: string) => Promise<void>;
};

async function authenticateWithServer(
  idToken: string,
  set: (state: Partial<AuthState>) => void,
) {
  const data = await apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });

  const { accessToken, ...user } = data;
  await saveToken(accessToken);
  set({ user, accessToken, isLoggedIn: true });
}

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isLoggedIn: false,
  isLoading: true,

  login: async (email, password) => {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await credential.user.getIdToken();
    await authenticateWithServer(idToken, set);
  },

  signup: async (email, password) => {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    const idToken = await credential.user.getIdToken();
    await authenticateWithServer(idToken, set);
  },

  logout: async () => {
    await signOut(auth);
    await removeToken();
    set({ user: null, accessToken: null, isLoggedIn: false });
  },

  restoreSession: async () => {
    try {
      const token = await getToken();

      if (token) {
        // JWT가 있으면 Firebase 초기화 여부와 무관하게 바로 /users/me 시도
        // 만료된 경우 apiFetch 401 인터셉터가 Firebase로 갱신 처리
        const data = await apiFetch<User>('/users/me');
        set({ user: data, accessToken: token, isLoggedIn: true });
      } else {
        // JWT 없음 — Firebase로 새 토큰 발급 필요 (첫 로그인 또는 로그아웃 후)
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) return;
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
    set({ user: data });
  },

  setRepresentative: async (userCharacterId) => {
    const data = await apiFetch<User>('/users/me/representative', {
      method: 'PUT',
      body: JSON.stringify({ userCharacterId }),
    });
    set({ user: data });
  },

  updateNickname: async (nickname) => {
    const data = await apiFetch<User>('/users/me/nickname', {
      method: 'PATCH',
      body: JSON.stringify({ nickname }),
    });
    set({ user: data });
  },
}));

export default useAuthStore;
