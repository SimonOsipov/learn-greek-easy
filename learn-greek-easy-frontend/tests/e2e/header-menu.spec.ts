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

    // Find Profile link by text (it's an anchor tag within the dropdown)
    const profileLink = page.locator('a:has-text("Profile")').first();
    const premiumItem = page.getByTestId('premium-menu-item');

    // Verify both are visible
    await expect(profileLink).toBeVisible();
    await expect(premiumItem).toBeVisible();

    // Get bounding boxes to compare vertical positions
    const profileBox = await profileLink.boundingBox();
    const premiumBox = await premiumItem.boundingBox();

    // Verify Profile comes before Premium (lower Y = higher on page)
    expect(profileBox).not.toBeNull();
    expect(premiumBox).not.toBeNull();
    if (profileBox && premiumBox) {
      expect(profileBox.y).toBeLessThan(premiumBox.y);
    }
  });
});
