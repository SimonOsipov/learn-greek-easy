/**
 * Initial locale bundle loader for non-English languages.
 *
 * This module is used by initI18n() to fire-and-forget load the initial
 * non-English locale bundle after i18n.init() completes. It is separate
 * from lazy-resources.ts (which handles runtime language-switch loading)
 * to allow clean test isolation via vi.doMock('@/i18n/bundle-loader', ...).
 *
 * @module i18n/bundle-loader
 */

import type { SupportedLanguage } from './constants';

/**
 * Load Russian language resources.
 *
 * @returns Promise resolving to Russian resource bundle keyed by namespace
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
 * Load the initial locale bundle for a non-English language.
 *
 * Called fire-and-forget from initI18n() after i18n.init() resolves.
 *
 * @param lang - Language code to load ('ru')
 * @returns Promise resolving to resource bundle keyed as { [lang]: { [ns]: translations } }
 *          or undefined for the default English language
 */
export async function loadLanguageBundle(
  lang: SupportedLanguage
): Promise<Record<string, Record<string, unknown>> | undefined> {
  if (lang === 'ru') {
    const bundle = await loadRussianBundle();
    return { ru: bundle };
  }
  // English is already bundled synchronously
  return undefined;
}
