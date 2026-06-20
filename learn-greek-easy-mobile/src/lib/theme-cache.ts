import * as SecureStore from 'expo-secure-store';

import type { ThemePreference } from '@/stores/theme-store';

// ─────────────────────────────────────────────────────────────────────────────
// THEME-03 (MOB-17) — Local 3-state theme-preference cache (anti-flash).
//
// Wraps `expo-secure-store`'s SYNCHRONOUS API (`SecureStore.getItem` /
// `SecureStore.setItem`) so the theme can be read on cold start BEFORE first
// paint (F8 anti-flash). The theme string is tiny (well under SecureStore's
// 2048-byte limit), so we use the dep DIRECTLY — NOT `LargeSecureStore`
// (D9: that wrapper is async + for >2048-byte blobs).
//
// Unlike the backend PATCH (which only stores the resolved concrete
// 'light'|'dark' — D8), this cache stores the FULL 3-state preference,
// including 'system'.
//
// SKELETON (THEME-03 Test-Spec / Mode-A): the reader is a stub that returns
// `null` and the writer is a no-op, so the cold-start / cache specs fail on an
// ASSERTION (not on import). The executor fleshes these out.
// ─────────────────────────────────────────────────────────────────────────────

/** SecureStore key for the cached 3-state theme preference. */
export const THEME_CACHE_KEY = 'mob17.theme.preference';

const VALID: readonly ThemePreference[] = ['light', 'dark', 'system'];

function isThemePreference(v: string | null): v is ThemePreference {
  return v !== null && (VALID as readonly string[]).includes(v);
}

/**
 * Synchronously read the cached 3-state theme preference, or `null` if no valid
 * value is cached (first launch, or a corrupted value). MUST be synchronous so
 * the store can paint the correct theme before first paint (F8).
 *
 * TODO(THEME-03 executor): implement via `SecureStore.getItem(THEME_CACHE_KEY)`
 * and validate against {@link isThemePreference} (an unexpected value ⇒ `null`,
 * treated as a cache miss). Currently a stub returning `null`.
 */
export function getCachedTheme(): ThemePreference | null {
  // TODO(THEME-03 executor): replace stub with the synchronous SecureStore read.
  // Keep `isThemePreference` validation so a bad persisted value is a cache miss.
  void isThemePreference; // referenced so the validator survives lint until wired
  void SecureStore;
  return null;
}

/**
 * Persist the full 3-state preference to the local cache.
 *
 * TODO(THEME-03 executor): implement via
 * `SecureStore.setItem(THEME_CACHE_KEY, preference)`. Currently a no-op.
 */
export function setCachedTheme(_preference: ThemePreference): void {
  // TODO(THEME-03 executor): replace no-op with the synchronous SecureStore write.
}
