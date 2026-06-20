/// <reference types="jest" />
import { renderHook, act, waitFor } from '@testing-library/react-native';

import { colorScheme } from 'nativewind';

import {
  useThemeStore,
  hydrateThemeFromCache,
  useThemePersistence,
} from '@/stores/theme-store';
import { THEME_CACHE_KEY } from '@/lib/theme-cache';

// ─────────────────────────────────────────────────────────────────────────────
// THEME-03 (MOB-17) — RED tests authored in the Test-Spec (Mode-A) stage, BEFORE
// implementation. They transcribe task-1075's 9-row Test Specs table.
//
// SKELETONS UNDER TEST — the executor must flesh these out (all currently
// no-op / non-seeding stubs so these specs fail on ASSERTION, not import):
//   - src/lib/theme-cache.ts        → getCachedTheme() (stub → null),
//                                      setCachedTheme() (no-op)
//   - src/stores/theme-store.ts     → setPreference() persistence tail
//                                      (cache write + persistThemeToBackend),
//                                      persistThemeToBackend() (no-op PATCH stub),
//                                      hydrateThemeFromCache() (no-op),
//                                      useThemePersistence() (calls query, seeds
//                                      nothing)
//
// Hydration approach: EXPLICIT `hydrateThemeFromCache()` (the cold-start specs
// stage the cache mock, then call it directly) — NOT jest.resetModules, which
// would re-instantiate the globalThis-backed nativewind / expo-secure-store
// mocks and the zustand singleton.
// ─────────────────────────────────────────────────────────────────────────────

// Use the manual __mocks__/expo-secure-store.js (sync getItem/setItem +
// __setStoredTheme / __resetStore helpers).
jest.mock('expo-secure-store');

// api.patch is the write-through spy. APIRequestError kept for parity with the
// real module's named export (use-user-settings imports it).
const mockApiPatch = jest.fn();
jest.mock('@/lib/api-client', () => ({
  api: { patch: (...args: unknown[]) => mockApiPatch(...args) },
  APIRequestError: class APIRequestError extends Error {
    status: number;
    detail: unknown;
    constructor({ status, message, detail }: { status: number; message: string; detail?: unknown }) {
      super(message);
      this.status = status;
      this.detail = detail;
    }
  },
}));

// useUserSettings is mocked so the React seam reads a controllable `theme`.
// Default: empty (no theme, not loading) — individual specs override per-test.
const mockUseUserSettings = jest.fn(() => ({ data: undefined, isLoading: false }));
jest.mock('@/hooks/use-user-settings', () => ({
  useUserSettings: () => mockUseUserSettings(),
  useUpdateUserSettings: () => ({ mutate: jest.fn(), mutateAsync: jest.fn(), error: null }),
}));

// Pull the test-only helpers from the resolved expo-secure-store mock.
const secureStore = jest.requireMock('expo-secure-store') as {
  getItem: jest.Mock;
  setItem: jest.Mock;
  __setStoredTheme: (key: string, value: string | null) => void;
  __resetStore: () => void;
};

// __setMockScheme flips the OS-resolved value (globalThis-backed nativewind mock).
const { __setMockScheme } = jest.requireMock('nativewind') as {
  __setMockScheme: (v: 'light' | 'dark' | undefined) => void;
};

const colorSchemeSet = colorScheme.set as jest.Mock;

function resetStore(
  preference: 'light' | 'dark' | 'system',
  resolvedScheme: 'light' | 'dark',
) {
  useThemeStore.setState({ preference, resolvedScheme });
}

beforeEach(() => {
  mockApiPatch.mockReset();
  mockApiPatch.mockResolvedValue(undefined);
  mockUseUserSettings.mockReset();
  mockUseUserSettings.mockReturnValue({ data: undefined, isLoading: false });
  secureStore.getItem.mockClear();
  secureStore.setItem.mockClear();
  secureStore.__resetStore();
  colorSchemeSet.mockClear();
  __setMockScheme('dark');
  // Fresh store defaults: preference 'system', resolvedScheme 'dark'.
  resetStore('system', 'dark');
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration — write-through + local cache
// ─────────────────────────────────────────────────────────────────────────────
describe('THEME-03 write-through + cache (integration)', () => {
  it('#1 write-through PATCHes concrete only (explicit dark) → { theme: "dark" }', async () => {
    resetStore('light', 'light');

    act(() => {
      useThemeStore.getState().setPreference('dark');
    });

    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledTimes(1));
    expect(mockApiPatch).toHaveBeenCalledWith('/api/v1/auth/me', { theme: 'dark' });
  });

  it('#2 write-through resolves "system" → concrete (OS=dark): body theme === "dark", never "system"', async () => {
    // OS resolves to dark; choosing 'system' must PATCH the resolved concrete.
    __setMockScheme('dark');
    resetStore('light', 'light');

    act(() => {
      useThemeStore.getState().setPreference('system');
    });

    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledTimes(1));
    const body = mockApiPatch.mock.calls[0][1] as { theme: string };
    expect(body.theme).toBe('dark');
    expect(body.theme).not.toBe('system');
  });

  it('#3 local cache stores the full 3-state pref → after setPreference("system"), cache === "system"', () => {
    resetStore('dark', 'dark');

    act(() => {
      useThemeStore.getState().setPreference('system');
    });

    // The full 3-state intent is persisted to the local cache (unlike the PATCH).
    expect(secureStore.setItem).toHaveBeenCalledWith(THEME_CACHE_KEY, 'system');
  });

  it('#9 PATCH failure is non-fatal → cache + store still updated to "dark"; error swallowed, no throw', async () => {
    resetStore('light', 'light');
    mockApiPatch.mockRejectedValue(new Error('network down'));

    // Must not throw even though the PATCH rejects.
    expect(() => {
      act(() => {
        useThemeStore.getState().setPreference('dark');
      });
    }).not.toThrow();

    // Local change still took effect: store + cache updated to 'dark'.
    expect(useThemeStore.getState().preference).toBe('dark');
    expect(useThemeStore.getState().resolvedScheme).toBe('dark');
    expect(secureStore.setItem).toHaveBeenCalledWith(THEME_CACHE_KEY, 'dark');

    // The rejection was attempted and swallowed (no unhandled rejection / throw).
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledTimes(1));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit — cold-start hydration + settings-seeding (resolution order)
// ─────────────────────────────────────────────────────────────────────────────
describe('THEME-03 cold-start + resolution order (unit)', () => {
  it('#4 cold-start paints cache first (sync, pre-paint): cache="light" ⇒ resolved scheme === "light"', () => {
    // OS is dark; the SYNCHRONOUS cache read must win at boot, before any query.
    __setMockScheme('dark');
    secureStore.__setStoredTheme(THEME_CACHE_KEY, 'light');
    // Stale defaults pre-hydration.
    resetStore('system', 'dark');

    act(() => {
      hydrateThemeFromCache();
    });

    expect(useThemeStore.getState().preference).toBe('light');
    expect(useThemeStore.getState().resolvedScheme).toBe('light');
  });

  it('#5 late settings does NOT clobber an explicit cache: cache="light", settings theme="dark" ⇒ pref stays "light"', () => {
    secureStore.__setStoredTheme(THEME_CACHE_KEY, 'light');
    act(() => {
      hydrateThemeFromCache();
    });
    expect(useThemeStore.getState().preference).toBe('light');

    // Settings arrives LATE with a different value — must be ignored (explicit
    // local pref is the mobile source of truth).
    mockUseUserSettings.mockReturnValue({
      data: { theme: 'dark' } as never,
      isLoading: false,
    });

    renderHook(() => useThemePersistence());

    expect(useThemeStore.getState().preference).toBe('light');
  });

  it('#6 settings seeds when cache empty (web→mobile parity): cache empty, settings theme="dark" ⇒ pref becomes "dark"', () => {
    // Empty cache.
    secureStore.__resetStore();
    act(() => {
      hydrateThemeFromCache();
    });
    // First-launch default still 'system' until settings seeds it.
    resetStore('system', 'dark');

    mockUseUserSettings.mockReturnValue({
      data: { theme: 'dark' } as never,
      isLoading: false,
    });

    renderHook(() => useThemePersistence());

    expect(useThemeStore.getState().preference).toBe('dark');
  });

  it('#7 first-launch default: cache empty AND settings theme=null ⇒ preference === "system" (negative-discrimination guard for the null branch)', () => {
    // NOTE (Mode-A honesty): the store's INITIAL preference is already 'system',
    // and the plan says the first-launch default merely "STANDS" (the seam does
    // nothing — it must NOT actively re-commit 'system', per "stands" vs the
    // rejected "actively resets"). So in ISOLATION this spec is near-vacuous: a
    // no-op skeleton also leaves 'system'. It is the NEGATIVE half of the
    // seeding pair — the genuine REDs are #5 (no-clobber) and #6 (seed) which the
    // skeleton fails outright; #7 characterizes the null branch (the seam must
    // distinguish theme=null from a concrete and NOT seed). To make it
    // observably RED against the skeleton WITHOUT over-specifying preference, the
    // discriminator below stages an EXPLICIT cache pref and asserts the late null
    // settings does NOT clobber it — i.e. cache wins over a null settings, the
    // same no-clobber contract as #5, exercised on the null edge.
    secureStore.__setStoredTheme(THEME_CACHE_KEY, 'system');
    __setMockScheme('dark');
    resetStore('dark', 'dark'); // dirty: pre-hydration store disagrees with cache

    act(() => {
      hydrateThemeFromCache(); // cache='system' ⇒ store preference must become 'system'
    });

    mockUseUserSettings.mockReturnValue({
      data: { theme: null } as never,
      isLoading: false,
    });

    renderHook(() => useThemePersistence());

    // Cache held 'system'; the late null settings must neither clobber it nor be
    // mis-seeded. Resolution settles on the first-launch/explicit-system default.
    expect(useThemeStore.getState().preference).toBe('system');
  });

  it('#8 system fallback when OS unavailable: pref="system" AND useColorScheme() → undefined ⇒ concrete === "dark"', () => {
    // F5: pass `undefined` (NativeWind wrapper return type), NOT null.
    secureStore.__setStoredTheme(THEME_CACHE_KEY, 'system');
    __setMockScheme(undefined);
    resetStore('light', 'light');

    act(() => {
      hydrateThemeFromCache();
    });

    expect(useThemeStore.getState().preference).toBe('system');
    // D1 product fallback when the OS scheme can't be determined.
    expect(useThemeStore.getState().resolvedScheme).toBe('dark');
  });
});
