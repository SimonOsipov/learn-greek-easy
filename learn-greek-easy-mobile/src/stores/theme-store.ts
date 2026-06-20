import { useEffect } from 'react';
import { colorScheme, useColorScheme } from 'nativewind';
import { create } from 'zustand';

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

export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'system',
  resolvedScheme: 'dark',

  setPreference: (preference: ThemePreference) => {
    // Drive NativeWind: 'light' | 'dark' | 'system' are all accepted. This also
    // writes RN Appearance so the app shell follows with no per-component edits.
    colorScheme.set(preference);

    if (preference === 'system') {
      // Explicit OS-following: resolve from the synchronous NativeWind snapshot
      // as a best-effort; the bootstrap component is the authoritative source of
      // 'system' resolution (it re-renders on OS flips and writes back).
      const osScheme = colorScheme.get();
      set({
        preference,
        ...(osScheme ? { resolvedScheme: osScheme } : {}),
      });
    } else {
      // Explicit 'light'/'dark' preference wins over the OS scheme.
      set({ preference, resolvedScheme: preference });
    }
  },
}));

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
