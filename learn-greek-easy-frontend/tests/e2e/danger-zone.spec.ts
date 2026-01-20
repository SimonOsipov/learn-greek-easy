/**
 * E2E Tests: Danger Zone Flows
 *
 * Tests the danger zone functionality in the profile security section:
 * - Reset Progress confirmation and cancellation
 * - Delete Account with typed confirmation
 * - Error handling for API failures
 *
 * Uses route mocking to avoid actual data changes during tests.
 */

import { test, expect } from '@playwright/test';
import { verifyAuthSucceeded } from './helpers/auth-helpers';

test.describe('Danger Zone - Reset Progress', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to profile page
    await page.goto('/profile');
    await verifyAuthSucceeded(page, '/profile');
    await expect(page.getByTestId('profile-page')).toBeVisible({ timeout: 15000 });

    // Navigate to Security tab
    const securityTab = page.getByRole('button', { name: /security/i });
    await securityTab.click();
    await expect(page.getByTestId('security-section')).toBeVisible({ timeout: 10000 });
  });

  test('E2E-DANGER-01: Reset Progress confirms and redirects to dashboard', async ({ page }) => {
    // Mock the reset progress API to return success
    await page.route('**/api/v1/users/me/reset-progress', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({ status: 204 });
      } else {
        route.continue();
      }
    });

    // Click the Reset Progress button
    const resetButton = page.getByTestId('reset-progress-button');
    await resetButton.click();

    // Verify modal opens
    const modal = page.getByTestId('reset-progress-modal');
    await expect(modal).toBeVisible();

    // Verify modal title is visible
    await expect(page.getByTestId('reset-progress-title')).toBeVisible();

    // Click confirm button
    const confirmButton = page.getByTestId('reset-confirm-button');
    await confirmButton.click();

    // Verify redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('E2E-DANGER-02: Reset Progress cancel closes modal', async ({ page }) => {
    // Click the Reset Progress button
    const resetButton = page.getByTestId('reset-progress-button');
    await resetButton.click();

    // Verify modal opens
    const modal = page.getByTestId('reset-progress-modal');
    await expect(modal).toBeVisible();

    // Click cancel button
    const cancelButton = page.getByTestId('reset-cancel-button');
    await cancelButton.click();

    // Verify modal closes
    await expect(modal).toBeHidden();

    // Verify still on profile page
    await expect(page).toHaveURL(/\/profile/);
  });

  test('E2E-DANGER-06: Reset Progress shows error on API failure', async ({ page }) => {
    // Mock the reset progress API to return error
    await page.route('**/api/v1/users/me/reset-progress', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Server error' }),
        });
      } else {
        route.continue();
      }
    });

    // Click the Reset Progress button
    const resetButton = page.getByTestId('reset-progress-button');
    await resetButton.click();

    // Verify modal opens
    const modal = page.getByTestId('reset-progress-modal');
    await expect(modal).toBeVisible();

    // Click confirm button
    const confirmButton = page.getByTestId('reset-confirm-button');
    await confirmButton.click();

    // Verify error is displayed
    const errorElement = page.getByTestId('reset-error');
    await expect(errorElement).toBeVisible({ timeout: 5000 });

    // Verify modal stays open
    await expect(modal).toBeVisible();
  });
});

test.describe('Danger Zone - Delete Account', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to profile page
    await page.goto('/profile');
    await verifyAuthSucceeded(page, '/profile');
    await expect(page.getByTestId('profile-page')).toBeVisible({ timeout: 15000 });

    // Navigate to Security tab
    const securityTab = page.getByRole('button', { name: /security/i });
    await securityTab.click();
    await expect(page.getByTestId('security-section')).toBeVisible({ timeout: 10000 });
  });

  test('E2E-DANGER-03: Delete Account with correct word succeeds', async ({ page }) => {
    // Mock the delete account API to return success
    await page.route('**/api/v1/users/me', (route) => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({ status: 204 });
      } else {
        route.continue();
      }
    });

    // Click the Delete Account button
    const deleteButton = page.getByTestId('delete-account-button');
    await deleteButton.click();

    // Verify modal opens
    const modal = page.getByTestId('delete-account-modal');
    await expect(modal).toBeVisible();

    // Verify modal title is visible
    await expect(page.getByTestId('delete-account-title')).toBeVisible();

    // Verify confirm button is disabled initially
    const confirmButton = page.getByTestId('delete-confirm-button');
    await expect(confirmButton).toBeDisabled();

    // Type the confirmation word "DELETE"
    const confirmInput = page.getByTestId('delete-confirmation-input');
    await confirmInput.fill('DELETE');

    // Verify confirm button is now enabled
    await expect(confirmButton).toBeEnabled();

    // Click confirm button
    await confirmButton.click();

    // Verify redirect happens (logout redirects to / or /login)
    // The logout function clears auth and redirects
    // Wait for the page to redirect away from /profile
    await page.waitForURL((url) => !url.pathname.includes('/profile'), { timeout: 10000 });
  });

  test('E2E-DANGER-04: Delete Account wrong word keeps button disabled', async ({ page }) => {
    // Click the Delete Account button
    const deleteButton = page.getByTestId('delete-account-button');
    await deleteButton.click();

    // Verify modal opens
    const modal = page.getByTestId('delete-account-modal');
    await expect(modal).toBeVisible();

    const confirmButton = page.getByTestId('delete-confirm-button');
    const confirmInput = page.getByTestId('delete-confirmation-input');

    // Test lowercase "delete" - button should be disabled
    await confirmInput.fill('delete');
    await expect(confirmButton).toBeDisabled();

    // Test partial "DEL" - button should be disabled
    await confirmInput.fill('DEL');
    await expect(confirmButton).toBeDisabled();

    // Test wrong word "REMOVE" - button should be disabled
    await confirmInput.fill('REMOVE');
    await expect(confirmButton).toBeDisabled();

    // Test correct word "DELETE" - button should be enabled
    await confirmInput.fill('DELETE');
    await expect(confirmButton).toBeEnabled();
  });

  test('E2E-DANGER-05: Delete Account cancel closes modal and clears input', async ({ page }) => {
    // Click the Delete Account button
    const deleteButton = page.getByTestId('delete-account-button');
    await deleteButton.click();

    // Verify modal opens
    const modal = page.getByTestId('delete-account-modal');
    await expect(modal).toBeVisible();

    // Type some text
    const confirmInput = page.getByTestId('delete-confirmation-input');
    await confirmInput.fill('some text');
    await expect(confirmInput).toHaveValue('some text');

    // Click cancel button
    const cancelButton = page.getByTestId('delete-cancel-button');
    await cancelButton.click();

    // Verify modal closes
    await expect(modal).toBeHidden();

    // Reopen modal
    await deleteButton.click();
    await expect(modal).toBeVisible();

    // Verify input is empty
    const newInput = page.getByTestId('delete-confirmation-input');
    await expect(newInput).toHaveValue('');
  });
});
