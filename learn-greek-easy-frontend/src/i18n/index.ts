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
import elAuth from './locales/el/auth.json';
import elCommon from './locales/el/common.json';
import elDeck from './locales/el/deck.json';
import elFeedback from './locales/el/feedback.json';
import elProfile from './locales/el/profile.json';
import elReview from './locales/el/review.json';
import elSettings from './locales/el/settings.json';
import elStatistics from './locales/el/statistics.json';
import enAuth from './locales/en/auth.json';
import enCommon from './locales/en/common.json';
import enDeck from './locales/en/deck.json';
import enFeedback from './locales/en/feedback.json';
import enProfile from './locales/en/profile.json';
import enReview from './locales/en/review.json';
import enSettings from './locales/en/settings.json';
import enStatistics from './locales/en/statistics.json';

/**
 * Translation resources organized by language and namespace
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
  },
  el: {
    common: elCommon,
    auth: elAuth,
    deck: elDeck,
    review: elReview,
    settings: elSettings,
    profile: elProfile,
    statistics: elStatistics,
    feedback: elFeedback,
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
