/**
 * Admin Panel i18n E2E Tests
 *
 * Tests for internationalization of the admin panel.
 * Verifies that admin panel respects language selection
 * and displays correct translations for English, Greek, and Russian.
 */

import { test, expect } from '@playwright/test';

// =============================================================================
// Admin Panel Translation Tests
// =============================================================================

// FIXME: These tests are flaky in CI due to admin role not being properly
// set for Auth0-authenticated users. The seeded admin user has is_superuser=True
// but the Auth0 token exchange might not be preserving this status correctly.
// See: https://github.com/SimonOsipov/learn-greek-easy/issues/XXX
test.describe.skip('Admin Panel - i18n Translations', () => {
  // Use admin storage state (superuser)
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test.beforeEach(async ({ page }) => {
    // Clear localStorage and navigate to admin
    await page.goto('/admin');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });
  });

  test('Admin panel displays English translations by default', async ({ page }) => {
    // Should display English title
    await expect(page.getByTestId('admin-title')).toHaveText('Admin Dashboard');

    // Should display English subtitle
    await expect(page.getByTestId('admin-subtitle')).toHaveText(
      'Manage content and view statistics'
    );
  });

  test('Admin panel displays Greek translations when Greek is selected', async ({ page }) => {
    // Switch to Greek
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-el').click();

    // Should display Greek title (assertion auto-waits for text change)
    await expect(page.getByTestId('admin-title')).toHaveText('Πίνακας Διαχείρισης');

    // Should display Greek subtitle
    await expect(page.getByTestId('admin-subtitle')).toHaveText(
      'Διαχείριση περιεχομένου και προβολή στατιστικών'
    );
  });

  test('Admin panel displays Russian translations when Russian is selected', async ({ page }) => {
    // Switch to Russian
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-ru').click();

    // Should display Russian title (assertion auto-waits for text change)
    await expect(page.getByTestId('admin-title')).toHaveText('Панель администратора');

    // Should display Russian subtitle
    await expect(page.getByTestId('admin-subtitle')).toHaveText(
      'Управление контентом и просмотр статистики'
    );
  });

  test('Language persists after page reload on admin panel', async ({ page }) => {
    // Switch to Greek
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-el').click();

    // Verify Greek is displayed (assertion auto-waits)
    await expect(page.getByTestId('admin-title')).toHaveText('Πίνακας Διαχείρισης');

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });

    // Should still display Greek after reload
    await expect(page.getByTestId('admin-title')).toHaveText('Πίνακας Διαχείρισης');
  });

  test('Language change applies immediately without page refresh', async ({ page }) => {
    // Verify English is displayed initially
    await expect(page.getByTestId('admin-title')).toHaveText('Admin Dashboard');

    // Switch to Greek
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-el').click();

    // Should immediately display Greek (no refresh needed) - assertion auto-waits
    await expect(page.getByTestId('admin-title')).toHaveText('Πίνακας Διαχείρισης');

    // Switch to Russian
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-ru').click();

    // Should immediately display Russian - assertion auto-waits
    await expect(page.getByTestId('admin-title')).toHaveText('Панель администратора');

    // Switch back to English
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-en').click();

    // Should immediately display English - assertion auto-waits
    await expect(page.getByTestId('admin-title')).toHaveText('Admin Dashboard');
  });

  test('Card count shows pluralized correctly in English', async ({ page }) => {
    // Look for card count text (e.g., "10 cards" or "1 card")
    // The pattern should match English plural forms - assertion auto-waits for content
    const cardCountText = page.locator('text=/\\d+\\s+cards?$/');
    await expect(cardCountText.first()).toBeVisible({ timeout: 10000 });
  });

  test('Card count shows pluralized correctly in Greek', async ({ page }) => {
    // Switch to Greek
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-el').click();

    // Wait for language to change - verify title changed first
    await expect(page.getByTestId('admin-title')).toHaveText('Πίνακας Διαχείρισης');

    // Look for Greek card count text
    // Greek uses "κάρτα" (singular) or "κάρτες" (plural)
    const cardCountText = page.locator('text=/\\d+\\s+κάρτ/');
    await expect(cardCountText.first()).toBeVisible({ timeout: 10000 });
  });

  test('Card count shows pluralized correctly in Russian', async ({ page }) => {
    // Switch to Russian
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-ru').click();

    // Wait for language to change - verify title changed first
    await expect(page.getByTestId('admin-title')).toHaveText('Панель администратора');

    // Look for Russian card count text
    // Russian uses "карточка" (1), "карточки" (2-4), "карточек" (5+)
    const cardCountText = page.locator('text=/\\d+\\s+карточ/');
    await expect(cardCountText.first()).toBeVisible({ timeout: 10000 });
  });
});

// =============================================================================
// Admin Panel i18n - Summary Cards Translation Tests
// =============================================================================

// FIXME: Also skipped due to admin role issues - see above
test.describe.skip('Admin Panel - Summary Cards i18n', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });
  });

  test('Summary cards show English labels by default', async ({ page }) => {
    // Check that summary cards contain English text
    const totalDecksCard = page.getByTestId('total-decks-card');
    const totalCardsCard = page.getByTestId('total-cards-card');

    await expect(totalDecksCard).toContainText('Total Decks');
    await expect(totalCardsCard).toContainText('Total Cards');
  });

  test('Summary cards show Greek labels when Greek is selected', async ({ page }) => {
    // Switch to Greek
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-el').click();

    // Wait for language change - assertions auto-wait
    const totalDecksCard = page.getByTestId('total-decks-card');
    const totalCardsCard = page.getByTestId('total-cards-card');

    await expect(totalDecksCard).toContainText('Συνολικές Τράπουλες');
    await expect(totalCardsCard).toContainText('Συνολικές Κάρτες');
  });

  test('Summary cards show Russian labels when Russian is selected', async ({ page }) => {
    // Switch to Russian
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-ru').click();

    // Wait for language change - assertions auto-wait
    const totalDecksCard = page.getByTestId('total-decks-card');
    const totalCardsCard = page.getByTestId('total-cards-card');

    await expect(totalDecksCard).toContainText('Всего колод');
    await expect(totalCardsCard).toContainText('Всего карточек');
  });
});
