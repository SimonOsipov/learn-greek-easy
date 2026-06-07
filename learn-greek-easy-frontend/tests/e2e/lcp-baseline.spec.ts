/**
 * PERF-04-01: Authenticated Playwright LCP Baseline Harness
 *
 * Captures the Largest Contentful Paint element identity and timing for
 * /dashboard using a single PerformanceObserver entry, then reports whether
 * the LCP element is the news <img> from t3.storageapi.dev.
 *
 * This is a MEASUREMENT harness — the test NEVER asserts on the LCP number
 * or element identity. The deliverable is the `lcp-baseline.json` attachment.
 * The AC#3 gate decision (PERF-04-02..05 apply or STOP) is indicated in the
 * `branchMessage` field of the attachment.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * HOW TO RUN (against a deployed, seeded env):
 *
 *   PLAYWRIGHT_BASE_URL=https://frontend-dev-8db9.up.railway.app \
 *   VITE_SUPABASE_URL=<dev supabase url> \
 *   VITE_SUPABASE_ANON_KEY=<dev anon key> \
 *   E2E_API_URL=<dev backend api base> \
 *   npx playwright test lcp-baseline.spec.ts --grep @lcp-baseline --project=chromium
 *
 * When PLAYWRIGHT_BASE_URL is set to a deployed host, the local webServer
 * (npm run dev) is automatically skipped — no local backend is needed.
 * NOTE: loopback URLs (localhost, 127.0.0.1, 0.0.0.0) are intentionally
 * skipped; PLAYWRIGHT_BASE_URL must point to a real deployed host.
 *
 * The auth setup (auth.setup.ts) must have run first to populate
 * playwright/.auth/learner.json, or run with --project=setup first:
 *
 *   npx playwright test --project=setup && \
 *   npx playwright test lcp-baseline.spec.ts --grep @lcp-baseline --project=chromium
 *
 * ──────────────────────────────────────────────────────────────────────────
 * WHY PLAYWRIGHT INSTEAD OF K6 (deviation from docs/conventions.md:12)?
 *
 * The project convention (conventions.md §CI/CD) routes perf tests to k6.
 * This spec is a scoped exception: k6's `browser_web_vital_lcp` scalar metric
 * captures the LCP timing but does NOT surface the LCP element identity
 * (which DOM element won, which resource URL it resolved to). The
 * `parse-k6-results.cjs` post-processor does not expose this either.
 *
 * The PERF-04 story's AC#3 gate requires us to identify the LCP element
 * (news <img> or something else) to decide whether to proceed with
 * preconnect / priority hints (PERF-04-02..05). Only a single
 * PerformanceObserver entry from a real browser context gives us both the
 * timing and the element reference in one shot — which Playwright provides
 * via addInitScript() + page.evaluate(). k6 does not expose the element.
 *
 * This spec is excluded from CI shards via --grep-invert @lcp-baseline in
 * the "Run E2E tests" step of .github/workflows/test.yml.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { test } from '@playwright/test';
import { verifyAuthSucceeded } from './helpers/auth-helpers';
import { installLCPObserver, captureLCP } from './helpers/lcp';

// This spec runs ONLY against a deployed env. Skip in all other contexts.
// PLAYWRIGHT_BASE_URL must be set and must NOT point to a loopback address.
const baseURL = process.env['PLAYWRIGHT_BASE_URL'];
test.skip(
  !baseURL || /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(baseURL),
  'LCP baseline runs against a deployed env only — set PLAYWRIGHT_BASE_URL to a deployed frontend URL (not localhost)'
);

// Use the learner storageState (matches the chromium project default and
// the same user the news-feed E2E tests use for dashboard checks).
test.use({ storageState: 'playwright/.auth/learner.json' });

test('dashboard LCP element identification @lcp-baseline', async ({ page }, testInfo) => {
  // ── Step 1: Install the LCP observer BEFORE navigation ──────────────────
  // addInitScript must be registered before page.goto() — it runs on each
  // new document load. The observer accumulates entries in window.__lcpEntries
  // and tags the winning element with [data-lcp-candidate].
  await installLCPObserver(page);

  // ── Step 2: Navigate to /dashboard and wait for the app to settle ────────
  await page.goto('/dashboard');

  // Verify we landed on the dashboard (not redirected to /login)
  await verifyAuthSucceeded(page, '/dashboard');

  // Wait for the dashboard testid to become visible — auth + React render done
  await page.getByTestId('dashboard').waitFor({ state: 'visible', timeout: 15000 });

  // Wait for network idle — covers the async news fetch (client-side)
  await page.waitForLoadState('networkidle');

  // Extra quiet window: let any late paints and the news <img> render settle.
  // 1500ms matches the architecture note in PERF-04-01 spec.
  await page.waitForTimeout(1500);

  // ── Step 3: Capture LCP ─────────────────────────────────────────────────
  const result = await captureLCP(page);

  // ── Step 4: Report results three ways ────────────────────────────────────

  // (a) JSON attachment — primary deliverable for CI/PR and local runs
  await testInfo.attach('lcp-baseline.json', {
    body: JSON.stringify(result, null, 2),
    contentType: 'application/json',
  });

  // (b) Playwright annotation — visible in HTML report and JSON results
  testInfo.annotations.push({
    type: 'lcp',
    description: [
      `lcpMs=${result.lcpMs.toFixed(1)}`,
      `selector=${result.selector}`,
      `tagName=${result.tagName}`,
      `url=${result.url}`,
      `isNewsImage=${result.isNewsImage}`,
    ].join(' | '),
  });

  // (c) Console — visible in terminal output and Playwright --reporter=list
  console.log('\n═══════════════ PERF-04 LCP BASELINE ═══════════════');
  console.log(`  LCP time    : ${result.lcpMs.toFixed(1)} ms`);
  console.log(`  Element     : ${result.selector} (${result.tagName})`);
  console.log(`  Resource URL: ${result.url || '(inline/text)'}`);
  console.log(`  isNewsImage : ${result.isNewsImage}`);
  if (result.resourceTiming) {
    console.log(`  DNS         : ${result.resourceTiming.dnsMs.toFixed(1)} ms`);
    console.log(`  Connect+TLS : ${result.resourceTiming.connectMs.toFixed(1)} ms`);
  }
  console.log('');
  console.log(`  ${result.branchMessage}`);
  console.log('════════════════════════════════════════════════════\n');

  // ── No threshold assertion — this is a measurement harness only ──────────
  // The test passes as long as it runs to completion. The attachment content
  // is what the operator reads to make the PERF-04-02..05 gate decision.
});
