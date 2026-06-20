import { useEffect } from 'react';
import { colorScheme, useColorScheme } from 'nativewind';
import { create } from 'zustand';

import { getCachedTheme, setCachedTheme } from '@/lib/theme-cache';

// NOTE: `@/lib/api-client` and `@/hooks/use-user-settings` are NOT imported at
// module top level on purpose. Both transitively pull in `@/lib/supabase` →
// `LargeSecureStore` → `@react-native-async-storage/async-storage` (a native
// module that is null under jest unless explicitly mocked). The store CORE
// (useThemeStore / setPreference / hydrateThemeFromCache) must stay
// dependency-light so it can be imported by tests that do NOT mock that chain
// (e.g. the THEME-02 suite). The persistence seam below reaches those deps
// lazily / via the hook import inside its own module scope.

// ─────────────────────────────────────────────────────────────────────────────
// THEME-02 (MOB-17) — Theme store + colorScheme driver.
//
// Match the existing store convention EXACTLY: plain `create<State>(...)` like
// auth-store.ts / onboarding-store.ts — NO `persist` middleware (persistence is
// handled explicitly in THEME-03). Honor F1 (Layering note): the store is a
// plain store; NativeWind's `colorScheme.get()` is a synchronous snapshot, not
// a subscription, so the plain store cannot reactively observe an OS flip on its
// own. Only the bootstrap COMPONENT (which calls `useColorScheme()` inside
// RootNavigator) re-renders on an OS flip and writes the new value back.
// ─────────────────────────────────────────────────────────────────────────────

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedScheme = 'light' | 'dark';

interface ThemeState {
  /** The user's 3-state preference (D2). Initial 'system'. */
  preference: ThemePreference;
  /** The concrete scheme actually in effect. Initial 'dark'. */
  resolvedScheme: ResolvedScheme;
  /**
   * Set the preference. Drives NativeWind's `colorScheme.set(preference)`
   * (which also writes RN `Appearance`, so the root ThemeProvider + tab shell
   * follow automatically) and updates `preference`. For an explicit
   * 'light'/'dark' preference, `resolvedScheme` is set to that value directly
   * (explicit pref wins over the OS); under 'system' the concrete scheme is
   * derived from the OS by the bootstrap component.
   */
  setPreference: (preference: ThemePreference) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: 'system',
  resolvedScheme: 'dark',

  setPreference: (preference: ThemePreference) => {
    // Drive NativeWind: 'light' | 'dark' | 'system' are all accepted. This also
    // writes RN Appearance so the app shell follows with no per-component edits.
    colorScheme.set(preference);

    let resolved: ResolvedScheme;
    if (preference === 'system') {
      // Explicit OS-following: resolve from the synchronous NativeWind snapshot
      // as a best-effort; the bootstrap component is the authoritative source of
      // 'system' resolution (it re-renders on OS flips and writes back).
      const osScheme = colorScheme.get();
      resolved = osScheme ?? get().resolvedScheme;
      set({
        preference,
        ...(osScheme ? { resolvedScheme: osScheme } : {}),
      });
    } else {
      // Explicit 'light'/'dark' preference wins over the OS scheme.
      resolved = preference;
      set({ preference, resolvedScheme: preference });
    }

    // THEME-03 persistence (D8/D9 — write-through + 3-state cache).
    // TODO(THEME-03 executor): persist here:
    //   (1) setCachedTheme(preference)        // full 3-state intent → local cache
    //   (2) persistThemeToBackend(resolved)   // resolved concrete 'light'|'dark'
    //       — PATCH /api/v1/auth/me { theme }, error-swallowed (D8 never 'system';
    //         spec #9 non-fatal). `resolved` is the concrete scheme computed above.
    // Currently NOT wired: the cache write + write-through are no-ops so the
    // THEME-03 persistence specs fail on ASSERTION (not import).
    void resolved;
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// THEME-03 (MOB-17) — Persistence seam.
//
// Two skeleton units the executor fleshes out:
//   1. `persistThemeToBackend(concrete)` — write-through PATCH of the resolved
//      concrete 'light'|'dark' (NEVER 'system' — D8), error-swallowed (spec #9).
//   2. `hydrateThemeFromCache()` — SYNCHRONOUS cold-start cache read → seeds the
//      store `preference`/`resolvedScheme` from the cached 3-state value, before
//      first paint (F8 anti-flash). Chosen hydration approach: an EXPLICIT
//      `hydrate()` the tests call after staging the cache mock (NOT
//      jest.resetModules) — keeps the globalThis-backed nativewind mock and the
//      zustand singleton stable across the suite.
//   3. `useThemePersistence()` — React seam that seeds `preference` from
//      `useUserSettings().theme` ONLY when the cache was empty (no explicit local
//      pref); a late settings value must NOT clobber an explicit cache pref.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Write-through: PATCH the resolved concrete scheme to the backend so the theme
 * syncs across devices/web. D8 — `concrete` is ALWAYS 'light'|'dark', never
 * 'system' (the backend enum is 2-value; a 'system' PATCH 422s). Errors are
 * swallowed (spec #9 — a failed sync must not break the local change).
 *
 * TODO(THEME-03 executor): implement as a fire-and-forget
 * `api.patch('/api/v1/auth/me', { theme: concrete })` wrapped so a rejection is
 * caught and swallowed (no throw, no unhandled rejection). Currently a no-op
 * stub that does NOT call the API → the write-through specs (#1, #2, #9) fail on
 * the PATCH assertion.
 */
export function persistThemeToBackend(_concrete: ResolvedScheme): void {
  // TODO(THEME-03 executor): replace no-op with the error-swallowed PATCH, e.g.:
  //   const { api } = require('@/lib/api-client') as typeof import('@/lib/api-client');
  //   void api.patch('/api/v1/auth/me', { theme: concrete }).catch(() => {});
  // Lazy `require` (not a top-level import) keeps the store core free of the
  // AsyncStorage native chain (see header note). The persistence test mocks
  // `@/lib/api-client`, so the lazy require resolves to the spy there.
}

/**
 * SYNCHRONOUS cold-start hydration (F8 anti-flash). Reads the cached 3-state
 * preference and, when present, seeds the store `preference` and a concrete
 * `resolvedScheme` BEFORE first paint — so a signed-in relaunch paints the
 * persisted theme with no light→dark flash, before `useUserSettings()` settles.
 *
 * Chosen approach (documented for the executor): EXPLICIT `hydrate()` — call
 * this once at app boot (and the tests call it directly after staging the cache
 * mock), rather than reading the cache inside `create()` (which would couple the
 * read to module-load order and force `jest.resetModules` in every spec).
 *
 * TODO(THEME-03 executor): implement:
 *   const cached = getCachedTheme();
 *   if (!cached) return;                    // empty cache ⇒ leave defaults; React
 *                                           //   seam may later seed from settings
 *   const resolved = cached === 'system'
 *     ? (colorScheme.get() ?? 'dark')       // D1 OS-unavailable ⇒ dark
 *     : cached;
 *   colorScheme.set(cached);
 *   useThemeStore.setState({ preference: cached, resolvedScheme: resolved });
 * Currently a no-op → the cold-start specs (#4, #8) fail on the painted-scheme
 * assertion.
 */
export function hydrateThemeFromCache(): void {
  // TODO(THEME-03 executor): replace no-op with the synchronous cache read +
  // store seed described above.
  void getCachedTheme;
  void setCachedTheme;
}

/**
 * React seam (mount inside RootNavigator, alongside or folded into
 * ThemeBootstrap). Seeds the store `preference` from the backend
 * `useUserSettings().theme` ONLY when the local cache is empty (web→mobile
 * parity, spec #6); when the cache holds an explicit pref, the late-arriving
 * settings value is IGNORED (spec #5 — no clobber). When BOTH cache and settings
 * are empty, the first-launch default 'system' stands (spec #7).
 *
 * Non-visual — returns null.
 *
 * TODO(THEME-03 executor): implement:
 *   const { data: settings } = useUserSettings();
 *   useEffect(() => {
 *     if (getCachedTheme() != null) return;            // explicit local pref wins
 *     const t = settings?.theme;                        // 'light'|'dark'|null|undefined
 *     if (t === 'light' || t === 'dark') {
 *       useThemeStore.getState().setPreference(t);      // seed (also caches it)
 *     }
 *     // else: leave the first-launch default ('system').
 *   }, [settings?.theme]);
 * Currently calls the query (so the hook is import-safe) but seeds NOTHING →
 * the seeding specs (#5, #6, #7) fail on the resulting preference assertion.
 */
export function useThemePersistence(): null {
  // Lazy require keeps the store CORE free of the AsyncStorage native chain that
  // `@/hooks/use-user-settings` → `@/lib/supabase` pulls in (see header note).
  // The persistence test mocks `@/hooks/use-user-settings`, so this resolves to
  // the spy there; at runtime it resolves to the real hook. Hooks rules are
  // honored: `useUserSettings()` is still called unconditionally on every render
  // of this hook component.
  const { useUserSettings } =
    require('@/hooks/use-user-settings') as typeof import('@/hooks/use-user-settings');
  // Call the query so the hook is structurally exercised; do NOT seed (skeleton).
  useUserSettings();
  // TODO(THEME-03 executor): wire the cache-empty-seed effect described above —
  //   const { data: settings } = useUserSettings();
  //   useEffect(() => { ... seed only when getCachedTheme() == null ... },
  //            [settings?.theme]);
  return null;
}

/**
 * Applies the stored preference once on mount and (under a 'system' preference)
 * writes OS-scheme flips back into the store. Mounted inside RootNavigator
 * (src/app/_layout.tsx) so it runs for the whole app. Non-visual — returns null.
 *
 * Effect-driven only (no side effects during render). `useColorScheme()` is
 * called so the component re-renders when the OS scheme flips; the write-back
 * effect then mirrors the new OS value into `resolvedScheme` while the
 * preference is 'system'.
 */
export function ThemeBootstrap(): null {
  const { colorScheme: osScheme } = useColorScheme();
  const preference = useThemeStore((s) => s.preference);

  // Apply the stored preference exactly once on mount (never during render, and
  // not re-fired on unrelated re-renders).
  useEffect(() => {
    colorScheme.set(useThemeStore.getState().preference);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Under a 'system' preference, mirror the OS-resolved scheme into the store
  // whenever it changes (and on mount). Keyed on preference + observed scheme so
  // it re-runs on an OS flip; only touches resolvedScheme (never colorScheme).
  useEffect(() => {
    if (preference === 'system' && osScheme) {
      useThemeStore.setState({ resolvedScheme: osScheme });
    }
  }, [preference, osScheme]);

  return null;
}
