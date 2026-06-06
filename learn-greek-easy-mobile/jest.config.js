/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|react-native-css-interop|react-native-reanimated|@sentry/react-native|react-native-gesture-handler|react-native-screens|react-native-safe-area-context))',
  ],
  // Transform .mjs files with babel-jest so the guard script (scripts/*.mjs) can
  // be imported directly from TypeScript test files under jest-expo (NWOPA-04/MOB-13).
  transform: {
    '\\.mjs$': [
      'babel-jest',
      {
        configFile: true,
        babelrc: true,
      },
    ],
  },
  moduleNameMapper: {
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};
