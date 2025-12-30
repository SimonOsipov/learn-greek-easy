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
// Greek and Russian resources are loaded on-demand via lazy-resources.ts
// This reduces the initial bundle by ~89KB for faster LCP
import enAdmin from './locales/en/admin.json';
import enAuth from './locales/en/auth.json';
import enCommon from './locales/en/common.json';
import enCulture from './locales/en/culture.json';
import enDeck from './locales/en/deck.json';
import enFeedback from './locales/en/feedback.json';
import enProfile from './locales/en/profile.json';
import enReview from './locales/en/review.json';
import enSettings from './locales/en/settings.json';
import enStatistics from './locales/en/statistics.json';

/**
 * Translation resources - only English loaded synchronously.
 * Greek (el) and Russian (ru) are loaded on-demand when the user
 * switches language via loadLanguageResources() in lazy-resources.ts.
 */
const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    deck: enDeck,
    review: enReview,
    settings: enSettings,
    profile: enProfile,
    statistics: enStatistics,
    feedback: enFeedback,
    culture: enCulture,
    admin: enAdmin,
  },
};

/**
 * Initialize i18next with react-i18next bindings and language detection.
 *
 * Detection priority:
 * 1. localStorage (user's saved preference)
 * 2. navigator (browser language)
 * 3. fallback to 'en'
 *
 * Note: For authenticated users, the LanguageProvider (subtask I18N-03)
 * will sync the preference from the backend after login.
 */
i18n
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

// Re-export for convenience
export { i18n };
export default i18n;

// Re-export types and constants
export * from './constants';
export * from './types';
