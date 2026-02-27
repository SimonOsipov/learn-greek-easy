/**
 * E2E Tests: Dark Mode Theme Flows
 *
 * Tests the dark mode functionality including:
 * - Guest theme toggle on landing page
 * - Theme persistence in localStorage
 * - Authenticated theme persistence
 * - Settings page theme changes
 * - Theme persistence on logout
 *
 * Test Organization:
 * - Unauthenticated: Tests guest user theme toggle and persistence
 * - Authenticated: Tests logged-in user theme functionality
 *
 * Note: Visual regression tests are handled by Chromatic, not Playwright screenshots.
 */

import { test, expect } from '@playwright/test';
import { verifyAuthSucceeded } from './helpers/auth-helpers';

/**
 * UNAUTHENTICATED TESTS - Guest Theme Toggle
 *
 * These tests use empty storageState to ensure no user is logged in.
 * Tests the public landing page theme toggle functionality.
 */
test.describe('Dark Mode - Guest Theme Toggle on Landing Page', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('DM-01: should toggle theme from light to dark', async ({ page }) => {
    // Clear localStorage at the start
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Wait for landing page to load
    await expect(page.getByTestId('landing-page')).toBeVisible({ timeout: 15000 });

    // Initially should be light mode (no dark class on html)
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    // Click theme switcher
    const themeSwitcher = page.getByTestId('theme-switcher');
    await expect(themeSwitcher).toBeVisible();
    await themeSwitcher.click();

    // Should now be dark mode
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Click again to toggle back to light
    await themeSwitcher.click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('DM-02: should persist theme preference in localStorage', async ({ page }) => {
    // Clear localStorage at the start
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Wait for landing page to load
    await expect(page.getByTestId('landing-page')).toBeVisible({ timeout: 15000 });

    // Initially should be light
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    // Toggle to dark
    await page.getByTestId('theme-switcher').click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Check localStorage
    const theme = await page.evaluate(() => localStorage.getItem('theme'));
    expect(theme).toBe('dark');
  });

  test('DM-03: should persist theme after page reload', async ({ page }) => {
    // Clear localStorage at the start
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Wait for landing page
    await expect(page.getByTestId('landing-page')).toBeVisible({ timeout: 15000 });

    // Toggle to dark
    await page.getByTestId('theme-switcher').click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Reload page (without clearing localStorage this time)
    await page.reload();

    // Wait for page to load again
    await expect(page.getByTestId('landing-page')).toBeVisible({ timeout: 15000 });

    // Should still be dark mode
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('DM-04: should not flash wrong theme on reload', async ({ page }) => {
    // Set dark theme before navigating
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('theme', 'dark'));
    await page.reload();

    // Wait for landing page
    await expect(page.getByTestId('landing-page')).toBeVisible({ timeout: 15000 });

    // Should be dark immediately (no flash to light mode)
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});

/**
 * AUTHENTICATED TESTS - Theme Persistence
 *
 * Tests theme functionality for logged-in users.
 * Uses default storageState from config (learner user).
 */
test.describe('Dark Mode - Authenticated Theme Persistence', () => {
  // Uses default storageState from config (learner user)

  test('DM-05: should toggle theme when logged in', async ({ page }) => {
    // Clear theme at the start
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');
    await page.evaluate(() => localStorage.removeItem('theme'));
    await page.reload();

    // Fail fast if auth failed
    await verifyAuthSucceeded(page, '/dashboard');

    // Wait for dashboard to load
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
      timeout: 15000,
    });

    // Initially should be light mode
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    // Toggle theme
    const themeSwitcher = page.getByTestId('theme-switcher');
    await expect(themeSwitcher).toBeVisible();
    await themeSwitcher.click();

    // Should now be dark mode
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('DM-06: should persist theme after reload when authenticated', async ({ page }) => {
    // Clear theme at the start
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');
    await page.evaluate(() => localStorage.removeItem('theme'));
    await page.reload();
    await verifyAuthSucceeded(page, '/dashboard');

    // Wait for dashboard to load
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
      timeout: 15000,
    });

    // Toggle to dark
    await page.getByTestId('theme-switcher').click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Reload page (without clearing theme)
    await page.reload();

    // Verify auth and wait for dashboard
    await verifyAuthSucceeded(page, '/dashboard');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
      timeout: 15000,
    });

    // Theme should persist
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});

/**
 * SETTINGS PAGE TESTS - Theme Change from Preferences
 *
 * Tests changing theme from the profile settings page.
 */
test.describe('Dark Mode - Settings Page Theme Change', () => {
  /**
   * Helper to navigate to preferences section
   */
  async function navigateToPreferences(page: import('@playwright/test').Page) {
    await page.goto('/profile');
    await verifyAuthSucceeded(page, '/profile');
    await page.evaluate(() => localStorage.removeItem('theme'));
    await page.reload();
    await verifyAuthSucceeded(page, '/profile');

    // Wait for profile page content
    await expect(page.getByTestId('profile-page')).toBeVisible({ timeout: 15000 });

    // Navigate to Preferences tab
    const preferencesTab = page.getByRole('button', { name: /preferences/i });
    await preferencesTab.click();

    // Wait for preferences section to load
    await expect(page.getByTestId('preferences-section')).toBeVisible({ timeout: 10000 });
  }

  test('DM-07: should display theme card in preferences', async ({ page }) => {
    await navigateToPreferences(page);

    // Verify theme card is visible
    const themeCard = page.getByTestId('theme-card');
    await expect(themeCard).toBeVisible();

    // Verify both theme options are visible
    await expect(page.getByTestId('theme-option-light')).toBeVisible();
    await expect(page.getByTestId('theme-option-dark')).toBeVisible();
  });

  test('DM-08: should change theme when clicking dark theme option', async ({ page }) => {
    await navigateToPreferences(page);

    // Initially should be light mode
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    // Click dark theme option
    await page.getByTestId('theme-option-dark').click();

    // Should update immediately to dark mode
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('DM-09: should change theme when clicking light theme option', async ({ page }) => {
    await navigateToPreferences(page);

    // First set to dark mode
    await page.getByTestId('theme-option-dark').click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Click light theme option
    await page.getByTestId('theme-option-light').click();

    // Should update to light mode
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('DM-10: should show checkmark on selected light theme', async ({ page }) => {
    await navigateToPreferences(page);

    // Ensure we're in light mode
    await page.getByTestId('theme-option-light').click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    // Light option should have 2 SVGs: Sun icon + Check icon
    const lightOption = page.getByTestId('theme-option-light');
    const lightIconCount = await lightOption.locator('svg').count();
    expect(lightIconCount).toBe(2);

    // Dark option should only have Moon icon (1), not Check + Moon (2)
    const darkOption = page.getByTestId('theme-option-dark');
    const darkCheckCount = await darkOption.locator('svg').count();
    expect(darkCheckCount).toBe(1);
  });

  test('DM-11: should show checkmark on selected dark theme', async ({ page }) => {
    await navigateToPreferences(page);

    // Set to dark mode
    await page.getByTestId('theme-option-dark').click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Dark option should have Moon icon + Check icon = 2 SVGs
    const darkOption = page.getByTestId('theme-option-dark');
    const darkIconCount = await darkOption.locator('svg').count();
    expect(darkIconCount).toBe(2);

    // Light option should NOT have checkmark (only Sun icon)
    const lightOption = page.getByTestId('theme-option-light');
    const lightIconCount = await lightOption.locator('svg').count();
    expect(lightIconCount).toBe(1);
  });
});

/**
 * LOGOUT PERSISTENCE TESTS - Theme Persists on Logout
 *
 * Tests that theme preference is maintained after logging out.
 */
test.describe('Dark Mode - Theme Persists on Logout', () => {
  /**
   * Helper to perform logout via UI
   * The app redirects to / after logout, not /login
   */
  async function logoutViaUI(page: import('@playwright/test').Page) {
    // Open user menu dropdown
    const userMenuButton = page.getByTestId('user-menu-trigger');
    await userMenuButton.click();

    // Click logout button
    const logoutButton = page.getByTestId('logout-button');
    await logoutButton.click();

    // Wait for dialog and confirm
    const dialog = page.getByTestId('logout-dialog');
    await dialog.waitFor({ state: 'visible', timeout: 5000 });

    const confirmButton = page.getByTestId('logout-confirm-button');
    await confirmButton.click();

    // Wait for redirect to landing page
    await page.waitForURL('/');
  }

  test('DM-12: should keep theme after logout', async ({ page }) => {
    // Clear theme at the start
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');
    await page.evaluate(() => localStorage.removeItem('theme'));
    await page.reload();
    await verifyAuthSucceeded(page, '/dashboard');

    // Wait for dashboard to load
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
      timeout: 15000,
    });

    // Set to dark theme
    await page.getByTestId('theme-switcher').click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Logout via UI
    await logoutViaUI(page);

    // Should be on landing page (app redirects to / after logout)
    await expect(page.getByTestId('landing-page')).toBeVisible({ timeout: 10000 });

    // Theme should still be dark after logout
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Verify localStorage still has dark theme
    const theme = await page.evaluate(() => localStorage.getItem('theme'));
    expect(theme).toBe('dark');
  });

  test('DM-13: should keep light theme after logout if set to light', async ({ page }) => {
    // Clear theme at the start
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');
    await page.evaluate(() => localStorage.removeItem('theme'));
    await page.reload();
    await verifyAuthSucceeded(page, '/dashboard');

    // Wait for dashboard to load
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
      timeout: 15000,
    });

    // Start in dark mode
    await page.getByTestId('theme-switcher').click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Switch back to light mode
    await page.getByTestId('theme-switcher').click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    // Logout via UI
    await logoutViaUI(page);

    // Should be on landing page
    await expect(page.getByTestId('landing-page')).toBeVisible({ timeout: 10000 });

    // Wait for any theme transition to complete before asserting
    await expect(page.locator('html')).not.toHaveClass(/theme-transition/, { timeout: 5000 });

    // Theme should still be light after logout
    await expect(page.locator('html')).not.toHaveClass(/dark/, { timeout: 3000 });

    // Verify localStorage has light theme
    const theme = await page.evaluate(() => localStorage.getItem('theme'));
    expect(theme).toBe('light');
  });
});
