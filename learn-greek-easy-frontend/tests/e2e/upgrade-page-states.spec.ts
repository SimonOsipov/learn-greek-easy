import { test, expect } from '@playwright/test';
import { verifyAuthSucceeded } from './helpers/auth-helpers';
import {
  BILLING_TRIAL,
  BILLING_PREMIUM,
  BILLING_EXPIRED_TRIAL,
  mockBillingStatus,
} from './helpers/billing-mocks';

test.use({ storageState: 'playwright/.auth/learner.json' });

test.describe('Upgrade Page State E2E Tests', () => {
  test('E2E-UPGRADE-01: Trial state shows days remaining banner on upgrade page', async ({
    page,
  }) => {
    await mockBillingStatus(page, BILLING_TRIAL);
    await page.goto('/upgrade');
    await verifyAuthSucceeded(page, '/upgrade');

    await expect(page.getByText('7 days')).toBeVisible({ timeout: 10000 });
  });

  test('E2E-UPGRADE-02: Premium state shows already premium card', async ({ page }) => {
    await mockBillingStatus(page, BILLING_PREMIUM);
    await page.goto('/upgrade');
    await verifyAuthSucceeded(page, '/upgrade');

    await expect(page.getByText("You're already on Premium!")).toBeVisible({ timeout: 10000 });
  });

  test('E2E-UPGRADE-03: Expired trial state shows trial ended banner and pricing', async ({
    page,
  }) => {
    await mockBillingStatus(page, BILLING_EXPIRED_TRIAL);
    await page.goto('/upgrade');
    await verifyAuthSucceeded(page, '/upgrade');

    await expect(page.getByText('Your free trial has ended')).toBeVisible({ timeout: 10000 });
    // Pricing section should be visible (BASE_PRICING has 3 plans)
    await expect(page.getByText('€9.99')).toBeVisible();
  });
});
