// Manual mock for nativewind — used by jest tests.
// cssInterop is a no-op in the test environment.
//
// THEME-02 (MOB-17): the store + bootstrap drive NativeWind's colorScheme API
// (colorScheme.set / useColorScheme). The real module is excluded from the
// transform whitelist in some paths and, more importantly, its colorScheme
// machinery is not test-friendly, so we expose a minimal, controllable shape.
//
//   - The OS-resolved ('light' | 'dark' | undefined) scheme that NativeWind
//     would report is backed on a PROCESS-WIDE singleton (globalThis), not a
//     module-level `let`. Under jest-expo, `jest.requireMock('nativewind')` and
//     the static `import { colorScheme, useColorScheme } from 'nativewind'`
//     resolve to DIFFERENT module instances of this mock (require !==
//     requireMock). A module-level `let __scheme` therefore gives each instance
//     its own copy: a test's `__setMockScheme(...)` flip (made via requireMock)
//     mutates instance A while the component-under-test reads instance B → the
//     flip is structurally unobservable, and even `beforeEach`'s reset never
//     reaches instance B (cross-test leakage). Backing the state on globalThis
//     makes every instance read/write ONE value, so the OS flip is observable
//     and `beforeEach` deterministically resets it for every test.
//   - colorScheme.set(v) mirrors NativeWind: 'light'/'dark' overwrite the
//     resolved scheme; 'system' defers to the OS, so it does NOT overwrite the
//     stored value here (the bootstrap reads the OS value back via the hook).
//   - useColorScheme() returns the NativeWind wrapper { colorScheme, setColorScheme,
//     toggleColorScheme }, where colorScheme ∈ 'light' | 'dark' | undefined.
//   - __setMockScheme(v) is a test-only helper to flip the OS-resolved value
//     (incl. undefined) between renders for the system OS-flip specs.
//
// Both colorScheme.set AND useColorScheme().setColorScheme are jest.fn()s so a
// test can assert on whichever API the store implementation ends up using.

// Process-wide singleton for the OS-resolved scheme. Shared across every mock
// instance jest hands out (static import vs jest.requireMock). Default 'dark'.
const SCHEME_KEY = '__NW_MOCK_SCHEME__';
if (globalThis[SCHEME_KEY] === undefined) {
  globalThis[SCHEME_KEY] = 'dark';
}

const getScheme = () => globalThis[SCHEME_KEY];
const setScheme = (v) => {
  globalThis[SCHEME_KEY] = v;
};

const colorScheme = {
  set: jest.fn((v) => {
    if (v !== 'system') setScheme(v);
  }),
  get: jest.fn(() => getScheme()),
};

const useColorScheme = jest.fn(() => ({
  colorScheme: getScheme(), // 'light' | 'dark' | undefined (NativeWind wrapper type)
  setColorScheme: jest.fn(),
  toggleColorScheme: jest.fn(),
}));

module.exports = {
  cssInterop: () => {},
  colorScheme,
  useColorScheme,
  // Test-only helper: flip the OS-resolved scheme (incl. undefined).
  __setMockScheme: (v) => {
    setScheme(v);
  },
};
