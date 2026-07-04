/**
 * E2E Test: /statistics Single-Call Network Contract (PERF-22-04, AC-1)
 *
 * PERF-22 unified the frontend cache for `GET /api/v1/progress/decks`: both
 * `useAnalytics()` (via `getAnalytics` -> `fetchDeckProgressList`) and the
 * global deck-cover warmer (`useWarmDeckCovers` -> `deckStore.ensureDecksFresh`
 * -> `fetchDecks` -> `fetchDeckProgressList`) now route through the SAME
 * user-scoped, TanStack-Query-backed fetcher (`src/lib/queryKeys.ts`):
 *
 *   queryKeys.progressDecks(userId) -> fetchDeckProgressList(userId)
 *
 * `/statistics` is the one route where BOTH consumers mount simultaneously:
 *   - `useWarmDeckCovers` (mounted globally by `ProtectedRoute`) fires on every
 *     protected route EXCEPT `/dashboard` (src/hooks/useWarmDeckCovers.ts:35).
 *   - `useAnalytics` (mounted by `src/pages/Statistics.tsx`) only fires on
 *     `/statistics`.
 *
 * Before PERF-22, this collision meant two independent, un-deduped calls to
 * `GET /api/v1/progress/decks` on a single `/statistics` cold load. This spec
 * proves the fix end-to-end: TanStack Query's `fetchQuery` (keyed by
 * `queryKeys.progressDecks(userId)`) coalesces the two concurrent callers into
 * exactly ONE network request.
 *
 * `/dashboard` is deliberately NOT the target page here — PERF-15 already made
 * it source everything from `GET /dashboard/summary` (see
 * dashboard-single-call.spec.ts), and `useWarmDeckCovers` explicitly skips it.
 */

import { test, expect } from '@playwright/test';
import type { Request } from '@playwright/test';

import { verifyAuthSucceeded } from './helpers/auth-helpers';

test.use({ storageState: 'playwright/.auth/learner.json' });

// GET /api/v1/progress/decks?page=1&page_size=50 — anchored on "(\?|$)" so it
// matches only the exact collection route, not a sibling detail route like
// /api/v1/progress/decks/{deckId} (has a "/" after "decks").
const PROGRESS_DECKS_ENDPOINT = /\/api\/v1\/progress\/decks(\?|$)/;

test.describe('/statistics Single-Call Network Contract (PERF-22-04, AC-1)', () => {
  test('AC-1: cold load of /statistics issues exactly one GET to /api/v1/progress/decks', async ({
    page,
  }) => {
    const requests: Request[] = [];

    // Register the listener BEFORE navigation so both consumers' requests
    // (useAnalytics + useWarmDeckCovers) are captured from the very first tick.
    page.on('request', (request) => {
      requests.push(request);
    });

    // Resolves as soon as EITHER (deduped) caller's request lands — the
    // deterministic readiness signal for this spec, mirroring
    // dashboard-single-call.spec.ts's AC-3 waitForResponse pattern.
    const progressDecksResponsePromise = page.waitForResponse(
      (r) => r.request().method() === 'GET' && PROGRESS_DECKS_ENDPOINT.test(r.url()),
      { timeout: 20000 }
    );

    await page.goto('/statistics');
    await verifyAuthSucceeded(page, '/statistics');
    await page.getByTestId('statistics-page').waitFor({ state: 'visible', timeout: 15000 });

    await progressDecksResponsePromise;
    // Trailing buffer so a would-be second (un-deduped) call has time to land
    // before we snapshot the request list below.
    await page.waitForTimeout(500);

    const progressDecksRequests = requests.filter(
      (r) => r.method() === 'GET' && PROGRESS_DECKS_ENDPOINT.test(r.url())
    );

    expect(
      progressDecksRequests,
      `expected exactly one GET /api/v1/progress/decks (useAnalytics + ` +
        `useWarmDeckCovers must dedup via the shared fetchDeckProgressList ` +
        `fetcher); saw ${progressDecksRequests.length}: ${progressDecksRequests
          .map((r) => r.url())
          .join(', ')}`
    ).toHaveLength(1);
  });
});
