/**
 * Landing Page Visual Regression Tests
 *
 * Visual tests for the landing page using Chromatic.
 * Captures snapshots at multiple viewports and in both languages.
 */

import { test, expect } from '@chromatic-com/playwright';
import { takeSnapshot, waitForPageReady, VIEWPORTS } from './helpers/visual-helpers';

test.describe('Landing Page - Desktop Visual Tests', () => {
  test('Landing Page - Full Page - English', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'en'));
    await page.reload();
    await waitForPageReady(page, '[data-testid="landing-page"]');

    await takeSnapshot(page, 'Landing Page - Full Page - English', testInfo);
  });

  test('Landing Page - Full Page - Greek', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'el'));
    await page.reload();
    await waitForPageReady(page, '[data-testid="landing-page"]');

    await takeSnapshot(page, 'Landing Page - Full Page - Greek', testInfo);
  });

  test('Landing Page - Hero Section', async ({ page }, testInfo) => {
    await page.goto('/');
    await waitForPageReady(page, '[data-testid="hero-section"]');

    await takeSnapshot(page, 'Landing Page - Hero Section', testInfo);
  });

  test('Landing Page - Features Section', async ({ page }, testInfo) => {
    await page.goto('/');
    await waitForPageReady(page, '[data-testid="features-section"]');

    // Scroll to features section
    await page.getByTestId('features-section').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Landing Page - Features Section', testInfo);
  });

  test('Landing Page - Social Proof Section', async ({ page }, testInfo) => {
    await page.goto('/');
    await waitForPageReady(page, '[data-testid="social-proof-section"]');

    // Scroll to social proof section
    await page.getByTestId('social-proof-section').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Landing Page - Social Proof Section', testInfo);
  });

  test('Landing Page - Pricing Section', async ({ page }, testInfo) => {
    await page.goto('/');
    await waitForPageReady(page, '[data-testid="pricing-section"]');

    // Scroll to pricing section
    await page.getByTestId('pricing-section').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Landing Page - Pricing Section', testInfo);
  });

  test('Landing Page - FAQ Section', async ({ page }, testInfo) => {
    await page.goto('/');
    await waitForPageReady(page, '[data-testid="faq-section"]');

    // Scroll to FAQ section
    await page.getByTestId('faq-section').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Landing Page - FAQ Section', testInfo);
  });

  test('Landing Page - Final CTA Section', async ({ page }, testInfo) => {
    await page.goto('/');
    await waitForPageReady(page, '[data-testid="final-cta-section"]');

    // Scroll to final CTA section
    await page.getByTestId('final-cta-section').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Landing Page - Final CTA Section', testInfo);
  });

  test('Landing Page - Footer', async ({ page }, testInfo) => {
    await page.goto('/');
    await waitForPageReady(page, '[data-testid="landing-footer"]');

    // Scroll to footer
    await page.getByTestId('landing-footer').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Landing Page - Footer', testInfo);
  });
});

test.describe('Landing Page - Mobile Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
  });

  test('Landing Page - Mobile - Full Page', async ({ page }, testInfo) => {
    await page.goto('/');
    await waitForPageReady(page, '[data-testid="landing-page"]');

    await takeSnapshot(page, 'Landing Page - Mobile - Full Page', testInfo);
  });

  test('Landing Page - Mobile - Hero', async ({ page }, testInfo) => {
    await page.goto('/');
    await waitForPageReady(page, '[data-testid="hero-section"]');

    await takeSnapshot(page, 'Landing Page - Mobile - Hero', testInfo);
  });

  test('Landing Page - Mobile - Features', async ({ page }, testInfo) => {
    await page.goto('/');
    await waitForPageReady(page, '[data-testid="features-section"]');

    await page.getByTestId('features-section').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Landing Page - Mobile - Features', testInfo);
  });

  test('Landing Page - Mobile - Pricing', async ({ page }, testInfo) => {
    await page.goto('/');
    await waitForPageReady(page, '[data-testid="pricing-section"]');

    await page.getByTestId('pricing-section').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Landing Page - Mobile - Pricing', testInfo);
  });

  test('Landing Page - Mobile - FAQ', async ({ page }, testInfo) => {
    await page.goto('/');
    await waitForPageReady(page, '[data-testid="faq-section"]');

    await page.getByTestId('faq-section').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Landing Page - Mobile - FAQ', testInfo);
  });
});

test.describe('Landing Page - Tablet Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
  });

  test('Landing Page - Tablet - Full Page', async ({ page }, testInfo) => {
    await page.goto('/');
    await waitForPageReady(page, '[data-testid="landing-page"]');

    await takeSnapshot(page, 'Landing Page - Tablet - Full Page', testInfo);
  });

  test('Landing Page - Tablet - Features', async ({ page }, testInfo) => {
    await page.goto('/');
    await waitForPageReady(page, '[data-testid="features-section"]');

    await page.getByTestId('features-section').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Landing Page - Tablet - Features', testInfo);
  });

  test('Landing Page - Tablet - Pricing', async ({ page }, testInfo) => {
    await page.goto('/');
    await waitForPageReady(page, '[data-testid="pricing-section"]');

    await page.getByTestId('pricing-section').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Landing Page - Tablet - Pricing', testInfo);
  });
});

test.describe('Landing Page - Interaction States', () => {
  test('Landing Page - CTA Button Hover', async ({ page }, testInfo) => {
    await page.goto('/');
    await waitForPageReady(page, '[data-testid="hero-cta-button"]');

    // Hover over CTA button
    await page.getByTestId('hero-cta-button').hover();
    await page.waitForTimeout(200);

    await takeSnapshot(page, 'Landing Page - CTA Button Hover', testInfo);
  });

  test('Landing Page - FAQ Expanded', async ({ page }, testInfo) => {
    await page.goto('/');
    await waitForPageReady(page, '[data-testid="faq-section"]');

    // Scroll to FAQ
    await page.getByTestId('faq-section').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Click first FAQ item to expand
    const firstFaqItem = page.getByTestId('faq-item').first();
    const trigger = firstFaqItem.locator('[data-radix-collection-item]');
    await trigger.click();
    await page.waitForTimeout(300);

    await takeSnapshot(page, 'Landing Page - FAQ Expanded', testInfo);
  });

  test('Landing Page - Pricing Card Hover', async ({ page }, testInfo) => {
    await page.goto('/');
    await waitForPageReady(page, '[data-testid="pricing-section"]');

    // Scroll to pricing
    await page.getByTestId('pricing-section').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Hover over first pricing card
    await page.getByTestId('pricing-card').first().hover();
    await page.waitForTimeout(200);

    await takeSnapshot(page, 'Landing Page - Pricing Card Hover', testInfo);
  });
});
