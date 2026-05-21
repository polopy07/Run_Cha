const mockAuth = () => ({
  signInWithEmailAndPassword: jest.fn(() =>
    Promise.resolve({
      user: { getIdToken: jest.fn(() => Promise.resolve('mock-id-token')) },
    }),
  ),
  createUserWithEmailAndPassword: jest.fn(() =>
    Promise.resolve({
      user: { getIdToken: jest.fn(() => Promise.resolve('mock-id-token')) },
    }),
  ),
  signOut: jest.fn(() => Promise.resolve()),
  onAuthStateChanged: jest.fn((callback) => {
    callback(null);
    return jest.fn(); // unsubscribe
  }),
  currentUser: null,
});

module.exports = mockAuth;
module.exports.default = mockAuth;
