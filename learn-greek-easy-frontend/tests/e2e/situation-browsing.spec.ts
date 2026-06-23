import { test, expect } from '@playwright/test';

/**
 * Situation Browsing E2E Tests (redesigned hub — SIT-27)
 *
 * Verifies the redesigned learner situation hub (/situations) and that the
 * comprehension CTA navigates. Uses the pre-authenticated learner from
 * auth.setup.ts.
 *
 * NOTE: Do NOT add beforeEach seed calls — the auth setup already seeds the
 * database and authenticates users. Re-seeding would invalidate the cached auth
 * tokens since user UUIDs would change.
 *
 * Seeded data (from seed_situations, learner = e2e_learner):
 *   Everyday (description_source_type='original'):
 *     "At the coffee shop" — domain "Food & drink", 2 exercises, 1/2 completed
 *     "On the bus"         — domain "Transport",     2 exercises, 0/2 completed
 *     "At the supermarket" — domain "Shopping",      1 exercise,  1/1 completed
 *   News (description_source_type='news', 3 prod-exported situations, domain "News").
 *
 * "At the coffee shop" is the only in-progress situation, so it anchors the
 * resume hero AND appears as a card in the Everyday section → assertions that
 * target the card scope the search to a section, or use .first().
 */
test.describe('Situation Browsing (redesigned hub)', () => {
  test('renders the resume hero and the comprehension CTA', async ({ page }) => {
    await page.goto('/situations');

    await expect(page.getByTestId('situations-page')).toBeVisible({ timeout: 15000 });

    // Resume hero (the in-progress coffee-shop situation) + its primary CTA.
    await expect(page.getByTestId('situations-resume-cta')).toBeVisible({ timeout: 10000 });

    // The metric strip surfaces the hub-level counts.
    await expect(page.getByTestId('culture-metric-strip')).toBeVisible();

    // Comprehension CTA is present.
    await expect(page.getByTestId('situations-comprehension-cta')).toBeVisible();
  });

  test('renders the news and everyday sections with rich cards', async ({ page }) => {
    await page.goto('/situations');

    await expect(page.getByTestId('situation-item').first()).toBeVisible({ timeout: 15000 });

    // Both source-type sections render (seed provides news + original situations).
    const newsSection = page.getByRole('region', { name: /from the news/i });
    const everydaySection = page.getByRole('region', { name: /everyday & travel/i });
    await expect(newsSection).toBeVisible();
    await expect(everydaySection).toBeVisible();

    // The everyday section contains the seeded original situations.
    await expect(everydaySection.getByText('On the bus')).toBeVisible();
    await expect(everydaySection.getByText('At the supermarket')).toBeVisible();

    // A card surfaces domain + completion progress. Scope to the bus card so the
    // coffee-shop hero/card duplication never makes the locator ambiguous.
    const busCard = everydaySection
      .getByTestId('situation-item')
      .filter({ hasText: 'On the bus' });
    await expect(busCard).toBeVisible();
    // domain label (kicker) — "Transport" comes from the seeded Situation.domain.
    await expect(busCard).toContainText(/transport/i);
    // exercise badge shows the completed/total fraction.
    await expect(busCard.getByTestId('exercise-badge')).toContainText('0/2');
  });

  test('shows exercise completion fractions on cards', async ({ page }) => {
    await page.goto('/situations');

    await expect(page.getByTestId('situation-item').first()).toBeVisible({ timeout: 15000 });

    const everydaySection = page.getByRole('region', { name: /everyday & travel/i });

    // coffee shop → 1/2 (scoped to the everyday card, not the resume hero).
    const coffeeCard = everydaySection
      .getByTestId('situation-item')
      .filter({ hasText: 'At the coffee shop' });
    await expect(coffeeCard.getByTestId('exercise-badge')).toContainText('1/2');

    // supermarket → 1/1 (its single Reading exercise is mastered).
    const supermarketCard = everydaySection
      .getByTestId('situation-item')
      .filter({ hasText: 'At the supermarket' });
    await expect(supermarketCard.getByTestId('exercise-badge')).toContainText('1/1');
  });

  test('filters situations via search', async ({ page }) => {
    await page.goto('/situations');

    await expect(page.getByTestId('situation-item').first()).toBeVisible({ timeout: 15000 });

    // Filter to the coffee shop.
    await page.getByTestId('situations-search').fill('coffee');
    await page.waitForTimeout(500); // 300ms debounce + slack

    const everydaySection = page.getByRole('region', { name: /everyday & travel/i });
    await expect(everydaySection.getByText('At the coffee shop')).toBeVisible();
    // The bus card must be gone once the search narrows to "coffee".
    await expect(page.getByText('On the bus')).not.toBeVisible();
  });

  test('navigates to a situation detail page from a card', async ({ page }) => {
    await page.goto('/situations');

    await expect(page.getByTestId('situation-item').first()).toBeVisible({ timeout: 15000 });

    await page.getByTestId('situation-item').first().click();

    await expect(page).toHaveURL(/\/situations\/.+/, { timeout: 10000 });
    await expect(page.getByTestId('situation-detail')).toBeVisible({ timeout: 10000 });
  });

  test('comprehension CTA navigates to the comprehension overview', async ({ page }) => {
    await page.goto('/situations');

    await expect(page.getByTestId('situations-comprehension-cta')).toBeVisible({ timeout: 15000 });

    await page.getByTestId('situations-comprehension-cta').click();

    await expect(page).toHaveURL(/\/situations\/comprehension$/, { timeout: 10000 });
    await expect(page.getByTestId('situations-comprehension-page')).toBeVisible({ timeout: 10000 });
  });
});
