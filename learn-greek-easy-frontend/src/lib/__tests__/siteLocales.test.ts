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
import { SUPPORTED_LANGUAGES } from '@/i18n/constants';

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

// --- QA-added coverage below (WEDGE-13-01 Stage 4 verification) -----------
//
// `SITE_LOCALES: readonly LocaleEntry[] = siteLocalesData.locales as LocaleEntry[]`
// is a compile-time-only type ASSERTION: `tsc -b --force` never validates that
// the JSON actually conforms to `LocaleEntry`. Verified directly — injecting an
// invalid `locale: "de"`, a duplicate `path: "/ru/"`, and a second
// `xDefault: true` entry into `site-locales.json` still exits `tsc -b --force`
// with code 0. These runtime invariants exist ONLY as tests; a compiler
// upgrade can never add this check because the data crosses a JSON/TS
// boundary via `as`, not a validated parse. Every assertion below is written
// generically over `SITE_LOCALES` (no hardcoded `en`/`ru` counts) so it keeps
// guarding correctly if a third locale is added to the registry.
describe('SITE_LOCALES registry invariants (runtime guard for `as LocaleEntry[]`)', () => {
  it('every entry.locale is a real SupportedLanguage', () => {
    for (const entry of SITE_LOCALES) {
      expect(SUPPORTED_LANGUAGES).toContain(entry.locale);
    }
  });

  it('no two entries share a locale', () => {
    const locales = SITE_LOCALES.map((entry) => entry.locale);
    expect(new Set(locales).size).toBe(locales.length);
  });

  it('exactly one entry has xDefault: true', () => {
    const xDefaultCount = SITE_LOCALES.filter((entry) => entry.xDefault === true).length;
    expect(xDefaultCount).toBe(1);
  });

  it('no two entries share a path', () => {
    const paths = SITE_LOCALES.map((entry) => entry.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('no two entries share a first path segment', () => {
    const segments = SITE_LOCALES.map((entry) => entry.path.split('/').filter(Boolean)[0] ?? '');
    expect(new Set(segments).size).toBe(segments.length);
  });

  it('every entry.path starts with a slash', () => {
    for (const entry of SITE_LOCALES) {
      expect(entry.path.startsWith('/')).toBe(true);
    }
  });

  it('SITE_URL has no trailing slash and is a valid absolute origin', () => {
    expect(SITE_URL.endsWith('/')).toBe(false);
    expect(() => new URL(SITE_URL)).not.toThrow();
    expect(new URL(SITE_URL).origin).toBe(SITE_URL);
  });

  it('every hreflang and ogLocale is non-empty and well-formed', () => {
    const hreflangShape = /^[a-z]{2}(-[A-Z]{2})?$/;
    const ogLocaleShape = /^[a-z]{2}_[A-Z]{2}$/;
    for (const entry of SITE_LOCALES) {
      expect(entry.hreflang).toMatch(hreflangShape);
      expect(entry.ogLocale).toMatch(ogLocaleShape);
    }
  });
});

// `detectRouteLocale` edges the Stage 1 architect addendum traced by hand and
// judged benign — re-verified independently below rather than taken on trust.
describe('detectRouteLocale edge cases', () => {
  it("is case-sensitive: uppercase /RU/ does not match (agrees with Caddy's case-sensitive try_files on Linux — verified: no case-insensitive matcher/global option exists in Caddyfile, and the container is Linux/ext4)", () => {
    expect(detectRouteLocale('/RU/')).toBeNull();
  });

  it('collapses a doubled leading slash: //ru/ still resolves to ru', () => {
    expect(detectRouteLocale('//ru/')).toBe('ru');
  });

  it('matches on the first segment regardless of deeper sub-path: /ru/login -> ru', () => {
    expect(detectRouteLocale('/ru/login')).toBe('ru');
  });

  it('returns null for an empty string', () => {
    expect(detectRouteLocale('')).toBeNull();
  });
});
