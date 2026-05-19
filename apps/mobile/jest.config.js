module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./node_modules/react-native-gesture-handler/jestSetup.js'],
  moduleNameMapper: {
    'react-native-maps': '<rootDir>/__mocks__/react-native-maps.js',
    'react-native-geolocation-service': '<rootDir>/__mocks__/react-native-geolocation-service.js',
    '@react-native-async-storage/async-storage':
      '<rootDir>/__mocks__/@react-native-async-storage/async-storage.js',
    'firebase/auth': '<rootDir>/__mocks__/firebase/auth.js',
    'firebase/app': '<rootDir>/__mocks__/firebase/app.js',
    '@env': '<rootDir>/__mocks__/env.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      '@react-navigation|' +
      '@react-native|' +
      '@react-native-firebase|' +
      'react-native|' +
      'react-native-maps|' +
      'react-native-safe-area-context|' +
      'react-native-geolocation-service|' +
      '@rneui' +
    ')/)',
  ],
};
