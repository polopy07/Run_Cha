const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
  removeAllListeners: jest.fn(),
  connected: false,
};

module.exports = {
  io: jest.fn(() => mockSocket),
  __mockSocket: mockSocket,
};
