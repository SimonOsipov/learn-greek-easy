import { test, expect } from '@playwright/test';

/**
 * Situation Browsing E2E Tests
 *
 * These tests verify the learner situation browser (list and detail pages).
 * The tests use the pre-authenticated learner user from auth.setup.ts.
 *
 * NOTE: Do NOT add beforeEach seed calls - the auth setup already seeds
 * the database and authenticates users. Re-seeding would invalidate
 * the cached auth tokens since user UUIDs would change.
 *
 * Seeded data (from seed_situations):
 *   1. "At the coffee shop" — 2 exercises, 1 completed (exercise_completed=1, exercise_total=2)
 *   2. "On the bus"         — 2 exercises, 0 completed (exercise_completed=0, exercise_total=2)
 *   3. "At the supermarket" — 0 exercises              (exercise_completed=0, exercise_total=0)
 */
test.describe('Situation Browsing', () => {
  test('should display situations list page', async ({ page }) => {
    await page.goto('/situations');

    await expect(page.getByTestId('situations-page')).toBeVisible({ timeout: 15000 });

    // At least one situation item should be visible
    await expect(page.getByTestId('situation-item').first()).toBeVisible({ timeout: 10000 });

    // The seeded coffee shop situation should appear
    await expect(page.getByText('At the coffee shop')).toBeVisible();
  });

  test('should filter situations via search', async ({ page }) => {
    await page.goto('/situations');

    // Wait for the list to load
    await expect(page.getByTestId('situation-item').first()).toBeVisible({ timeout: 15000 });

    // Fill the search input
    await page.getByTestId('situations-search').fill('coffee');

    // Account for debounce (300ms)
    await page.waitForTimeout(500);

    // Coffee shop should be visible, bus should not
    await expect(page.getByText('At the coffee shop')).toBeVisible();
    await expect(page.getByText('On the bus')).not.toBeVisible();
  });

  test('should navigate to situation detail page', async ({ page }) => {
    await page.goto('/situations');

    await expect(page.getByTestId('situation-item').first()).toBeVisible({ timeout: 15000 });

    // Click the first situation item
    await page.getByTestId('situation-item').first().click();

    // URL should change to /situations/{uuid}
    await expect(page).toHaveURL(/\/situations\/.+/, { timeout: 10000 });

    // Detail view should be visible
    await expect(page.getByTestId('situation-detail')).toBeVisible({ timeout: 10000 });
  });

  test('should show exercise completion badge', async ({ page }) => {
    await page.goto('/situations');

    await expect(page.getByTestId('situation-item').first()).toBeVisible({ timeout: 15000 });

    // Find the coffee shop card — it should show 1/2 (1 completed out of 2 total)
    const coffeeCard = page.getByTestId('situation-item').filter({ hasText: 'At the coffee shop' });
    const coffeeBadge = coffeeCard.getByTestId('exercise-badge');
    await expect(coffeeBadge).toBeVisible();
    await expect(coffeeBadge).toContainText('1/2');

    // Find the bus card — it should show 0/2
    const busCard = page.getByTestId('situation-item').filter({ hasText: 'On the bus' });
    const busBadge = busCard.getByTestId('exercise-badge');
    await expect(busBadge).toBeVisible();
    await expect(busBadge).toContainText('0/2');

    // Find the supermarket card — it should show 0/0
    const supermarketCard = page.getByTestId('situation-item').filter({
      hasText: 'At the supermarket',
    });
    const supermarketBadge = supermarketCard.getByTestId('exercise-badge');
    await expect(supermarketBadge).toBeVisible();
    await expect(supermarketBadge).toContainText('0/0');
  });
});
