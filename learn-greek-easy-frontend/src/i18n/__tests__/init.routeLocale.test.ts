/**
 * WEDGE-13-03 — URL-locale precedence + route-scoped critical-namespace await.
 *
 * Covers AC-2 (URL prefix outranks localStorage/navigator), AC-3 (the RU
 * critical trio — common/auth/landing — is awaited on the URL-prefix path,
 * scoped on BOTH route AND namespace so the other 14 RU namespaces are never
 * paint-blocking), AC-5 (`/` keeps its existing detection order and
 * fire-and-forget byte-for-byte), AC-6 (a rejected RU bundle on the
 * URL-prefix path still resolves initI18n() and falls back to EN), and the
 * 13th (user-decided) spec pinning the `[localstorage-writeback]` decision.
 *
 * ── Defect D: every spec here needs a FRESH i18next instance ───────────────
 * `src/lib/test-setup.ts` (global `setupFiles`) pre-seeds the shared i18next
 * singleton with ALL 17 RU (and EN) namespaces before any test file runs.
 * Asserting `hasResourceBundle('ru', 'admin')` against that shared instance
 * would read back test-setup.ts's pre-seed, not what init.ts itself loaded —
 * `admin` would read `true` regardless of the implementation. Every spec
 * below therefore uses `vi.resetModules()` + a dynamic `import('../init')` +
 * `import('i18next')`, mirroring the established pattern at
 * `src/i18n/__tests__/i18n.test.ts:80-114` and
 * `src/i18n/__tests__/init.namespaceSplit.test.ts` (PERF-24-01, the EN-side
 * equivalent of this same split).
 *
 * jsdom/happy-dom shares one `window.history` per test file (route specs in
 * `../__tests__/ruRoute.test.tsx` need the same hygiene) — `beforeEach` resets
 * the pathname to `/` so no spec inherits a previous spec's route.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('WEDGE-13-03: URL-locale precedence + route-scoped critical await', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.doUnmock('@/i18n/bundle-loader');
    vi.doUnmock('@/lib/logger');
    vi.resetModules();
    window.history.pushState({}, '', '/');
    localStorage.clear();
  });

  // ---------------------------------------------------------------------------
  // AC-2: URL locale prefix outranks localStorage and navigator
  // ---------------------------------------------------------------------------

  it('url_prefix_beats_stale_localStorage_en', async () => {
    localStorage.setItem('i18nextLng', 'en');
    window.history.pushState({}, '', '/ru/');

    vi.resetModules();
    const freshInit = await import('../init');
    freshInit.resetI18nInit();
    const { default: freshI18n } = await import('i18next');

    await freshInit.initI18n();

    expect(freshI18n.language).toBe('ru');
  });

  it('url_prefix_beats_navigator_en', async () => {
    vi.stubGlobal('navigator', { ...navigator, language: 'en-US' });
    window.history.pushState({}, '', '/ru/');

    vi.resetModules();
    const freshInit = await import('../init');
    freshInit.resetI18nInit();
    const { default: freshI18n } = await import('i18next');

    await freshInit.initI18n();

    expect(freshI18n.language).toBe('ru');
  });

  // ---------------------------------------------------------------------------
  // AC-3: the RU critical trio is awaited on the URL-prefix entry — scoped on
  // BOTH route AND namespace (QA finding F1). The other 14 RU namespaces
  // (278,139 B raw, admin.json alone 104,418 B) must NOT be paint-blocking.
  // ---------------------------------------------------------------------------

  it('ru_critical_trio_is_awaited_on_route_locale_entry', async () => {
    window.history.pushState({}, '', '/ru/');

    vi.resetModules();
    const freshInit = await import('../init');
    freshInit.resetI18nInit();
    const { default: freshI18n } = await import('i18next');

    await freshInit.initI18n();

    (['common', 'auth', 'landing'] as const).forEach((ns) => {
      expect(freshI18n.hasResourceBundle('ru', ns)).toBe(true);
    });
  });

  it('ru_route_await_excludes_non_critical_namespaces', async () => {
    window.history.pushState({}, '', '/ru/');

    vi.resetModules();
    const freshInit = await import('../init');
    freshInit.resetI18nInit();
    const { default: freshI18n } = await import('i18next');

    await freshInit.initI18n();

    // The naive fix (route-only scoping) would await ALL 17 RU namespaces via
    // loadLanguageBundle('ru')'s single Promise.all (bundle-loader.ts:19-56) —
    // reintroducing the PERF-24/25 anti-pattern this story exists to avoid.
    // Asserting only that 'landing' is present (the trio's own AC) would let
    // that regression pass; this spec is the one QA finding F1 exists for.
    (['admin', 'deck', 'mockExam'] as const).forEach((ns) => {
      expect(freshI18n.hasResourceBundle('ru', ns)).toBe(false);
    });
  });

  it('ru_route_deferred_namespaces_arrive_after_resolution', async () => {
    window.history.pushState({}, '', '/ru/');

    vi.resetModules();
    const freshInit = await import('../init');
    freshInit.resetI18nInit();
    const { default: freshI18n } = await import('i18next');

    await freshInit.initI18n();

    // Not paint-blocking...
    expect(freshI18n.hasResourceBundle('ru', 'admin')).toBe(false);

    // ...but not dropped either — it must arrive fire-and-forget, post-paint,
    // mirroring loadDeferredEnglishNamespaces() (init.ts:230-289) with an
    // allSettled/.catch() guard.
    await vi.waitFor(() => {
      expect(freshI18n.hasResourceBundle('ru', 'admin')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // AC-5: `/` keeps its existing detection order and fire-and-forget
  // byte-for-byte. These two specs describe behavior that is ALREADY true on
  // the current (unimplemented) code — the point of AC-5 is that adding the
  // URL-prefix branch must not touch this path at all. They are not expected
  // to RED; they are the regression guard that would catch an executor who
  // made the new route-locale logic apply too broadly. Flagged in the QA
  // report rather than forced into an artificial red.
  // ---------------------------------------------------------------------------

  it('root_path_keeps_fire_and_forget_and_detection_order', async () => {
    vi.stubGlobal('navigator', { ...navigator, language: 'ru-RU' });
    window.history.pushState({}, '', '/');

    vi.resetModules();
    const freshInit = await import('../init');
    freshInit.resetI18nInit();
    const { default: freshI18n } = await import('i18next');

    await freshInit.initI18n();

    // PERF-09-01 guard: fire-and-forget means the RU bundle is NOT yet in the
    // store at the exact point initI18n() resolves.
    expect(freshI18n.hasResourceBundle('ru', 'common')).toBe(false);
  });

  it('root_path_localStorage_still_beats_navigator', async () => {
    localStorage.setItem('i18nextLng', 'en');
    vi.stubGlobal('navigator', { ...navigator, language: 'ru-RU' });
    window.history.pushState({}, '', '/');

    vi.resetModules();
    const freshInit = await import('../init');
    freshInit.resetI18nInit();
    const { default: freshI18n } = await import('i18next');

    await freshInit.initI18n();

    expect(freshI18n.language).toBe('en');
  });

  // ---------------------------------------------------------------------------
  // AC-6: a rejected RU bundle on the URL-prefix path still resolves
  // initI18n() — no unhandled rejection, no blank page — falls back to EN,
  // and logs a warning. Mirrors the existing "Edge: ru_bundle_rejection_is_
  // swallowed" spec in i18n.test.ts:391-441, retargeted to the route path.
  // ---------------------------------------------------------------------------

  it('route_locale_bundle_rejection_still_resolves_init', async () => {
    window.history.pushState({}, '', '/ru/');
    vi.resetModules();

    const warnSpy = vi.fn();
    vi.doMock('@/lib/logger', () => ({
      default: { warn: warnSpy, error: vi.fn(), info: vi.fn(), debug: vi.fn() },
    }));
    vi.doMock('@/i18n/bundle-loader', () => ({
      loadLanguageBundle: () => Promise.reject(new Error('Simulated RU bundle network failure')),
    }));

    const freshInit = await import('../init');
    freshInit.resetI18nInit();
    const { default: freshI18n } = await import('i18next');

    let initResolved = false;
    let initError: unknown = null;

    await freshInit
      .initI18n()
      .then(() => {
        initResolved = true;
      })
      .catch((err: unknown) => {
        initError = err;
      });

    expect(initResolved).toBe(true);
    expect(initError).toBeNull();

    // The discriminating assertion: on today's code, the URL-only pathname
    // '/ru/' carries no localStorage/navigator RU signal, so
    // detectInitialLanguage() returns 'en' and loadLanguageBundle is never
    // even called — warnSpy would never fire and this waitFor times out.
    await vi.waitFor(() => {
      expect(warnSpy).toHaveBeenCalled();
    });

    // EN fallback strings remain usable.
    expect(freshI18n.t('common:loading')).toBe('Loading...');
  });

  // ---------------------------------------------------------------------------
  // 13th spec (Decision [localstorage-writeback], Option A — user-decided at
  // Stage 2.5). GREEN on first write, by design: it is a direct consequence
  // of AC-2's URL-precedence branch plus the PRE-EXISTING `caches:
  // ['localStorage']` config (init.ts:126), not of any separate code. Its job
  // is to make a future silent change to the caching config fail loudly
  // rather than drift, pinning the accepted cost that a `/ru/` visit
  // overwrites a prior explicit 'en' preference.
  // ---------------------------------------------------------------------------

  it('ru_route_entry_persists_ru_to_localstorage', async () => {
    localStorage.setItem('i18nextLng', 'en');
    window.history.pushState({}, '', '/ru/');

    vi.resetModules();
    const freshInit = await import('../init');
    freshInit.resetI18nInit();

    await freshInit.initI18n();

    expect(localStorage.getItem('i18nextLng')).toBe('ru');
  });
});
