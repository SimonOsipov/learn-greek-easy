/**
 * WEDGE-13-04 (AC-8) — the only new E2E this subtask adds.
 *
 * Layer contract (task-1313 §0 — read before touching this file): the CI E2E
 * lane runs the Vite DEV server (`playwright.config.ts:134`), never Caddy and
 * never a built `dist/`. This spec is dev-server-viable ONLY because
 * WEDGE-13-03 already landed the `/ru` SPA route + URL-locale-precedence i18n
 * init on `main` — it is JS-on and exercises client-side routing, not the
 * static per-locale document. It must NOT assert `<html lang>`, canonical,
 * hreflang, or any other static-head content (that's
 * `build/__tests__/localeHtml.test.ts`, WEDGE-13-02, unit-covered — see AC-7),
 * and it must NOT be read as proof Caddy serves `/ru/` (AC-2/AC-3 — that's
 * `scripts/release-web-verify.cjs`, Phase 3.5 only, against a real deployed
 * Caddy).
 *
 * AC -> test name map:
 *   AC-8  ru_entry_renders_russian_copy_with_js_and_no_en_flash
 */
import { test, expect } from '@playwright/test';

// Mirrors src/i18n/locales/ru/landing.json's `hero.title` + `hero.titleHighlight`
// (read directly, 2026-07-16) — the rendered <h1 data-testid="hero-title"> text
// is `{title}{' '}{titleHighlight}` (src/components/landing/Hero.tsx).
const RU_HERO_TITLE = 'Ваш помощник в изучении греческого';

test.describe('WEDGE-13-04 (AC-8): /ru SPA route renders RU copy, no EN flash', () => {
  // Empty storageState is REQUIRED here, not optional: playwright.config.ts
  // pins storageState: STORAGE_STATE.LEARNER on every browser project
  // (chromium/firefox/webkit, lines 89/98/107). LandingRoute
  // (src/components/auth/LandingRoute.tsx:30-34, wrapping /ru at
  // App.tsx:342-348) redirects an authenticated visitor to /dashboard via a
  // client-side useEffect. Without this override every assertion below would
  // instead observe the dashboard, not the RU landing page — and since that
  // redirect is JS, it is load-bearing ONLY for a JS-on spec like this one
  // (it would never have fired on a no-JS request, which is what the original,
  // now-dropped 9-spec design assumed universally).
  test.use({ storageState: { cookies: [], origins: [] } });

  test('ru_entry_renders_russian_copy_with_js_and_no_en_flash', async ({ page }) => {
    // Record every DISTINCT text value [data-testid="hero-title"] ever holds,
    // from document creation — before React or any page script runs. This is
    // what makes "no EN flash" a real, falsifiable assertion instead of a
    // final-state-only check: src/main.tsx's bootstrap() awaits initI18n()
    // (which, per WEDGE-13-03, awaits the RU critical trio when the locale
    // came from the URL) BEFORE the first createRoot().render() call, so
    // architecturally there should be exactly one non-empty value ever
    // observed. A MutationObserver-based history — unlike a single
    // post-hoc `toHaveText` poll — would still catch a transient EN (or raw
    // i18n key) value even if a future regression made it last only one frame.
    await page.addInitScript(() => {
      const w = window as unknown as {
        __heroTitleHistory: string[];
        __heroTitleObserverError?: string;
      };
      w.__heroTitleHistory = [];
      const record = () => {
        const el = document.querySelector('[data-testid="hero-title"]');
        if (!el) return;
        const text = el.textContent ?? '';
        if (w.__heroTitleHistory[w.__heroTitleHistory.length - 1] !== text) {
          w.__heroTitleHistory.push(text);
        }
      };
      // Observe `document`, NOT `document.documentElement`: at the point
      // addInitScript runs (before any of the page's own scripts, per
      // Playwright's contract), the parser has not yet produced <html> —
      // `document.documentElement` is null and `.observe(null, ...)` throws
      // synchronously, silently discarding the whole observer (verified: this
      // was live, un-thrown-anywhere-visible breakage during authoring — the
      // catch below exists so a future regression here fails LOUDLY via
      // __heroTitleObserverError instead of silently recording nothing).
      // `document` itself is always a valid Node from the very first tick.
      try {
        new MutationObserver(record).observe(document, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      } catch (err) {
        w.__heroTitleObserverError = String(err);
      }
    });

    // The URL drives the locale here, NOT the browser: this spec relies on
    // playwright.config.ts:70's project-wide `locale: 'en-US'` default and
    // does NOT override it with a Russian browser locale. That is exactly
    // WEDGE-13-03 AC-2's URL-precedence claim (init.ts's
    // detectInitialLanguage() reads the URL locale prefix above localStorage
    // and navigator.language) — a browser-locale-driven test would not
    // distinguish this path from the pre-existing language-detection.spec.ts
    // coverage.
    await page.goto('/ru/');

    const heroTitle = page.getByTestId('hero-title');
    await expect(heroTitle).toBeVisible({ timeout: 15000 });
    await expect(heroTitle).toHaveText(RU_HERO_TITLE);

    const debugState = await page.evaluate(() => {
      const w = window as unknown as {
        __heroTitleHistory: string[];
        __heroTitleObserverError?: string;
      };
      return { history: w.__heroTitleHistory, observerError: w.__heroTitleObserverError };
    });

    // Fail loudly with a clear cause, not a bare array diff, if the observer
    // itself never attached (this exact failure mode was hit once during
    // authoring — .observe(document.documentElement) threw because the
    // parser hadn't produced <html> yet, silently discarding the observer).
    expect(debugState.observerError).toBeUndefined();

    // The whole point of this spec: hero-title never held any OTHER
    // non-empty value (the EN string, or a raw untranslated "hero.title" key)
    // before settling on RU. An empty string pre-mount is not a "flash" of
    // English — filtered out so it can't hide a real EN->RU swap immediately
    // after it, nor produce a false failure on the harmless pre-mount state.
    expect(debugState.history.filter((text) => text !== '')).toEqual([RU_HERO_TITLE]);
  });
});
