/**
 * Subscription Visual Regression Tests
 *
 * Chromatic snapshots for subscription states covering:
 * - Profile subscription tab (7 scenarios: desktop + mobile)
 * - Upgrade page (3 scenarios)
 *
 * Total: 10 visual test scenarios
 *
 * Viewports:
 * - Desktop: 1280x720
 * - Mobile: 375x667
 */

import { test, expect } from '@chromatic-com/playwright';
import {
  takeSnapshot,
  waitForPageReady,
  loginForVisualTest,
  VIEWPORTS,
} from './helpers/visual-helpers';
import {
  BILLING_TRIAL,
  BILLING_EXPIRED_TRIAL,
  BILLING_PREMIUM,
  BILLING_CANCELLED,
  BILLING_PAST_DUE,
  mockBillingStatus,
} from '../e2e/helpers/billing-mocks';

// ============================================================================
// PROFILE SUBSCRIPTION TAB TESTS - 7 SCENARIOS
// ============================================================================

test.describe('Profile - Subscription Tab', () => {
  test('Subscription Tab - Trial', async ({ page }, testInfo) => {
    await mockBillingStatus(page, BILLING_TRIAL);
    await loginForVisualTest(page);
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/profile');
    await waitForPageReady(page, '[data-testid="profile-page"]');
    await page.getByRole('button', { name: /subscription/i }).click();
    await expect(page.getByText('Current plan').first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);
    await takeSnapshot(page, 'Subscription Tab - Trial', testInfo);
  });

  test('Subscription Tab - Trial (Mobile)', async ({ page }, testInfo) => {
    await mockBillingStatus(page, BILLING_TRIAL);
    await loginForVisualTest(page);
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/profile');
    await waitForPageReady(page, '[data-testid="profile-page"]');
    // Open sidebar on mobile first, then click subscription tab
    await page.getByLabel('Open menu').click();
    await page.getByRole('button', { name: /subscription/i }).click();
    await expect(page.getByText('Current plan').first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);
    await takeSnapshot(page, 'Subscription Tab - Trial (Mobile)', testInfo);
  });

  test('Subscription Tab - Expired Trial', async ({ page }, testInfo) => {
    await mockBillingStatus(page, BILLING_EXPIRED_TRIAL);
    await loginForVisualTest(page);
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/profile');
    await waitForPageReady(page, '[data-testid="profile-page"]');
    await page.getByRole('button', { name: /subscription/i }).click();
    await expect(page.getByText('Current plan').first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);
    await takeSnapshot(page, 'Subscription Tab - Expired Trial', testInfo);
  });

  test('Subscription Tab - Premium Active', async ({ page }, testInfo) => {
    await mockBillingStatus(page, BILLING_PREMIUM);
    await loginForVisualTest(page);
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/profile');
    await waitForPageReady(page, '[data-testid="profile-page"]');
    await page.getByRole('button', { name: /subscription/i }).click();
    await expect(page.getByText('Current plan').first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);
    await takeSnapshot(page, 'Subscription Tab - Premium Active', testInfo);
  });

  test('Subscription Tab - Cancelled', async ({ page }, testInfo) => {
    await mockBillingStatus(page, BILLING_CANCELLED);
    await loginForVisualTest(page);
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/profile');
    await waitForPageReady(page, '[data-testid="profile-page"]');
    await page.getByRole('button', { name: /subscription/i }).click();
    await expect(page.getByText('Current plan').first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);
    await takeSnapshot(page, 'Subscription Tab - Cancelled', testInfo);
  });

  test('Subscription Tab - Past Due', async ({ page }, testInfo) => {
    await mockBillingStatus(page, BILLING_PAST_DUE);
    await loginForVisualTest(page);
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/profile');
    await waitForPageReady(page, '[data-testid="profile-page"]');
    await page.getByRole('button', { name: /subscription/i }).click();
    await expect(page.getByText('Current plan').first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);
    await takeSnapshot(page, 'Subscription Tab - Past Due', testInfo);
  });

  test('Subscription Tab - Past Due (Mobile)', async ({ page }, testInfo) => {
    await mockBillingStatus(page, BILLING_PAST_DUE);
    await loginForVisualTest(page);
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/profile');
    await waitForPageReady(page, '[data-testid="profile-page"]');
    // Open sidebar on mobile first, then click subscription tab
    await page.getByLabel('Open menu').click();
    await page.getByRole('button', { name: /subscription/i }).click();
    await expect(page.getByText('Current plan').first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);
    await takeSnapshot(page, 'Subscription Tab - Past Due (Mobile)', testInfo);
  });
});

// ============================================================================
// UPGRADE PAGE TESTS - 3 SCENARIOS
// ============================================================================

test.describe('Upgrade Page', () => {
  test('Upgrade Page - Trial Banner', async ({ page }, testInfo) => {
    await mockBillingStatus(page, { ...BILLING_TRIAL, trial_days_remaining: 5 });
    await loginForVisualTest(page);
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/upgrade');
    await expect(page.getByText('5 days')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    await takeSnapshot(page, 'Upgrade Page - Trial Banner', testInfo);
  });

  test('Upgrade Page - Already Premium', async ({ page }, testInfo) => {
    await mockBillingStatus(page, BILLING_PREMIUM);
    await loginForVisualTest(page);
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/upgrade');
    await expect(page.getByText("You're already on Premium!")).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    await takeSnapshot(page, 'Upgrade Page - Already Premium', testInfo);
  });

  test('Upgrade Page - Expired Trial', async ({ page }, testInfo) => {
    await mockBillingStatus(page, BILLING_EXPIRED_TRIAL);
    await loginForVisualTest(page);
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/upgrade');
    await expect(page.getByText('Your free trial has ended')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    await takeSnapshot(page, 'Upgrade Page - Expired Trial', testInfo);
  });
});
