import { test, expect } from '@playwright/test';

/**
 * Situations Comprehension Overview E2E (SIT-27-09 / SIT-27-10)
 *
 * Verifies the account-wide comprehension screen at /situations/comprehension.
 * Uses the pre-authenticated learner from auth.setup.ts.
 *
 * NOTE: Do NOT add beforeEach seed calls — the auth setup already seeds the DB.
 *
 * Seeded comprehension signal (from seed_situations, learner = e2e_learner):
 *   - Listening topic: coffee-shop reviews (LEARNING record + 3 reviews) → accuracy.
 *   - Reading topic:   supermarket reviews (MASTERED record + 2 reviews)  → accuracy.
 *   - Dialogue + Visual topics: no exercises/reviews → "No attempts yet".
 *   - recent_sessions: 5 ExerciseReview rows across recent days.
 *   - streak: a multi-day exercise streak from those review dates.
 *
 * The exact percentages depend on the SM-2 weighting, so the spec asserts the
 * client renders the right STRUCTURE for the seeded shape (donut, verdict, all
 * four topic bars with the right empty/non-empty accuracy state, recent rows,
 * nudge) rather than pinning brittle numeric values.
 */
test.describe('Situations Comprehension Overview', () => {
  test('renders the donut percentage and a verdict', async ({ page }) => {
    await page.goto('/situations/comprehension');

    await expect(page.getByTestId('situations-comprehension-page')).toBeVisible({ timeout: 15000 });

    // Donut shows a rounded percentage (e.g. "42%").
    const donut = page.getByTestId('comprehension-donut-pct');
    await expect(donut).toBeVisible({ timeout: 10000 });
    await expect(donut).toHaveText(/^\d+%$/);

    // Verdict pill carries one of the localized verdict labels.
    await expect(page.getByTestId('comprehension-verdict')).not.toBeEmpty();
  });

  test('renders the honest nudge banner', async ({ page }) => {
    await page.goto('/situations/comprehension');

    await expect(page.getByTestId('comprehension-nudge')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('comprehension-nudge')).not.toBeEmpty();
  });

  test('renders all four per-topic confidence bars', async ({ page }) => {
    await page.goto('/situations/comprehension');

    await expect(page.getByTestId('comprehension-topics')).toBeVisible({ timeout: 15000 });

    // All four canonical topics render a bar (testid uses the topic key).
    for (const topic of ['Listening', 'Reading', 'Dialogue', 'Visual']) {
      await expect(page.getByTestId(`comprehension-topic-${topic}`)).toBeVisible();
    }
  });

  test('shows accuracy for reviewed topics and "No attempts yet" for unreviewed ones', async ({
    page,
  }) => {
    await page.goto('/situations/comprehension');

    await expect(page.getByTestId('comprehension-topics')).toBeVisible({ timeout: 15000 });

    // Listening + Reading have seeded reviews → an "Accuracy: NN%" meta.
    for (const topic of ['Listening', 'Reading']) {
      const accuracy = page.getByTestId(`comprehension-topic-${topic}-accuracy`);
      await expect(accuracy).toContainText(/accuracy/i);
    }

    // Dialogue + Visual have no exercises/reviews → "No attempts yet" (NOT "0%").
    for (const topic of ['Dialogue', 'Visual']) {
      const accuracy = page.getByTestId(`comprehension-topic-${topic}-accuracy`);
      await expect(accuracy).toContainText(/no attempts yet/i);
    }
  });

  test('renders recent review sessions from the seeded reviews', async ({ page }) => {
    await page.goto('/situations/comprehension');

    await expect(page.getByTestId('comprehension-recent')).toBeVisible({ timeout: 15000 });

    // The learner has seeded reviews → at least one session row, not the empty state.
    await expect(page.getByTestId('comprehension-session-0')).toBeVisible();
    await expect(page.getByTestId('comprehension-recent-empty')).not.toBeVisible();
  });

  test('navigates back to the hub via the breadcrumb', async ({ page }) => {
    await page.goto('/situations/comprehension');

    await expect(page.getByTestId('situations-comprehension-page')).toBeVisible({ timeout: 15000 });

    // Scope to the breadcrumb nav so the sidebar "Situations" link can't match.
    const breadcrumb = page.getByRole('navigation', { name: /breadcrumb/i });
    await breadcrumb.getByRole('link', { name: /^situations$/i }).click();

    await expect(page).toHaveURL(/\/situations$/, { timeout: 10000 });
    await expect(page.getByTestId('situations-page')).toBeVisible({ timeout: 10000 });
  });
});
