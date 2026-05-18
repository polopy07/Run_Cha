const mockUser = {
  getIdToken: jest.fn(() => Promise.resolve('mock-id-token')),
};

module.exports = {
  getAuth: jest.fn(() => ({
    currentUser: null,
  })),
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
