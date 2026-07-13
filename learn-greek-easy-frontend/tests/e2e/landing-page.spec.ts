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
      // Pricing section is intentionally hidden during waitlist phase
      await expect(page.getByTestId('faq-section')).toBeVisible();
      await expect(page.getByTestId('final-cta-section')).toBeVisible();
      await expect(page.getByTestId('landing-footer')).toBeVisible();
    });

    test('should display hero section content', async ({ page }) => {
      await page.goto('/');

      await expect(page.getByTestId('hero-title')).toBeVisible();
      // PERF-09: anon visitor must reach the hero WITHOUT the auth-loading spinner
      // (RouteGuard de-gated in PERF-09-02 — isInitializing never true, so the spinner never mounts)
      await expect(page.getByTestId('auth-loading')).toHaveCount(0);
      await expect(page.getByTestId('hero-subtitle')).toBeVisible();
      // Hero CTA is now the WaitlistForm email input + submit button
      // Use .first() since WaitlistForm appears in both Hero and FinalCTA
      await expect(page.getByTestId('waitlist-email-input').first()).toBeVisible();
      await expect(page.getByTestId('waitlist-submit-button').first()).toBeVisible();
    });

    test('should display feature cards', async ({ page }) => {
      await page.goto('/');

      // Scroll to features section to ensure it's loaded
      const featuresSection = page.getByTestId('features-section');
      await featuresSection.scrollIntoViewIfNeeded();
      await expect(featuresSection).toBeInViewport();

      const featureCards = page.getByTestId('feature-card');
      await expect(featureCards.first()).toBeVisible();

      // Verify multiple features exist (9 features as per Features.tsx)
      const count = await featureCards.count();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    test('should display waitlist form in FinalCTA section', async ({ page }) => {
      await page.goto('/');

      // Scroll to final CTA section
      const finalCtaSection = page.getByTestId('final-cta-section');
      await finalCtaSection.scrollIntoViewIfNeeded();
      await expect(finalCtaSection).toBeInViewport();

      // FinalCTA now contains the WaitlistForm (dark variant) instead of a register button
      await expect(finalCtaSection.getByTestId('waitlist-email-input')).toBeVisible();
      await expect(finalCtaSection.getByTestId('waitlist-submit-button')).toBeVisible();
    });

    test('should display FAQ items', async ({ page }) => {
      await page.goto('/');

      // Scroll to FAQ section
      const faqSection = page.getByTestId('faq-section');
      await faqSection.scrollIntoViewIfNeeded();
      await expect(faqSection).toBeInViewport();

      const faqItems = page.getByTestId('faq-item');
      await expect(faqItems.first()).toBeVisible();

      // Verify multiple FAQ items exist (10 FAQs as per FAQ.tsx)
      const count = await faqItems.count();
      expect(count).toBeGreaterThanOrEqual(3);
    });
  });

  test.describe('Navigation', () => {
    test('should show Join Waitlist button in header', async ({ page }) => {
      await page.goto('/');

      // The header now shows "Join Waitlist" instead of login/register buttons
      const joinWaitlistButton = page.getByTestId('landing-get-started-button');
      await expect(joinWaitlistButton).toBeVisible();

      // The waitlist form should be accessible on the page
      await expect(page.getByTestId('waitlist-email-input').first()).toBeVisible();
    });

    test('should scroll to sections via anchor links', async ({ page }) => {
      await page.goto('/');

      // Click on features link in nav. Scope to the nav: the footer also has a
      // "Features" anchor, so an unscoped role locator matches 2 elements and
      // .click() throws a strict-mode violation. (Surfaced by the PERF-25
      // eager-load — the footer now renders on first paint, so both links
      // coexist at click time rather than the footer arriving after the click.)
      const featuresLink = page.getByTestId('landing-nav').getByRole('link', { name: /features/i });
      if ((await featuresLink.count()) > 0) {
        await featuresLink.click();

        // Verify features section is in view (Playwright auto-waits for scroll animation)
        const featuresSection = page.getByTestId('features-section');
        await expect(featuresSection).toBeInViewport();
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto('/');

      // React mounts the hero after async i18n init — i.e. after goto's load
      // event — so wait for it before counting. A non-retrying count() here
      // raced a not-yet-rendered DOM and saw 0 h1s.
      const heroTitle = page.getByTestId('hero-title');
      await expect(heroTitle).toBeVisible();

      // Should have exactly one h1 — the hero title (auto-retries until settled)
      await expect(page.locator('h1')).toHaveCount(1);

      // Hero title should be the h1
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

      // Waitlist submit button should have accessible text
      const submitBtn = page.getByTestId('waitlist-submit-button').first();
      const buttonText = await submitBtn.textContent();
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
    await expect(page.getByTestId('dashboard-title')).toBeVisible({
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
      const heroWidth = await heroSection.evaluate((el) => (el as HTMLElement).offsetWidth);

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

    test('should display waitlist form on tablet', async ({ page }) => {
      await page.goto('/');

      // WaitlistForm should be visible in hero section on tablet
      await expect(page.getByTestId('waitlist-email-input').first()).toBeVisible();
      await expect(page.getByTestId('waitlist-submit-button').first()).toBeVisible();
    });
  });

  test.describe('Desktop (1280px)', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test('should display full desktop navigation', async ({ page }) => {
      await page.goto('/');

      // Desktop nav should be visible
      await expect(page.getByTestId('landing-nav')).toBeVisible();
    });

    test('should show nav items inline', async ({ page }) => {
      await page.goto('/');

      // Header now shows only "Join Waitlist" button (Log In removed during waitlist phase)
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

    // Measure perceived load — time until the hero paints — not the full window
    // `load` event. PERF-25 eager-loads the pre-auth routes into the entry
    // modulepreload graph, deliberately trading a later `load` event (more JS
    // fetched upfront) for a faster LCP/hero paint. Waiting for `load` (the
    // goto default) mis-penalized that: on firefox `load` consistently sat
    // ~0.5–3s past the hero paint (fonts, below-fold images, analytics, and the
    // eager route preloads), tripping the 5s bound while the hero was already
    // visible. `waitUntil: 'commit'` lets the toBeVisible() poll below measure
    // time-to-hero, which is what this test's title and assertion target mean.
    await page.goto('/', { waitUntil: 'commit' });
    await expect(page.getByTestId('hero-section')).toBeVisible();

    const loadTime = Date.now() - startTime;

    // Hero should paint within 5 seconds (perceived load).
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
        !error.includes('favicon') &&
        !error.includes('analytics') &&
        !error.includes('Failed to load resource') &&
        !error.includes('Failed to preconnect') &&
        !error.includes('sentry.io')
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
    const faqSection = page.getByTestId('faq-section');
    await faqSection.scrollIntoViewIfNeeded();
    await expect(faqSection).toBeInViewport();

    // Get the first FAQ item trigger (AccordionTrigger renders as button)
    const firstFaqItem = page.getByTestId('faq-item').first();
    const trigger = firstFaqItem.locator('button');

    // Click to expand
    await trigger.click();

    // Verify content is visible (accordion content) - Playwright auto-waits for animation
    const content = firstFaqItem.locator('[role="region"][data-state="open"]');
    await expect(content).toBeVisible();
  });
});
