const mockUser = {
  getIdToken: jest.fn(() => Promise.resolve('mock-id-token')),
};

// initializeAuth와 getAuth가 동일한 객체를 반환해야
// client.ts/authStore.ts의 auth.currentUser 조작이 테스트에 반영됨
const mockAuthObject = { currentUser: null };

module.exports = {
  initializeAuth: jest.fn(() => mockAuthObject),
  getAuth: jest.fn(() => mockAuthObject),
  getReactNativePersistence: jest.fn(() => 'mock-persistence'),
  signInWithEmailAndPassword: jest.fn(() =>
    Promise.resolve({ user: mockUser }),
  ),
  createUserWithEmailAndPassword: jest.fn(() =>
    Promise.resolve({ user: mockUser }),
  ),
  signOut: jest.fn(() => Promise.resolve()),
  onAuthStateChanged: jest.fn((authInstance, callback) => {
    callback(null);
    return jest.fn();
  }),
};
