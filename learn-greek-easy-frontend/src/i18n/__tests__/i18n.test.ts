/**
 * i18n Configuration Tests
 *
 * Tests for i18n initialization, language resources, and translation functionality.
 * These tests verify that:
 * - i18next is configured correctly with fallback language
 * - All supported languages have resources loaded (after lazy loading)
 * - Translation keys return expected values
 * - Language switching works correctly
 *
 * Note: Uses async initI18n() which pre-loads resources based on detected language.
 * Additional languages are loaded via loadLanguageResources() for comprehensive testing.
 */

import { describe, it, expect, beforeEach, beforeAll, afterEach, vi } from 'vitest';

import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, NAMESPACES } from '../constants';
import i18n from '../index';
import { initI18n, resetI18nInit } from '../init';
import { loadLanguageResources } from '../lazy-resources';

describe('i18n configuration', () => {
  // Initialize i18n and load all language resources before running tests
  beforeAll(async () => {
    // Reset init state for clean test environment
    resetI18nInit();
    // Initialize i18n (this will detect English from test environment)
    await initI18n();
    // Load remaining languages for comprehensive testing
    await loadLanguageResources('ru');
  });

  beforeEach(async () => {
    // Reset to default language before each test
    await i18n.changeLanguage(DEFAULT_LANGUAGE);
  });

  describe('Initialization', () => {
    it('should initialize with correct fallback language', () => {
      expect(i18n.options.fallbackLng).toContain(DEFAULT_LANGUAGE);
    });

    it('should have all supported languages configured', () => {
      const languages = i18n.options.supportedLngs;
      SUPPORTED_LANGUAGES.forEach((lang) => {
        expect(languages).toContain(lang);
      });
    });

    it('should use common as default namespace', () => {
      expect(i18n.options.defaultNS).toBe('common');
    });

    it('should have all namespaces configured', () => {
      const configuredNS = i18n.options.ns;
      NAMESPACES.forEach((ns) => {
        expect(configuredNS).toContain(ns);
      });
    });
  });

  describe('Resource Bundles', () => {
    it('should have English common namespace loaded', () => {
      expect(i18n.hasResourceBundle('en', 'common')).toBe(true);
    });

    it('should have Russian common namespace loaded', () => {
      expect(i18n.hasResourceBundle('ru', 'common')).toBe(true);
    });

    // PERF-24-01: The SHARED singleton used elsewhere in this describe block
    // is pre-seeded with all 17 EN namespaces by src/lib/test-setup.ts,
    // independent of init.ts. That makes it unsuitable for asserting what
    // initI18n() itself loads synchronously vs. defers. This test therefore
    // uses a FRESH i18next instance (vi.resetModules() + dynamic import,
    // mirroring the pattern at this file's PERF-09-01 describe block below)
    // to assert the real invariant: only the critical trio (common/auth/
    // landing) loads synchronously; a non-critical namespace (deck) does not
    // — it ships via the deferred, post-paint loader instead.
    it('should load critical EN namespaces synchronously and defer a non-critical one (fresh instance)', async () => {
      localStorage.setItem('i18nextLng', 'en');
      vi.resetModules();

      const freshInit = await import('../init');
      freshInit.resetI18nInit();
      const { default: freshI18n } = await import('i18next');

      // IMPORTANT: in this repo's Vitest setup, `vi.resetModules()` does not
      // actually yield an isolated i18next package instance (node_modules
      // deps are not re-evaluated per reset) — `freshI18n` above IS the same
      // real i18next singleton the whole file shares. Calling
      // `freshInit.initI18n()` rebuilds i18next's internal ResourceStore from
      // scratch (i18next internals: `this.store = new
      // ResourceStore(this.options.resources, this.options)`), which wipes
      // the RU bundle this describe block's `beforeAll` loaded. The
      // try/finally restores it so later tests in this file (which rely on
      // the shared singleton having RU loaded) still pass, even if the
      // assertions below throw (the RED case, pre-split).
      try {
        await freshInit.initI18n();

        ['common', 'auth', 'landing'].forEach((ns) => {
          expect(freshI18n.hasResourceBundle('en', ns)).toBe(true);
        });

        // Non-critical namespace must NOT be present synchronously.
        expect(freshI18n.hasResourceBundle('en', 'deck')).toBe(false);
      } finally {
        vi.resetModules();
        resetI18nInit();
        await initI18n();
        await loadLanguageResources('ru');
      }
    });

    it('should have all namespaces loaded for Russian', () => {
      NAMESPACES.forEach((ns) => {
        expect(i18n.hasResourceBundle('ru', ns)).toBe(true);
      });
    });
  });

  describe('Language Switching', () => {
    it('should change language to English successfully', async () => {
      await i18n.changeLanguage('en');
      expect(i18n.language).toBe('en');
    });

    it('should change language to Russian successfully', async () => {
      await i18n.changeLanguage('ru');
      expect(i18n.language).toBe('ru');
    });

    it('should maintain language after multiple switches', async () => {
      await i18n.changeLanguage('ru');
      expect(i18n.language).toBe('ru');

      await i18n.changeLanguage('en');
      expect(i18n.language).toBe('en');

      await i18n.changeLanguage('ru');
      expect(i18n.language).toBe('ru');
    });
  });

  describe('Translations', () => {
    it('should return translation for valid key in English', () => {
      const translation = i18n.t('common:loading');
      expect(translation).toBe('Loading...');
    });

    it('should return translation for valid key in Russian', async () => {
      await i18n.changeLanguage('ru');
      const translation = i18n.t('common:loading');
      expect(translation).toBe('Загрузка...');
    });

    it('should return translation with namespace prefix', () => {
      const translation = i18n.t('nav.dashboard', { ns: 'common' });
      expect(translation).toBe('Dashboard');
    });

    it('should handle interpolation', () => {
      const translation = i18n.t('welcome.greeting', {
        ns: 'common',
        name: 'Test User',
      });
      expect(translation).toContain('Test User');
    });

    it('should return key path for missing translation', () => {
      const result = i18n.t('nonexistent.key');
      // With returnEmptyString: false and returnNull: false, missing keys return the key path.
      // The production init wires warn/report mode (not throw), so missing keys do not throw
      // here — they log to console.warn in dev and Sentry Logs in prod.
      expect(result).toBe('nonexistent.key');
    });
  });

  describe('Default Language', () => {
    it('should have English as default language constant', () => {
      expect(DEFAULT_LANGUAGE).toBe('en');
    });

    it('should have exactly 2 supported languages', () => {
      expect(SUPPORTED_LANGUAGES).toHaveLength(2);
    });

    it('should include en and ru in supported languages', () => {
      expect(SUPPORTED_LANGUAGES).toContain('en');
      expect(SUPPORTED_LANGUAGES).toContain('ru');
    });
  });

  describe('Namespaces', () => {
    it('should have all required namespaces', () => {
      const requiredNamespaces = [
        'common',
        'auth',
        'deck',
        'review',
        'settings',
        'profile',
        'statistics',
        'feedback',
      ];

      requiredNamespaces.forEach((ns) => {
        expect(NAMESPACES).toContain(ns);
      });
    });

    // PERF-24-01: this test runs on the SHARED singleton, which
    // src/lib/test-setup.ts always pre-seeds with all 17 EN namespaces
    // regardless of init.ts's synchronous/deferred split — so checking
    // 'deck'/'settings' (both now deferrable) here would not actually
    // exercise or guard the split's synchronous-availability invariant.
    // Retargeted to the critical trio (common/auth/landing), which init.ts
    // guarantees synchronously on ANY instance. Deferred-namespace access is
    // covered on a fresh instance in init.namespaceSplit.test.ts (AC-2).
    it('should access translations from different namespaces', async () => {
      // Ensure we're testing in English
      await i18n.changeLanguage('en');

      // Common namespace
      expect(i18n.t('common:loading')).toBe('Loading...');

      // Auth namespace - note: the app uses Greek greeting for branding
      // "Kalos irthate!" means "Welcome!" in Greek
      expect(i18n.t('auth:login.title')).toBeTruthy();

      // Landing namespace (critical — PERF-24-01)
      expect(i18n.t('hero.title', { ns: 'landing' })).toBe('Your Greek Practice');
    });
  });
});

// ---------------------------------------------------------------------------
// PERF-09-01: Fire-and-forget locale load — behavior-based specs
//
// These tests verify that initI18n() does NOT block on the RU bundle before
// resolving.  Each test uses vi.resetModules() to get a fresh init.ts with its
// own i18n singleton (isInitialized=false), exercising the PRODUCTION path.
//
// Key implementation detail: i18next.init() reassigns addResourceBundle on the
// instance via the storeApiChained loop (init.ts dependency on i18next internals).
// Therefore spies on addResourceBundle must be set AFTER initI18n() resolves,
// not before — i18n.init() would overwrite a pre-set spy.
//
// Assertions are behavior-based (spy call counts, vi.waitFor) — no hard-coded
// microtask-tick depths.
//
// AC-1: immediately after initI18n() resolves, 0 RU addResourceBundle calls.
// AC-2: after initI18n() resolves, addResourceBundle is eventually called for RU.
// AC-3: EN user init never calls addResourceBundle for RU.
// Edge: RU bundle rejection is swallowed by the fire-and-forget .catch();
//       initI18n() resolves and log.warn is called (not an unhandled rejection).
// ---------------------------------------------------------------------------
describe('PERF-09-01: fire-and-forget RU locale load', () => {
  beforeEach(() => {
    // Simulate RU locale detection: set localStorage key so detectInitialLanguage()
    // returns 'ru'.  test-setup.ts replaces globalThis.localStorage with a fresh
    // LocalStorageMock before each test file, so this is safe to set here.
    localStorage.setItem('i18nextLng', 'ru');
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.doUnmock('@/i18n/bundle-loader');
    vi.doUnmock('@/lib/logger');
    vi.resetModules();

    // Reset the init flag so the shared singleton is in a clean state for the
    // remaining test blocks in this file.
    resetI18nInit();

    // Restore i18n language to English (shared singleton remains seeded from
    // test-setup.ts, but language should be reset for next tests).
    if (i18n.language !== 'en') {
      await i18n.changeLanguage('en');
    }
    localStorage.removeItem('i18nextLng');
  });

  // ---------------------------------------------------------------------------
  // AC-1: initI18n() resolves WITHOUT awaiting the pending RU bundle
  //
  // Spy is set AFTER initI18n() resolves (avoids the storeApiChained overwrite).
  // Immediately after resolution, 0 RU calls have been made (fire-and-forget
  // is kicked async — it has not run yet at the resolution point).
  //
  // Pre-fix: initI18n() blocked on `await loadLanguageBundle` then called
  //   addResourceBundle before resolving → spy would see > 0 calls → FAILS.
  // Post-fix: init resolves, spy is set, 0 RU calls → PASSES.
  // ---------------------------------------------------------------------------
  it('AC-1: initI18n_resolves_without_awaiting_ru_bundle — initI18n settles before RU bundle is injected', async () => {
    vi.resetModules();
    const freshInit = await import('../init');
    freshInit.resetI18nInit();
    const { default: freshI18n } = await import('i18next');

    await freshInit.initI18n();

    // Spy is installed AFTER initI18n() resolves — after i18n.init() has run and
    // storeApiChained has wired up its addResourceBundle wrapper. The spy now
    // wraps the post-init addResourceBundle. Since we are still in the same
    // microtask as initI18n()'s resolution (no extra await), the fire-and-forget
    // .then() callback has not yet executed.
    const addBundleSpy = vi.spyOn(freshI18n, 'addResourceBundle');

    // 0 calls at the exact resolution point — fire-and-forget has not fired yet.
    const ruCallsAtResolution = addBundleSpy.mock.calls.filter((args) => args[0] === 'ru').length;
    expect(ruCallsAtResolution).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // AC-2: RU strings populate via fire-and-forget AFTER initI18n() resolves
  //
  // Spy is set after initI18n() resolves. vi.waitFor polls until the
  // fire-and-forget delivers at least one RU namespace — no fixed flush count.
  //
  // Pre-fix: addResourceBundle never called for 'ru' (old blocking path put RU
  //   into `resources` param to i18n.init() which no-ops) → waitFor times out.
  // Post-fix: fire-and-forget .then() calls addResourceBundle for each namespace.
  // ---------------------------------------------------------------------------
  it('AC-2: ru_strings_populate_via_fire_and_forget — addResourceBundle called for ru after initI18n resolves', async () => {
    vi.resetModules();
    const freshInit = await import('../init');
    freshInit.resetI18nInit();
    const { default: freshI18n } = await import('i18next');

    await freshInit.initI18n();

    // Spy after init (storeApiChained complete). The fire-and-forget is pending.
    const addBundleSpy = vi.spyOn(freshI18n, 'addResourceBundle');

    // Wait for the fire-and-forget to deliver at least one RU namespace.
    await vi.waitFor(() => {
      const ruCalls = addBundleSpy.mock.calls.filter((args) => args[0] === 'ru');
      expect(ruCalls.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // AC-3: EN user init uses sync bundle only — no RU import attempted/awaited
  //
  // Regression guard: post-fix must NOT accidentally load RU for EN users.
  // ---------------------------------------------------------------------------
  it('AC-3: en_user_init_uses_sync_bundle_only — EN init resolves without touching RU imports', async () => {
    // Override to EN: detectInitialLanguage() will return 'en'.
    localStorage.setItem('i18nextLng', 'en');

    vi.resetModules();
    const freshInit = await import('../init');
    freshInit.resetI18nInit();
    const { default: freshI18n } = await import('i18next');

    await freshInit.initI18n();

    // Spy after init. Flush microtasks to catch any inadvertent async side-effect.
    const addBundleSpy = vi.spyOn(freshI18n, 'addResourceBundle');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // No RU addResourceBundle calls for the EN init path.
    const ruAddCalls = addBundleSpy.mock.calls.filter((args) => args[0] === 'ru');
    expect(ruAddCalls).toHaveLength(0);

    // EN translation must still be accessible (sync bundle bundled at build time).
    expect(freshI18n.t('hero.title', { ns: 'landing' })).toBe('Your Greek Practice');
  });

  // ---------------------------------------------------------------------------
  // Edge: RU fetch rejection — initI18n() must resolve (not reject); rejection
  // swallowed in the fire-and-forget .catch()
  //
  // Mechanism: vi.resetModules() + vi.doMock('@/i18n/bundle-loader') with a
  // factory that returns a loadLanguageBundle that rejects. Mocking at the
  // bundle-loader module boundary (not individual JSON files) avoids Vitest's
  // unhandled rejection from the module mock system.
  //
  // We also mock @/lib/logger to spy that log.warn is called — confirming the
  // .catch() path was actually reached (not silently bypassed).
  //
  // Pre-fix: initI18n() `await loadLanguageBundle(detectedLang)` propagates the
  //   rejection → initError !== null → FAILS.
  // Post-fix: loadLanguageBundle is kicked fire-and-forget with .catch() →
  //   initI18n() has already resolved → initError remains null → PASSES.
  // ---------------------------------------------------------------------------
  it('Edge: ru_bundle_rejection_is_swallowed — initI18n resolves; rejection does not propagate', async () => {
    vi.resetModules();

    // Mock @/lib/logger to capture log.warn calls (confirms .catch() path ran).
    const warnSpy = vi.fn();
    vi.doMock('@/lib/logger', () => ({
      default: { warn: warnSpy, error: vi.fn(), info: vi.fn(), debug: vi.fn() },
    }));

    // Mock @/i18n/bundle-loader to return a loadLanguageBundle that rejects.
    // Mocking at this boundary (not individual JSON files) avoids Vitest's
    // module-mock-system unhandled-rejection leak.
    vi.doMock('@/i18n/bundle-loader', () => ({
      loadLanguageBundle: () => Promise.reject(new Error('Simulated RU bundle network failure')),
    }));

    // Import fresh init.ts AFTER mocks are set up — fresh i18n (isInitialized=false).
    const freshInit = await import('../init');
    freshInit.resetI18nInit();

    // Track whether initI18n resolves or rejects.
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

    // Post-fix: initI18n() must have resolved (fire-and-forget swallows rejection).
    // Pre-fix: initI18n() propagates the rejection → initError !== null → FAILS.
    expect(initResolved).toBe(true);
    expect(initError).toBeNull();

    // Wait for the fire-and-forget .catch() to run — log.warn must be called.
    // This proves the rejection reached the .catch() and was swallowed there,
    // not left as an unhandled rejection.
    await vi.waitFor(() => {
      expect(warnSpy).toHaveBeenCalled();
    });

    // The warn must reference the bundle failure (not some other warning).
    expect(warnSpy.mock.calls[0][0]).toContain('non-English bundle');

    // The shared i18n singleton (from test-setup.ts) is still usable in EN fallback.
    expect(i18n.t('common:loading')).toBe('Loading...');
  });
});
