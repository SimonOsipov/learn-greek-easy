/**
 * WEDGE-13-02 (Mode A — RED): build-time locale HTML + sitemap.xml + robots.txt.
 *
 * These tests are authored RED, ahead of `build/localeHtml.ts` and
 * `public/robots.txt` existing (both are created by the executor in Stage 3).
 * They assert behavior from the subtask's 16 Test Specs (task-1310's
 * Implementation Plan + Addendum 1 + Addendum 2) only — independent of how
 * the executor implements the regex/upsert shape.
 *
 * `build/localeHtml.ts` exports two pure, DOM-free, fs-free functions:
 *   - `buildLocaleHtml(html: string, locale: string, registry: SiteRegistry, seo: SeoCopy): string`
 *   - `buildSitemap(registry: SiteRegistry): string`
 *
 * `build/**\/*.ts` is added to `tsconfig.node.json:include` by the executor,
 * whose `types: ["node"]` has NO vitest globals — hence the explicit
 * `import { describe, it, expect } from 'vitest'` below (AC-11). Bare globals
 * fail `tsc -b --force` with TS2593 even though `tsconfig.test.json`
 * advertises `vitest/globals`.
 *
 * `build/localeHtml.ts` itself cannot import 01's `LocaleEntry` type from
 * `src/lib/siteLocales.ts` (proven broken both routes — TS2307 via `@/`,
 * TS6307 + transitive TS2307 via a relative path). It declares its own local
 * structural type. This test file does the same, rather than importing types
 * from the module under test — the two projects cannot share types across
 * this boundary.
 *
 * AC -> test name map:
 *   AC-1  buildLocaleHtml_ru_sets_html_lang_ru
 *   AC-1  buildLocaleHtml_ru_replaces_title_and_description
 *   AC-1  buildLocaleHtml_ru_sets_og_locale_url_and_title
 *   AC-2  buildLocaleHtml_canonical_is_per_variant
 *   AC-2  buildLocaleHtml_emits_identical_self_inclusive_hreflang_set
 *   AC-1  buildLocaleHtml_preserves_injected_build_tags
 *   AC-6  buildLocaleHtml_does_not_touch_og_image
 *   AC-1  buildLocaleHtml_is_idempotent
 *   AC-2  buildSitemap_lists_both_variants_with_alternates
 *   AC-2  buildSitemap_is_wellformed_xml_with_xhtml_ns
 *   AC-7  buildLocaleHtml_en_sets_og_locale_en_us
 *   AC-8  buildLocaleHtml_emits_full_twitter_set_on_both_passes
 *   AC-8  buildLocaleHtml_twitter_card_is_summary_large_image
 *   AC-8/AC-6  buildLocaleHtml_twitter_image_mirrors_untouched_og_image
 *   AC-9  buildLocaleHtml_og_and_twitter_url_are_per_variant_with_trailing_slash
 *   AC-3  robots_txt_allows_crawling_and_points_at_sitemap
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

import { describe, it, expect } from 'vitest';

// Module under test does not exist yet — this import is the expected RED
// (module-not-found) until the executor creates build/localeHtml.ts.
import { buildLocaleHtml, buildSitemap } from '../localeHtml';

// --- Local structural types (build/localeHtml.ts cannot import src/lib/siteLocales.ts's
// LocaleEntry across the tsconfig.node.json / tsconfig.app.json boundary — see the
// docblock above). Duplicated by design, not an oversight. -----------------------------

interface LocaleEntry {
  locale: string;
  path: string;
  hreflang: string;
  ogLocale: string;
  xDefault: boolean;
}

interface SiteRegistry {
  SITE_URL: string;
  locales: LocaleEntry[];
}

interface SeoCopy {
  title: string;
  description: string;
  ogTitle: string;
}

// --- Fixtures — verified against the real worktree, not invented -----------------------
//
// REGISTRY mirrors src/i18n/site-locales.json byte-for-byte (read directly, 2026-07-16).
const REGISTRY: SiteRegistry = {
  SITE_URL: 'https://greeklish.eu',
  locales: [
    { locale: 'en', path: '/', hreflang: 'en', ogLocale: 'en_US', xDefault: true },
    { locale: 'ru', path: '/ru/', hreflang: 'ru', ogLocale: 'ru_RU', xDefault: false },
  ],
};

// EN_SEO / RU_SEO mirror src/i18n/locales/{en,ru}/landing.json's `seo` block byte-for-byte
// (read directly, 2026-07-16) — NOT invented copy.
const EN_SEO: SeoCopy = {
  title: 'Greeklish - Learn and Practice all aspects of the Greek language',
  description:
    'Learn and practice Greek Language on interactive platform with spaced repetition, exercises and exam preparation.',
  ogTitle: 'Greeklish - Your Learning Greek Companion',
};

const RU_SEO: SeoCopy = {
  title: 'Greeklish - Изучайте и практикуйте все аспекты греческого языка',
  description:
    'Изучайте и практикуйте греческий язык на интерактивной платформе с интервальным повторением, упражнениями и подготовкой к экзаменам.',
  ogTitle: 'Greeklish - Ваш помощник в изучении греческого',
};

// The two build-time-injected artifacts that must survive buildLocaleHtml untouched.
// Exact literal strings cited in task-1310 Addendum 2's probe evidence (real `vite build`
// output in this worktree): the hero preload link (heroPreloadPlugin, enforce:'post',
// which THIS plugin must run after) and the real hashed entry <script> tag.
const HERO_PRELOAD_TAG =
  '<link rel="preload" as="image" fetchpriority="high" type="image/avif" imagesrcset="/assets/img/cyprus-hero-BIgNyp2-.avif 640w, /assets/img/cyprus-hero-BIgNyp2-.avif 960w, /assets/img/cyprus-hero-BIgNyp2-.avif 1280w, /assets/img/cyprus-hero-BIgNyp2-.avif 1920w" imagesizes="100vw">';

const ENTRY_SCRIPT_TAG = '<script type="module" crossorigin src="/assets/js/index-BcOiOfNC.js"></script>';

/**
 * The "built" index.html buildLocaleHtml operates on inside generateBundle —
 * i.e. the repo's real index.html (every source-authored tag preserved
 * byte-for-byte: same attribute order, same ` />` self-closing style, same
 * content strings — verified directly against index.html in this worktree,
 * 2026-07-16), PLUS the two build-time-injected artifacts above substituted in
 * for their dev-mode originals:
 *   - HERO_PRELOAD_TAG inserted before </head> (heroPreloadPlugin's
 *     transformIndexHtml, order:'post', already ran — Addendum 2 Claim 2).
 *   - the dev entry `<script type="module" src="/src/main.tsx">` replaced by
 *     the real hashed built entry tag.
 * This is NOT invented markup — it is the documented shape of the bundle-time
 * `bundle['index.html'].source` string per the Implementation Plan + Addendum 2.
 */
const BUILT_INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <!-- Theme initialization - prevents flash of wrong theme -->
    <script>
      (function() {
        try {
          var theme = localStorage.getItem('theme');
          if (theme === 'dark') {
            document.documentElement.classList.add('dark');
          }
        } catch (e) {}
      })();
    </script>
    <script>
      (function () {
        var CAP = 3, COOLDOWN_MS = 60000, KEY = 'learn-greek-easy:chunk-error-reload';
        window.addEventListener('error', function (e) {
          var t = e.target;
          if (!t || t === window) return;
          if (document.getElementById('lcp-shell') === null) return;
          var isModule  = t.tagName === 'SCRIPT' && t.src && t.src.indexOf(location.origin) === 0;
          var isPreload = t.tagName === 'LINK'   && t.rel === 'modulepreload';
          if (!isModule && !isPreload) return;
          try {
            var s = JSON.parse(sessionStorage.getItem(KEY) || '{"n":0,"t":0}');
            if (s.n >= CAP) return;
            if (s.n > 0 && Date.now() - s.t < COOLDOWN_MS) return;
            sessionStorage.setItem(KEY, JSON.stringify({ n: s.n + 1, t: Date.now() }));
          } catch (err) { return; }
          location.reload();
        }, true);
      })();
    </script>
    <link rel="preconnect" href="https://accounts.google.com" crossorigin />
    <link rel="dns-prefetch" href="https://accounts.google.com" />
    <link rel="preconnect" href="https://eu.i.posthog.com" crossorigin />
    <link rel="preconnect" href="https://o4510597104009216.ingest.de.sentry.io" crossorigin />
    <link rel="preconnect" href="https://storage.railway.app" />
    <link rel="dns-prefetch" href="https://storage.railway.app" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      media="print"
      onload="this.media='all'"
      href="https://fonts.googleapis.com/css2?family=Inter:wght@800&family=Inter+Tight:wght@500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Noto+Serif:ital,wght@0,400;0,600;1,400&display=swap"
    />
    <noscript>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@800&family=Inter+Tight:wght@500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Noto+Serif:ital,wght@0,400;0,600;1,400&display=swap"
      />
    </noscript>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Learn and practice Greek Language on interactive platform with spaced repetition, exercises and exam preparation." />
    <meta name="keywords" content="Greek language, Cypriot Citizenship Exam, Greek language learning, Ellinomatheia" />
    <meta name="author" content="Greeklish" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://greeklish.eu" />
    <meta property="og:title" content="Greeklish - Your Learning Greek Companion" />
    <meta property="og:description" content="Learn and practice Greek Language on interactive platform with spaced repetition, exercises and exam preparation." />
    <meta property="og:image" content="https://greeklish.eu/og-image.png" />
    <meta property="og:site_name" content="Greeklish" />
    <title>Greeklish - Learn and Practice all aspects of the Greek language</title>
    ${HERO_PRELOAD_TAG}
  </head>
  <body>
    <div id="lcp-shell" class="lcp-shell" role="status" aria-label="Loading">
      <style>
        .lcp-shell {
          display: flex;
          min-height: 100vh;
          align-items: center;
          justify-content: center;
          background: hsl(220 30% 98%);
        }
        @keyframes lcp-spin { to { transform: rotate(360deg); } }
      </style>
    </div>
    <div id="root"></div>
    ${ENTRY_SCRIPT_TAG}
  </body>
</html>
`;

// --- Helpers ---------------------------------------------------------------------------

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Extracts every `<meta property="og:X">` / `<meta name="twitter:X">` `content` value, keyed by tag. */
function extractMetaContent(html: string, attrName: 'property' | 'name', key: string): string[] {
  const re = new RegExp(`<meta ${attrName}="${escapeRegExp(key)}" content="([^"]*)"\\s*/>`, 'g');
  const values: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    values.push(match[1]);
  }
  return values;
}

function extractCanonicalHrefs(html: string): string[] {
  const re = /<link rel="canonical" href="([^"]*)"\s*\/>/g;
  const values: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    values.push(match[1]);
  }
  return values;
}

/** Maps hreflang code -> list of href values found in `<link rel="alternate" ...>`
 * (HTML head) or `<xhtml:link rel="alternate" ...>` (sitemap.xml) tags, tolerant
 * of attribute order (buildLocaleHtml/buildSitemap are free to emit either order). */
function extractHreflangMap(html: string): Record<string, string[]> {
  const tagRe = /<(?:xhtml:)?link\s+[^>]*rel="alternate"[^>]*\/?>/g;
  const tags = html.match(tagRe) ?? [];
  const map: Record<string, string[]> = {};
  for (const tag of tags) {
    const hreflangMatch = tag.match(/hreflang="([^"]*)"/);
    const hrefMatch = tag.match(/href="([^"]*)"/);
    if (!hreflangMatch || !hrefMatch) continue;
    const code = hreflangMatch[1];
    (map[code] ??= []).push(hrefMatch[1]);
  }
  return map;
}

// --- AC-1: locale-swapped document identity ---------------------------------------------

describe('buildLocaleHtml — locale document identity (AC-1)', () => {
  it('buildLocaleHtml_ru_sets_html_lang_ru', () => {
    const out = buildLocaleHtml(BUILT_INDEX_HTML, 'ru', REGISTRY, RU_SEO);
    expect(out).toContain('<html lang="ru">');
    expect(out).not.toContain('<html lang="en">');
  });

  it('buildLocaleHtml_ru_replaces_title_and_description', () => {
    const out = buildLocaleHtml(BUILT_INDEX_HTML, 'ru', REGISTRY, RU_SEO);

    expect(out).toContain(`<title>${RU_SEO.title}</title>`);

    // The single most valuable assertion in this file: og:description and
    // meta[name=description] share a BYTE-IDENTICAL EN content string in the
    // real index.html (:72 and :78). A buggy content-based `.replace()` that
    // targets the STRING rather than the TAG fixes only the first occurrence
    // and silently leaves the other in English. Assert both tags,
    // independently, by tag-scoped extraction — not a single blanket
    // `.toContain(RU_SEO.description)` that a partial fix could still satisfy.
    const metaDescriptions = extractMetaContent(out, 'name', 'description');
    const ogDescriptions = extractMetaContent(out, 'property', 'og:description');

    expect(metaDescriptions).toEqual([RU_SEO.description]);
    expect(ogDescriptions).toEqual([RU_SEO.description]);

    // No EN string remains — scoped to title/description ONLY (meta[name=keywords],
    // meta[name=author], og:site_name legitimately stay English on the RU pass and
    // must NOT be asserted against here, per the executor note in task-1310).
    expect(out).not.toContain(EN_SEO.title);
    expect(out).not.toContain(EN_SEO.description);
  });

  it('buildLocaleHtml_ru_sets_og_locale_url_and_title', () => {
    const out = buildLocaleHtml(BUILT_INDEX_HTML, 'ru', REGISTRY, RU_SEO);

    expect(extractMetaContent(out, 'property', 'og:locale')).toEqual(['ru_RU']);
    expect(extractMetaContent(out, 'property', 'og:url')).toEqual(['https://greeklish.eu/ru/']);
    expect(extractMetaContent(out, 'property', 'og:title')).toEqual([RU_SEO.ogTitle]);
  });

  it('buildLocaleHtml_preserves_injected_build_tags', () => {
    const out = buildLocaleHtml(BUILT_INDEX_HTML, 'ru', REGISTRY, RU_SEO);
    // Both survive BYTE-IDENTICAL — buildLocaleHtml touches only the locale
    // surface (lang/title/description/og/twitter/canonical/hreflang), never
    // the entry script or the hero preload link injected before it ran
    // (enforce:'post' plugin ordering — Addendum 2 Claim 2).
    expect(out).toContain(HERO_PRELOAD_TAG);
    expect(out).toContain(ENTRY_SCRIPT_TAG);
  });

  it('buildLocaleHtml_is_idempotent', () => {
    const once = buildLocaleHtml(BUILT_INDEX_HTML, 'ru', REGISTRY, RU_SEO);
    const twice = buildLocaleHtml(once, 'ru', REGISTRY, RU_SEO);

    expect(twice).toBe(once);

    // Explicit per-tag duplication guard: 10 of the tags buildLocaleHtml
    // writes are INSERTS into a document that lacks them today (og:locale,
    // the 5 twitter:* tags, canonical, the 3 hreflang alternates) — the
    // insert path is exactly where re-application would double up. A raw
    // byte-equality check alone could theoretically pass by coincidence on a
    // non-deterministic implementation; count each tag explicitly too.
    const countOf = (re: RegExp) => (twice.match(re) ?? []).length;
    expect(countOf(/<link rel="canonical"/g)).toBe(1);
    expect(countOf(/hreflang="en"/g)).toBe(1);
    expect(countOf(/hreflang="ru"/g)).toBe(1);
    expect(countOf(/hreflang="x-default"/g)).toBe(1);
    expect(countOf(/property="og:locale"/g)).toBe(1);
    expect(countOf(/name="twitter:card"/g)).toBe(1);
    expect(countOf(/name="twitter:url"/g)).toBe(1);
    expect(countOf(/name="twitter:title"/g)).toBe(1);
    expect(countOf(/name="twitter:description"/g)).toBe(1);
    expect(countOf(/name="twitter:image"/g)).toBe(1);
  });
});

// --- AC-2: canonical + reciprocal hreflang ------------------------------------------------

describe('buildLocaleHtml — canonical + hreflang (AC-2)', () => {
  it('buildLocaleHtml_canonical_is_per_variant', () => {
    const ru = buildLocaleHtml(BUILT_INDEX_HTML, 'ru', REGISTRY, RU_SEO);
    const en = buildLocaleHtml(BUILT_INDEX_HTML, 'en', REGISTRY, EN_SEO);

    const ruCanonical = extractCanonicalHrefs(ru);
    const enCanonical = extractCanonicalHrefs(en);

    expect(ruCanonical).toEqual(['https://greeklish.eu/ru/']);
    expect(enCanonical).toEqual(['https://greeklish.eu/']);
  });

  it('buildLocaleHtml_emits_identical_self_inclusive_hreflang_set', () => {
    const ru = buildLocaleHtml(BUILT_INDEX_HTML, 'ru', REGISTRY, RU_SEO);
    const en = buildLocaleHtml(BUILT_INDEX_HTML, 'en', REGISTRY, EN_SEO);

    const expected: Record<string, string> = {
      en: 'https://greeklish.eu/',
      ru: 'https://greeklish.eu/ru/',
      'x-default': 'https://greeklish.eu/',
    };

    const ruMap = extractHreflangMap(ru);
    const enMap = extractHreflangMap(en);

    for (const [code, href] of Object.entries(expected)) {
      // Self-inclusive: each document lists itself too (Google's reciprocity rule).
      expect(ruMap[code]).toEqual([href]);
      expect(enMap[code]).toEqual([href]);
    }
  });
});

// --- AC-6: og:image is a known-broken, explicitly out-of-scope pointer — never touched ---

describe('buildLocaleHtml — og:image passthrough (AC-6)', () => {
  it('buildLocaleHtml_does_not_touch_og_image', () => {
    const out = buildLocaleHtml(BUILT_INDEX_HTML, 'ru', REGISTRY, RU_SEO);
    expect(extractMetaContent(out, 'property', 'og:image')).toEqual(['https://greeklish.eu/og-image.png']);
  });
});

// --- Addendum 1 (regression closure): og:locale on EN, full twitter:* mirror, per-variant og:url ---

describe('buildLocaleHtml — og:locale on EN pass (AC-7)', () => {
  it('buildLocaleHtml_en_sets_og_locale_en_us', () => {
    const out = buildLocaleHtml(BUILT_INDEX_HTML, 'en', REGISTRY, EN_SEO);
    // og:locale does NOT exist in the base document (verified against index.html,
    // 2026-07-16) — this is an INSERT on the EN pass too, not just the RU pass.
    expect(extractMetaContent(out, 'property', 'og:locale')).toEqual(['en_US']);
  });
});

describe('buildLocaleHtml — twitter:* mirror block (AC-8)', () => {
  it('buildLocaleHtml_emits_full_twitter_set_on_both_passes', () => {
    const en = buildLocaleHtml(BUILT_INDEX_HTML, 'en', REGISTRY, EN_SEO);
    const ru = buildLocaleHtml(BUILT_INDEX_HTML, 'ru', REGISTRY, RU_SEO);

    for (const [doc, seo] of [
      [en, EN_SEO],
      [ru, RU_SEO],
    ] as const) {
      expect(extractMetaContent(doc, 'name', 'twitter:card')).toHaveLength(1);
      expect(extractMetaContent(doc, 'name', 'twitter:url')).toHaveLength(1);
      expect(extractMetaContent(doc, 'name', 'twitter:title')).toEqual([seo.ogTitle]);
      expect(extractMetaContent(doc, 'name', 'twitter:description')).toEqual([seo.description]);
      expect(extractMetaContent(doc, 'name', 'twitter:image')).toHaveLength(1);
    }

    // The two locales' twitter copy must genuinely differ — guards against a
    // stub that emits the same (e.g. always-EN) literal on both passes.
    expect(extractMetaContent(en, 'name', 'twitter:title')[0]).not.toBe(
      extractMetaContent(ru, 'name', 'twitter:title')[0]
    );
    expect(extractMetaContent(en, 'name', 'twitter:description')[0]).not.toBe(
      extractMetaContent(ru, 'name', 'twitter:description')[0]
    );
  });

  it('buildLocaleHtml_twitter_card_is_summary_large_image', () => {
    const en = buildLocaleHtml(BUILT_INDEX_HTML, 'en', REGISTRY, EN_SEO);
    const ru = buildLocaleHtml(BUILT_INDEX_HTML, 'ru', REGISTRY, RU_SEO);

    // Pinned separately: this is the ONE tag with no og: fallback — losing it
    // silently downgrades every social share to a small summary card.
    expect(extractMetaContent(en, 'name', 'twitter:card')).toEqual(['summary_large_image']);
    expect(extractMetaContent(ru, 'name', 'twitter:card')).toEqual(['summary_large_image']);
  });

  it('buildLocaleHtml_twitter_image_mirrors_untouched_og_image', () => {
    const out = buildLocaleHtml(BUILT_INDEX_HTML, 'ru', REGISTRY, RU_SEO);

    const ogImage = extractMetaContent(out, 'property', 'og:image');
    const twitterImage = extractMetaContent(out, 'name', 'twitter:image');

    // Guards [og-image-excluded]: the derived twitter:image tag must INHERIT
    // the known-broken pointer, never "fix" it.
    expect(ogImage).toEqual(['https://greeklish.eu/og-image.png']);
    expect(twitterImage).toEqual(['https://greeklish.eu/og-image.png']);
  });
});

describe('buildLocaleHtml — og:url / twitter:url per-variant with trailing slash (AC-9)', () => {
  it('buildLocaleHtml_og_and_twitter_url_are_per_variant_with_trailing_slash', () => {
    const en = buildLocaleHtml(BUILT_INDEX_HTML, 'en', REGISTRY, EN_SEO);
    const ru = buildLocaleHtml(BUILT_INDEX_HTML, 'ru', REGISTRY, RU_SEO);

    // Base document's og:url is un-slashed ("https://greeklish.eu" — index.html:76).
    // BOTH passes must rewrite it to the per-variant, trailing-slash form that
    // agrees with that document's own canonical and hreflang self-reference.
    expect(extractMetaContent(en, 'property', 'og:url')).toEqual(['https://greeklish.eu/']);
    expect(extractMetaContent(en, 'name', 'twitter:url')).toEqual(['https://greeklish.eu/']);
    expect(extractCanonicalHrefs(en)).toEqual(['https://greeklish.eu/']);

    expect(extractMetaContent(ru, 'property', 'og:url')).toEqual(['https://greeklish.eu/ru/']);
    expect(extractMetaContent(ru, 'name', 'twitter:url')).toEqual(['https://greeklish.eu/ru/']);
    expect(extractCanonicalHrefs(ru)).toEqual(['https://greeklish.eu/ru/']);
  });
});

// --- buildSitemap (AC-2) ------------------------------------------------------------------

describe('buildSitemap', () => {
  it('buildSitemap_lists_both_variants_with_alternates', () => {
    const xml = buildSitemap(REGISTRY);

    const locMatches = xml.match(/<loc>([^<]*)<\/loc>/g) ?? [];
    expect(locMatches).toHaveLength(2);
    expect(xml).toContain('<loc>https://greeklish.eu/</loc>');
    expect(xml).toContain('<loc>https://greeklish.eu/ru/</loc>');

    const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];
    expect(urlBlocks).toHaveLength(2);

    for (const block of urlBlocks) {
      const hreflangMap = extractHreflangMap(block);
      expect(hreflangMap.en).toEqual(['https://greeklish.eu/']);
      expect(hreflangMap.ru).toEqual(['https://greeklish.eu/ru/']);
      expect(hreflangMap['x-default']).toEqual(['https://greeklish.eu/']);
    }
  });

  it('buildSitemap_is_wellformed_xml_with_xhtml_ns', () => {
    const xml = buildSitemap(REGISTRY);

    // NOTE (documented deliberately — see the return note to the coordinator):
    // happy-dom's DOMParser (this project's vitest `environment`) does NOT
    // implement real XML well-formedness checking — verified directly:
    // `parseFromString(..., 'application/xml')` on deliberately malformed XML
    // (mismatched tags, bare `&`) returns a document with ZERO
    // `parsererror` elements and never throws, for both valid and invalid
    // input. Using it here would be a vacuous oracle (a green
    // `getElementsByTagName('parsererror').length === 0` assertion could
    // never catch a real defect). Well-formedness is instead verified by hand
    // via a balanced-tag + declaration check, which DOES fail on truncation
    // or mismatched tags.
    expect(xml.startsWith('<?xml')).toBe(true);
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');

    const countTag = (tag: string) => (xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'g')) ?? []).length;
    const countCloseTag = (tag: string) => (xml.match(new RegExp(`</${tag}>`, 'g')) ?? []).length;

    expect(countTag('urlset')).toBe(1);
    expect(countCloseTag('urlset')).toBe(1);
    expect(countTag('url')).toBe(2);
    expect(countCloseTag('url')).toBe(2);
    expect(countTag('loc')).toBe(2);
    expect(countCloseTag('loc')).toBe(2);

    // Every xhtml:link entry must be self-closed (well-formed empty element).
    const xhtmlLinkTags = xml.match(/<xhtml:link\b[^>]*>/g) ?? [];
    expect(xhtmlLinkTags.length).toBeGreaterThan(0);
    for (const tag of xhtmlLinkTags) {
      expect(tag.trim().endsWith('/>')).toBe(true);
    }
  });
});

// --- robots.txt (AC-3) ---------------------------------------------------------------------

describe('robots.txt', () => {
  it('robots_txt_allows_crawling_and_points_at_sitemap', () => {
    const content = readFileSync(resolve(__dirname, '../../public/robots.txt'), 'utf8');

    expect(content).toContain('User-agent: *');
    expect(content).toContain('Allow: /');
    expect(content).toContain('Sitemap: https://greeklish.eu/sitemap.xml');
    expect(content).not.toContain('Disallow: /');
  });
});
