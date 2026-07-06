/**
 * Async i18n initialization module.
 *
 * English resources are bundled synchronously — i18n.init() resolves without
 * waiting for any non-English bundle, so React mounts and first paint happen
 * immediately for all users.
 *
 * For non-English (RU) users, the locale bundle is loaded fire-and-forget
 * AFTER i18n.init() resolves. Once the bundle arrives, addResourceBundle()
 * injects it into the live i18next store; react-i18next's bindI18nStore:'added
 * removed' triggers a re-render so RU strings swap in post-paint with no flash
 * of untranslated content beyond the initial EN render.
 *
 * @module i18n/init
 */

import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import log from '@/lib/logger';

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
 * Detect the initial language from localStorage or navigator.
 * This runs BEFORE i18n.init() to pre-load resources.
 *
 * @returns The detected language code, normalized to supported languages
 */
function detectInitialLanguage(): SupportedLanguage {
  // Check localStorage first (user's saved preference)
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
 * Track initialization state to prevent double-init.
 */
let initialized = false;

/**
 * Initialize i18n with fire-and-forget non-English locale loading.
 *
 * This function:
 * 1. Detects the initial language from localStorage/navigator BEFORE init
 * 2. Initializes i18n immediately with synchronous English resources only
 * 3. If non-English detected, fires the bundle load post-init (fire-and-forget)
 *    so first paint is never blocked; RU strings swap in after the bundle arrives
 * 4. Sets up languageChanged event handler for runtime language switches
 *
 * @returns Promise that resolves when i18n is fully initialized (NOT when non-EN
 *          bundle has loaded — that happens asynchronously after this resolves)
 */
export async function initI18n(): Promise<typeof i18n> {
  if (initialized) {
    return i18n;
  }

  // Step 1: Detect initial language BEFORE i18n.init()
  const detectedLang = detectInitialLanguage();

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

  // Step 3: Fire-and-forget non-English bundle load.
  // i18next does NOT emit 'languageChanged' for the initial lng passed to
  // init(), so we must populate the bundle explicitly here.
  // bindI18nStore:'added removed' (above) ensures react-i18next re-renders
  // components when the bundle arrives via addResourceBundle().
  if (detectedLang !== DEFAULT_LANGUAGE) {
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
      const bundle = await loadLanguageBundle(lng as SupportedLanguage);
      if (bundle) {
        const langBundle = bundle[lng];
        if (langBundle) {
          Object.entries(langBundle).forEach(([ns, translations]) => {
            i18n.addResourceBundle(lng, ns, translations, true, true);
          });
        }
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
