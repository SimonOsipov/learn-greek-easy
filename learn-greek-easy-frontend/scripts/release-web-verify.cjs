#!/usr/bin/env node
/**
 * Authenticated Web Verify Script for Release Verify Pipeline
 *
 * Logs in as the seeded e2e_beginner user, confirms the dashboard renders,
 * and confirms the deck list is non-empty.  This is the oracle that the
 * dev-release-lease web-verify job uses in release-verify.yml.
 *
 * Usage:
 *   FRONTEND_URL=https://example.com node scripts/release-web-verify.cjs
 *
 * Exit codes:
 *   0 - All checks passed
 *   1 - Any check failed
 *
 * NEVER log SEED_PASSWORD — project rule 3.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ============================================================================
// Configuration
// ============================================================================

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const PR_NUMBER = (process.env.PR_NUMBER || '').trim();
const SEED_EMAIL = PR_NUMBER
  ? `e2e_beginner+pr${PR_NUMBER}@test.com`
  : 'e2e_beginner@test.com';
const SEED_PASSWORD = 'TestPassword123!';
const REPORTS_DIR = path.join(process.cwd(), 'web-verify-reports');

// ============================================================================
// Locale Serving Checks (WEDGE-13-04, AC-4/AC-5)
// ============================================================================
//
// Verifies Caddy's ACTUAL serving behavior for the /ru locale variant and the
// build-time sitemap.xml / robots.txt (WEDGE-13-02/03). This is the ONLY
// layer that can prove it: the CI E2E lane (tests/e2e/) runs the Vite dev
// server, never Caddy and never a built `dist/` (task-1313 §0) — a green CI
// E2E run there is NOT evidence Caddy serves /ru/ correctly.
//
// Runs BEFORE the authenticated flow below, in its own JS-disabled context,
// so it cannot disturb the existing login state. Never asserts status alone:
// a bare 200 is exactly what BOTH failure modes (EN-shell SPA fallback for a
// missing locale doc, SPA-fallback HTML for a missing sitemap/robots file)
// return too — every check below inspects content.

const RU_TITLE_FRAGMENT = 'Изучайте';
const SITEMAP_LOCS = ['<loc>https://greeklish.eu/</loc>', '<loc>https://greeklish.eu/ru/</loc>'];
const ROBOTS_SITEMAP_LINE = 'Sitemap: https://greeklish.eu/sitemap.xml';

/**
 * Navigates (JS-disabled context) to `path` and asserts the served document's
 * `<html lang>` matches `expectedLang`. For the RU case, also asserts the
 * document actually carries RU copy (not just the lang attribute) — guards
 * against a partial fix that flips lang but still serves EN-templated markup.
 */
async function assertLocaleDocument(context, path, expectedLang) {
  const page = await context.newPage();
  try {
    await page.goto(`${FRONTEND_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const html = await page.content();
    const expectedTag = `<html lang="${expectedLang}"`;
    if (!html.includes(expectedTag)) {
      throw new Error(
        `${path}: expected served document to contain ${expectedTag}, but it did not (wrong locale variant served)`
      );
    }
    if (expectedLang === 'ru' && !html.includes(RU_TITLE_FRAGMENT)) {
      throw new Error(
        `${path}: served an <html lang="ru"> document, but its title is missing the expected RU fragment "${RU_TITLE_FRAGMENT}"`
      );
    }
  } finally {
    await page.close();
  }
}

async function runLocaleServingChecks(browser) {
  console.log('Locale check: RU/EN document serving + sitemap.xml/robots.txt (JS disabled) ...');
  const context = await browser.newContext({ javaScriptEnabled: false });

  try {
    // RU document — both the trailing-slash and bare-path forms. `/ru` (no
    // trailing slash) is the one that actually proves the Caddyfile fix
    // (AC-1/AC-10): Caddy's try_files file matcher does not resolve directory
    // indexes on its own, so under the OLD try_files, `/ru` fell through to
    // the EN root document instead of `/ru/index.html`.
    await assertLocaleDocument(context, '/ru/', 'ru');
    await assertLocaleDocument(context, '/ru', 'ru');

    // EN negative control — proves the RU/EN documents are genuinely
    // distinct (no accidental /ru-prefix capture of unrelated routes) and
    // that the fix's new try_files alternative never fires for a real,
    // non-locale path. /rutabaga is the try_files regression guard: an
    // unknown route must still fall through to the EN SPA document, exactly
    // as before the fix.
    await assertLocaleDocument(context, '/', 'en');
    await assertLocaleDocument(context, '/login', 'en');
    await assertLocaleDocument(context, '/rutabaga', 'en');

    // sitemap.xml — must be the real static file (content-type + body), not
    // the SPA fallback document, which would also return 200.
    const sitemapResponse = await context.request.get(`${FRONTEND_URL}/sitemap.xml`);
    const sitemapContentType = sitemapResponse.headers()['content-type'] || '';
    if (!/xml/.test(sitemapContentType)) {
      throw new Error(
        `/sitemap.xml: expected content-type matching /xml/, got "${sitemapContentType}" (served the SPA fallback?)`
      );
    }
    const sitemapBody = await sitemapResponse.text();
    if (!sitemapBody.startsWith('<?xml')) {
      throw new Error(
        '/sitemap.xml: body does not start with "<?xml" — served the SPA fallback document?'
      );
    }
    for (const loc of SITEMAP_LOCS) {
      if (!sitemapBody.includes(loc)) {
        throw new Error(`/sitemap.xml: missing expected "${loc}"`);
      }
    }

    // robots.txt — same shape of check: content-type + the Sitemap directive.
    const robotsResponse = await context.request.get(`${FRONTEND_URL}/robots.txt`);
    const robotsContentType = robotsResponse.headers()['content-type'] || '';
    if (!robotsContentType.includes('text/plain')) {
      throw new Error(
        `/robots.txt: expected content-type "text/plain", got "${robotsContentType}" (served the SPA fallback?)`
      );
    }
    const robotsBody = await robotsResponse.text();
    if (!robotsBody.includes(ROBOTS_SITEMAP_LINE)) {
      throw new Error(`/robots.txt: missing "${ROBOTS_SITEMAP_LINE}"`);
    }

    console.log(
      '  Locale check passed: /ru/ + /ru -> RU; /, /login, /rutabaga -> EN; sitemap.xml + robots.txt are real files'
    );
  } finally {
    await context.close();
  }
}

// ============================================================================
// Main Function
// ============================================================================

async function runWebVerify() {
  console.log('='.repeat(60));
  console.log('AUTHENTICATED WEB VERIFY');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Frontend URL: ${FRONTEND_URL}`);
  console.log(`Seed user: ${SEED_EMAIL}`);
  console.log('');

  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const browser = await chromium.launch();
  let failed = false;

  try {
    // Locale serving checks (WEDGE-13-04) — no auth needed, own JS-disabled
    // context, run first so a failure here can never be masked by (or
    // disturb) the authenticated flow below.
    await runLocaleServingChecks(browser);

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    // Step 3: Navigate to login
    console.log('Step 1: Navigating to /login ...');
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Step 4: Wait for login form + screenshot
    console.log('Step 2: Waiting for login form ...');
    await page.locator('[data-testid="login-form"]').waitFor({ state: 'visible', timeout: 15000 });
    await page.screenshot({ path: path.join(REPORTS_DIR, '01-login.png'), fullPage: true });
    console.log('  Screenshot: 01-login.png');

    // Step 5-6: Fill credentials (never log password)
    console.log(`Step 3: Filling credentials for ${SEED_EMAIL} ...`);
    await page.locator('[data-testid="email-input"]').fill(SEED_EMAIL);
    await page.locator('[data-testid="password-input"]').fill(SEED_PASSWORD);

    // Step 7: Submit login
    console.log('Step 4: Submitting login form ...');
    await page.locator('[data-testid="login-submit"]').click();

    // Step 8: Wait for redirect to dashboard
    console.log('Step 5: Waiting for /dashboard redirect ...');
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    console.log(`  Reached: ${page.url()}`);

    // Step 9: Wait for app-ready signal
    console.log('Step 6: Waiting for app-ready signal ...');
    await page.locator('[data-app-ready="true"]').waitFor({ state: 'attached', timeout: 30000 });

    // Step 10: Confirm dashboard visible + screenshot.
    // The [data-testid="dashboard"] container renders IMMEDIATELY (with an
    // internal loading skeleton) while useDashboardSummary is in flight, so
    // waiting on it alone screenshots the skeleton, not the real dashboard.
    // metric-strip mounts only once the summary resolves — for BOTH new and
    // returning users (Dashboard.tsx gates <MetricStrip> on `summary`, not
    // `!isNew`) — making it the deterministic loaded-state signal. This
    // mirrors the loaded-only waits used for decks (deck-card) and mock-exam
    // (start-exam-button) below.
    console.log('Step 7: Waiting for dashboard component ...');
    await page.locator('[data-testid="dashboard"]').waitFor({ state: 'visible', timeout: 15000 });
    console.log('Step 7b: Waiting for dashboard loaded state (metric-strip) ...');
    await page.locator('[data-testid="metric-strip"]').waitFor({ state: 'visible', timeout: 15000 });
    await page.screenshot({ path: path.join(REPORTS_DIR, '02-dashboard.png'), fullPage: true });
    console.log('  Screenshot: 02-dashboard.png');

    // Step 11: Navigate to /decks
    console.log('Step 8: Navigating to /decks ...');
    await page.goto(`${FRONTEND_URL}/decks`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Step 12: Wait for decks title
    console.log('Step 9: Waiting for decks-title ...');
    await page.locator('[data-testid="decks-title"]').waitFor({ state: 'visible', timeout: 15000 });

    // Step 13: Assert at least one deck card + screenshot
    console.log('Step 10: Waiting for deck-card (first) ...');
    await page.locator('[data-testid="deck-card"]').first().waitFor({ state: 'visible', timeout: 15000 });
    const deckCount = await page.locator('[data-testid="deck-card"]').count();
    if (deckCount < 1) {
      throw new Error('deck list empty — no [data-testid="deck-card"] elements found');
    }
    console.log(`  Found ${deckCount} deck card(s)`);
    await page.screenshot({ path: path.join(REPORTS_DIR, '03-decks.png'), fullPage: true });
    console.log('  Screenshot: 03-decks.png');

    // Step 11: Navigate to /practice/culture-exam + screenshot (best-effort,
    // supplementary regression coverage — must NEVER fail web-verify).
    console.log('Step 11: Navigating to /practice/culture-exam (best-effort) ...');
    try {
      await page.goto(`${FRONTEND_URL}/practice/culture-exam`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.locator('[data-testid="mock-exam-page"]').waitFor({ state: 'visible', timeout: 15000 });
      // Wait for the LOADED state (not the loading skeleton): start-exam-button
      // only mounts once statistics resolve (!isLoading && !error). A timeout
      // here falls through to the catch's best-effort capture (non-fatal).
      await page.locator('[data-testid="start-exam-button"]').waitFor({ state: 'visible', timeout: 20000 });
      await page.screenshot({ path: path.join(REPORTS_DIR, '04-mock-exam-landing.png'), fullPage: true });
      console.log('  Screenshot: 04-mock-exam-landing.png');
    } catch (mockExamErr) {
      console.warn('  WARNING: mock-exam landing capture failed (non-fatal):', mockExamErr.message);
      // Best-effort capture of whatever rendered, then continue.
      try {
        await page.screenshot({ path: path.join(REPORTS_DIR, '04-mock-exam-landing.png'), fullPage: true });
        console.warn('  (Captured best-effort 04-mock-exam-landing.png anyway)');
      } catch (mockExamShotErr) {
        console.warn('  (Could not capture mock-exam screenshot:', mockExamShotErr.message, ')');
      }
    }

    await context.close();
  } catch (err) {
    failed = true;
    console.error('');
    console.error('VERIFY FAILED:', err.message);
    console.error('');

    // Best-effort failure screenshot
    try {
      // Re-use an open page if possible — create a minimal one just for screenshot capture
      // The page variable is scoped inside try; we rely on the browser still being open
      const pages = browser.contexts().flatMap((c) => c.pages());
      if (pages.length > 0) {
        await pages[0].screenshot({
          path: path.join(REPORTS_DIR, '99-failure.png'),
          fullPage: true,
        });
        console.error('  Failure screenshot: 99-failure.png');
      }
    } catch (screenshotErr) {
      console.error('  (Could not capture failure screenshot:', screenshotErr.message, ')');
    }
  } finally {
    await browser.close();
  }

  // Summary
  console.log('');
  console.log('='.repeat(60));
  if (failed) {
    console.log('RESULT: FAILED');
    console.log('='.repeat(60));
    process.exit(1);
  } else {
    console.log('RESULT: PASSED — login, dashboard, and deck list verified');
    console.log('='.repeat(60));
    process.exit(0);
  }
}

// ============================================================================
// Run
// ============================================================================

runWebVerify().catch((e) => {
  console.error(e);
  process.exit(1);
});
