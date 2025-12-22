/**
 * Authenticated Pages Visual Tests
 *
 * Visual regression tests for pages that require authentication.
 * These tests use mock auth via localStorage to access protected routes.
 */

import { test, expect } from '@chromatic-com/playwright';
import {
  takeSnapshot,
  loginForVisualTest,
  waitForPageReady,
} from './helpers/visual-helpers';

test.describe('Authenticated Pages Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up authentication before each test
    await loginForVisualTest(page);
  });

  test('Dashboard Page', async ({ page }, testInfo) => {
    await page.goto('/');
    await waitForPageReady(page);

    // Wait for dashboard content to load
    await expect(page.getByRole('heading').first()).toBeVisible();
    await takeSnapshot(page, 'Dashboard Page', testInfo);
  });

  test('Decks Page', async ({ page }, testInfo) => {
    await page.goto('/decks');
    await waitForPageReady(page);

    // Wait for deck list to load
    await expect(page.getByRole('heading', { name: /decks/i })).toBeVisible();
    await page.waitForTimeout(1000); // Wait for deck cards to render
    await takeSnapshot(page, 'Decks Page', testInfo);
  });

  test('Profile Page', async ({ page }, testInfo) => {
    await page.goto('/profile');
    await waitForPageReady(page);

    // Wait for profile content
    await expect(page.getByTestId('profile-page')).toBeVisible();
    await takeSnapshot(page, 'Profile Page', testInfo);
  });

  test('Profile Page - Preferences Tab', async ({ page }, testInfo) => {
    await page.goto('/profile');
    await waitForPageReady(page);

    // Wait for profile content
    await expect(page.getByTestId('profile-page')).toBeVisible();

    // Navigate to Preferences tab
    await page.getByRole('button', { name: /preferences/i }).click();

    // Wait for preferences section to load
    await expect(page.getByTestId('preferences-section')).toBeVisible();
    await page.waitForTimeout(500); // Allow any animations to complete

    await takeSnapshot(page, 'Profile Page - Preferences Tab', testInfo);
  });

  test('Profile Page - Preferences Tab - Intensive Goal', async ({ page }, testInfo) => {
    await page.goto('/profile');
    await waitForPageReady(page);

    // Wait for profile content
    await expect(page.getByTestId('profile-page')).toBeVisible();

    // Navigate to Preferences tab
    await page.getByRole('button', { name: /preferences/i }).click();

    // Wait for preferences section to load
    await expect(page.getByTestId('preferences-section')).toBeVisible();

    // Set slider to intensive value (90 minutes)
    const slider = page.getByTestId('daily-goal-slider');
    await slider.fill('90');

    // Wait for UI to update
    await page.waitForTimeout(500);

    await takeSnapshot(page, 'Profile Page - Preferences Tab - Intensive Goal', testInfo);
  });

  test('Statistics Page', async ({ page }, testInfo) => {
    await page.goto('/statistics');
    await waitForPageReady(page);

    // Wait for statistics content
    await expect(page.getByTestId('statistics-page')).toBeVisible();
    await page.waitForTimeout(1000); // Wait for charts to render
    await takeSnapshot(page, 'Statistics Page', testInfo);
  });

  test('Settings Page', async ({ page }, testInfo) => {
    await page.goto('/settings');
    await waitForPageReady(page);

    // Wait for settings content
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
    await takeSnapshot(page, 'Settings Page', testInfo);
  });
});
