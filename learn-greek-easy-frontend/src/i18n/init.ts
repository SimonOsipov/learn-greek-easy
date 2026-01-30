/**
 * Async i18n initialization module.
 *
 * This module solves the race condition where i18next-browser-languagedetector
 * detects a non-English language on page load, but the Greek/Russian resources
 * haven't been loaded yet (since they're lazy-loaded for better LCP).
 *
 * Solution: Detect the initial language BEFORE i18n.init() and pre-load
 * the necessary resources so they're available immediately.
 *
 * @module i18n/init
 */

import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

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
 * Initialize i18n with proper language detection and resource pre-loading.
 *
 * This function:
 * 1. Detects the initial language from localStorage/navigator BEFORE init
 * 2. Pre-loads the language resources if non-English
 * 3. Initializes i18n with all necessary resources already available
 * 4. Sets up languageChanged event handler for runtime language switches
 *
 * @returns Promise that resolves when i18n is fully initialized
 */
export async function initI18n(): Promise<typeof i18n> {
  if (initialized) {
    return i18n;
  }

  // Step 1: Detect initial language BEFORE i18n.init()
  const detectedLang = detectInitialLanguage();

  // Step 2: Pre-load resources if non-English
  const preloadedResources = await loadLanguageBundle(detectedLang);

  // Step 3: Merge pre-loaded resources with English resources
  const resources = {
    ...englishResources,
    ...preloadedResources,
  };

  // Step 4: Initialize i18n with resources already available
  await i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      // Resources
      resources,
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
        bindI18nStore: 'added removed',
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
    });

  // Step 5: Defense in depth - handle runtime language changes
  // This ensures resources are loaded if user switches language after init
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
