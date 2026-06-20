// Manual mock for expo-secure-store — used by jest tests.
//
// THEME-03 (MOB-17): the theme cache (src/lib/theme-cache.ts) reads/writes the
// 3-state preference via SecureStore's SYNCHRONOUS API (getItem / setItem) so
// the theme can paint on cold start before first paint (F8 anti-flash). This
// mock exposes a deterministic, in-memory synchronous store plus a test helper.
//
// Backing store is a PROCESS-WIDE singleton on globalThis (same rationale as
// __mocks__/nativewind.js): under jest-expo, a static `import * as SecureStore`
// and `jest.requireMock('expo-secure-store')` can resolve to DIFFERENT module
// instances; a module-level object would give each its own copy, so a test's
// `__setStoredTheme(...)` (via requireMock) would not be observable by the
// code-under-test (via static import). Backing on globalThis makes every
// instance read/write ONE map.

const STORE_KEY = '__EXPO_SECURE_STORE_MOCK__';
if (globalThis[STORE_KEY] === undefined) {
  globalThis[STORE_KEY] = {};
}

const store = () => globalThis[STORE_KEY];

const getItem = jest.fn((key) => {
  const v = store()[key];
  return v === undefined ? null : v;
});

const setItem = jest.fn((key, value) => {
  store()[key] = value;
});

const deleteItemAsync = jest.fn(async (key) => {
  delete store()[key];
});

// Async variants (used elsewhere, e.g. LargeSecureStore) — kept for parity.
const getItemAsync = jest.fn(async (key) => getItem(key));
const setItemAsync = jest.fn(async (key, value) => setItem(key, value));

module.exports = {
  getItem,
  setItem,
  getItemAsync,
  setItemAsync,
  deleteItemAsync,
  // Test-only helpers (NOT part of the published expo-secure-store API).
  __setStoredTheme: (key, value) => {
    if (value === undefined || value === null) {
      delete store()[key];
    } else {
      store()[key] = value;
    }
  },
  __resetStore: () => {
    globalThis[STORE_KEY] = {};
  },
};
