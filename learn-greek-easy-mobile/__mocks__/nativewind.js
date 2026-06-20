// Manual mock for nativewind — used by jest tests.
// cssInterop is a no-op in the test environment.
//
// THEME-02 (MOB-17): the store + bootstrap drive NativeWind's colorScheme API
// (colorScheme.set / useColorScheme). The real module is excluded from the
// transform whitelist in some paths and, more importantly, its colorScheme
// machinery is not test-friendly, so we expose a minimal, controllable shape.
//
//   - __scheme is a mutable module-level value representing the OS-resolved
//     ('light' | 'dark') scheme that NativeWind would report.
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

let __scheme = 'dark'; // mutable so tests can flip the OS-resolved value

const colorScheme = {
  set: jest.fn((v) => {
    __scheme = v === 'system' ? __scheme : v;
  }),
  get: jest.fn(() => __scheme),
};

const useColorScheme = jest.fn(() => ({
  colorScheme: __scheme, // 'light' | 'dark' | undefined (NativeWind wrapper type)
  setColorScheme: jest.fn(),
  toggleColorScheme: jest.fn(),
}));

module.exports = {
  cssInterop: () => {},
  colorScheme,
  useColorScheme,
  // Test-only helper: flip the OS-resolved scheme (incl. undefined).
  __setMockScheme: (v) => {
    __scheme = v;
  },
};
