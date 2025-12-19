/**
 * Language Switcher E2E Tests
 *
 * Tests for the language switcher component functionality.
 * Tests both unauthenticated (login page) and authenticated scenarios.
 */

import { test, expect } from '@playwright/test';
import { SEED_USERS, loginViaUI } from '../helpers/auth-helpers';

/**
 * UNAUTHENTICATED TESTS
 *
 * Tests language switching on the login page (no auth required)
 */
test.describe('Language Switcher - Unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    // Clear localStorage and navigate to login
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
  });

  test('should display language switcher in header', async ({ page }) => {
    // Language switcher should be visible in header
    await expect(page.getByTestId('language-switcher-trigger')).toBeVisible();
  });

  test('should open dropdown with language options', async ({ page }) => {
    // Click language switcher
    await page.getByTestId('language-switcher-trigger').click();

    // Menu should be visible
    await expect(page.getByTestId('language-switcher-menu')).toBeVisible();

    // Both language options should be available
    await expect(page.getByTestId('language-option-en')).toBeVisible();
    await expect(page.getByTestId('language-option-el')).toBeVisible();
  });

  test('should show English and Greek options with correct labels', async ({ page }) => {
    await page.getByTestId('language-switcher-trigger').click();

    // Check for English option
    const englishOption = page.getByTestId('language-option-en');
    await expect(englishOption).toBeVisible();
    await expect(englishOption).toContainText('English');

    // Check for Greek option
    const greekOption = page.getByTestId('language-option-el');
    await expect(greekOption).toBeVisible();
    await expect(greekOption).toContainText('Ελληνικά');
  });

  test('should switch UI to Greek when Greek is selected', async ({ page }) => {
    // Verify starting in English
    await expect(page.getByText('Welcome Back')).toBeVisible();

    // Switch to Greek
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-el').click();

    // Wait for language change
    await page.waitForTimeout(500);

    // Verify UI updated to Greek
    await expect(page.getByText('Καλώς Ήρθατε')).toBeVisible();
  });

  test('should switch UI back to English when English is selected', async ({ page }) => {
    // First switch to Greek
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-el').click();
    await page.waitForTimeout(500);

    // Verify Greek
    await expect(page.getByText('Καλώς Ήρθατε')).toBeVisible();

    // Switch back to English
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-en').click();
    await page.waitForTimeout(500);

    // Verify English
    await expect(page.getByText('Welcome Back')).toBeVisible();
  });

  test('should persist language choice in localStorage', async ({ page }) => {
    // Switch to Greek
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-el').click();
    await page.waitForTimeout(500);

    // Verify localStorage updated
    const storedLang = await page.evaluate(() => localStorage.getItem('i18nextLng'));
    expect(storedLang).toBe('el');
  });

  test('should persist language choice after page reload', async ({ page }) => {
    // Switch to Greek
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-el').click();
    await page.waitForTimeout(500);

    // Reload page
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Should still be in Greek
    await expect(page.getByText('Καλώς Ήρθατε')).toBeVisible();
  });

  test('should mark current language as selected in dropdown', async ({ page }) => {
    // Open dropdown
    await page.getByTestId('language-switcher-trigger').click();

    // English should be marked as selected (aria-selected)
    const englishOption = page.getByTestId('language-option-en');
    await expect(englishOption).toHaveAttribute('aria-selected', 'true');
  });
});

/**
 * AUTHENTICATED TESTS
 *
 * Tests language switching for logged-in users.
 * Uses default storageState (authenticated user).
 */
test.describe('Language Switcher - Authenticated', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard (will redirect to login if not authenticated)
    await page.goto('/');

    // Wait for auth check
    await page.waitForLoadState('networkidle');

    // If on login page, we need to login
    if (page.url().includes('/login')) {
      await loginViaUI(page, SEED_USERS.LEARNER);
    }
  });

  test('should display language switcher when authenticated', async ({ page }) => {
    await expect(page.getByTestId('language-switcher-trigger')).toBeVisible();
  });

  test('should switch language on authenticated pages', async ({ page }) => {
    // Verify starting in English (Dashboard)
    await expect(page.getByText('Dashboard')).toBeVisible();

    // Switch to Greek
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-el').click();
    await page.waitForTimeout(500);

    // Verify dashboard is now in Greek
    await expect(page.getByText(/Πίνακας Ελέγχου/i)).toBeVisible();
  });

  test('should maintain language when navigating between pages', async ({ page }) => {
    // Switch to Greek
    await page.getByTestId('language-switcher-trigger').click();
    await page.getByTestId('language-option-el').click();
    await page.waitForTimeout(500);

    // Navigate to decks page
    await page.goto('/decks');
    await page.waitForLoadState('networkidle');

    // Decks page should be in Greek
    await expect(page.getByText('Διαθέσιμες Τράπουλες')).toBeVisible();

    // Navigate to settings
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Settings should be in Greek
    await expect(page.getByText('Ρυθμίσεις')).toBeVisible();
  });
});

/**
 * ACCESSIBILITY TESTS
 */
test.describe('Language Switcher - Accessibility', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    // Focus on language switcher trigger
    const trigger = page.getByTestId('language-switcher-trigger');
    await trigger.focus();

    // Press Enter to open dropdown
    await page.keyboard.press('Enter');

    // Menu should be visible
    await expect(page.getByTestId('language-switcher-menu')).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');

    // Menu should be hidden
    await expect(page.getByTestId('language-switcher-menu')).toBeHidden();
  });

  test('should have accessible aria-label', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    const trigger = page.getByTestId('language-switcher-trigger');
    const ariaLabel = await trigger.getAttribute('aria-label');

    // Should have an aria-label for screen readers
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel?.toLowerCase()).toContain('language');
  });
});
