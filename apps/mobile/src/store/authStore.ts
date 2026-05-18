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

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isLoggedIn: false,
  isLoading: true,

  login: async (email, password) => {
    const credential = await auth.signInWithEmailAndPassword(email, password);
    const idToken = await credential.user.getIdToken();

    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });

    await saveToken(data.accessToken);

    set({
      user: {
        id: data.id,
        email: data.email,
        nickname: data.nickname,
        points: data.points,
        totalDistance: data.totalDistance,
        pityCount: data.pityCount,
      },
      accessToken: data.accessToken,
      isLoggedIn: true,
    });
  },

  signup: async (email, password) => {
    const credential = await auth.createUserWithEmailAndPassword(
      email,
      password,
    );
    const idToken = await credential.user.getIdToken();

    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });

    await saveToken(data.accessToken);

    set({
      user: {
        id: data.id,
        email: data.email,
        nickname: data.nickname,
        points: data.points,
        totalDistance: data.totalDistance,
        pityCount: data.pityCount,
      },
      accessToken: data.accessToken,
      isLoggedIn: true,
    });
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

      if (token && firebaseUser) {
        // JWT 있고 Firebase 세션도 살아있음 → 유저 정보 조회
        const data = await apiFetch('/users/me');
        set({
          user: {
            id: data.id,
            email: data.email,
            nickname: data.nickname,
            points: data.points,
            totalDistance: data.totalDistance,
            pityCount: data.pityCount,
          },
          accessToken: token,
          isLoggedIn: true,
        });
      } else if (firebaseUser) {
        // JWT 만료됐지만 Firebase 세션 살아있음 → 재발급
        const idToken = await firebaseUser.getIdToken(true);
        const data = await apiFetch('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ idToken }),
        });

        await saveToken(data.accessToken);
        set({
          user: {
            id: data.id,
            email: data.email,
            nickname: data.nickname,
            points: data.points,
            totalDistance: data.totalDistance,
            pityCount: data.pityCount,
          },
          accessToken: data.accessToken,
          isLoggedIn: true,
        });
      }
    } catch {
      // 복원 실패 → 로그아웃 상태로
      await removeToken();
      set({ user: null, accessToken: null, isLoggedIn: false });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMe: async () => {
    const data = await apiFetch('/users/me');
    set({
      user: {
        id: data.id,
        email: data.email,
        nickname: data.nickname,
        points: data.points,
        totalDistance: data.totalDistance,
        pityCount: data.pityCount,
      },
    });
  },
}));

export default useAuthStore;
