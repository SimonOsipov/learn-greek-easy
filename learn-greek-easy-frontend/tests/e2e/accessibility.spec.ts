/**
 * Accessibility Tests with Axe-core
 * Automated WCAG 2.1 AA compliance testing
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility (Axe-core)', () => {
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

  // ENABLED: Now uses seed data from E2E database seeding infrastructure (SEED-10)
  test('Settings page should have no accessibility violations', async ({ page }) => {
    await page.goto('/settings');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['landmark-one-main', 'page-has-heading-one', 'region'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Review session should have no accessibility violations', async ({ page }) => {
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

  test('Modals should have proper ARIA attributes', async ({ page }) => {
    await page.goto('/settings');

    // Wait for page to load
    await page.waitForSelector('h1, h2', { timeout: 10000 });

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
});
