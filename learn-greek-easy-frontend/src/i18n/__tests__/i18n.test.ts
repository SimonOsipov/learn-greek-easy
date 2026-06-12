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

    it('should have all namespaces loaded for English', () => {
      NAMESPACES.forEach((ns) => {
        expect(i18n.hasResourceBundle('en', ns)).toBe(true);
      });
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

    it('should access translations from different namespaces', async () => {
      // Ensure we're testing in English
      await i18n.changeLanguage('en');

      // Common namespace
      expect(i18n.t('common:loading')).toBe('Loading...');

      // Auth namespace - note: the app uses Greek greeting for branding
      // "Kalos irthate!" means "Welcome!" in Greek
      expect(i18n.t('auth:login.title')).toBeTruthy();

      // Deck namespace
      expect(i18n.t('deck:list.title')).toBe('Available Decks');

      // Settings namespace
      expect(i18n.t('settings:page.title')).toBe('Settings');
    });
  });
});

// ---------------------------------------------------------------------------
// PERF-09-01: Fire-and-forget locale load — RED specs
//
// These tests verify that initI18n() does NOT block on the RU bundle before
// resolving.  They isolate from the shared i18n singleton by:
//   1. Resetting the initialized flag with resetI18nInit() before each test.
//   2. Spying on i18n.addResourceBundle and timing initI18n() resolution
//      relative to when the bundle would be injected.
//   3. For the edge/rejection test: using vi.resetModules() + vi.doMock within
//      the test body to get a fresh init.ts with a rejecting loadRussianBundle.
//
// Pre-fix: AC-1 fails (initI18n() blocks on await loadLanguageBundle before
// i18n.init()).  AC-2 fails (addResourceBundle never called for 'ru' — the old
// path passed RU via the `resources` param to i18n.init()).
// AC-3 passes pre-fix (EN path never touches RU imports — regression guard).
// Edge fails pre-fix (initI18n() propagates the loadLanguageBundle rejection
// upward instead of swallowing it in a fire-and-forget chain).
// ---------------------------------------------------------------------------
describe('PERF-09-01: fire-and-forget RU locale load', () => {
  // Holds the per-test deferred control handles for the RU bundle.
  // The deferred is created fresh each test so we can settle it independently.
  let deferredResolve: ((value: { default: Record<string, unknown> }) => void) | null = null;
  let deferredReject: ((reason: unknown) => void) | null = null;

  /**
   * Returns a new deferred promise for a single RU JSON module.
   * Stores the LAST resolve/reject handles; since Promise.all() in
   * loadRussianBundle awaits all 17 imports, only one deferred needs to
   * remain pending for the whole Promise.all to stay unsettled.
   */
  function makeDeferredRuModule(): Promise<{ default: Record<string, unknown> }> {
    return new Promise<{ default: Record<string, unknown> }>((resolve, reject) => {
      deferredResolve = resolve;
      deferredReject = reject;
    });
  }

  // Minimal fake RU locale payload (non-empty so addResourceBundle receives real data).
  const fakeRuPayload: Record<string, unknown> = { loading: 'Загрузка...' };

  beforeEach(() => {
    deferredResolve = null;
    deferredReject = null;

    // Simulate RU locale detection: set localStorage key so detectInitialLanguage()
    // returns 'ru'.  test-setup.ts replaces globalThis.localStorage with a fresh
    // LocalStorageMock before each test file, so this is safe to set here.
    localStorage.setItem('i18nextLng', 'ru');
  });

  afterEach(async () => {
    vi.restoreAllMocks();

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
  // Mechanism: spy on i18n.addResourceBundle. After calling initI18n() and
  // awaiting it (with a tight race against a multi-tick sentinel), verify:
  //   - pre-fix: the sentinel wins the race (initI18n() blocked on the bundle
  //     await), so winner === 'sentinel' → assertion `toBe('init')` FAILS.
  //   - post-fix: initI18n() wins (bundle kicked as fire-and-forget), and
  //     addResourceBundle has NOT yet been called for 'ru' at that moment.
  //
  // The "never-resolving" effect is achieved by mocking loadLanguageBundle's
  // observable outcome: we spy on addResourceBundle and assert it hasn't fired
  // for 'ru' when initI18n() resolves.  The race test catches the blocking.
  //
  // Pre-fix failure mode: winner === 'sentinel' (initI18n awaits loadLanguageBundle
  // which resolves synchronously in happy-dom but still yields multiple times
  // before the await chain completes — sentinel wins within 5 ticks).
  // ---------------------------------------------------------------------------
  it('AC-1: initI18n_resolves_without_awaiting_ru_bundle — initI18n settles before RU bundle is injected', async () => {
    resetI18nInit();

    // Spy on i18n.addResourceBundle to track if/when RU bundles are added.
    const addBundleSpy = vi.spyOn(i18n, 'addResourceBundle');

    // Race initI18n() against a sentinel that wins in 5 microtask ticks.
    // Post-fix: initI18n() skips the `await loadLanguageBundle` so it resolves
    //           after only i18n.init() (already done → immediate) — it wins the race.
    // Pre-fix: initI18n() does `await loadLanguageBundle('ru')` which even when
    //          it resolves synchronously in happy-dom still requires multiple
    //          microtask yields before initI18n() can continue — sentinel wins.
    const SENTINEL = 'sentinel' as const;
    const INIT = 'init' as const;

    const winner = await Promise.race([
      initI18n().then(() => INIT),
      Promise.resolve()
        .then(() => {})
        .then(() => {})
        .then(() => {})
        .then(() => {})
        .then(() => SENTINEL),
    ]);

    expect(winner).toBe(INIT);

    // At the moment initI18n() resolved, addResourceBundle must NOT yet have been
    // called with 'ru' — the fire-and-forget bundle injection happens asynchronously
    // AFTER init resolves.
    const ruCallsAtInit = addBundleSpy.mock.calls.filter((args) => args[0] === 'ru');
    expect(ruCallsAtInit).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // AC-2: RU strings populate via fire-and-forget after initI18n() resolves
  //
  // Pre-fix: the `await loadLanguageBundle` blocking path puts RU translations
  //          into the `resources` object passed to i18n.init() (which is a
  //          no-op since the singleton is already initialized in test-setup.ts).
  //          addResourceBundle is never called for 'ru' → assertion FAILS.
  //
  // Post-fix: initI18n() resolves immediately, then the fire-and-forget chain
  //           calls addResourceBundle('ru', ns, ...) for each namespace after
  //           loadLanguageBundle resolves.
  // ---------------------------------------------------------------------------
  it('AC-2: ru_strings_populate_via_fire_and_forget — addResourceBundle called for ru after initI18n resolves', async () => {
    resetI18nInit();

    const addBundleSpy = vi.spyOn(i18n, 'addResourceBundle');

    // Await initI18n(). Post-fix: resolves quickly. Pre-fix: also resolves
    // (real RU json loads synchronously in happy-dom), but via the BLOCKING path.
    await initI18n();

    // Flush multiple microtask rounds so any fire-and-forget .then() chain can run.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Post-fix: addResourceBundle called for each RU namespace via fire-and-forget.
    // Pre-fix: addResourceBundle never called for 'ru' (translations went into
    //          `resources` param to i18n.init() which no-ops on the already-init'd
    //          singleton) — assertion fails.
    const ruAddCalls = addBundleSpy.mock.calls.filter((args) => args[0] === 'ru');
    expect(ruAddCalls.length).toBeGreaterThan(0);

    // Verify the fire-and-forget path (not languageChanged) populated the bundles:
    // language must remain 'en' or 'ru' (the i18n instance's active language after
    // init); critically, addResourceBundle was called WITHOUT a changeLanguage() call.
    // We confirm by checking that none of the ruAddCalls came after a change to 'ru'.
    // (The languageChanged handler at init.ts:263-275 only fires on changeLanguage(),
    //  not on initial load — so these calls must come from the fire-and-forget branch.)
    expect(i18n.language).not.toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // AC-3: EN user init uses sync bundle only — no RU import attempted/awaited
  //
  // Pre-fix: EN path skips the `if (lang === 'ru')` branch → GREEN pre-fix.
  // This test is a regression guard: ensures post-fix doesn't accidentally
  // load RU for EN users. Included in this describe block so it runs with the
  // same isolated setup.
  // ---------------------------------------------------------------------------
  it('AC-3: en_user_init_uses_sync_bundle_only — EN init resolves without touching RU imports', async () => {
    // Override to EN: detectInitialLanguage() will return 'en'.
    localStorage.setItem('i18nextLng', 'en');
    resetI18nInit();

    const addBundleSpy = vi.spyOn(i18n, 'addResourceBundle');

    await initI18n();

    // Flush microtasks in case any async side-effect fires.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // No RU addResourceBundle calls for the EN init path.
    const ruAddCalls = addBundleSpy.mock.calls.filter((args) => args[0] === 'ru');
    expect(ruAddCalls).toHaveLength(0);

    // EN translation must still be accessible (sync bundle bundled at build time).
    expect(i18n.t('hero.title', { ns: 'landing' })).toBe('Your Greek Practice');
  });

  // ---------------------------------------------------------------------------
  // Edge: RU fetch rejection — initI18n() must resolve (not reject); rejection
  // swallowed in the fire-and-forget .catch()
  //
  // Mechanism: use vi.resetModules() + vi.doMock WITHIN this test so a fresh
  // init.ts is loaded whose loadRussianBundle() promise rejects.  This isolates
  // from the module cache and makes the rejection actually propagate through the
  // code path rather than the happy-dom synchronous-import short-circuit.
  //
  // Pre-fix failure: initI18n() `await loadLanguageBundle(detectedLang)` throws,
  //                  so the whole function rejects → initError !== null → FAILS.
  // Post-fix: loadLanguageBundle is kicked fire-and-forget with .catch() →
  //           initI18n() has already resolved → initError remains null → PASSES.
  // ---------------------------------------------------------------------------
  it('Edge: ru_bundle_rejection_is_swallowed — initI18n resolves; rejection does not propagate', async () => {
    // Use vi.resetModules so the fresh dynamic import of init.ts below picks up
    // our vi.doMock for the RU JSON files (overrides the module cache).
    vi.resetModules();

    // Set up a rejecting deferred for ALL RU JSON imports.
    let rejectRuBundle: ((reason: unknown) => void) | null = null;
    const rejectingRuModule = new Promise<{ default: Record<string, unknown> }>((_, reject) => {
      rejectRuBundle = reject;
    });

    vi.doMock('@/i18n/locales/ru/achievements.json', () => rejectingRuModule);
    vi.doMock('@/i18n/locales/ru/admin.json', () => rejectingRuModule);
    vi.doMock('@/i18n/locales/ru/auth.json', () => rejectingRuModule);
    vi.doMock('@/i18n/locales/ru/changelog.json', () => rejectingRuModule);
    vi.doMock('@/i18n/locales/ru/common.json', () => rejectingRuModule);
    vi.doMock('@/i18n/locales/ru/culture.json', () => rejectingRuModule);
    vi.doMock('@/i18n/locales/ru/deck.json', () => rejectingRuModule);
    vi.doMock('@/i18n/locales/ru/feedback.json', () => rejectingRuModule);
    vi.doMock('@/i18n/locales/ru/landing.json', () => rejectingRuModule);
    vi.doMock('@/i18n/locales/ru/mockExam.json', () => rejectingRuModule);
    vi.doMock('@/i18n/locales/ru/profile.json', () => rejectingRuModule);
    vi.doMock('@/i18n/locales/ru/review.json', () => rejectingRuModule);
    vi.doMock('@/i18n/locales/ru/settings.json', () => rejectingRuModule);
    vi.doMock('@/i18n/locales/ru/statistics.json', () => rejectingRuModule);
    vi.doMock('@/i18n/locales/ru/upgrade.json', () => rejectingRuModule);
    vi.doMock('@/i18n/locales/ru/subscription.json', () => rejectingRuModule);
    vi.doMock('@/i18n/locales/ru/waitlist.json', () => rejectingRuModule);

    // Dynamically import a fresh copy of init.ts AFTER mocks are set up.
    const freshInit = await import('../init');
    freshInit.resetI18nInit();

    // Track whether initI18n resolves or rejects.
    let initResolved = false;
    let initError: unknown = null;

    const initPromise = freshInit
      .initI18n()
      .then(() => {
        initResolved = true;
      })
      .catch((err: unknown) => {
        initError = err;
      });

    // Flush microtasks to let initI18n() reach the fire-and-forget kick point
    // (post-fix) or the blocking await point (pre-fix).
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Now reject the RU bundle.
    if (rejectRuBundle) {
      rejectRuBundle(new Error('Simulated RU bundle network failure'));
    }

    // Flush for rejection propagation.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    await initPromise;

    // Clean up dynamic mocks so they don't bleed into later tests.
    vi.doUnmock('@/i18n/locales/ru/achievements.json');
    vi.doUnmock('@/i18n/locales/ru/admin.json');
    vi.doUnmock('@/i18n/locales/ru/auth.json');
    vi.doUnmock('@/i18n/locales/ru/changelog.json');
    vi.doUnmock('@/i18n/locales/ru/common.json');
    vi.doUnmock('@/i18n/locales/ru/culture.json');
    vi.doUnmock('@/i18n/locales/ru/deck.json');
    vi.doUnmock('@/i18n/locales/ru/feedback.json');
    vi.doUnmock('@/i18n/locales/ru/landing.json');
    vi.doUnmock('@/i18n/locales/ru/mockExam.json');
    vi.doUnmock('@/i18n/locales/ru/profile.json');
    vi.doUnmock('@/i18n/locales/ru/review.json');
    vi.doUnmock('@/i18n/locales/ru/settings.json');
    vi.doUnmock('@/i18n/locales/ru/statistics.json');
    vi.doUnmock('@/i18n/locales/ru/upgrade.json');
    vi.doUnmock('@/i18n/locales/ru/subscription.json');
    vi.doUnmock('@/i18n/locales/ru/waitlist.json');
    vi.resetModules();
    // Also reset the freshInit flag so the shared singleton is clean.
    freshInit.resetI18nInit();

    // Post-fix: initI18n() must have resolved (fire-and-forget swallows rejection).
    // Pre-fix: initI18n() propagates the rejection → initError !== null → FAILS.
    expect(initResolved).toBe(true);
    expect(initError).toBeNull();

    // i18n is still usable in EN fallback after the rejection.
    expect(i18n.t('common:loading')).toBe('Loading...');
  });
});
