/**
 * Accessibility Tests with Axe-core
 * Automated WCAG 2.1 AA compliance testing
 *
 * Test Organization:
 * - Public Pages: Use empty storageState to test unauthenticated pages (login, register)
 * - Protected Pages: Use default storageState (learner user) from config
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * PUBLIC PAGES - UNAUTHENTICATED TESTS
 *
 * These tests use empty storageState to ensure no user is logged in.
 * This is required for testing login/register pages and their accessibility.
 */
test.describe('Accessibility - Public Pages', () => {
  // Override storageState to be empty (no auth)
  test.use({ storageState: { cookies: [], origins: [] } });

  test('Login page should have no accessibility violations', async ({ page }) => {
    await page.goto('/login');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['landmark-one-main', 'page-has-heading-one', 'region']) // Best-practice, not WCAG AA
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Register page should have no accessibility violations', async ({ page }) => {
    await page.goto('/register');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['landmark-one-main', 'page-has-heading-one', 'region'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Form inputs should have accessible labels', async ({ page }) => {
    await page.goto('/login');

    // Check email input has accessible name using test ID
    const emailInput = page.getByTestId('email-input');
    await expect(emailInput).toBeVisible();

    // Get accessible name
    const emailName = await emailInput.evaluate((el: HTMLInputElement) => {
      const label = document.querySelector(`label[for="${el.id}"]`);
      return label?.textContent || el.getAttribute('aria-label') || '';
    });
    expect(emailName.length).toBeGreaterThan(0);

    // Check password input has accessible name using test ID
    const passwordInput = page.getByTestId('password-input');
    await expect(passwordInput).toBeVisible();

    const passwordName = await passwordInput.evaluate((el: HTMLInputElement) => {
      const label = document.querySelector(`label[for="${el.id}"]`);
      return label?.textContent || el.getAttribute('aria-label') || '';
    });
    expect(passwordName.length).toBeGreaterThan(0);
  });

  test('Buttons should have accessible names', async ({ page }) => {
    await page.goto('/login');

    // Just verify button exists and is accessible using test ID
    const loginButton = page.getByTestId('login-submit');
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toBeEnabled();

    // Verify it has text content
    const buttonText = await loginButton.textContent();
    expect(buttonText).toBeTruthy();
  });

  test('Error messages should be announced to screen readers', async ({ page }) => {
    await page.goto('/login');

    // Fill invalid credentials using test IDs
    await page.getByTestId('email-input').fill('invalid@example.com');
    await page.getByTestId('password-input').fill('wrong');

    // Submit form using test ID
    const submitButton = page.getByTestId('login-submit');
    await submitButton.click();

    // Wait for error message (may take a moment)
    await page.waitForTimeout(1000);

    // Check for error display (toast or inline error)
    const hasError = await page.locator('[role="alert"], .text-destructive, .error').count();
    expect(hasError).toBeGreaterThan(0);
  });

  test('Color contrast should meet WCAG AA standards', async ({ page }) => {
    await page.goto('/login');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .disableRules(['landmark-one-main', 'page-has-heading-one', 'region'])
      .analyze();

    // Find color contrast violations specifically
    const contrastViolations = accessibilityScanResults.violations.filter((v) =>
      v.id.includes('color-contrast')
    );

    expect(contrastViolations).toEqual([]);
  });

  test('Landing page should have no accessibility violations', async ({ page }) => {
    await page.goto('/');

    // Wait for landing page to load
    await expect(page.getByTestId('landing-page')).toBeVisible({ timeout: 10000 });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['landmark-one-main', 'page-has-heading-one', 'region'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Landing page color contrast should meet WCAG AA', async ({ page }) => {
    await page.goto('/');

    // Wait for landing page to load
    await expect(page.getByTestId('landing-page')).toBeVisible({ timeout: 10000 });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .disableRules(['landmark-one-main', 'page-has-heading-one', 'region'])
      .analyze();

    const contrastViolations = accessibilityScanResults.violations.filter((v) =>
      v.id.includes('color-contrast')
    );

    expect(contrastViolations).toEqual([]);
  });
});

/**
 * PROTECTED PAGES - AUTHENTICATED TESTS
 *
 * These tests use the default storageState from config (learner user).
 * The storageState is loaded BEFORE the test starts, so the user is
 * already authenticated when the browser opens.
 */
test.describe('Accessibility - Protected Pages', () => {
  // Uses default storageState from config (learner user)

  // ENABLED: Now uses seed data from E2E database seeding infrastructure (SEED-10)
  test('Dashboard should have no accessibility violations', async ({ page }) => {
    await page.goto('/');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['landmark-one-main', 'page-has-heading-one', 'region'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Decks page should have no accessibility violations', async ({ page }) => {
    await page.goto('/decks');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['landmark-one-main', 'page-has-heading-one', 'region'])
      .exclude('[data-a11y-ignore="color-contrast"]') // Exclude decorative build hash indicator
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Review session should have no accessibility violations', async ({ page }) => {
    await page.goto('/decks');

    // Wait for decks page React content to load (not LCP shell)
    await expect(page.locator('[data-testid="decks-title"]')).toBeVisible({ timeout: 10000 });

    // Look for Greek vocabulary deck
    const deckHeading = page.getByRole('heading', { name: /greek.*vocabulary/i });

    // Only run if deck exists
    if (await deckHeading.count() > 0) {
      await deckHeading.click();

      // Wait for review button
      const startReviewButton = page.getByRole('button', { name: /start review/i });
      if (await startReviewButton.count() > 0) {
        await startReviewButton.click();

        // Wait for review interface to load
        await page.waitForTimeout(1000);

        const accessibilityScanResults = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .disableRules(['landmark-one-main', 'page-has-heading-one', 'region'])
          .analyze();

        expect(accessibilityScanResults.violations).toEqual([]);
      }
    }
  });

  test('Modals should have proper ARIA attributes', async ({ page }) => {
    await page.goto('/profile');

    // Wait for profile page to load
    await expect(page.getByTestId('profile-page')).toBeVisible({ timeout: 10000 });

    // Click on Security tab to access delete account button
    await page.getByRole('button', { name: /security/i }).click();

    // Wait for security section to load
    await expect(page.getByTestId('security-section')).toBeVisible({ timeout: 5000 });

    // Look for delete account button
    const deleteButton = page.getByRole('button', { name: /delete account/i });

    // Only run test if button exists
    if (await deleteButton.count() > 0) {
      await deleteButton.click();

      // Check dialog has role="dialog"
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Check aria-labelledby or aria-label
      const hasAccessibleName = await dialog.evaluate((el) => {
        return el.hasAttribute('aria-labelledby') || el.hasAttribute('aria-label');
      });
      expect(hasAccessibleName).toBe(true);
    }
  });
});
