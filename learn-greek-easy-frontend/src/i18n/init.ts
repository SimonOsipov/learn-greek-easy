/**
 * Async i18n initialization module.
 *
 * English resources are bundled synchronously. There are two initialization
 * paths, and which one runs is decided by the URL:
 *
 * 1. NO locale prefix (`/`, `/login`, …) — unchanged. i18n.init() resolves
 *    without waiting for any non-English bundle, so React mounts and first
 *    paint happen immediately. For a non-English (RU) user the locale bundle
 *    is loaded fire-and-forget AFTER i18n.init() resolves; once it arrives,
 *    addResourceBundle() injects it into the live i18next store and
 *    react-i18next's bindI18nStore:'added removed' triggers a re-render, so RU
 *    strings swap in post-paint with no flash of untranslated content beyond
 *    the initial EN render.
 *
 * 2. A locale-prefixed URL (`/ru/`) — the language comes from the URL itself,
 *    which outranks localStorage and navigator. Here an EN first paint would
 *    be a visible defect: the statically-served /ru/ document already carries
 *    an RU <html lang> and RU <head>, so the booted SPA must agree with it.
 *    The await is therefore scoped on TWO axes:
 *      - route: only this URL-prefix path awaits anything; `/` never does.
 *      - namespace: only the CRITICAL trio (common/auth/landing) — the same
 *        trio PERF-24-01 established for English — is awaited. The other 14 RU
 *        namespaces stay fire-and-forget post-resolution.
 *    Both axes are load-bearing: RU's 17 namespaces total 278,139 B
 *    (admin.json alone 104,418 B), and await initI18n() gates
 *    createRoot().render() in main.tsx — so awaiting the full bundle would
 *    block first paint on ~210 KB the landing page never reads, which is the
 *    PERF-24/25 anti-pattern this path exists to avoid. The RU trio is
 *    68,321 B vs EN's 47,388 B: +44% from Cyrillic UTF-8 expansion — the same
 *    tier, not the same byte count.
 *
 * @module i18n/init
 */

import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import log from '@/lib/logger';
import { detectRouteLocale } from '@/lib/siteLocales';

import { loadLanguageBundle } from './bundle-loader';
import {
  DEFAULT_LANGUAGE,
  DETECTION_ORDER,
  I18N_STORAGE_KEY,
  NAMESPACES,
  SUPPORTED_LANGUAGES,
} from './constants';
// Only the 3 CRITICAL English namespaces load synchronously — these back the
// pre-auth LCP surface (landing page / login / register). The other 14 EN
// namespaces are deferred post-paint via loadDeferredEnglishNamespaces().
import enAuth from './locales/en/auth.json';
import enCommon from './locales/en/common.json';
import enLanding from './locales/en/landing.json';
import { makeMissingKeyHandler } from './missingKeyHandler';

import type { SupportedLanguage } from './constants';

/**
 * Critical English resources bundled synchronously (always available at first
 * paint). These 3 namespaces back the pre-auth LCP surface (landing / login /
 * register). The remaining 14 EN namespaces are post-auth only and load
 * fire-and-forget via loadDeferredEnglishNamespaces() after createRoot().
 */
const englishResources = {
  en: {
    common: enCommon,
    auth: enAuth,
    landing: enLanding,
  },
};

/**
 * Detect the initial language from the URL, localStorage, or navigator.
 * This runs BEFORE i18n.init() to pre-load resources.
 *
 * The URL locale prefix wins over BOTH localStorage and navigator: a Russian
 * searcher arriving on /ru/ from a RU SERP with a stale i18nextLng='en' must
 * still get RU. Otherwise /ru/ would serve EN to that user while Googlebot
 * (which has no localStorage) sees RU — invalidating the hreflang pair.
 *
 * @returns The detected language code, normalized to supported languages
 */
function detectInitialLanguage(): SupportedLanguage {
  // Check the URL locale prefix first — it describes the document being
  // requested, so it outranks any stored or browser preference.
  const routeLang = detectRouteLocale(window.location.pathname);
  if (routeLang) {
    return routeLang;
  }

  // Check localStorage next (user's saved preference)
  const storedLang = localStorage.getItem(I18N_STORAGE_KEY);
  if (storedLang && SUPPORTED_LANGUAGES.includes(storedLang as SupportedLanguage)) {
    return storedLang as SupportedLanguage;
  }

  // Check navigator.language (browser setting)
  const browserLang = navigator.language?.split('-')[0];
  if (browserLang && SUPPORTED_LANGUAGES.includes(browserLang as SupportedLanguage)) {
    return browserLang as SupportedLanguage;
  }

  // Fallback to default
  return DEFAULT_LANGUAGE;
}

/**
 * Inject a loaded locale bundle into the live i18next store.
 *
 * bindI18nStore:'added removed' (see init config) makes react-i18next re-render
 * once the namespaces land, so strings swap in with no user action.
 */
function addBundleNamespaces(
  lang: SupportedLanguage,
  bundle: Record<string, Record<string, unknown>> | undefined
): void {
  const langBundle = bundle?.[lang];
  if (!langBundle) {
    return;
  }
  Object.entries(langBundle).forEach(([ns, translations]) => {
    i18n.addResourceBundle(lang, ns, translations, true, true);
  });
}

/**
 * Track initialization state to prevent double-init.
 */
let initialized = false;

/**
 * Initialize i18n, awaiting a non-English bundle only on a locale-prefixed URL.
 *
 * This function:
 * 1. Detects the initial language from the URL prefix / localStorage /
 *    navigator BEFORE init (the URL wins — see detectInitialLanguage)
 * 2. Initializes i18n immediately with synchronous English resources only
 * 3. Loads the detected non-English bundle by one of two paths:
 *    - NO locale prefix (`/`): fire-and-forget post-init, so first paint is
 *      never blocked; RU strings swap in after the bundle arrives. UNCHANGED.
 *    - locale prefix (`/ru/`): AWAITS the critical trio (common/auth/landing)
 *      so the SPA never paints EN over the statically-served RU document, then
 *      fires the other 14 namespaces post-resolution. A failure here is
 *      swallowed (log.warn) and init still resolves onto the EN fallback —
 *      main.tsx gates createRoot().render() on this promise, so a throw would
 *      mean a blank page.
 * 4. Sets up languageChanged event handler for runtime language switches
 *
 * Note this reads window.location.pathname internally rather than taking it as
 * an argument, so no caller changes.
 *
 * @returns Promise that resolves when i18n is fully initialized. On `/` this is
 *          NOT when the non-EN bundle has loaded (that happens asynchronously
 *          after this resolves); on a locale-prefixed URL the critical trio IS
 *          in the store by the time it resolves, but the other 14 namespaces
 *          are still in flight.
 */
export async function initI18n(): Promise<typeof i18n> {
  if (initialized) {
    return i18n;
  }

  // Step 1: Detect initial language BEFORE i18n.init()
  const detectedLang = detectInitialLanguage();

  // Did the language come from the URL locale prefix? detectRouteLocale is a
  // pure function of the pathname, so asking it again here is free — and it
  // keeps detectInitialLanguage()'s SupportedLanguage return type intact.
  // Only this path awaits a bundle below.
  const routeLocale = detectRouteLocale(window.location.pathname);

  // Step 2: Initialize i18n with synchronous English resources only.
  // Non-English bundles are NOT awaited here — they are loaded fire-and-forget
  // after init resolves so React can mount and paint immediately.
  await i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      // Only the synchronous English bundle is passed here.
      // Non-English resources are injected post-init via addResourceBundle.
      resources: { ...englishResources },
      lng: detectedLang,
      fallbackLng: DEFAULT_LANGUAGE,
      supportedLngs: [...SUPPORTED_LANGUAGES],

      // Namespaces
      defaultNS: 'common',
      ns: [...NAMESPACES],

      // Language detection
      detection: {
        order: [...DETECTION_ORDER],
        lookupLocalStorage: I18N_STORAGE_KEY,
        caches: ['localStorage'],
      },

      // Interpolation
      interpolation: {
        escapeValue: false, // React already escapes values - no double-escaping
      },

      // React-specific options
      react: {
        useSuspense: false, // Disable suspense to avoid flash during SSR/hydration
        bindI18n: 'languageChanged loaded',
        bindI18nStore: 'added removed', // Re-renders when bundles are added/removed
        transEmptyNodeValue: '',
        transSupportBasicHtmlNodes: true,
        transKeepBasicHtmlNodesFor: ['br', 'strong', 'em', 'i', 'b'],
      },

      // Return empty string for missing keys in production
      // Helps identify missing translations in development
      returnNull: false,
      returnEmptyString: false,

      // Debug mode for development
      debug: import.meta.env.DEV,

      // Missing-key handler: report to Sentry Logs in production, warn to
      // console in development.  'throw' mode is used only in tests
      // (wired in src/lib/test-setup.ts).
      saveMissing: true,
      missingKeyHandler: makeMissingKeyHandler(import.meta.env.PROD ? 'report' : 'warn'),
    });

  // Step 3: Load the non-English bundle. i18next does NOT emit
  // 'languageChanged' for the initial lng passed to init(), so we must populate
  // the bundle explicitly here. bindI18nStore:'added removed' (above) ensures
  // react-i18next re-renders components when it arrives via addResourceBundle().
  //
  // Step 3a: URL-locale path (`/ru/`) — await ONLY the critical trio, so the
  // SPA agrees with the statically-served RU document at first paint without
  // blocking on the 14 namespaces the landing page never reads.
  if (routeLocale && detectedLang !== DEFAULT_LANGUAGE) {
    try {
      addBundleNamespaces(detectedLang, await loadLanguageBundle(detectedLang, 'critical'));
    } catch (err: unknown) {
      // Critical bundle failed — fall back to the synchronous EN resources.
      // main.tsx gates createRoot().render() on this promise, so this MUST NOT
      // rethrow: a rejection here is a blank page, not a language regression.
      log.warn('[i18n] Failed to load critical route-locale bundle, falling back to EN:', err);
    }

    // The other 14 namespaces: fire-and-forget post-resolution, never
    // paint-blocking — mirroring loadDeferredEnglishNamespaces() below.
    void loadLanguageBundle(detectedLang, 'deferred')
      .then((bundle) => {
        addBundleNamespaces(detectedLang, bundle);
      })
      .catch((err: unknown) => {
        // Post-auth namespaces fall back to the raw key path until a reload
        // retries. Graceful degradation; do NOT let the rejection propagate.
        log.warn('[i18n] Failed to load deferred route-locale namespaces:', err);
      });
  } else if (detectedLang !== DEFAULT_LANGUAGE) {
    // Step 3b: no locale prefix (`/`) — fire-and-forget, unchanged.
    void loadLanguageBundle(detectedLang)
      .then((bundle) => {
        if (bundle) {
          const langBundle = bundle[detectedLang];
          if (langBundle) {
            Object.entries(langBundle).forEach(([ns, translations]) => {
              i18n.addResourceBundle(detectedLang, ns, translations, true, true);
            });
          }
        }
      })
      .catch((err: unknown) => {
        // RU bundle failed to load — user stays on EN fallback.
        // This is a graceful degradation; do NOT let the rejection propagate.
        log.warn('[i18n] Failed to load non-English bundle, falling back to EN:', err);
      });
  }

  // Step 4: Defense in depth - handle runtime language changes.
  // This ensures resources are loaded if user switches language after init.
  // Note: this handler is NOT triggered by the initial lng set in init() above —
  // that initial load is handled by the fire-and-forget in Step 3.
  i18n.on('languageChanged', async (lng: string) => {
    if (lng === 'ru' && !i18n.hasResourceBundle(lng, 'common')) {
      // AC-6: i18next's emit() drops the promise this async handler returns, so
      // a rejecting loadLanguageBundle here escapes as an UNHANDLED rejection.
      // Reachable on the /ru/ entry: if the critical bundle already failed
      // (Step 3a logged and fell back to EN), the guard above is true, and any
      // later changeLanguage('ru') retries the still-broken load. Swallow it —
      // the user simply stays on the EN fallback.
      try {
        const bundle = await loadLanguageBundle(lng as SupportedLanguage);
        if (bundle) {
          const langBundle = bundle[lng];
          if (langBundle) {
            Object.entries(langBundle).forEach(([ns, translations]) => {
              i18n.addResourceBundle(lng, ns, translations, true, true);
            });
          }
        }
      } catch (err: unknown) {
        log.warn('[i18n] Failed to load non-English bundle on language change:', err);
      }
    }
  });

  initialized = true;
  return i18n;
}

/**
 * Fire-and-forget loader for the 14 non-critical English namespaces.
 *
 * initI18n() ships only the 3 critical namespaces (common/auth/landing) needed
 * for the pre-auth LCP surface. The remaining namespaces are post-auth only, so
 * they are imported lazily and injected into the live i18next store AFTER first
 * paint — mirroring the RU fire-and-forget pattern (Step 3 above). Called from
 * src/main.tsx right after createRoot(...).render(...), NOT behind
 * requestIdleCallback.
 *
 * bindI18nStore:'added removed' (see init config) triggers a react-i18next
 * re-render once each bundle arrives, so any already-mounted post-auth screen
 * swaps from the raw key path to the real string with no user action.
 *
 * Uses Promise.allSettled (not Promise.all) so ONE failed chunk (e.g. a flaky
 * connection dropping deck.json) never takes the other 13 down with it — each
 * import is added independently as soon as it resolves, and only the
 * namespace(s) that actually failed are logged and left for a reload to
 * retry. The import failures are swallowed (log.warn) so callers can invoke
 * this fire-and-forget (`void loadDeferredEnglishNamespaces()`) without
 * risking an unhandled rejection.
 *
 * @returns Promise that resolves once every successfully-loaded namespace is
 *          injected (failures are logged, not thrown — this never rejects).
 */
export async function loadDeferredEnglishNamespaces(): Promise<void> {
  // Parallel to the import list below; index i in `results` corresponds to
  // namespaces[i].
  const namespaces = [
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
  ];

  try {
    const results = await Promise.allSettled([
      import('./locales/en/achievements.json'),
      import('./locales/en/admin.json'),
      import('./locales/en/changelog.json'),
      import('./locales/en/culture.json'),
      import('./locales/en/deck.json'),
      import('./locales/en/feedback.json'),
      import('./locales/en/mockExam.json'),
      import('./locales/en/profile.json'),
      import('./locales/en/review.json'),
      import('./locales/en/settings.json'),
      import('./locales/en/statistics.json'),
      import('./locales/en/subscription.json'),
      import('./locales/en/upgrade.json'),
      import('./locales/en/waitlist.json'),
    ]);

    const failedNamespaces: string[] = [];

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        i18n.addResourceBundle('en', namespaces[i], result.value.default, true, true);
      } else {
        failedNamespaces.push(namespaces[i]);
      }
    });

    if (failedNamespaces.length > 0) {
      // Partial degradation: the namespaces below fall back to the raw key
      // path until a reload retries; every other namespace was still added.
      log.warn('[i18n] Some deferred English namespaces failed to load:', failedNamespaces);
    }
  } catch (err: unknown) {
    // Unexpected failure outside the per-namespace handling above (e.g.
    // addResourceBundle itself throwing). Graceful degradation; do NOT let
    // the rejection propagate (main.tsx calls this fire-and-forget).
    log.warn('[i18n] Failed to load deferred English namespaces:', err);
  }
}

/**
 * Reset initialization state (for testing purposes only).
 */
export function resetI18nInit(): void {
  initialized = false;
}

// Re-export i18n instance for convenience
export { i18n };
