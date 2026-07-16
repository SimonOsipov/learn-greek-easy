/**
 * WEDGE-13 — single source of truth for the site's public locale routing.
 *
 * The registry itself lives in `src/i18n/site-locales.json` (data, not code) so
 * that the build plugin can read it with `readFileSync` without a cross-project
 * TS import into `tsconfig.node.json`. This module is the app-side typed view of
 * that data.
 *
 * DOM-free and node-free by contract: no `document`, no `window`, no `fs`, and
 * no import from `@/i18n/init.ts` or any browser-only module. It is imported by
 * i18n initialization, which runs before the app mounts.
 */
import type { SupportedLanguage } from '@/i18n/constants';
import siteLocalesData from '@/i18n/site-locales.json';

export interface LocaleEntry {
  /** The i18n language code this route serves. */
  locale: SupportedLanguage;
  /** Public URL path for this locale's landing document: '/' or '/ru/'. */
  path: string;
  /** Value for `<link rel="alternate" hreflang="...">`: 'en' | 'ru'. */
  hreflang: string;
  /** Value for `<meta property="og:locale">`: 'en_US' | 'ru_RU'. */
  ogLocale: string;
  /** Exactly one entry is the `x-default` target. */
  xDefault: boolean;
}

/** Canonical origin, with NO trailing slash — `SITE_URL + entry.path` must not double the slash. */
export const SITE_URL: string = siteLocalesData.SITE_URL;

export const SITE_LOCALES: readonly LocaleEntry[] = siteLocalesData.locales as LocaleEntry[];

/** First non-empty path segment, or undefined when there is none ('/' -> undefined). */
function firstSegment(path: string): string | undefined {
  return path.split('/').filter(Boolean)[0];
}

/**
 * Matches a pathname to a registered locale by WHOLE PATH SEGMENT, never by
 * string prefix.
 *
 * - '/ru' and '/ru/' -> 'ru'
 * - '/' and '/login' -> null
 * - '/rutabaga'      -> null: the first segment is 'rutabaga', which does not
 *   equal any registered locale's own segment ('ru'). A naive
 *   `pathname.startsWith('/ru')` would wrongly match here.
 *
 * Derives each locale's segment from its registry `path` rather than hardcoding
 * 'ru', so adding a third locale to the registry needs no change here. The `en`
 * entry's path is '/', which has no segment, so it can never match — the
 * root document is reached by falling through to null.
 */
export function detectRouteLocale(pathname: string): SupportedLanguage | null {
  const segment = firstSegment(pathname);
  if (!segment) return null;
  const match = SITE_LOCALES.find((entry) => firstSegment(entry.path) === segment);
  return match ? match.locale : null;
}
