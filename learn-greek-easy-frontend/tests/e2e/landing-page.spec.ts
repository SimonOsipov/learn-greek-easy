/**
 * Landing Page E2E Tests
 *
 * Tests the public landing page functionality including:
 * - Section visibility
 * - Navigation flows
 * - Authentication redirects
 * - Responsive behavior
 *
 * Test Organization:
 * - Unauthenticated: Tests public landing page access
 * - Authenticated: Tests redirect behavior for logged-in users
 */

import { test, expect } from '@playwright/test';

/**
 * UNAUTHENTICATED TESTS
 *
 * These tests use empty storageState to ensure no user is logged in.
 * This is required for testing the public landing page.
 */
test.describe('Landing Page - Unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.describe('Section Visibility', () => {
    test('should display all landing page sections', async ({ page }) => {
      await page.goto('/');

      // Verify main container
      await expect(page.getByTestId('landing-page')).toBeVisible();

      // Verify all major sections
      await expect(page.getByTestId('landing-header')).toBeVisible();
      await expect(page.getByTestId('hero-section')).toBeVisible();
      await expect(page.getByTestId('features-section')).toBeVisible();
      await expect(page.getByTestId('social-proof-section')).toBeVisible();
      await expect(page.getByTestId('pricing-section')).toBeVisible();
      await expect(page.getByTestId('faq-section')).toBeVisible();
      await expect(page.getByTestId('final-cta-section')).toBeVisible();
      await expect(page.getByTestId('landing-footer')).toBeVisible();
    });

    test('should display hero section content', async ({ page }) => {
      await page.goto('/');

      await expect(page.getByTestId('hero-title')).toBeVisible();
      await expect(page.getByTestId('hero-subtitle')).toBeVisible();
      await expect(page.getByTestId('hero-cta-button')).toBeVisible();
    });

    test('should display feature cards', async ({ page }) => {
      await page.goto('/');

      // Scroll to features section to ensure it's loaded
      await page.getByTestId('features-section').scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      const featureCards = page.getByTestId('feature-card');
      await expect(featureCards.first()).toBeVisible();

      // Verify multiple features exist (9 features as per Features.tsx)
      const count = await featureCards.count();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    test('should display pricing cards', async ({ page }) => {
      await page.goto('/');

      // Scroll to pricing section
      await page.getByTestId('pricing-section').scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      const pricingCards = page.getByTestId('pricing-card');
      await expect(pricingCards.first()).toBeVisible();

      // Verify pricing CTAs exist (4 plans)
      const ctaButtons = page.getByTestId('pricing-cta');
      expect(await ctaButtons.count()).toBe(4);
    });

    test('should display FAQ items', async ({ page }) => {
      await page.goto('/');

      // Scroll to FAQ section
      await page.getByTestId('faq-section').scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      const faqItems = page.getByTestId('faq-item');
      await expect(faqItems.first()).toBeVisible();

      // Verify multiple FAQ items exist (10 FAQs as per FAQ.tsx)
      const count = await faqItems.count();
      expect(count).toBeGreaterThanOrEqual(3);
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to login from header', async ({ page }) => {
      await page.goto('/');

      await page.getByTestId('landing-login-button').click();
      await page.waitForURL('/login');

      await expect(page.getByTestId('login-card')).toBeVisible();
    });

    test('should navigate to register from header "Get Started" button', async ({ page }) => {
      await page.goto('/');

      await page.getByTestId('landing-get-started-button').click();
      await page.waitForURL('/register');

      await expect(page.getByTestId('register-card')).toBeVisible();
    });

    test('should navigate to register from hero CTA', async ({ page }) => {
      await page.goto('/');

      await page.getByTestId('hero-cta-button').click();
      await page.waitForURL('/register');

      await expect(page.getByTestId('register-card')).toBeVisible();
    });

    test('should scroll to sections via anchor links', async ({ page }) => {
      await page.goto('/');

      // Click on features link in nav
      const featuresLink = page.getByRole('link', { name: /features/i });
      if ((await featuresLink.count()) > 0) {
        await featuresLink.click();
        await page.waitForTimeout(500); // Allow scroll animation

        // Verify features section is in view
        const featuresSection = page.getByTestId('features-section');
        await expect(featuresSection).toBeInViewport();
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto('/');

      // Should have exactly one h1
      const h1Elements = page.locator('h1');
      expect(await h1Elements.count()).toBe(1);

      // Hero title should be the h1
      const heroTitle = page.getByTestId('hero-title');
      const tagName = await heroTitle.evaluate((el) => el.tagName.toLowerCase());
      expect(tagName).toBe('h1');
    });

    test('should have accessible navigation', async ({ page }) => {
      await page.goto('/');

      // Navigation should be visible
      const nav = page.getByTestId('landing-nav');
      await expect(nav).toBeVisible();
    });

    test('should have proper button labels', async ({ page }) => {
      await page.goto('/');

      // All CTA buttons should have accessible text
      const heroCta = page.getByTestId('hero-cta-button');
      const buttonText = await heroCta.textContent();
      expect(buttonText).toBeTruthy();
      expect(buttonText!.length).toBeGreaterThan(0);
    });
  });
});

/**
 * AUTHENTICATED TESTS
 *
 * Tests redirect behavior for logged-in users.
 * Uses default storageState from config (learner user).
 */
test.describe('Landing Page - Authenticated Redirect', () => {
  // Uses default storageState from config (learner user)

  test('should redirect authenticated user from / to /dashboard', async ({ page }) => {
    await page.goto('/');

    // Should redirect to dashboard
    await page.waitForURL('/dashboard', { timeout: 15000 });

    // Wait for dashboard content
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
      timeout: 15000,
    });

    // Landing-specific elements should NOT be visible
    const landingPage = page.getByTestId('landing-page');
    await expect(landingPage).not.toBeVisible();
  });

  test('should not show landing page elements when authenticated', async ({ page }) => {
    await page.goto('/');

    // Wait for redirect to complete
    await page.waitForURL('/dashboard', { timeout: 15000 });

    // Hero section should not be visible for authenticated users
    const heroSection = page.getByTestId('hero-section');
    await expect(heroSection).not.toBeVisible();
  });
});

/**
 * RESPONSIVE TESTS
 *
 * Tests landing page at different viewport sizes.
 */
test.describe('Landing Page - Responsive', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.describe('Mobile (375px)', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('should display landing page on mobile', async ({ page }) => {
      await page.goto('/');

      await expect(page.getByTestId('landing-page')).toBeVisible();
      await expect(page.getByTestId('hero-section')).toBeVisible();
    });

    test('should have full-width sections on mobile', async ({ page }) => {
      await page.goto('/');

      const heroSection = page.getByTestId('hero-section');
      const heroWidth = await heroSection.evaluate((el) => el.offsetWidth);

      // Should be nearly full viewport width (accounting for padding)
      expect(heroWidth).toBeGreaterThan(375 * 0.9);
    });

    test('should hide desktop nav on mobile', async ({ page }) => {
      await page.goto('/');

      // Desktop nav should be hidden on mobile (it has md:flex)
      const desktopNav = page.getByTestId('landing-nav');
      await expect(desktopNav).not.toBeVisible();
    });
  });

  test.describe('Tablet (768px)', () => {
    test.use({ viewport: { width: 768, height: 1024 } });

    test('should display tablet-appropriate layout', async ({ page }) => {
      await page.goto('/');

      await expect(page.getByTestId('landing-page')).toBeVisible();
      await expect(page.getByTestId('hero-section')).toBeVisible();

      const viewportSize = page.viewportSize();
      expect(viewportSize?.width).toBe(768);
    });

    test('should show pricing cards in grid layout', async ({ page }) => {
      await page.goto('/');

      // Scroll to pricing
      await page.getByTestId('pricing-section').scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      const pricingCards = page.getByTestId('pricing-card');
      await expect(pricingCards.first()).toBeVisible();

      // Cards should not be full width on tablet
      const firstCard = pricingCards.first();
      const cardWidth = await firstCard.evaluate((el) => el.offsetWidth);
      expect(cardWidth).toBeLessThan(768 * 0.9);
    });
  });

  test.describe('Desktop (1280px)', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test('should display full desktop navigation', async ({ page }) => {
      await page.goto('/');

      // Desktop nav should be visible
      await expect(page.getByTestId('landing-nav')).toBeVisible();
    });

    test('should show all nav items inline', async ({ page }) => {
      await page.goto('/');

      await expect(page.getByTestId('landing-login-button')).toBeVisible();
      await expect(page.getByTestId('landing-get-started-button')).toBeVisible();
    });
  });
});

/**
 * PERFORMANCE TESTS
 *
 * Basic performance checks for landing page.
 */
test.describe('Landing Page - Performance', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should load landing page within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await expect(page.getByTestId('hero-section')).toBeVisible();

    const loadTime = Date.now() - startTime;

    // Landing page should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('should not have console errors', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out known acceptable errors (e.g., third-party scripts)
    const criticalErrors = consoleErrors.filter(
      (error) =>
        !error.includes('favicon') && !error.includes('analytics') && !error.includes('Failed to load resource')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});

/**
 * FAQ INTERACTION TESTS
 *
 * Tests FAQ accordion functionality.
 */
test.describe('Landing Page - FAQ Interactions', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should expand and collapse FAQ items', async ({ page }) => {
    await page.goto('/');

    // Scroll to FAQ section
    await page.getByTestId('faq-section').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Get the first FAQ item trigger (AccordionTrigger renders as button)
    const firstFaqItem = page.getByTestId('faq-item').first();
    const trigger = firstFaqItem.locator('button');

    // Click to expand
    await trigger.click();
    await page.waitForTimeout(300);

    // Verify content is visible (accordion content)
    const content = firstFaqItem.locator('[data-state="open"]');
    await expect(content).toBeVisible();
  });
});
