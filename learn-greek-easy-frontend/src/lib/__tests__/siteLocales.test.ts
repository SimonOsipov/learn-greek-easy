/**
 * WEDGE-13-01 — locale registry + detectRouteLocale.
 *
 * These tests are authored RED, ahead of `src/lib/siteLocales.ts` and
 * `src/i18n/site-locales.json` existing (both are created by the executor in
 * Stage 3). They assert behavior from the subtask's acceptance criteria only:
 *
 * - AC-1: `site-locales.json` holds `SITE_URL` + per-locale
 *   `{ locale, path, hreflang, ogLocale, xDefault }` for `en` (`/`, x-default)
 *   and `ru` (`/ru/`).
 * - AC-2: `detectRouteLocale(pathname)` matches by WHOLE PATH SEGMENT, not by
 *   string-prefix — `/rutabaga` must NOT match `/ru`.
 *
 * The 7th Test Spec row (`landing_seo_keys_have_en_ru_parity`, AC-3/AC-4) is
 * covered by the existing auto-generated parity case in
 * `src/i18n/__tests__/parity.test.ts` once `seo.*` lands in both landing.json
 * files — no new test is added here for it.
 */
import { describe, it, expect } from 'vitest';

import { SITE_URL, SITE_LOCALES, detectRouteLocale } from '@/lib/siteLocales';

describe('detectRouteLocale', () => {
  it('detectRouteLocale_returns_ru_for_ru_root_slash', () => {
    expect(detectRouteLocale('/ru/')).toBe('ru');
  });

  it('detectRouteLocale_returns_ru_without_trailing_slash', () => {
    expect(detectRouteLocale('/ru')).toBe('ru');
  });

  it('detectRouteLocale_returns_null_for_root', () => {
    expect(detectRouteLocale('/')).toBeNull();
  });

  it('detectRouteLocale_returns_null_for_ru_prefixed_non_locale', () => {
    // Whole-segment match, not prefix match: the first path segment is
    // 'rutabaga', which is not equal to any registered locale's own segment
    // ('ru'). A naive `pathname.startsWith('/ru')` would wrongly match here.
    expect(detectRouteLocale('/rutabaga')).toBeNull();
  });

  it('detectRouteLocale_returns_null_for_app_route', () => {
    expect(detectRouteLocale('/login')).toBeNull();
  });
});

describe('SITE_LOCALES registry', () => {
  it('registry_pairs_en_root_xdefault_with_ru_prefix', () => {
    // SITE_URL is load-bearing: subtask 02 concatenates it into every
    // canonical, every hreflang href, og:url, and both sitemap <loc> entries.
    // No trailing slash is the invariant that makes `SITE_URL + path` join to
    // 'https://greeklish.eu/' and 'https://greeklish.eu/ru/' rather than a
    // doubled slash.
    expect(SITE_URL).toBe('https://greeklish.eu');
    expect(SITE_URL.endsWith('/')).toBe(false);

    const en = SITE_LOCALES.find((entry) => entry.locale === 'en');
    const ru = SITE_LOCALES.find((entry) => entry.locale === 'ru');

    expect(en).toMatchObject({
      path: '/',
      hreflang: 'en',
      ogLocale: 'en_US',
      xDefault: true,
    });
    expect(ru).toMatchObject({
      path: '/ru/',
      hreflang: 'ru',
      ogLocale: 'ru_RU',
      xDefault: false,
    });

    const xDefaultEntries = SITE_LOCALES.filter((entry) => entry.xDefault === true);
    expect(xDefaultEntries).toHaveLength(1);
  });
});
