/**
 * E2E Tests: Exercise Hub Queue Network Contract (PERF-22-04, AC-2 + AC-5)
 *
 * PERF-22-03 gave the exercises hub (`ExercisePreSessionPage`, route
 * `/practice/exercises`) a registry query key (`queryKeys.exerciseQueue`),
 * an explicit 30s `staleTime`, and a finish-time invalidation
 * (`ExercisePracticePage.tsx`) fired once when a session's `sessionSummary`
 * is set.
 *
 * Decision 3 (story): the reconciled, testable network contracts are:
 *   - AC-2: hub<->hub reuse. PERF-15 already removed the dashboard's own
 *     queue fetch (see dashboard-single-call.spec.ts's LEGACY_ENDPOINTS list),
 *     so the obsolete literal "Dashboard -> hub" scenario no longer applies —
 *     the salvageable reuse is navigating AWAY from the hub and back to it
 *     within the 30s staleTime window.
 *   - AC-5: post-session freshness. Completing a session invalidates the
 *     hub's queue cache; returning to the hub must refetch regardless of
 *     staleTime.
 *
 * Both tests key off the hub's own request signature specifically —
 * `GET /api/v1/exercises/queue?summary=true` (PERF-17-05's slim summary
 * mode, passed ONLY by the hub — see src/services/exerciseAPI.ts's
 * `ExerciseQueueParams.summary` doc comment). This is deliberately NARROWER
 * than "any GET to /exercises/queue": the exercise SESSION page
 * (`exercisePracticeStore.ts`'s `startSession()`) independently calls
 * `exerciseAPI.getQueue({ modality })` (no `summary` param) to load the
 * actual exercise items to work through. Filtering on `summary=true`
 * isolates the hub's own fetch/refetch from that unrelated session-page call,
 * so AC-5's assertion can't be satisfied by a false positive.
 *
 * Tests run serial and share the seeded learner's exercise queue (single CI
 * worker, one /api/v1/test/seed/all per run — see docs/e2e-seeding.md).
 * AC-5 consumes the queue to completion, mirroring the already-accepted
 * pattern in picture-match-practice.spec.ts's PMATCH-E2E-03. AC-2 runs first
 * since it only asserts on request counts and is agnostic to queue content.
 */

import { test, expect } from '@playwright/test';
import type { Page, Request } from '@playwright/test';

import { verifyAuthSucceeded } from './helpers/auth-helpers';

test.use({ storageState: 'playwright/.auth/learner.json' });

test.describe.configure({ mode: 'serial' });

// GET /api/v1/exercises/queue?summary=true — the hub's own slim-summary
// fetch (PERF-17-05). Anchored on "(&|$)" after "summary=true" so it still
// matches if future callers append additional query params.
const HUB_QUEUE_ENDPOINT = /\/api\/v1\/exercises\/queue\?summary=true(&|$)/;

/** Wait for the hub page to be mounted and its queue query to have settled. */
async function waitForHubReady(page: Page): Promise<void> {
  await page.getByTestId('exercise-pre-session-page').waitFor({ state: 'visible', timeout: 15000 });
  await expect(
    page.getByTestId('recommended-grid').or(page.getByTestId('recommended-empty'))
  ).toBeVisible({ timeout: 15000 });
}

/**
 * Drive the active exercise session to completion by repeatedly answering
 * whichever renderer is on screen and clicking Continue. Mirrors
 * picture-match-practice.spec.ts's PMATCH-E2E-03 loop (the one proven,
 * already-in-suite pattern for exhausting this learner's exercise queue).
 */
async function driveSessionToCompletion(page: Page, maxIterations = 40): Promise<void> {
  for (let i = 0; i < maxIterations; i++) {
    const spfd = page.getByTestId('spfd-renderer');
    const sdfp = page.getByTestId('sdfp-renderer');
    const sca = page.getByTestId('sca-renderer');

    const isSpfd = await spfd.isVisible().catch(() => false);
    const isSdfp = await sdfp.isVisible().catch(() => false);
    const isSca = await sca.isVisible().catch(() => false);

    if (!isSpfd && !isSdfp && !isSca) break; // session complete / navigated away

    if (isSpfd) {
      await page.getByTestId('spfd-option-0').click();
    } else if (isSdfp) {
      await page.getByTestId('sdfp-option-0').click();
    } else {
      await page.getByTestId('sca-option-0').click();
    }

    const resultPanel = page.getByTestId('xd-result');
    await expect(resultPanel).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /continue/i }).click();
    await page.waitForTimeout(300);
  }
}

test.describe('Exercise Hub Queue Network Contract (PERF-22-04)', () => {
  test('AC-2: hub cold load fetches /exercises/queue once; hub -> /dashboard -> hub within staleTime issues zero additional GETs', async ({
    page,
  }) => {
    const hubQueueRequests: Request[] = [];
    page.on('request', (request) => {
      if (request.method() === 'GET' && HUB_QUEUE_ENDPOINT.test(request.url())) {
        hubQueueRequests.push(request);
      }
    });

    // Cold load of the hub.
    await page.goto('/practice/exercises');
    await verifyAuthSucceeded(page, '/practice/exercises');
    await waitForHubReady(page);
    await page.waitForTimeout(500);

    expect(
      hubQueueRequests,
      `expected exactly one cold-load GET /exercises/queue?summary=true; saw: ${hubQueueRequests
        .map((r) => r.url())
        .join(', ')}`
    ).toHaveLength(1);

    // SPA navigation hub -> /dashboard via the top nav (NOT page.goto — a hard
    // navigation would tear down the in-memory QueryClient and defeat the
    // staleTime-reuse behavior this test exists to prove).
    await page.locator('[data-testid="main-nav"]').getByRole('link', { name: /dashboard/i }).click();
    await page.waitForURL(/\/dashboard$/);
    await expect(page.getByTestId('feed-section')).toBeVisible({ timeout: 10000 });

    // SPA navigation /dashboard -> hub via the Practice dropdown, well within
    // the hub query's 30s staleTime.
    await page.locator('[data-testid="practice-dropdown-trigger"]').click();
    await page.locator('[data-testid="nav-item-practice-exercises"]').click();
    await page.waitForURL(/\/practice\/exercises$/);
    await waitForHubReady(page);
    await page.waitForTimeout(500);

    expect(
      hubQueueRequests,
      `expected zero additional GET /exercises/queue?summary=true after hub -> ` +
        `/dashboard -> hub within staleTime; saw ${hubQueueRequests.length} total: ${hubQueueRequests
          .map((r) => r.url())
          .join(', ')}`
    ).toHaveLength(1);
  });

  test('AC-5: completing an exercise session refetches the hub queue on return, regardless of staleTime', async ({
    page,
  }) => {
    const hubQueueRequests: Request[] = [];
    page.on('request', (request) => {
      if (request.method() === 'GET' && HUB_QUEUE_ENDPOINT.test(request.url())) {
        hubQueueRequests.push(request);
      }
    });

    await page.goto('/practice/exercises');
    await verifyAuthSucceeded(page, '/practice/exercises');
    await waitForHubReady(page);
    await page.waitForTimeout(500);

    expect(hubQueueRequests).toHaveLength(1);

    const startBtn = page.getByTestId('start-daily-mix-btn');
    if (await startBtn.isDisabled()) {
      test.skip(
        true,
        'seeded exercise queue is empty this run (possibly exhausted by an earlier ' +
          'test) — post-session freshness is covered at the unit level by the ' +
          'finish-invalidation effect test (PERF-22-03)'
      );
      return;
    }

    await startBtn.click();
    await page.waitForURL(/\/practice\/exercises\/session/);

    await driveSessionToCompletion(page);

    // handleCompleteTracked (ExercisePracticePage.tsx) navigates back to the hub
    // with `state: { fromFinish: true }` once `sessionSummary` is set. The
    // finish-invalidation effect invalidates queryKeys.exerciseQueue(userId) in
    // the same render pass (Decision 7: once on finish, not per answer), so the
    // hub's remount below must refetch even though staleTime (30s) has not
    // elapsed — this is exactly what distinguishes AC-5 from AC-2.
    await page.waitForURL(/\/practice\/exercises$/, { timeout: 15000 });
    await waitForHubReady(page);
    await page.waitForTimeout(500);

    // Best-effort: the completion banner (fromFinish + sessionSummary) should
    // also be visible. Logged rather than hard-asserted — it is not the
    // network contract this test exists to prove.
    const bannerVisible = await page
      .getByTestId('xd-completion-banner')
      .isVisible()
      .catch(() => false);
    if (!bannerVisible) {
      console.log(
        '[AC-5] xd-completion-banner not visible on return to the hub — proceeding ' +
          'with the network-refetch assertion only'
      );
    }

    expect(
      hubQueueRequests.length,
      `expected an additional GET /exercises/queue?summary=true when the hub ` +
        `remounts post-finish (invalidation-driven refetch); saw ` +
        `${hubQueueRequests.length} total (baseline was 1): ${hubQueueRequests
          .map((r) => r.url())
          .join(', ')}`
    ).toBeGreaterThan(1);
  });
});
