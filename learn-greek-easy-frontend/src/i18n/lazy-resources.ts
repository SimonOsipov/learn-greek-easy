/**
 * Lazy loading for non-English language resources.
 *
 * This module enables on-demand loading of Russian translations
 * to reduce the initial bundle size and improve LCP (Largest Contentful Paint).
 *
 * English resources are loaded synchronously as the default language.
 * Russian resources are loaded only when the user switches to that language.
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
 * Load Russian language resources on demand.
 *
 * @returns Promise that resolves when all Russian resources are loaded
 */
async function loadRussianResources(): Promise<void> {
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
  ]);

  i18n.addResourceBundle('ru', 'achievements', achievements.default, true, true);
  i18n.addResourceBundle('ru', 'admin', admin.default, true, true);
  i18n.addResourceBundle('ru', 'auth', auth.default, true, true);
  i18n.addResourceBundle('ru', 'changelog', changelog.default, true, true);
  i18n.addResourceBundle('ru', 'common', common.default, true, true);
  i18n.addResourceBundle('ru', 'culture', culture.default, true, true);
  i18n.addResourceBundle('ru', 'deck', deck.default, true, true);
  i18n.addResourceBundle('ru', 'feedback', feedback.default, true, true);
  i18n.addResourceBundle('ru', 'landing', landing.default, true, true);
  i18n.addResourceBundle('ru', 'mockExam', mockExam.default, true, true);
  i18n.addResourceBundle('ru', 'profile', profile.default, true, true);
  i18n.addResourceBundle('ru', 'review', review.default, true, true);
  i18n.addResourceBundle('ru', 'settings', settings.default, true, true);
  i18n.addResourceBundle('ru', 'statistics', statistics.default, true, true);
  i18n.addResourceBundle('ru', 'upgrade', upgrade.default, true, true);
}

/**
 * Lazily load language resources on demand.
 *
 * This function loads the translation resources for Russian language
 * when needed. English resources are always available (bundled synchronously).
 *
 * @param lang - The language code to load ('ru' for Russian)
 * @returns Promise that resolves when the language resources are loaded
 *
 * @example
 * // Load Russian resources before switching language
 * await loadLanguageResources('ru');
 * await i18n.changeLanguage('ru');
 */
export async function loadLanguageResources(lang: 'ru'): Promise<void> {
  // Check if already loaded to avoid duplicate network requests
  if (isLanguageLoaded(lang)) {
    return;
  }

  await loadRussianResources();
}
