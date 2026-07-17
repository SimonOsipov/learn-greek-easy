/**
 * WEDGE-13-02: build-time per-locale HTML derivation + sitemap.xml generation.
 *
 * Pure, DOM-free, fs-free string/regex functions, consumed by `localeHtmlPlugin`
 * in vite.config.ts (which owns the fs reads and the bundle wiring).
 *
 * Three hard constraints shape this file — none of them stylistic:
 *
 * 1. NO DOMParser. `build/**\/*.ts` lives under tsconfig.node.json, whose
 *    `lib: ["ES2023"]` has no DOM — `DOMParser` fails to compile (TS2304).
 *    String/regex only.
 *
 * 2. Tag-targeted regexes, NEVER content-based `.replace()`. `meta[name=description]`
 *    and `og:description` carry a BYTE-IDENTICAL content string in index.html
 *    (:72 and :78), so `html.replace(EN_DESCRIPTION, RU_DESCRIPTION)` fixes only the
 *    first occurrence and silently leaves og:description in English.
 *
 * 3. The types below are declared locally rather than imported from 01's
 *    `src/lib/siteLocales.ts` BY DESIGN — both routes are proven broken across the
 *    tsconfig.node.json / tsconfig.app.json boundary (TS2307 via the `@/` alias,
 *    which tsconfig.node.json does not define; TS6307 + transitive TS2307 via a
 *    relative path). `src/i18n/site-locales.json` stays the single source of DATA;
 *    only the structural type is restated. Do not attempt to dedupe it.
 */

export interface LocaleEntry {
  locale: string;
  path: string;
  hreflang: string;
  ogLocale: string;
  xDefault: boolean;
}

export interface SiteRegistry {
  SITE_URL: string;
  locales: LocaleEntry[];
}

export interface SeoCopy {
  title: string;
  description: string;
  ogTitle: string;
}

interface Alternate {
  code: string;
  href: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Attribute values are never escaped on write — deliberately.
 *
 * `twitter:image` is a DERIVED MIRROR: og:image's raw attribute text is read back out
 * of the document and written straight into twitter:image. Escaping would double-escape
 * that value on re-application (`&` -> `&amp;` -> `&amp;amp;`), breaking idempotency for
 * any URL carrying a query string. A bare `&` in an attribute parses fine, so the only
 * genuinely unsafe character is `"` — guard it loudly at build time instead. seo copy is
 * translator-editable, so this is a real input, not an impossible one.
 */
function assertAttrSafe(key: string, value: string): void {
  if (value.includes('"')) {
    throw new Error(
      `[wedge-13 localeHtml] Value for "${key}" contains a double quote, which would ` +
        `produce a malformed attribute. Value: ${value}`
    );
  }
}

function localeUrl(registry: SiteRegistry, entry: LocaleEntry): string {
  return `${registry.SITE_URL}${entry.path}`;
}

/**
 * The reciprocal, self-inclusive hreflang set — identical in every document
 * (Google's reciprocity rule) and reused by buildSitemap, so the two can't drift.
 */
function buildAlternates(registry: SiteRegistry): Alternate[] {
  const alternates: Alternate[] = registry.locales.map((entry) => ({
    code: entry.hreflang,
    href: localeUrl(registry, entry),
  }));

  const xDefault = registry.locales.find((entry) => entry.xDefault);
  if (!xDefault) {
    throw new Error('[wedge-13 localeHtml] No registry locale carries xDefault: true.');
  }
  alternates.push({ code: 'x-default', href: localeUrl(registry, xDefault) });

  return alternates;
}

function insertBeforeHeadClose(html: string, tag: string): string {
  const closeHead = /([ \t]*)<\/head>/;
  const match = html.match(closeHead);
  if (!match) {
    throw new Error('[wedge-13 localeHtml] No </head> found in the document.');
  }
  const closeIndent = match[1];
  // Function replacer, not a string: tag content is data and may contain `$&`/`$1`.
  return html.replace(closeHead, () => `${closeIndent}  ${tag}\n${closeIndent}</head>`);
}

/**
 * THE keyed upsert (AC-10). Every rewritten/inserted tag routes through this shape:
 * replace the value in place if a tag with this key exists, else insert immediately
 * before `</head>` in the source-authored ` />` style so detection and emission agree.
 *
 * This is what makes buildLocaleHtml idempotent BY CONSTRUCTION rather than by care:
 * 10 of the tags it writes (og:locale, the 5 twitter:*, canonical, the 3 hreflang
 * alternates) are INSERTS into a document that lacks them, and the insert path is
 * exactly where naive re-application doubles up.
 */
function upsertTag(html: string, existing: RegExp, tag: string): string {
  if (existing.test(html)) {
    return html.replace(existing, () => tag);
  }
  return insertBeforeHeadClose(html, tag);
}

function upsertMeta(html: string, attrName: 'name' | 'property', key: string, value: string): string {
  assertAttrSafe(key, value);
  return upsertTag(
    html,
    new RegExp(`<meta ${attrName}="${escapeRegExp(key)}"[^>]*>`),
    `<meta ${attrName}="${key}" content="${value}" />`
  );
}

function readMetaContent(html: string, attrName: 'name' | 'property', key: string): string | null {
  const match = html.match(new RegExp(`<meta ${attrName}="${escapeRegExp(key)}" content="([^"]*)"`));
  return match ? match[1] : null;
}

function upsertCanonical(html: string, href: string): string {
  assertAttrSafe('canonical', href);
  return upsertTag(html, /<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${href}" />`);
}

/** Keyed on the tuple rel="alternate" + hreflang="<code>" — one upsert per code, never a blind append. */
function upsertHreflang(html: string, code: string, href: string): string {
  assertAttrSafe(`hreflang="${code}"`, href);
  return upsertTag(
    html,
    new RegExp(`<link rel="alternate" hreflang="${escapeRegExp(code)}"[^>]*>`),
    `<link rel="alternate" hreflang="${code}" href="${href}" />`
  );
}

/**
 * Derive the document for `locale` from the BUILT index.html string.
 *
 * Everything not named below passes through untouched: the theme-flash script, the
 * chunk-error reload guard, preconnects, the font links, the LCP shell, og:type,
 * og:site_name, meta[name=keywords], meta[name=author], the hero preload link and the
 * hashed entry script (both build-time injections this plugin runs after), and og:image.
 *
 * Asset URLs are root-absolute (`/assets/...`) by Vite's build config, so the derived
 * document needs NO path rewriting to resolve correctly from /ru/.
 *
 * Applied uniformly on BOTH passes rather than branching on locale: on EN the
 * title/description/og:title rewrites are a provable no-op (01's EN seo.* keys are
 * byte-identical to index.html's literals), which buys one code path and makes the
 * hreflang set and twitter mirror structurally reciprocal instead of hand-duplicated.
 */
export function buildLocaleHtml(
  html: string,
  locale: string,
  registry: SiteRegistry,
  seo: SeoCopy
): string {
  const entry = registry.locales.find((candidate) => candidate.locale === locale);
  if (!entry) {
    throw new Error(`[wedge-13 localeHtml] Locale "${locale}" is not in the registry.`);
  }

  const url = localeUrl(registry, entry);
  let out = html;

  out = out.replace(/<html lang="[^"]*">/, () => `<html lang="${entry.locale}">`);
  out = out.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${seo.title}</title>`);

  out = upsertMeta(out, 'name', 'description', seo.description);
  out = upsertMeta(out, 'property', 'og:title', seo.ogTitle);
  out = upsertMeta(out, 'property', 'og:description', seo.description);
  out = upsertMeta(out, 'property', 'og:url', url);
  out = upsertMeta(out, 'property', 'og:locale', entry.ogLocale);

  // twitter:* is a DERIVED mirror of the og:* values this same pass computed — never
  // independent literals, so the two blocks cannot drift. twitter:image reads og:image's
  // existing value straight back out, which makes AC-6 / [og-image-excluded] true by
  // construction: the mirror INHERITS the known-broken og-image.png pointer rather than
  // "fixing" it, and will follow automatically whenever SEO-02 fixes it upstream.
  // twitter:card is the load-bearing one — it has no og: fallback, so losing it silently
  // downgrades every social share to a small summary card.
  const ogImage = readMetaContent(out, 'property', 'og:image');
  if (ogImage === null) {
    throw new Error('[wedge-13 localeHtml] og:image not found — twitter:image mirrors it.');
  }
  out = upsertMeta(out, 'name', 'twitter:card', 'summary_large_image');
  out = upsertMeta(out, 'name', 'twitter:url', url);
  out = upsertMeta(out, 'name', 'twitter:title', seo.ogTitle);
  out = upsertMeta(out, 'name', 'twitter:description', seo.description);
  out = upsertMeta(out, 'name', 'twitter:image', ogImage);

  out = upsertCanonical(out, url);
  for (const alternate of buildAlternates(registry)) {
    out = upsertHreflang(out, alternate.code, alternate.href);
  }

  return out;
}

/** sitemap.xml: one <url> per registered locale, each carrying the same alternate set. */
export function buildSitemap(registry: SiteRegistry): string {
  const alternateLinks = buildAlternates(registry)
    .map(
      (alternate) =>
        `    <xhtml:link rel="alternate" hreflang="${alternate.code}" href="${alternate.href}" />`
    )
    .join('\n');

  const urls = registry.locales
    .map((entry) =>
      ['  <url>', `    <loc>${localeUrl(registry, entry)}</loc>`, alternateLinks, '  </url>'].join('\n')
    )
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    urls,
    '</urlset>',
    '',
  ].join('\n');
}
