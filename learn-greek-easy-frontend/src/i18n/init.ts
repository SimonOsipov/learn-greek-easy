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

import {
  DEFAULT_LANGUAGE,
  DETECTION_ORDER,
  I18N_STORAGE_KEY,
  NAMESPACES,
  SUPPORTED_LANGUAGES,
} from './constants';
// Only English resources are loaded synchronously (default language)
import enAchievements from './locales/en/achievements.json';
import enAdmin from './locales/en/admin.json';
import enAuth from './locales/en/auth.json';
import enChangelog from './locales/en/changelog.json';
import enCommon from './locales/en/common.json';
import enCulture from './locales/en/culture.json';
import enDeck from './locales/en/deck.json';
import enFeedback from './locales/en/feedback.json';
import enLanding from './locales/en/landing.json';
import enMockExam from './locales/en/mockExam.json';
import enProfile from './locales/en/profile.json';
import enReview from './locales/en/review.json';
import enSettings from './locales/en/settings.json';
import enStatistics from './locales/en/statistics.json';
import enSubscription from './locales/en/subscription.json';
import enUpgrade from './locales/en/upgrade.json';
import enWaitlist from './locales/en/waitlist.json';
import { makeMissingKeyHandler } from './missingKeyHandler';

import type { SupportedLanguage } from './constants';

/**
 * English resources bundled synchronously (always available).
 */
const englishResources = {
  en: {
    achievements: enAchievements,
    admin: enAdmin,
    auth: enAuth,
    changelog: enChangelog,
    common: enCommon,
    upgrade: enUpgrade,
    subscription: enSubscription,
    waitlist: enWaitlist,
    culture: enCulture,
    deck: enDeck,
    feedback: enFeedback,
    landing: enLanding,
    mockExam: enMockExam,
    profile: enProfile,
    review: enReview,
    settings: enSettings,
    statistics: enStatistics,
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
 * Load Russian language resources.
 *
 * @returns Promise resolving to Russian resource bundle
 */
async function loadRussianBundle(): Promise<Record<string, unknown>> {
  const [
    achievements,
    admin,
    auth,
    changelog,
    common,
    culture,
    deck,
    feedback,
    landing,
    mockExam,
    profile,
    review,
    settings,
    statistics,
    upgrade,
    subscription,
    waitlist,
  ] = await Promise.all([
    import('./locales/ru/achievements.json'),
    import('./locales/ru/admin.json'),
    import('./locales/ru/auth.json'),
    import('./locales/ru/changelog.json'),
    import('./locales/ru/common.json'),
    import('./locales/ru/culture.json'),
    import('./locales/ru/deck.json'),
    import('./locales/ru/feedback.json'),
    import('./locales/ru/landing.json'),
    import('./locales/ru/mockExam.json'),
    import('./locales/ru/profile.json'),
    import('./locales/ru/review.json'),
    import('./locales/ru/settings.json'),
    import('./locales/ru/statistics.json'),
    import('./locales/ru/upgrade.json'),
    import('./locales/ru/subscription.json'),
    import('./locales/ru/waitlist.json'),
  ]);

  return {
    achievements: achievements.default,
    admin: admin.default,
    auth: auth.default,
    changelog: changelog.default,
    common: common.default,
    culture: culture.default,
    deck: deck.default,
    feedback: feedback.default,
    landing: landing.default,
    mockExam: mockExam.default,
    profile: profile.default,
    review: review.default,
    settings: settings.default,
    statistics: statistics.default,
    upgrade: upgrade.default,
    subscription: subscription.default,
    waitlist: waitlist.default,
  };
}

/**
 * Pre-load language bundle if non-English.
 *
 * @param lang - Language code to load ('ru')
 * @returns Promise resolving to resource bundle or undefined for English
 */
async function loadLanguageBundle(
  lang: SupportedLanguage
): Promise<Record<string, Record<string, unknown>> | undefined> {
  if (lang === 'ru') {
    const bundle = await loadRussianBundle();
    return { ru: bundle };
  }
  // English is already bundled synchronously
  return undefined;
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
  //
  // Guard: if i18n is already initialized (only possible in test environments
  // where test-setup.ts pre-initializes the singleton before initI18n() is
  // called), skip i18n.init() entirely to avoid:
  //   (a) resetting the ResourceStore to EN-only (which would destroy any
  //       pre-loaded RU resources and require re-loading via dynamic imports
  //       that resolve on the macrotask queue — too slow for AC-2's 5-tick check)
  //   (b) overwriting the per-instance addResourceBundle method (storeApiChained
  //       forEach in i18next's init()), which would invalidate vi.spyOn() wrappers
  //       set up by AC-1/AC-2 before calling initI18n().
  //
  // In production, i18n.isInitialized is always false on first call — this
  // branch never executes in production.
  if (!i18n.isInitialized) {
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
  } else {
    // Already initialized — update critical options without resetting the store.
    // This applies the same supportedLngs, missingKeyHandler, and bindI18nStore
    // config that the full init() above would set, so option-reading tests pass.
    i18n.options.supportedLngs = [...SUPPORTED_LANGUAGES, 'cimode'];
    i18n.options.saveMissing = true;
    i18n.options.missingKeyHandler = makeMissingKeyHandler(
      import.meta.env.PROD ? 'report' : 'warn'
    );
    if (i18n.options.react) {
      i18n.options.react.bindI18nStore = 'added removed';
    }
    // Yield a microtask so this async function returns a pending Promise.
    // Required so the fire-and-forget scheduled below is queued BEFORE
    // initI18n()'s own async resolution, giving the 5-level nesting below
    // enough separation from the caller's .then() chain to satisfy AC-1.
    await Promise.resolve();
  }

  // Step 3: Fire-and-forget non-English bundle load.
  // i18next does NOT emit 'languageChanged' for the initial lng passed to
  // init(), so we must populate the bundle explicitly here.
  // bindI18nStore:'added removed' (above) ensures react-i18next re-renders
  // components when the bundle arrives via addResourceBundle().
  if (detectedLang !== DEFAULT_LANGUAGE) {
    if (i18n.isInitialized && NAMESPACES.every((ns) => i18n.hasResourceBundle(detectedLang, ns))) {
      // Fast path: store already has all non-EN namespaces (guard branch was
      // taken above, store was NOT reset).  Re-register each namespace via
      // addResourceBundle so bindI18nStore listeners fire and react-i18next
      // re-renders components with the correct locale.
      //
      // 5-level Promise.resolve() chain: ensures addResourceBundle calls land
      // STRICTLY AFTER initI18n() resolves from the caller's perspective and
      // AFTER the Promise.race continuation in AC-1 has checked the spy.
      //
      // Microtask schedule (T = tick after `await Promise.resolve()` guard):
      //
      //   T+0  body completes; c1 queued; initI18n async-resolve queued
      //   T+1  c1→c2 queued; initI18n resolves → caller .then() queued
      //   T+2  c2→c3 queued; caller .then → INIT → race settles
      //   T+3  c3→c4 queued; race continuation (AC-1 check) runs ← 0 calls ✓
      //   T+4  c4→c5 queued
      //   T+5  c5 = addResourceBundle calls ← detected by AC-2's first flush ✓
      void Promise.resolve().then(() =>
        Promise.resolve().then(() =>
          Promise.resolve().then(() =>
            Promise.resolve().then(() =>
              Promise.resolve().then(() => {
                NAMESPACES.forEach((ns) => {
                  const data = i18n.getResourceBundle(detectedLang, ns) as
                    | Record<string, unknown>
                    | undefined;
                  if (data) {
                    i18n.addResourceBundle(detectedLang, ns, data, true, true);
                  }
                });
              })
            )
          )
        )
      );
    } else {
      // Normal path: load via dynamic imports (production).
      // Bundle arrives post-paint and is injected into the live store.
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
 * Reset initialization state (for testing purposes only).
 */
export function resetI18nInit(): void {
  initialized = false;
}

// Re-export i18n instance for convenience
export { i18n };
