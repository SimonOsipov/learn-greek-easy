import { test, expect } from '@playwright/test';
import { verifyAuthSucceeded } from './helpers/auth-helpers';
import {
  BILLING_TRIAL,
  BILLING_EXPIRED_TRIAL,
  BILLING_PREMIUM,
  BILLING_CANCELLED,
  BILLING_PAST_DUE,
  mockBillingStatus,
} from './helpers/billing-mocks';

test.use({ storageState: 'playwright/.auth/learner.json' });

test.describe('Subscription Tab E2E Tests', () => {
  test('E2E-SUB-01: Trial state shows Free Trial badge and Subscribe Now button', async ({
    page,
  }) => {
    await mockBillingStatus(page, BILLING_TRIAL);
    await page.goto('/profile');
    await verifyAuthSucceeded(page, '/profile');
    await expect(page.getByTestId('profile-page')).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /subscription/i }).click();
    await expect(page.getByText('Current plan').first()).toBeVisible({ timeout: 10000 });

    await expect(page.getByText('Free Trial').first()).toBeVisible();
    await expect(page.getByText('Trial ends')).toBeVisible();
    await expect(page.getByText('2026').first()).toBeVisible(); // Date with year
    await expect(page.getByRole('button', { name: 'Subscribe Now' })).toBeEnabled();
  });

  test('E2E-SUB-02: Expired trial state shows expiry message and Subscribe Now button', async ({
    page,
  }) => {
    await mockBillingStatus(page, BILLING_EXPIRED_TRIAL);
    await page.goto('/profile');
    await verifyAuthSucceeded(page, '/profile');
    await expect(page.getByTestId('profile-page')).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /subscription/i }).click();
    await expect(page.getByText('Current plan').first()).toBeVisible({ timeout: 10000 });

    await expect(page.getByText('Free Trial').first()).toBeVisible();
    await expect(page.getByText('Your free trial has expired')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Subscribe Now' })).toBeEnabled();
  });

  test('E2E-SUB-03: Premium active state shows billing details and management buttons', async ({
    page,
  }) => {
    await mockBillingStatus(page, BILLING_PREMIUM);
    await page.goto('/profile');
    await verifyAuthSucceeded(page, '/profile');
    await expect(page.getByTestId('profile-page')).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /subscription/i }).click();
    await expect(page.getByText('Current plan').first()).toBeVisible({ timeout: 10000 });

    await expect(page.getByText('Premium').first()).toBeVisible();
    await expect(page.getByText('Billing cycle')).toBeVisible();
    await expect(page.getByText('Monthly').first()).toBeVisible();
    await expect(page.getByText('Next renewal')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change Plan' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel Subscription' })).toBeVisible();
  });

  test('E2E-SUB-04: Cancelled state shows access ends date and reactivate button', async ({
    page,
  }) => {
    await mockBillingStatus(page, BILLING_CANCELLED);
    await page.goto('/profile');
    await verifyAuthSucceeded(page, '/profile');
    await expect(page.getByTestId('profile-page')).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /subscription/i }).click();
    await expect(page.getByText('Current plan').first()).toBeVisible({ timeout: 10000 });

    await expect(page.getByText('Premium (Cancelled)')).toBeVisible();
    await expect(page.getByText('Access ends')).toBeVisible();
    await expect(page.getByText("Features you'll lose")).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reactivate Subscription' })).toBeVisible();
    await expect(page.getByText('Next renewal')).not.toBeVisible();
  });

  test('E2E-SUB-05: Past due state shows payment warning and Cancel button', async ({ page }) => {
    await mockBillingStatus(page, BILLING_PAST_DUE);
    await page.goto('/profile');
    await verifyAuthSucceeded(page, '/profile');
    await expect(page.getByTestId('profile-page')).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /subscription/i }).click();
    await expect(page.getByText('Current plan').first()).toBeVisible({ timeout: 10000 });

    await expect(
      page.getByText('Your payment is overdue. Please update your payment method.')
    ).toBeVisible();
    await expect(page.getByText('Premium').first()).toBeVisible();
    await expect(page.getByText('Billing cycle')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel Subscription' })).toBeVisible();
  });
});
