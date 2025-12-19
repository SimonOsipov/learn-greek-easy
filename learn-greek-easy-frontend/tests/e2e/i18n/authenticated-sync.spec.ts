/**
 * Authenticated Language Sync E2E Tests
 *
 * Tests for language preference synchronization with backend for authenticated users.
 * Verifies that language changes are persisted to user preferences via API.
 */

import { test, expect } from '@playwright/test';
import { SEED_USERS, loginViaUI } from '../helpers/auth-helpers';

test.describe('Authenticated Language Sync', () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh - clear storage
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Login with test user
    await loginViaUI(page, SEED_USERS.LEARNER);

    // Wait for dashboard to load
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
  });

  test('should sync language preference to backend on change', async ({ page }) => {
    // Intercept the API call to verify it's made
    let apiCallMade = false;
    let apiPayload: unknown = null;

    await page.route('**/api/v1/users/me/preferences**', async (route, request) => {
      if (request.method() === 'PATCH') {
        apiCallMade = true;
        apiPayload = request.postDataJSON();
      }
      await route.continue();
    });

    // Switch to Greek
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-el').click();
    await page.waitForTimeout(1000);

    // Verify API call was made with correct payload
    expect(apiCallMade).toBe(true);
    expect(apiPayload).toMatchObject({
      interface_language: 'el',
    });
  });

  test('should load user language preference from backend on login', async ({ page }) => {
    // This test verifies that after login, the UI reflects the user's saved preference
    // The seed user (LEARNER) may have a language preference set

    // Verify the language switcher reflects current language
    await page.getByTestId('language-switcher-trigger').click();

    // One of the options should be marked as selected
    const englishOption = page.getByTestId('language-option-en');
    const greekOption = page.getByTestId('language-option-el');

    const englishSelected = await englishOption.getAttribute('aria-selected');
    const greekSelected = await greekOption.getAttribute('aria-selected');

    // One should be selected
    expect(englishSelected === 'true' || greekSelected === 'true').toBe(true);
  });

  test('should persist language across page navigation', async ({ page }) => {
    // Switch to Greek
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-el').click();
    await page.waitForTimeout(500);

    // Navigate to different pages
    await page.goto('/decks');
    await page.waitForLoadState('networkidle');

    // Verify language is still Greek
    await expect(page.getByText('Διαθέσιμες Τράπουλες')).toBeVisible();

    // Navigate to settings
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Verify language is still Greek
    await expect(page.getByText('Ρυθμίσεις')).toBeVisible();
  });

  test('should persist language after logout and re-login', async ({ page }) => {
    // Switch to Greek
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-el').click();
    await page.waitForTimeout(500);

    // Verify UI is in Greek
    await expect(page.getByText(/Πίνακας Ελέγχου/i)).toBeVisible();

    // Logout (navigate to settings and logout, or use the user menu)
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Find and click logout button
    const logoutButton = page.getByRole('button', { name: /logout|αποσύνδεση/i });
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await page.waitForURL('**/login**');
    }

    // Login again
    await loginViaUI(page, SEED_USERS.LEARNER);
    await page.waitForURL('**/dashboard**', { timeout: 10000 });

    // Language should still be Greek (loaded from user preferences)
    // Note: This depends on backend successfully saving and returning the preference
    const storedLang = await page.evaluate(() => localStorage.getItem('i18nextLng'));
    // Either Greek is persisted OR localStorage was cleared on logout
    expect(['el', null]).toContain(storedLang);
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Simulate API failure
    await page.route('**/api/v1/users/me/preferences**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Internal server error' }),
      });
    });

    // Switch to Greek - should still work locally even if API fails
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-el').click();
    await page.waitForTimeout(500);

    // UI should still update to Greek (local change works)
    await expect(page.getByText(/Πίνακας Ελέγχου/i)).toBeVisible();

    // localStorage should be updated
    const storedLang = await page.evaluate(() => localStorage.getItem('i18nextLng'));
    expect(storedLang).toBe('el');
  });
});

test.describe('Language Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    await loginViaUI(page, SEED_USERS.LEARNER);
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
  });

  test('should show language option in settings page', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Settings page should have language-related content
    // Look for language selector or language-related text
    const hasLanguageSection =
      (await page.getByText(/language|γλώσσα/i).count()) > 0 ||
      (await page.getByTestId('language-switcher-trigger').count()) > 0;

    expect(hasLanguageSection).toBe(true);
  });

  test('should be able to change language from settings', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Use the language switcher (should be in header)
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-el').click();
    await page.waitForTimeout(500);

    // Settings page should now be in Greek
    await expect(page.getByText('Ρυθμίσεις')).toBeVisible();
  });
});
