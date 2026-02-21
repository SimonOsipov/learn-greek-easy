import { type Page } from '@playwright/test';
import { type BillingStatusResponse } from '../../../src/services/billingAPI';

const BASE_PRICING = [
  {
    billing_cycle: 'monthly',
    price_amount: 999,
    price_formatted: '€9.99',
    currency: 'eur',
    interval: 'month',
    interval_count: 1,
    savings_percent: null,
  },
  {
    billing_cycle: 'quarterly',
    price_amount: 2499,
    price_formatted: '€24.99',
    currency: 'eur',
    interval: 'month',
    interval_count: 3,
    savings_percent: 17,
  },
  {
    billing_cycle: 'semi_annual',
    price_amount: 3999,
    price_formatted: '€39.99',
    currency: 'eur',
    interval: 'month',
    interval_count: 6,
    savings_percent: 33,
  },
];

export const BILLING_TRIAL: BillingStatusResponse = {
  subscription_status: 'trialing',
  subscription_tier: 'premium',
  trial_end_date: '2026-03-01T00:00:00.000Z',
  trial_days_remaining: 7,
  billing_cycle: null,
  is_premium: false,
  pricing: BASE_PRICING,
  current_period_end: null,
  cancel_at_period_end: false,
  current_price_amount: null,
  current_price_formatted: null,
  current_price_currency: null,
};

export const BILLING_EXPIRED_TRIAL: BillingStatusResponse = {
  subscription_status: 'trialing',
  subscription_tier: 'free',
  trial_end_date: '2026-01-01T00:00:00.000Z',
  trial_days_remaining: 0,
  billing_cycle: null,
  is_premium: false,
  pricing: BASE_PRICING,
  current_period_end: null,
  cancel_at_period_end: false,
  current_price_amount: null,
  current_price_formatted: null,
  current_price_currency: null,
};

export const BILLING_PREMIUM: BillingStatusResponse = {
  subscription_status: 'active',
  subscription_tier: 'premium',
  trial_end_date: null,
  trial_days_remaining: null,
  billing_cycle: 'monthly',
  is_premium: true,
  pricing: [],
  current_period_end: '2026-03-22T00:00:00.000Z',
  cancel_at_period_end: false,
  current_price_amount: 999,
  current_price_formatted: '€9.99',
  current_price_currency: 'eur',
};

export const BILLING_CANCELLED: BillingStatusResponse = {
  subscription_status: 'active',
  subscription_tier: 'premium',
  trial_end_date: null,
  trial_days_remaining: null,
  billing_cycle: 'quarterly',
  is_premium: true,
  pricing: [],
  current_period_end: '2026-04-15T00:00:00.000Z',
  cancel_at_period_end: true,
  current_price_amount: 2499,
  current_price_formatted: '€24.99',
  current_price_currency: 'eur',
};

export const BILLING_PAST_DUE: BillingStatusResponse = {
  subscription_status: 'past_due',
  subscription_tier: 'premium',
  trial_end_date: null,
  trial_days_remaining: null,
  billing_cycle: 'monthly',
  is_premium: true,
  pricing: [],
  current_period_end: '2026-02-26T00:00:00.000Z',
  cancel_at_period_end: false,
  current_price_amount: 999,
  current_price_formatted: '€9.99',
  current_price_currency: 'eur',
};

export const BILLING_FREE: BillingStatusResponse = {
  subscription_status: 'free',
  subscription_tier: 'free',
  trial_end_date: null,
  trial_days_remaining: null,
  billing_cycle: null,
  is_premium: false,
  pricing: [],
  current_period_end: null,
  cancel_at_period_end: false,
  current_price_amount: null,
  current_price_formatted: null,
  current_price_currency: null,
};

export async function mockBillingStatus(page: Page, data: BillingStatusResponse): Promise<void> {
  await page.route('**/api/v1/billing/status', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(data),
      });
    } else {
      route.continue();
    }
  });
}
