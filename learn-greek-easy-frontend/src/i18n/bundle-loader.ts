/**
 * Initial locale bundle loader for non-English languages.
 *
 * This module is used by initI18n() to load the initial non-English locale
 * bundle. It is separate from lazy-resources.ts (which handles runtime
 * language-switch loading) to allow clean test isolation via
 * vi.doMock('@/i18n/bundle-loader', ...).
 *
 * IMPORTANT — this module exports exactly ONE symbol (loadLanguageBundle), and
 * must keep doing so. The PERF-09-01 suite mocks it with a vi.doMock factory
 * returning a single property (i18n.test.ts:403-405); a second named export
 * would make Vitest throw "No <X> export is defined on the mock" and force
 * edits to a suite that must pass unmodified. The critical/deferred split is
 * therefore expressed as an optional PARAMETER, not as extra exports.
 *
 * @module i18n/bundle-loader
 */

import type { SupportedLanguage } from './constants';

/**
 * Which slice of a locale's namespaces to load.
 *
 * - 'critical' — the 3 namespaces backing the pre-auth LCP surface
 *   (common/auth/landing), the same trio PERF-24-01 established for English.
 *   Small enough to be awaited before first paint.
 * - 'deferred' — the other 14 namespaces. Post-auth only; never paint-blocking.
 * - 'all' — every namespace (default). The historical behaviour.
 */
type BundleScope = 'all' | 'critical' | 'deferred';

/**
 * Load the 3 critical Russian namespaces (common/auth/landing).
 *
 * These back the pre-auth LCP surface, so this slice — and only this slice —
 * is small enough for initI18n() to await before first paint on the /ru/
 * entry. Awaiting all 17 instead would block paint on ~210 KB the landing page
 * never reads (admin.json alone is 104,418 B).
 */
async function loadRussianCriticalBundle(): Promise<Record<string, unknown>> {
  const [auth, common, landing] = await Promise.all([
    import('./locales/ru/auth.json'),
    import('./locales/ru/common.json'),
    import('./locales/ru/landing.json'),
  ]);

  return {
    auth: auth.default,
    common: common.default,
    landing: landing.default,
  };
}

/**
 * Load the 14 non-critical Russian namespaces.
 *
 * Post-auth surfaces only — loaded fire-and-forget after first paint.
 */
async function loadRussianDeferredBundle(): Promise<Record<string, unknown>> {
  const [
    achievements,
    admin,
    changelog,
    culture,
    deck,
    feedback,
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
    import('./locales/ru/changelog.json'),
    import('./locales/ru/culture.json'),
    import('./locales/ru/deck.json'),
    import('./locales/ru/feedback.json'),
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
    changelog: changelog.default,
    culture: culture.default,
    deck: deck.default,
    feedback: feedback.default,
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
 * Load Russian language resources.
 *
 * Composes the critical and deferred slices. Both helpers run to their own
 * Promise.all synchronously, so all 17 imports are still in flight in the same
 * tick and the first rejection still rejects the whole — behaviourally
 * identical to the single flat Promise.all this replaced.
 *
 * @returns Promise resolving to Russian resource bundle keyed by namespace
 */
async function loadRussianBundle(): Promise<Record<string, unknown>> {
  const [critical, deferred] = await Promise.all([
    loadRussianCriticalBundle(),
    loadRussianDeferredBundle(),
  ]);

  return { ...critical, ...deferred };
}

/**
 * Load the initial locale bundle for a non-English language.
 *
 * Called two ways by initI18n():
 * - `/` entry: fire-and-forget with the default 'all' scope, exactly as before.
 * - `/ru/` (URL locale prefix) entry: 'critical' awaited before init resolves,
 *   then 'deferred' fire-and-forget post-resolution.
 *
 * @param lang - Language code to load ('ru')
 * @param scope - Which namespace slice to load; defaults to 'all' (unchanged
 *                behaviour for every pre-existing caller)
 * @returns Promise resolving to resource bundle keyed as { [lang]: { [ns]: translations } }
 *          or undefined for the default English language
 */
export async function loadLanguageBundle(
  lang: SupportedLanguage,
  scope: BundleScope = 'all'
): Promise<Record<string, Record<string, unknown>> | undefined> {
  if (lang === 'ru') {
    if (scope === 'critical') {
      return { ru: await loadRussianCriticalBundle() };
    }
    if (scope === 'deferred') {
      return { ru: await loadRussianDeferredBundle() };
    }
    const bundle = await loadRussianBundle();
    return { ru: bundle };
  }
  // English is already bundled synchronously
  return undefined;
}
