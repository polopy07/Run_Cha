const mockUser = {
  getIdToken: jest.fn(() => Promise.resolve('mock-id-token')),
};

module.exports = {
  initializeAuth: jest.fn(() => ({
    currentUser: null,
  })),
  getAuth: jest.fn(() => ({
    currentUser: null,
  })),
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
