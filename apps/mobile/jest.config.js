module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  moduleNameMapper: {
    'react-native-maps': '<rootDir>/__mocks__/react-native-maps.js',
    '@react-native-async-storage/async-storage':
      '<rootDir>/__mocks__/@react-native-async-storage/async-storage.js',
    '@react-native-community/geolocation':
      '<rootDir>/__mocks__/@react-native-community/geolocation.js',
    'firebase/auth': '<rootDir>/__mocks__/firebase/auth.js',
    'firebase/app': '<rootDir>/__mocks__/firebase/app.js',
    '@env': '<rootDir>/__mocks__/env.js',
    'socket.io-client': '<rootDir>/__mocks__/socket.io-client.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      '@react-navigation|' +
      '@react-native|' +
      '@react-native-firebase|' +
      '@react-native-community|' +
      'react-native|' +
      'react-native-maps|' +
      'react-native-safe-area-context|' +
      '@rneui' +
    ')/)',
  ],
};
