/// <reference types="jest" />
import { renderHook, act, waitFor } from '@testing-library/react-native';

import { colorScheme } from 'nativewind';

import {
  useThemeStore,
  hydrateThemeFromCache,
  useThemePersistence,
} from '@/stores/theme-store';
import { THEME_CACHE_KEY, getCachedTheme } from '@/lib/theme-cache';

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

// ─────────────────────────────────────────────────────────────────────────────
// THEME-03 adversarial coverage (Mode-B QA). These do NOT re-author the 9 AC
// specs; they target the gaps those specs leave. Mutation-verified during QA:
// each fails against a plausible wrong implementation (PATCH carries 'system',
// cache write awaits the network, no-clobber gated on settings-presence instead
// of the cache, a garbage cached value treated as valid, the load-guard skipping
// a real PATCH, the seed path leaking 'system' to the backend).
//
// NOTE on the harness limitation these are written around: the manual
// __mocks__/nativewind.js `colorScheme.set('light'|'dark')` MUTATES the OS
// snapshot the mock's `get()` reports. So `setPreference('system')` with OS=light
// must be staged with the OS *set to light first* and NOT call set('light')
// before reading — we read the PATCH BODY (captured at call time) rather than a
// post-hoc get(), so the mutation does not contaminate the assertion.
// ─────────────────────────────────────────────────────────────────────────────
describe('THEME-03 adversarial — PATCH never carries "system"', () => {
  it('setPreference("system") with OS=light ⇒ PATCH body is the resolved "light" (never "system"); cache keeps "system"', async () => {
    __setMockScheme('light');
    resetStore('dark', 'dark');

    act(() => {
      useThemeStore.getState().setPreference('system');
    });

    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledTimes(1));
    const body = mockApiPatch.mock.calls[0][1] as { theme: string };
    // Resolved concrete is the OS scheme (light) — NOT the 3-state 'system'.
    expect(body.theme).toBe('light');
    expect(body.theme).not.toBe('system');
    // The full 3-state intent still lives in the local cache (D8 split).
    expect(secureStore.setItem).toHaveBeenCalledWith(THEME_CACHE_KEY, 'system');
  });

  it('the settings-seed path also PATCHes a CONCRETE value, never "system" (parity seed routes through the setter)', async () => {
    // Cache empty ⇒ the seam seeds from settings.theme='dark' via setPreference,
    // which write-throughs. Assert that write-through is concrete (it must be —
    // settings.theme is already 'light'|'dark', the type forbids 'system').
    secureStore.__resetStore();
    resetStore('system', 'dark');

    mockUseUserSettings.mockReturnValue({
      data: { theme: 'dark' } as never,
      isLoading: false,
    });

    renderHook(() => useThemePersistence());

    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledTimes(1));
    const body = mockApiPatch.mock.calls[0][1] as { theme: string };
    expect(body.theme).toBe('dark');
    expect(body.theme).not.toBe('system');
  });
});

describe('THEME-03 adversarial — cache write is independent of the PATCH outcome', () => {
  it('on PATCH reject, the local cache + store commit are NOT awaiting the network: both updated synchronously, BEFORE the rejection settles', () => {
    resetStore('light', 'light');
    mockApiPatch.mockRejectedValue(new Error('network down'));

    act(() => {
      useThemeStore.getState().setPreference('dark');
    });

    // The synchronous local commit (store + 3-state cache) has ALREADY happened
    // by the time setPreference returns — it does not await api.patch(). If the
    // implementation awaited the network before committing, these would not yet
    // hold here (the rejection has not been flushed).
    expect(useThemeStore.getState().preference).toBe('dark');
    expect(useThemeStore.getState().resolvedScheme).toBe('dark');
    expect(secureStore.setItem).toHaveBeenCalledWith(THEME_CACHE_KEY, 'dark');
    // Ordering: the cache write happens regardless of (and not gated behind) the
    // PATCH — setItem was called even though the PATCH is rejecting.
    expect(secureStore.setItem).toHaveBeenCalledTimes(1);
  });

  it('on PATCH reject, the cache holds the 3-STATE pref even when it differs from the PATCHed concrete (system ⇒ cache "system", PATCH "dark")', async () => {
    __setMockScheme('dark');
    resetStore('light', 'light');
    mockApiPatch.mockRejectedValue(new Error('boom'));

    act(() => {
      useThemeStore.getState().setPreference('system');
    });

    // Cache = 3-state 'system' (survives a failed sync); PATCH attempted 'dark'.
    expect(secureStore.setItem).toHaveBeenCalledWith(THEME_CACHE_KEY, 'system');
    expect(useThemeStore.getState().preference).toBe('system');
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledTimes(1));
    expect(mockApiPatch.mock.calls[0][1]).toEqual({ theme: 'dark' });
  });
});

describe('THEME-03 adversarial — anti-flash module-init hydrate (the real cold-start path)', () => {
  it('cache="dark" staged before hydrate ⇒ store preference/resolvedScheme AND colorScheme.set reflect "dark" SYNCHRONOUSLY (no await)', () => {
    // OS is light; the synchronous cache read must win at boot.
    __setMockScheme('light');
    secureStore.__setStoredTheme(THEME_CACHE_KEY, 'dark');
    resetStore('system', 'light'); // stale pre-hydration defaults disagree
    colorSchemeSet.mockClear();

    // No act()/await — the hydrate is synchronous (module-init style).
    hydrateThemeFromCache();

    expect(useThemeStore.getState().preference).toBe('dark');
    expect(useThemeStore.getState().resolvedScheme).toBe('dark');
    // The NativeWind driver was painted on frame 1 with the cached value.
    expect(colorSchemeSet).toHaveBeenCalledWith('dark');
  });

  it('cache="system" + OS=undefined ⇒ resolvedScheme "dark" (F5/D1), preference "system", colorScheme.set("system")', () => {
    __setMockScheme(undefined);
    secureStore.__setStoredTheme(THEME_CACHE_KEY, 'system');
    resetStore('light', 'light');
    colorSchemeSet.mockClear();

    hydrateThemeFromCache();

    expect(useThemeStore.getState().preference).toBe('system');
    expect(useThemeStore.getState().resolvedScheme).toBe('dark');
    // colorScheme.set is driven with the 3-state value ('system' ⇒ OS-follow);
    // the concrete fallback only governs the store's resolvedScheme.
    expect(colorSchemeSet).toHaveBeenCalledWith('system');
  });

  it('cache holds GARBAGE ("purple") ⇒ getCachedTheme() returns null ⇒ hydrate is INERT (defaults preserved, no colorScheme.set)', () => {
    // isThemePreference must reject an out-of-enum stored value → treated as a
    // cache miss → hydrate touches neither the store nor the driver.
    secureStore.__setStoredTheme(THEME_CACHE_KEY, 'purple');
    expect(getCachedTheme()).toBeNull();

    resetStore('system', 'dark');
    colorSchemeSet.mockClear();

    hydrateThemeFromCache();

    // Defaults untouched (the bad value did NOT seed the store).
    expect(useThemeStore.getState().preference).toBe('system');
    expect(useThemeStore.getState().resolvedScheme).toBe('dark');
    // Inert: no paint side-effect on a cache miss.
    expect(colorSchemeSet).not.toHaveBeenCalled();
  });

  it('getCachedTheme() validates: rejects empty-string and a near-miss ("Dark"), accepts each canonical value', () => {
    for (const bad of ['', 'Dark', 'lite', ' system ']) {
      secureStore.__setStoredTheme(THEME_CACHE_KEY, bad);
      expect(getCachedTheme()).toBeNull();
    }
    for (const good of ['light', 'dark', 'system'] as const) {
      secureStore.__setStoredTheme(THEME_CACHE_KEY, good);
      expect(getCachedTheme()).toBe(good);
    }
  });

  it('hydrate is idempotent: a second hydrate of the same cache does not flip the pref or re-paint a different value', () => {
    __setMockScheme('light');
    secureStore.__setStoredTheme(THEME_CACHE_KEY, 'dark');
    resetStore('system', 'light');

    hydrateThemeFromCache();
    expect(useThemeStore.getState().preference).toBe('dark');

    colorSchemeSet.mockClear();
    hydrateThemeFromCache();

    // Still 'dark' — the second call did not corrupt the resolved pref, and any
    // re-paint used the same cached value (never a different one).
    expect(useThemeStore.getState().preference).toBe('dark');
    expect(useThemeStore.getState().resolvedScheme).toBe('dark');
    for (const call of colorSchemeSet.mock.calls) {
      expect(call[0]).toBe('dark');
    }
  });
});

describe('THEME-03 adversarial — no-clobber is CACHE-gated, not settings-presence-gated', () => {
  it('cache="dark", settings later resolves "light" ⇒ preference STAYS "dark" (the real gate is the cache, not !settings)', () => {
    // This is the discriminating case for the gate condition: a NON-NULL settings
    // value that disagrees with the cache. If the seam gated on `!settings`
    // (settings-presence) instead of `getCachedTheme()==null`, the present
    // 'light' settings would seed and clobber the cached 'dark'. The cache gate
    // must hold.
    secureStore.__setStoredTheme(THEME_CACHE_KEY, 'dark');
    act(() => {
      hydrateThemeFromCache();
    });
    expect(useThemeStore.getState().preference).toBe('dark');

    mockUseUserSettings.mockReturnValue({
      data: { theme: 'light' } as never,
      isLoading: false,
    });

    renderHook(() => useThemePersistence());

    // Explicit cache pref wins — the present, disagreeing settings value is
    // ignored. (#5 covered cache=light/settings=dark; this is the inverse pair.)
    expect(useThemeStore.getState().preference).toBe('dark');
  });

  it('genuine first-launch default: cache EMPTY + settings theme=null ⇒ no seed, preference stays "system" (the coverage #7 cannot carry)', () => {
    // #7 stages a NON-empty cache ('system'), so its null-branch is unreachable
    // (the cache early-return fires first) — it is really a no-clobber re-test.
    // THIS spec stages the cache genuinely EMPTY so the seam actually evaluates
    // the null branch: a null settings must NOT seed, and the first-launch
    // default 'system' must stand.
    secureStore.__resetStore();
    expect(getCachedTheme()).toBeNull();
    resetStore('system', 'dark');

    mockUseUserSettings.mockReturnValue({
      data: { theme: null } as never,
      isLoading: false,
    });

    renderHook(() => useThemePersistence());

    expect(useThemeStore.getState().preference).toBe('system');
    // The seam must not have PATCHed anything (no concrete to seed).
    expect(mockApiPatch).not.toHaveBeenCalled();
  });

  it('genuine first-launch default: cache EMPTY + settings UNDEFINED (still loading / signed-out) ⇒ no seed, preference stays "system", no PATCH', () => {
    secureStore.__resetStore();
    resetStore('system', 'dark');

    mockUseUserSettings.mockReturnValue({ data: undefined, isLoading: false });

    renderHook(() => useThemePersistence());

    expect(useThemeStore.getState().preference).toBe('system');
    expect(mockApiPatch).not.toHaveBeenCalled();
  });
});

describe('THEME-03 adversarial — the load-guard does not mask a real PATCH', () => {
  it('with @/lib/api-client present (mocked), a successful setPreference STILL fires the PATCH — the try/catch around require() does not skip the call', async () => {
    // The outer try/catch exists only to swallow a LOAD failure of the lazy
    // require chain; when the module loads fine (the mocked case) the PATCH must
    // be invoked. This guards against a refactor that accidentally short-circuits
    // the call inside the guard.
    resetStore('light', 'light');
    mockApiPatch.mockResolvedValue(undefined);

    act(() => {
      useThemeStore.getState().setPreference('dark');
    });

    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledTimes(1));
    expect(mockApiPatch).toHaveBeenCalledWith('/api/v1/auth/me', { theme: 'dark' });
  });

  it('a SYNCHRONOUSLY-throwing api.patch is swallowed by the outer guard — setPreference does not throw and the local change still stands', () => {
    // The `.catch` only covers an async rejection; a synchronous throw from
    // api.patch (or the require) is the OTHER swallow path (try/catch). Either
    // way, the local commit must survive and no error escapes.
    resetStore('light', 'light');
    mockApiPatch.mockImplementation(() => {
      throw new Error('synchronous explosion in api.patch');
    });

    expect(() => {
      act(() => {
        useThemeStore.getState().setPreference('dark');
      });
    }).not.toThrow();

    // Local change still took effect despite the synchronous PATCH failure.
    expect(useThemeStore.getState().preference).toBe('dark');
    expect(secureStore.setItem).toHaveBeenCalledWith(THEME_CACHE_KEY, 'dark');
  });
});
