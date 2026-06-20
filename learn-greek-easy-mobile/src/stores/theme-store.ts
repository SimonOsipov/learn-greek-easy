import { create } from 'zustand';

// ─────────────────────────────────────────────────────────────────────────────
// THEME-02 (MOB-17) — SKELETON ONLY (authored by the Test-Spec / Mode-A stage).
//
// This file is intentionally a non-functional skeleton: it exists so the RED
// test file (src/stores/__tests__/theme-store.test.tsx) imports + type-checks
// and FAILS ON ASSERTION, not on a missing module. The THEME-02 EXECUTOR must
// replace the stubbed bodies below with the real implementation.
//
// Match the existing store convention EXACTLY: plain `create<State>(...)` like
// auth-store.ts / onboarding-store.ts — NO `persist` middleware (persistence is
// handled explicitly in THEME-03). Honor F1 (Layering note): the store is a
// plain store; only the bootstrap COMPONENT (which calls useColorScheme inside
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
   * Set the preference. The real implementation MUST drive NativeWind's
   * setColorScheme(preference) (via `colorScheme.set` or the useColorScheme
   * hook's setter) AND update `preference` (and `resolvedScheme` for an
   * explicit 'light'/'dark' pref).
   */
  setPreference: (preference: ThemePreference) => void;
}

export const useThemeStore = create<ThemeState>(() => ({
  preference: 'system',
  resolvedScheme: 'dark',

  // TODO(THEME-02 executor): implement.
  // Deliberate NO-OP stub so the behavioral RED tests (#1, #2, #3, #5) fail on
  // assertion: it does NOT call setColorScheme and does NOT update state.
  setPreference: (_preference: ThemePreference) => {
    // no-op (skeleton)
  },
}));

/**
 * Bootstrap that applies the stored preference once on mount and (under a
 * 'system' preference) writes OS-scheme flips back into the store.
 *
 * SKELETON: renders null and wires NO effect, so the RNTL specs (#4, #6, #7)
 * mount it but their assertions FAIL (no setColorScheme call, no resolvedScheme
 * reaction).
 *
 * TODO(THEME-02 executor): wire the effect here (call useColorScheme() to
 * observe the OS scheme, apply the stored preference via setColorScheme in an
 * EFFECT — never during render — and write the resolved value back into the
 * store) and MOUNT this inside RootNavigator in src/app/_layout.tsx (NOT
 * RootLayout — see the task's mounting note).
 */
export function ThemeBootstrap(): null {
  // no-op (skeleton)
  return null;
}
