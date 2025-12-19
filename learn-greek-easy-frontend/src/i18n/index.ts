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
import elCommon from './locales/el/common.json';
import enCommon from './locales/en/common.json';

/**
 * Translation resources organized by language and namespace
 */
const resources = {
  en: {
    common: enCommon,
  },
  el: {
    common: elCommon,
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
