/**
 * Lazy loading for non-English language resources.
 *
 * This module enables on-demand loading of Greek and Russian translations
 * to reduce the initial bundle size and improve LCP (Largest Contentful Paint).
 *
 * English resources are loaded synchronously as the default language.
 * Greek and Russian resources are loaded only when the user switches to those languages.
 *
 * @module i18n/lazy-resources
 */

import i18n from './index';

import type { SupportedLanguage } from './constants';

/**
 * Check if language resources are already loaded.
 *
 * @param lang - Language code to check
 * @returns true if the language resources are loaded
 */
export function isLanguageLoaded(lang: SupportedLanguage): boolean {
  // Check if common namespace exists (all namespaces are loaded together)
  return i18n.hasResourceBundle(lang, 'common');
}

/**
 * Load Greek language resources on demand.
 *
 * @returns Promise that resolves when all Greek resources are loaded
 */
async function loadGreekResources(): Promise<void> {
  const [admin, auth, common, culture, deck, feedback, profile, review, settings, statistics] =
    await Promise.all([
      import('./locales/el/admin.json'),
      import('./locales/el/auth.json'),
      import('./locales/el/common.json'),
      import('./locales/el/culture.json'),
      import('./locales/el/deck.json'),
      import('./locales/el/feedback.json'),
      import('./locales/el/profile.json'),
      import('./locales/el/review.json'),
      import('./locales/el/settings.json'),
      import('./locales/el/statistics.json'),
    ]);

  i18n.addResourceBundle('el', 'admin', admin.default, true, true);
  i18n.addResourceBundle('el', 'auth', auth.default, true, true);
  i18n.addResourceBundle('el', 'common', common.default, true, true);
  i18n.addResourceBundle('el', 'culture', culture.default, true, true);
  i18n.addResourceBundle('el', 'deck', deck.default, true, true);
  i18n.addResourceBundle('el', 'feedback', feedback.default, true, true);
  i18n.addResourceBundle('el', 'profile', profile.default, true, true);
  i18n.addResourceBundle('el', 'review', review.default, true, true);
  i18n.addResourceBundle('el', 'settings', settings.default, true, true);
  i18n.addResourceBundle('el', 'statistics', statistics.default, true, true);
}

/**
 * Load Russian language resources on demand.
 *
 * @returns Promise that resolves when all Russian resources are loaded
 */
async function loadRussianResources(): Promise<void> {
  const [admin, auth, common, culture, deck, feedback, profile, review, settings, statistics] =
    await Promise.all([
      import('./locales/ru/admin.json'),
      import('./locales/ru/auth.json'),
      import('./locales/ru/common.json'),
      import('./locales/ru/culture.json'),
      import('./locales/ru/deck.json'),
      import('./locales/ru/feedback.json'),
      import('./locales/ru/profile.json'),
      import('./locales/ru/review.json'),
      import('./locales/ru/settings.json'),
      import('./locales/ru/statistics.json'),
    ]);

  i18n.addResourceBundle('ru', 'admin', admin.default, true, true);
  i18n.addResourceBundle('ru', 'auth', auth.default, true, true);
  i18n.addResourceBundle('ru', 'common', common.default, true, true);
  i18n.addResourceBundle('ru', 'culture', culture.default, true, true);
  i18n.addResourceBundle('ru', 'deck', deck.default, true, true);
  i18n.addResourceBundle('ru', 'feedback', feedback.default, true, true);
  i18n.addResourceBundle('ru', 'profile', profile.default, true, true);
  i18n.addResourceBundle('ru', 'review', review.default, true, true);
  i18n.addResourceBundle('ru', 'settings', settings.default, true, true);
  i18n.addResourceBundle('ru', 'statistics', statistics.default, true, true);
}

/**
 * Lazily load language resources on demand.
 *
 * This function loads the translation resources for Greek or Russian languages
 * when needed. English resources are always available (bundled synchronously).
 *
 * @param lang - The language code to load ('el' for Greek, 'ru' for Russian)
 * @returns Promise that resolves when the language resources are loaded
 *
 * @example
 * // Load Greek resources before switching language
 * await loadLanguageResources('el');
 * await i18n.changeLanguage('el');
 */
export async function loadLanguageResources(lang: 'el' | 'ru'): Promise<void> {
  // Check if already loaded to avoid duplicate network requests
  if (isLanguageLoaded(lang)) {
    return;
  }

  if (lang === 'el') {
    await loadGreekResources();
  } else if (lang === 'ru') {
    await loadRussianResources();
  }
}
