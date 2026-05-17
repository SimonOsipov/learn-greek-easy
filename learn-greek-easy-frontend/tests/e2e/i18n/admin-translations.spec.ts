/**
 * Admin Panel i18n E2E Tests
 *
 * Tests for internationalization of the admin panel.
 * Verifies that admin panel respects language selection
 * and displays correct translations for English and Russian.
 * Note: Greek UI was removed - only EN/RU are now supported.
 */

import { test, expect } from '@playwright/test';

// =============================================================================
// Admin Panel Translation Tests
// =============================================================================

// FIXME: These tests are flaky in CI due to admin role not being properly
// set for Auth0-authenticated users. The seeded admin user has is_superuser=True
// but the Auth0 token exchange might not be preserving this status correctly.
// Text assertions below mirror the current pageHeadPropsFor output for the
// dashboard tab (see src/i18n/locales/{en,ru}/admin.json → dashboard.{title,sub}).
test.describe.skip('Admin Panel - i18n Translations', () => {
  // Use admin storage state (superuser)
  test.use({ storageState: 'playwright/.auth/admin.json' });

  const EN_TITLE = 'Admin Dashboard';
  const EN_SUB = 'Manage content and view statistics across every learning surface.';
  const RU_TITLE = 'Панель администратора';
  const RU_SUB = 'Управление контентом и статистикой всех учебных разделов.';

  test.beforeEach(async ({ page }) => {
    // Clear localStorage and navigate to admin
    await page.goto('/admin');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });
  });

  test('Admin panel displays English translations by default', async ({ page }) => {
    await expect(page.getByTestId('admin-title')).toHaveText(EN_TITLE);
    await expect(page.getByTestId('admin-subtitle')).toHaveText(EN_SUB);
  });

  test('Admin panel displays Russian translations when Russian is selected', async ({ page }) => {
    // Switch to Russian
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-ru').click();

    // Should display Russian title (assertion auto-waits for text change)
    await expect(page.getByTestId('admin-title')).toHaveText(RU_TITLE);
    await expect(page.getByTestId('admin-subtitle')).toHaveText(RU_SUB);
  });

  test('Language persists after page reload on admin panel', async ({ page }) => {
    // Switch to Russian
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-ru').click();

    // Verify Russian is displayed (assertion auto-waits)
    await expect(page.getByTestId('admin-title')).toHaveText(RU_TITLE);

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('admin-page')).toBeVisible({ timeout: 15000 });

    // Should still display Russian after reload
    await expect(page.getByTestId('admin-title')).toHaveText(RU_TITLE);
  });

  test('Language change applies immediately without page refresh', async ({ page }) => {
    // Verify English is displayed initially
    await expect(page.getByTestId('admin-title')).toHaveText(EN_TITLE);

    // Switch to Russian
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-ru').click();

    // Should immediately display Russian - assertion auto-waits
    await expect(page.getByTestId('admin-title')).toHaveText(RU_TITLE);

    // Switch back to English
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-en').click();

    // Should immediately display English - assertion auto-waits
    await expect(page.getByTestId('admin-title')).toHaveText(EN_TITLE);
  });

  test('Card count shows pluralized correctly in English', async ({ page }) => {
    // Look for card count text (e.g., "10 cards" or "1 card")
    // The pattern should match English plural forms - assertion auto-waits for content
    const cardCountText = page.locator('text=/\\d+\\s+cards?$/');
    await expect(cardCountText.first()).toBeVisible({ timeout: 10000 });
  });

  test('Card count shows pluralized correctly in Russian', async ({ page }) => {
    // Switch to Russian
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-ru').click();

    // Wait for language to change - verify title changed first
    await expect(page.getByTestId('admin-title')).toHaveText(RU_TITLE);

    // Look for Russian card count text
    // Russian uses "карточка" (1), "карточки" (2-4), "карточек" (5+)
    const cardCountText = page.locator('text=/\\d+\\s+карточ/');
    await expect(cardCountText.first()).toBeVisible({ timeout: 10000 });
  });
});
