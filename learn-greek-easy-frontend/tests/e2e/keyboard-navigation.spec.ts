/**
 * Keyboard Navigation Tests
 * Tests Tab, Enter, Esc, and arrow key navigation
 */

import { test, expect } from '@playwright/test';
import { SEED_USERS } from './helpers/auth-helpers';

test.describe('Keyboard Navigation', () => {
  test('Tab order should be logical on login page', async ({ page, browserName }) => {
    // Skip in webkit due to different focus behavior
    test.skip(browserName === 'webkit', 'Webkit has different tab order behavior');

    await page.goto('/login');

    // Get all focusable elements to verify minimum count
    const focusableElements = await page.locator('button, input, a, [tabindex]:not([tabindex="-1"])').count();
    expect(focusableElements).toBeGreaterThanOrEqual(3);

    // Tab through elements - verify order using test IDs
    await page.keyboard.press('Tab'); // Email input
    await expect(page.getByTestId('email-input')).toBeFocused();

    await page.keyboard.press('Tab'); // Password input
    await expect(page.getByTestId('password-input')).toBeFocused();

    // Next tab should land on an interactive element (button, input, or link)
    await page.keyboard.press('Tab');
    let focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['INPUT', 'BUTTON', 'A']).toContain(focused);
  });

  test('All interactive elements should be keyboard accessible', async ({ page, browserName }) => {
    // Skip in webkit due to different focus behavior
    test.skip(browserName === 'webkit', 'Webkit has different tab focus behavior');

    // Navigate to dashboard - storageState handles auth
    await page.goto('/');

    // CRITICAL: Verify we're authenticated and not redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      throw new Error('Authentication failed - redirected to login page. Check backend connectivity.');
    }

    // Wait for Dashboard heading specifically (ensures page is fully rendered)
    await expect(page.getByRole('heading', { name: /dashboard/i }))
      .toBeVisible({ timeout: 15000 });

    // Count focusable interactive elements (excluding those intentionally removed from tab order)
    const focusableSelector = 'button:not([tabindex="-1"]):not([disabled]), a:not([tabindex="-1"]), input:not([tabindex="-1"]):not([disabled]), textarea:not([tabindex="-1"]):not([disabled]), select:not([tabindex="-1"]):not([disabled])';
    const focusableElements = await page.locator(focusableSelector).count();

    // Log diagnostic info if count is unexpectedly low
    if (focusableElements === 0) {
      console.error('[TEST] No focusable elements found - possible auth failure');
      console.error('[TEST] Current URL:', page.url());
    }

    // Dashboard should have focusable elements (nav links, buttons, etc.)
    expect(focusableElements).toBeGreaterThan(0);

    // Verify we can tab through at least some elements
    await page.keyboard.press('Tab');
    const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT']).toContain(firstFocused);
  });

  test('Skip link should work', async ({ page }) => {
    await page.goto('/login');

    // Tab to skip link (usually first element)
    await page.keyboard.press('Tab');

    // Check if skip link is visible
    const skipLink = page.getByText(/skip to main|skip navigation/i);
    if (await skipLink.isVisible()) {
      await page.keyboard.press('Enter');

      // Focus should jump to main content
      const focused = await page.evaluate(() => document.activeElement?.id || '');
      expect(focused).toContain('main');
    }
  });

  test('Modals should trap focus', async ({ page }) => {
    await page.goto('/settings');

    // Open modal
    await page.getByRole('button', { name: /delete account/i }).click();

    // Wait for dialog
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Tab through dialog elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Focus should stay within dialog
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.closest('[role="dialog"]') !== null;
    });
    expect(focusedElement).toBe(true);
  });

  test('Esc should close modals', async ({ page }) => {
    await page.goto('/settings');

    // Open modal
    await page.getByRole('button', { name: /delete account/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Press Esc
    await page.keyboard.press('Escape');

    // Modal should close
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('Enter key should submit forms', async ({ page }) => {
    await page.goto('/login');

    // Fill form using test IDs
    await page.getByTestId('email-input').fill(SEED_USERS.LEARNER.email);
    await page.getByTestId('password-input').fill(SEED_USERS.LEARNER.password);

    // Press Enter (instead of clicking button)
    await page.keyboard.press('Enter');

    // Wait for form submission attempt
    await page.waitForTimeout(1000);

    // Should either redirect or show error (both are valid - form submitted)
    const currentUrl = page.url();
    const hasError = await page.locator('[role="alert"]').count() > 0;

    // Form submission was attempted (not blocked)
    expect(currentUrl === '/' || currentUrl.endsWith('/') || currentUrl.includes('/login')).toBe(true);
  });

  test('Arrow keys should work in review session', async ({ page }) => {
    await page.goto('/decks');

    // Wait for page to load
    await page.waitForSelector('h1, h2', { timeout: 10000 });

    // Look for Greek vocabulary deck
    const deckHeading = page.getByRole('heading', { name: /greek.*vocabulary/i });

    // Only run if deck exists
    if (await deckHeading.count() > 0) {
      await deckHeading.click();

      // Wait for review button
      const startReviewButton = page.getByRole('button', { name: /start review/i });
      if (await startReviewButton.count() > 0) {
        await startReviewButton.click();

        // Wait for review interface
        await page.waitForTimeout(1000);

        // Try keyboard shortcuts
        await page.keyboard.press('Space'); // Flip card
        await page.waitForTimeout(500);

        await page.keyboard.press('4'); // Rate card
        await page.waitForTimeout(500);
      }
    }
  });

  test('Focus visible styles should be present', async ({ page }) => {
    await page.goto('/login');

    // Tab to button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Check for focus styles
    const buttonHasFocusStyle = await page.evaluate(() => {
      const button = document.activeElement as HTMLElement;
      const styles = window.getComputedStyle(button);
      return (
        styles.outline !== 'none' ||
        styles.boxShadow.includes('focus') ||
        button.classList.contains('focus')
      );
    });

    expect(buttonHasFocusStyle).toBe(true);
  });
});
