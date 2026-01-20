/**
 * Header Menu E2E Tests
 *
 * Tests for the profile dropdown menu in the header.
 * Verifies Premium menu item presence, icon, and menu order.
 */

import { test, expect } from '@playwright/test';
import { verifyAuthSucceeded } from './helpers/auth-helpers';

test.describe('Profile Dropdown Menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await verifyAuthSucceeded(page, '/dashboard');
  });

  test('E2E-MENU-01: Premium menu item appears in profile dropdown', async ({ page }) => {
    const userMenuButton = page.getByTestId('user-menu-trigger');
    await userMenuButton.click();

    // Wait for dropdown to open and verify Profile is visible
    await expect(page.getByText(/profile/i)).toBeVisible();

    // Verify Premium menu item is visible
    const premiumMenuItem = page.getByTestId('premium-menu-item');
    await expect(premiumMenuItem).toBeVisible();
    await expect(premiumMenuItem).toContainText(/premium/i);
  });

  test('E2E-MENU-02: Premium menu item has crown icon', async ({ page }) => {
    const userMenuButton = page.getByTestId('user-menu-trigger');
    await userMenuButton.click();

    // Get the Premium menu item and verify it has an SVG icon
    const premiumMenuItem = page.getByTestId('premium-menu-item');
    await expect(premiumMenuItem).toBeVisible();
    await expect(premiumMenuItem.locator('svg')).toBeVisible();
  });

  test('E2E-MENU-03: Profile dropdown shows correct menu order', async ({ page }) => {
    const userMenuButton = page.getByTestId('user-menu-trigger');
    await userMenuButton.click();

    // Wait for dropdown to open
    await expect(page.getByTestId('premium-menu-item')).toBeVisible();

    // Get all menu items
    const menuItems = page.locator('[role="menuitem"]');
    const items = await menuItems.allTextContents();

    // Find indices of Profile, Premium, and Logout
    const profileIndex = items.findIndex((t) => t.toLowerCase().includes('profile'));
    const premiumIndex = items.findIndex((t) => t.toLowerCase().includes('premium'));
    const logoutIndex = items.findIndex((t) => t.toLowerCase().includes('logout'));

    // Verify order: Profile < Premium < Logout
    expect(profileIndex).toBeGreaterThanOrEqual(0);
    expect(premiumIndex).toBeGreaterThanOrEqual(0);
    expect(logoutIndex).toBeGreaterThanOrEqual(0);
    expect(profileIndex).toBeLessThan(premiumIndex);
    expect(premiumIndex).toBeLessThan(logoutIndex);
  });
});
