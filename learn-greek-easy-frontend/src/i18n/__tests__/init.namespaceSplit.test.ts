/**
 * PERF-24-01: RED specs — EN critical-namespace split
 *
 * Subtask 01 will shrink the SYNCHRONOUS EN bundle in src/i18n/init.ts from
 * all 17 namespaces down to the 3 critical namespaces { common, auth, landing }
 * needed for the pre-auth LCP surface (landing page / login / register). The
 * other 14 namespaces are deferred to a post-paint, fire-and-forget
 * `loadDeferredEnglishNamespaces()` call, triggered from src/main.tsx right
 * after `createRoot(...).render(...)` — mirroring the existing RU
 * `loadLanguageBundle` / bundle-loader.ts fire-and-forget pattern.
 *
 * ── CRITICAL TRAP (why these tests use a FRESH i18next instance) ──────────
 * src/lib/test-setup.ts (the global vitest `setupFiles` entry) pre-seeds the
 * SHARED i18next default singleton with ALL 17 EN+RU namespaces via its own
 * `i18n.init({ resources: {...} })` before any test file runs. init.ts's
 * `initI18n()` MERGES resources into whatever instance it's called on — it
 * does not wipe pre-existing bundles. So asserting namespace absence against
 * the SHARED singleton (`import i18n from '../index'`) would ALWAYS see the
 * namespace present (via the pre-seed) regardless of what init.ts actually
 * does — a false pass/fail that proves nothing about the real code path.
 *
 * To get a genuine RED, every test below uses `vi.resetModules()` + a dynamic
 * `import('i18next')` to obtain a brand new, unseeded i18next instance, then
 * dynamically imports a fresh `../init` bound to that same fresh module
 * registry. This mirrors the established pattern already used in this repo at
 * src/i18n/__tests__/i18n.test.ts:252-270 (and 282-298, 305-328).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const CRITICAL_EN_NAMESPACES = ['common', 'auth', 'landing'] as const;

const NONCRITICAL_EN_NAMESPACES = [
  'achievements',
  'admin',
  'changelog',
  'culture',
  'deck',
  'feedback',
  'mockExam',
  'profile',
  'review',
  'settings',
  'statistics',
  'subscription',
  'upgrade',
  'waitlist',
] as const;

describe('PERF-24-01: EN critical-namespace split (fresh instance)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    localStorage.removeItem('i18nextLng');
  });

  // ---------------------------------------------------------------------------
  // AC-1: critical_en_namespaces_present_synchronously
  //
  // Passes today (all 17 EN namespaces load synchronously, so the critical
  // trio trivially does too) AND after the split (critical trio is exactly
  // what stays synchronous). Not the RED driver — a guard that must never
  // regress once the split lands.
  // ---------------------------------------------------------------------------
  it('AC-1: critical_en_namespaces_present_synchronously', async () => {
    localStorage.setItem('i18nextLng', 'en');
    vi.resetModules();

    const freshInit = await import('../init');
    freshInit.resetI18nInit();
    const { default: freshI18n } = await import('i18next');

    await freshInit.initI18n();

    CRITICAL_EN_NAMESPACES.forEach((ns) => {
      expect(freshI18n.hasResourceBundle('en', ns)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // AC-2: noncritical_en_absent_until_deferred_then_present
  //
  // RED DRIVER. On the CURRENT (unsplit) init.ts, all 17 EN namespaces
  // (including 'deck') are passed to i18n.init({ resources }) synchronously,
  // so 'deck' is present the instant initI18n() resolves — the very first
  // expect() below is `expect(true).toBe(false)` today, a clean assertion
  // failure (not an import/collection error).
  //
  // Post-split, 'deck' must NOT be present synchronously — it ships only via
  // the deferred, post-paint loader. The absence check is placed FIRST so the
  // RED is unambiguous; the "then present after deferred load" continuation
  // below is unreached until the absence check passes (post-split), by which
  // point the executor's loadDeferredEnglishNamespaces() export must exist.
  // ---------------------------------------------------------------------------
  it('AC-2: noncritical_en_absent_until_deferred_then_present', async () => {
    localStorage.setItem('i18nextLng', 'en');
    vi.resetModules();

    const freshInit = await import('../init');
    freshInit.resetI18nInit();
    const { default: freshI18n } = await import('i18next');

    await freshInit.initI18n();

    // --- RED: fails today with "expected true to be false" -----------------
    expect(freshI18n.hasResourceBundle('en', 'deck')).toBe(false);
    // ------------------------------------------------------------------------

    // Not reached until the split lands. The executor's plan names the new
    // export `loadDeferredEnglishNamespaces()`, mirroring the RU
    // `loadLanguageBundle` / bundle-loader.ts pattern. We don't know yet
    // whether it will be exported from `init.ts` or `bundle-loader.ts`, so we
    // probe both — if neither exists, this line throws (acceptable failure
    // mode per the Stage 2.5 brief, since the absence check above already
    // provides the clean RED).
    const initModule = freshInit as unknown as {
      loadDeferredEnglishNamespaces?: () => Promise<unknown>;
    };
    const bundleModule = (await import('../bundle-loader')) as unknown as {
      loadDeferredEnglishNamespaces?: () => Promise<unknown>;
    };
    const loadDeferred =
      initModule.loadDeferredEnglishNamespaces ?? bundleModule.loadDeferredEnglishNamespaces;

    expect(typeof loadDeferred).toBe('function');
    await loadDeferred!();

    NONCRITICAL_EN_NAMESPACES.forEach((ns) => {
      expect(freshI18n.hasResourceBundle('en', ns)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // AC-1: pre_auth_strings_resolve_no_missing_key
  //
  // Passes today AND after the split — a guard confirming the pre-auth
  // surface (login title from `auth`, hero title from `landing`) never
  // regresses to returning the raw key path (which would happen if either
  // namespace were accidentally moved into the deferred set).
  // ---------------------------------------------------------------------------
  it('AC-1: pre_auth_strings_resolve_no_missing_key', async () => {
    localStorage.setItem('i18nextLng', 'en');
    vi.resetModules();

    const freshInit = await import('../init');
    freshInit.resetI18nInit();
    const { default: freshI18n } = await import('i18next');

    await freshInit.initI18n();

    // auth namespace — Login page title.
    expect(freshI18n.t('auth:login.title')).toBe('Welcome Back');
    expect(freshI18n.t('auth:login.title')).not.toBe('auth:login.title');

    // landing namespace — hero title.
    expect(freshI18n.t('hero.title', { ns: 'landing' })).toBe('Your Greek Practice');
    expect(freshI18n.t('hero.title', { ns: 'landing' })).not.toBe('hero.title');
  });

  // ---------------------------------------------------------------------------
  // AC-5: ru_fire_and_forget_still_injects
  //
  // Regression guard: the RU fire-and-forget path (init.ts Step 3) is
  // untouched by the EN split. Passes today AND after.
  // ---------------------------------------------------------------------------
  it('AC-5: ru_fire_and_forget_still_injects', async () => {
    localStorage.setItem('i18nextLng', 'ru');
    vi.resetModules();

    const freshInit = await import('../init');
    freshInit.resetI18nInit();
    const { default: freshI18n } = await import('i18next');

    await freshInit.initI18n();

    await vi.waitFor(() => {
      expect(freshI18n.hasResourceBundle('ru', 'common')).toBe(true);
    });
  });
});
