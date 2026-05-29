import useAuthStore from '../src/store/authStore';

const mockLoginResponse = {
  id: 1,
  email: 'test@test.com',
  nickname: 'tester',
  points: 100,
  totalDistance: 5.5,
  accessToken: 'jwt-token-123',
};

const mockUserResponse = {
  id: 1,
  email: 'test@test.com',
  nickname: 'tester',
  points: 100,
  totalDistance: 5.5,
};

beforeEach(() => {
  jest.clearAllMocks();
  (global.fetch as jest.Mock) = jest.fn();

  const AsyncStorage = require('@react-native-async-storage/async-storage');
  (AsyncStorage.clear as jest.Mock)();

  useAuthStore.setState({
    user: null,
    accessToken: null,
    isLoggedIn: false,
    isLoading: true,
  });
});

describe('authStore', () => {
  describe('login', () => {
    it('Firebase 인증 → 서버 JWT 발급 → 상태 업데이트', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockLoginResponse),
      });

      await useAuthStore.getState().login('test@test.com', 'password');

      const state = useAuthStore.getState();
      expect(state.isLoggedIn).toBe(true);
      expect(state.accessToken).toBe('jwt-token-123');
      expect(state.user).toEqual(mockUserResponse);
    });
  });

  describe('signup', () => {
    it('Firebase 회원가입 → 서버 JWT 발급 → 상태 업데이트', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockLoginResponse),
      });

      await useAuthStore.getState().signup('new@test.com', 'password');

      const state = useAuthStore.getState();
      expect(state.isLoggedIn).toBe(true);
      expect(state.accessToken).toBe('jwt-token-123');
      expect(state.user).toEqual(mockUserResponse);
    });
  });

  describe('logout', () => {
    it('로그아웃 시 상태 초기화 및 토큰 삭제', async () => {
      useAuthStore.setState({
        user: mockUserResponse,
        accessToken: 'jwt-token-123',
        isLoggedIn: true,
      });

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.isLoggedIn).toBe(false);
    });
  });

  describe('restoreSession', () => {
    it('firebaseUser 없으면 로그인 상태 변경 없이 종료', async () => {
      await useAuthStore.getState().restoreSession();

      const state = useAuthStore.getState();
      expect(state.isLoggedIn).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it('복원 실패 시 로그아웃 상태로 전환', async () => {
      const { getAuth } = require('firebase/auth');
      const mockAuthInstance = getAuth();
      mockAuthInstance.currentUser = { getIdToken: jest.fn(() => Promise.resolve('id-tok')) };

      (global.fetch as jest.Mock).mockRejectedValue(new Error('network error'));

      await useAuthStore.getState().restoreSession();

      const state = useAuthStore.getState();
      expect(state.isLoggedIn).toBe(false);
      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(false);

      mockAuthInstance.currentUser = null;
    });
  });

  describe('fetchMe', () => {
    it('유저 정보 조회 후 상태 업데이트', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUserResponse),
      });

      await useAuthStore.getState().fetchMe();

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUserResponse);
    });
  });
});
