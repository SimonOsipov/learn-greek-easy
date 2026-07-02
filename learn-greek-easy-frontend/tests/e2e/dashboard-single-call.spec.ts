/**
 * E2E Tests: Dashboard Single-Call Network Contract (PERF-15-07)
 *
 * PERF-15 replaced the dashboard's eight per-section fetches (progress
 * summary, trends, deck progress, deck list, situations list, situations
 * comprehension, news list, exercises queue) with a single composed
 * GET /api/v1/dashboard/summary call (dashboard_compose.py). This spec
 * guards the network contract so a future change can't silently reintroduce
 * the fan-out:
 *
 *   - AC-1/AC-2: cold /dashboard load makes exactly ONE GET to
 *     /api/v1/dashboard/summary and ZERO GETs to any of the 8 legacy
 *     endpoints it replaced.
 *   - AC-3: the summary payload stays under the 30KB budget, omits the
 *     heavy fields SlimNews deliberately excludes (word_timestamps,
 *     description_el — see backend src/schemas/dashboard.py), and the
 *     dashboard renders the same structural surface (testids + feed card
 *     count) in both EN and RU.
 *
 * AC-4 (Sentry transaction for /dashboard/summary + confirmation that the
 * 8-call fan-out is gone in production traces) is verified manually
 * post-deploy via the Sentry MCP `search_events` tool — it is not
 * observable through Playwright's network layer, which only sees this
 * harness's own requests, not APM instrumentation on the backend.
 */

import { test, expect } from '@playwright/test';
import type { Request } from '@playwright/test';

import { verifyAuthSucceeded } from './helpers/auth-helpers';

test.use({ storageState: 'playwright/.auth/learner.json' });

// The single composed endpoint PERF-15 introduced.
const SUMMARY_ENDPOINT = /\/api\/v1\/dashboard\/summary(\?|$)/;

// The eight legacy per-section endpoints PERF-15 replaced. Each regex anchors
// on "(\?|$)" immediately after the terminal path segment so it matches only
// the exact collection route and NOT a sibling/detail route that happens to
// share a path prefix:
//   - /api/v1/decks            matches "?page=1" or end-of-string, so it does
//                               NOT match /api/v1/dashboard/summary (different
//                               prefix entirely) and does NOT match
//                               /api/v1/decks/{id} (has a "/" after "decks").
//   - /api/v1/situations       likewise does NOT match
//                               /api/v1/situations/comprehension or
//                               /api/v1/situations/{id}(/exercises|/stats).
const LEGACY_ENDPOINTS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: 'progress/dashboard', pattern: /\/api\/v1\/progress\/dashboard(\?|$)/ },
  { name: 'progress/trends', pattern: /\/api\/v1\/progress\/trends(\?|$)/ },
  { name: 'progress/decks', pattern: /\/api\/v1\/progress\/decks(\?|$)/ },
  { name: 'decks (list)', pattern: /\/api\/v1\/decks(\?|$)/ },
  { name: 'situations (list)', pattern: /\/api\/v1\/situations(\?|$)/ },
  { name: 'situations/comprehension', pattern: /\/api\/v1\/situations\/comprehension(\?|$)/ },
  { name: 'news (list)', pattern: /\/api\/v1\/news(\?|$)/ },
  { name: 'exercises/queue', pattern: /\/api\/v1\/exercises\/queue(\?|$)/ },
];

test.describe('Dashboard Single-Call Network Contract (PERF-15-07)', () => {
  test('AC-1/AC-2: cold load makes exactly one GET to /dashboard/summary and zero to the 8 legacy endpoints', async ({
    page,
  }) => {
    const requests: Request[] = [];

    // Register the listener BEFORE navigation so the very first request
    // (including the one that resolves the initial render) is captured.
    // /api/v1/auth/me, /api/v1/notifications, /api/v1/notifications/unread-count
    // and the SSE /api/v1/notifications/stream are allowed and intentionally
    // NOT filtered against below — they are unrelated to the dashboard-summary
    // consolidation this spec guards.
    page.on('request', (request) => {
      requests.push(request);
    });

    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');
    await page.getByTestId('dashboard').waitFor({ state: 'visible', timeout: 15000 });
    // The dashboard keeps /api/v1/notifications/stream (SSE) open, so
    // waitForLoadState('networkidle') can hang/time out — it never resolves
    // while that connection is live. feed-section renders only once the
    // summary resolves, so its visibility is a deterministic readiness
    // signal; the trailing timeout gives a moment for any late duplicate
    // call to land before we snapshot the request list below.
    await expect(page.getByTestId('feed-section')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    const summaryRequests = requests.filter(
      (r) => r.method() === 'GET' && SUMMARY_ENDPOINT.test(r.url())
    );
    expect(summaryRequests).toHaveLength(1);

    for (const { name, pattern } of LEGACY_ENDPOINTS) {
      const matches = requests.filter((r) => r.method() === 'GET' && pattern.test(r.url()));
      expect(
        matches,
        `unexpected GET(s) to legacy endpoint "${name}": ${matches
          .map((m) => m.url())
          .join(', ')}`
      ).toHaveLength(0);
    }
  });

  test('AC-3: /dashboard/summary payload stays under 30KB and omits heavy fields', async ({
    page,
  }) => {
    const summaryResponsePromise = page.waitForResponse(
      (r) => r.request().method() === 'GET' && SUMMARY_ENDPOINT.test(r.url()),
      { timeout: 20000 }
    );

    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');

    const resp = await summaryResponsePromise;
    await page.getByTestId('dashboard').waitFor({ state: 'visible', timeout: 15000 });
    // See the AC-1/AC-2 test above for why networkidle is unsafe here (the
    // open SSE stream never idles). feed-section renders only once the
    // summary resolves, so its visibility is a deterministic readiness
    // signal; the response body itself was already captured above.
    await expect(page.getByTestId('feed-section')).toBeVisible({ timeout: 10000 });

    const body = await resp.body();
    const bytes = body.length;
    expect(bytes).toBeLessThan(30_000);

    const text = body.toString();
    // SlimNews deliberately omits these heavy fields (backend
    // src/schemas/dashboard.py) — their presence would mean the summary
    // endpoint regressed back to embedding full news/word-audio payloads.
    expect(text).not.toContain('word_timestamps');
    expect(text).not.toContain('description_el');
  });

  test('AC-3: dashboard renders the same structural surface in EN and RU', async ({ page }) => {
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');
    // No networkidle wait (see the AC-1/AC-2 test above): this initial load
    // is immediately superseded by the EN reload below, whose own
    // metric-strip/feed-section visibility checks are the readiness gate
    // the assertions that follow actually depend on.
    await page.getByTestId('dashboard').waitFor({ state: 'visible', timeout: 15000 });

    // ── EN ────────────────────────────────────────────────────────────────
    // Set i18nextLng on the baseURL origin the app actually runs on (not
    // https://greeklish.eu — a different origin whose localStorage never
    // reaches localhost/preview), then reload so i18n re-inits in EN.
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'en'));
    await page.reload();
    await verifyAuthSucceeded(page, '/dashboard');
    await page.getByTestId('dashboard').waitFor({ state: 'visible', timeout: 15000 });

    const metricStripEn = page.getByTestId('metric-strip');
    await expect(metricStripEn).toBeVisible({ timeout: 10000 });
    const feedSectionEn = page.getByTestId('feed-section');
    await expect(feedSectionEn).toBeVisible({ timeout: 10000 });

    const newsCardsEn = feedSectionEn.locator('[data-kind="news"]');
    const hasNewsEn = (await newsCardsEn.count()) > 0;
    if (hasNewsEn) {
      await expect(newsCardsEn.first()).toBeVisible({ timeout: 5000 });
    }
    const enCardCount = await feedSectionEn.locator('[data-kind]').count();

    // ── RU ────────────────────────────────────────────────────────────────
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'ru'));
    await page.reload();
    await verifyAuthSucceeded(page, '/dashboard');
    await page.getByTestId('dashboard').waitFor({ state: 'visible', timeout: 15000 });

    const metricStripRu = page.getByTestId('metric-strip');
    await expect(metricStripRu).toBeVisible({ timeout: 10000 });
    const feedSectionRu = page.getByTestId('feed-section');
    await expect(feedSectionRu).toBeVisible({ timeout: 10000 });

    const newsCardsRu = feedSectionRu.locator('[data-kind="news"]');
    if (hasNewsEn) {
      // Same seeded learner data drives both locales — if news surfaced in
      // EN it must also surface in RU (structural parity, not pixel parity;
      // the visual EN/RU gate lives in release-verify's Phase 3.5).
      await expect(newsCardsRu.first()).toBeVisible({ timeout: 5000 });
    }
    const ruCardCount = await feedSectionRu.locator('[data-kind]').count();

    expect(ruCardCount).toBe(enCardCount);

    // Cleanup — avoid leaking RU into sibling tests/specs.
    await page.evaluate(() => localStorage.removeItem('i18nextLng'));
  });
});
