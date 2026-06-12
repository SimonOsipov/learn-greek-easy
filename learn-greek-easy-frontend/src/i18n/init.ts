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
 * Reset initialization state (for testing purposes only).
 */
export function resetI18nInit(): void {
  initialized = false;
}

// Re-export i18n instance for convenience
export { i18n };
