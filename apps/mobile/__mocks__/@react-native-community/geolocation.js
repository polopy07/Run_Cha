let watchIdCounter = 0;

const Geolocation = {
  setRNConfiguration: jest.fn(),
  requestAuthorization: jest.fn((success) => {
    if (success) success();
  }),
  watchPosition: jest.fn(() => {
    watchIdCounter += 1;
    return watchIdCounter;
  }),
  clearWatch: jest.fn(),
  getCurrentPosition: jest.fn(),
  stopObserving: jest.fn(),
};

module.exports = { default: Geolocation, ...Geolocation };
