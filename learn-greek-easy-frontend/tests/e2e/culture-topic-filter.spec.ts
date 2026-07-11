/**
 * E2E Test: Culture Topic Filter — end-to-end filtered practice session (WEDGE-03-04)
 *
 * This is the AC5 "done bar" for the WEDGE-03 topic filter: a learner can pick a
 * single thematic topic on the Mock Exam hub (`/practice/culture-exam`) and drill
 * a real, non-empty practice session scoped to that topic — in both EN and RU.
 *
 * Assembles three prior subtasks with no code changes of its own:
 *   - WEDGE-03-01 (backend): `topic` query param on the culture queue/browse endpoints.
 *   - WEDGE-03-02 (client+page wiring): `CultureTopic` client type + `?topic=` threading
 *     from `CulturePracticePage` into `cultureDeckAPI.getQuestionQueue`.
 *   - WEDGE-03-03 (chips+resolver): the `culture-topic-chips` row on `MockExamPage`,
 *     single-select via `aria-pressed`, and the D-6a topic→deck resolver feeding the
 *     `topic-practice-launcher` CTA (`/culture/:deckId/practice?topic=<topic>`).
 *
 * Auth + seed harness: mirrors `tests/e2e/mock-exam.spec.ts` /
 * `tests/e2e/culture-practice.spec.ts` — pre-authenticated learner via the default
 * Playwright project `storageState` (`playwright/.auth/learner.json`, set in
 * `playwright.config.ts`), backed by the `/seed/all` E2E seed (`docs/e2e-seeding.md`).
 * Do NOT add beforeEach seed calls — re-seeding invalidates the cached auth tokens.
 *
 * Seed shape this test relies on (docs/e2e-seeding.md, backend
 * `SeedService.seed_culture_decks_and_questions` / `CULTURE_DECKS`): 5 culture decks —
 * History, Geography, Politics, Culture, Traditions. Deck `category` values are
 * history/geography/politics/culture/traditions; there is NO `practical`-category
 * deck. The D-6a resolver (`resolveDeckIdForTopic` in `MockExamPage.tsx`) matches on
 * `deck.category === topic`, so:
 *   - topic `history` resolves deterministically to the single History deck (used
 *     for the EN/RU/tap-clear flows below).
 *   - topic `practical` resolves to NO deck (used for the D-8 empty-state guard below)
 *     — this is real seed shape, not a mutation, so it's safe to assert against without
 *     touching shared seed data.
 * The History deck is `is_premium: true` in the seed, but neither
 * `CulturePracticePage` nor the backend `get_question_queue` endpoint enforce a
 * premium gate (premium is a display-only flag on deck *browsing* cards) — this test
 * navigates directly to the practice URL, bypassing the browse-page card lock, exactly
 * as the real topic-launcher button does.
 *
 * Locale switching: per project convention (see `dashboard-single-call.spec.ts`), set
 * `i18nextLng` in localStorage on the baseURL origin the app is actually running on
 * (NOT https://greeklish.eu — a different origin) and reload, rather than relying on
 * browser `locale` context config, which only drives initial detection.
 *
 * NOTE (Mode A / RALPH): this spec is authored pre-verification against the already-
 * assembled feature (WEDGE-03-01/02/03 are merged on this branch). It cannot be run
 * locally — there is no live deployed env in this workspace. It was validated with
 * `npx playwright test --list` (parses + discovers cleanly) plus
 * `npx tsc -b --force` / `npm run typecheck:test` (type-checks cleanly). The real
 * RED→GREEN execution happens in CI / the Phase 3.5 release-verify run against the
 * deployed dev environment.
 */

import { test, expect } from '@playwright/test';

import { verifyAuthSucceeded } from './helpers/auth-helpers';

test.describe('Culture Topic Filter — filtered practice session (WEDGE-03-04)', () => {
  test('AC5 (EN): tap History chip on the mock-exam hub launches a filtered, non-empty practice session', async ({
    page,
  }) => {
    await page.goto('/practice/culture-exam');
    await verifyAuthSucceeded(page, '/practice/culture-exam');
    await expect(page.getByTestId('mock-exam-page')).toBeVisible({ timeout: 15000 });

    const chipRow = page.getByTestId('culture-topic-chips');
    await expect(chipRow).toBeVisible({ timeout: 10000 });

    const historyChip = page.getByTestId('topic-chip-history');
    await expect(historyChip).toBeVisible();
    await historyChip.click();
    await expect(historyChip).toHaveAttribute('aria-pressed', 'true');

    const launcher = page.getByTestId('topic-practice-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await expect(launcher).toBeEnabled({ timeout: 10000 });
    await launcher.click();

    // URL must carry the topic param — the minimum proof the filter was actually
    // applied (not just "a session page loaded").
    await expect(page).toHaveURL(/\/culture\/[^/]+\/practice/, { timeout: 10000 });
    expect(page.url()).toContain('topic=history');

    // The session must actually run and render a real question — not just navigate.
    const mcq = page.getByTestId('mcq-component');
    await expect(mcq).toBeVisible({ timeout: 15000 });
    const questionText = page.getByTestId('mcq-question-text');
    await expect(questionText).toBeVisible();
    await expect(questionText).not.toHaveText('');

    // Non-vacuous session: the progress indicator ("Question X of Y") must report a
    // total greater than zero — a session that resolved to an empty queue would never
    // reach this point (mcq-component wouldn't render at all), but asserting the count
    // directly guards against a future regression that renders the component with a
    // zero/undefined total.
    const progress = page.getByTestId('mcq-progress');
    await expect(progress).toBeVisible();
    const progressText = (await progress.textContent()) ?? '';
    const counts = progressText.match(/(\d+)\D+(\d+)/);
    expect(counts).not.toBeNull();
    expect(Number(counts?.[2])).toBeGreaterThan(0);
  });

  test('AC5 (RU): История chip launches a filtered practice session with the UI in Russian', async ({
    page,
  }) => {
    await page.goto('/practice/culture-exam');
    await verifyAuthSucceeded(page, '/practice/culture-exam');
    await expect(page.getByTestId('mock-exam-page')).toBeVisible({ timeout: 15000 });

    // Set i18nextLng on the baseURL origin the app actually runs on, then reload so
    // i18n re-inits in Russian (see file header + dashboard-single-call.spec.ts).
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'ru'));
    await page.reload();
    await verifyAuthSucceeded(page, '/practice/culture-exam');
    await expect(page.getByTestId('mock-exam-page')).toBeVisible({ timeout: 15000 });

    const chipRow = page.getByTestId('culture-topic-chips');
    await expect(chipRow).toBeVisible({ timeout: 10000 });

    const historyChip = page.getByTestId('topic-chip-history');
    await expect(historyChip).toBeVisible();
    await expect(historyChip).toHaveText('История');

    await historyChip.click();
    await expect(historyChip).toHaveAttribute('aria-pressed', 'true');

    const launcher = page.getByTestId('topic-practice-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await expect(launcher).toBeEnabled({ timeout: 10000 });
    await launcher.click();

    await expect(page).toHaveURL(/\/culture\/[^/]+\/practice/, { timeout: 10000 });
    expect(page.url()).toContain('topic=history');

    const mcq = page.getByTestId('mcq-component');
    await expect(mcq).toBeVisible({ timeout: 15000 });
    const questionText = page.getByTestId('mcq-question-text');
    await expect(questionText).toBeVisible();
    await expect(questionText).not.toHaveText('');

    const progress = page.getByTestId('mcq-progress');
    await expect(progress).toBeVisible();
    const progressText = (await progress.textContent()) ?? '';
    const counts = progressText.match(/(\d+)\D+(\d+)/);
    expect(counts).not.toBeNull();
    expect(Number(counts?.[2])).toBeGreaterThan(0);

    // Cleanup — avoid leaking RU into sibling tests/specs (matches
    // dashboard-single-call.spec.ts's AC-3 EN/RU parity test).
    await page.evaluate(() => localStorage.removeItem('i18nextLng'));
  });

  test('tapping the active History chip again clears the selection back to all-topics', async ({
    page,
  }) => {
    await page.goto('/practice/culture-exam');
    await verifyAuthSucceeded(page, '/practice/culture-exam');
    await expect(page.getByTestId('mock-exam-page')).toBeVisible({ timeout: 15000 });

    const historyChip = page.getByTestId('topic-chip-history');
    await expect(historyChip).toBeVisible({ timeout: 10000 });
    await historyChip.click();
    await expect(historyChip).toHaveAttribute('aria-pressed', 'true');

    // The topic-scoped launcher mounts only while a topic is selected.
    await expect(page.getByTestId('topic-practice-launcher')).toBeVisible();

    // Tap the SAME chip again — single-select toggle clears back to all-topics.
    await historyChip.click();
    await expect(historyChip).toHaveAttribute('aria-pressed', 'false');

    // No topic chip is aria-pressed; the "All topics" clear chip is pressed instead.
    for (const topic of ['history', 'geography', 'politics', 'culture', 'practical']) {
      await expect(page.getByTestId(`topic-chip-${topic}`)).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    }
    await expect(page.getByTestId('topic-chip-all')).toHaveAttribute('aria-pressed', 'true');

    // The topic-scoped launcher reverts to the default (unmounted) — the page's
    // primary CTA is the unscoped mock-exam launcher, which was already present.
    await expect(page.getByTestId('topic-practice-launcher')).toHaveCount(0);
    await expect(page.getByTestId('start-exam-button')).toBeVisible();
  });

  test('D-8: Practical topic has no seeded deck — launcher stays disabled, no navigation', async ({
    page,
  }) => {
    // Real E2E seed shape (docs/e2e-seeding.md): 5 culture decks (History, Geography,
    // Politics, Culture, Traditions) — no deck has category "practical". This proves
    // the D-6a disabled-guard path against real (unmutated) seed data, matching the
    // architect's D-8 note: no seed change for this test.
    await page.goto('/practice/culture-exam');
    await verifyAuthSucceeded(page, '/practice/culture-exam');
    await expect(page.getByTestId('mock-exam-page')).toBeVisible({ timeout: 15000 });

    const practicalChip = page.getByTestId('topic-chip-practical');
    await expect(practicalChip).toBeVisible({ timeout: 10000 });
    await practicalChip.click();
    await expect(practicalChip).toHaveAttribute('aria-pressed', 'true');

    const launcher = page.getByTestId('topic-practice-launcher');
    await expect(launcher).toBeVisible({ timeout: 10000 });
    await expect(launcher).toBeDisabled();

    // A disabled native <button> cannot be activated by a real user click — Playwright
    // itself refuses to click a disabled element, so the strongest available proof of
    // "no navigation" is that we stay on the hub with the launcher still disabled.
    const urlBefore = page.url();
    await page.waitForTimeout(500);
    expect(page.url()).toBe(urlBefore);
    await expect(launcher).toBeDisabled();
    await expect(page.getByTestId('mock-exam-page')).toBeVisible();
  });
});
