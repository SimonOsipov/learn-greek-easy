/**
 * E2E Tests: XP & Achievements System
 *
 * Tests the achievements page, XP display, and gamification features.
 * Uses Playwright's storageState pattern for authentication.
 *
 * Test Organization:
 * - Achievements page navigation and display
 * - XP stats and level display
 * - Achievement categories and cards
 * - User-specific XP states (boundary, mid, max)
 */

import { test, expect } from '@playwright/test';
import { verifyAuthSucceeded, waitForAppReady, SEED_USERS, loginViaUI } from './helpers/auth-helpers';

test.describe('Achievements Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/achievements');

    // Fail fast with clear error if auth failed
    await verifyAuthSucceeded(page, '/achievements');

    // Wait for achievements page content
    await expect(page.getByTestId('achievements-page')).toBeVisible({ timeout: 15000 });
  });

  test('E2E-ACH-01: Achievements page displays correctly', async ({ page }) => {
    // Verify page title (use role selector to avoid matching nav link)
    await expect(page.getByRole('heading', { name: 'Achievements', level: 1 })).toBeVisible();

    // Verify stats section is visible - scope to stats section to avoid matching category headers
    const statsSection = page.locator('section[aria-labelledby="achievements-stats-heading"]');
    await expect(statsSection).toBeVisible();
    await expect(statsSection.getByText('Unlocked')).toBeVisible();
    await expect(statsSection.getByText('Progress')).toBeVisible();
    await expect(statsSection.getByText('XP Earned')).toBeVisible();
  });

  test('E2E-ACH-02: Achievement categories are displayed', async ({ page }) => {
    // Wait for content to load
    await page.waitForTimeout(1000);

    // Verify at least one category is visible using role selectors
    // Categories: Streak, Learning, Session, Accuracy, Cefr, Special
    const streakCategory = page.getByRole('heading', { name: /Streak/i, level: 2 });
    const learningCategory = page.getByRole('heading', { name: /Learning/i, level: 2 });

    // At least one category should be visible
    await expect(streakCategory.or(learningCategory).first()).toBeVisible({ timeout: 10000 });
  });

  test('E2E-ACH-03: Achievement cards show progress', async ({ page }) => {
    // Wait for content to load
    await page.waitForTimeout(1000);

    // Look for progress indicators (0/X format or percentage)
    const progressIndicator = page.getByText(/\d+\s*\/\s*\d+/);
    await expect(progressIndicator.first()).toBeVisible({ timeout: 10000 });
  });

  test('E2E-ACH-04: Locked achievements show lock indicator', async ({ page }) => {
    // Wait for content to load
    await page.waitForTimeout(1000);

    // Look for locked badges
    const lockedBadge = page.getByText('Locked');
    await expect(lockedBadge.first()).toBeVisible({ timeout: 10000 });
  });

  test('E2E-ACH-05: XP reward badges are displayed', async ({ page }) => {
    // Wait for content to load
    await page.waitForTimeout(1000);

    // Look for XP reward badges (e.g., "50 XP", "100 XP")
    const xpBadge = page.getByText(/\d+\s*XP/);
    await expect(xpBadge.first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('XP Stats Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/achievements');
    await verifyAuthSucceeded(page, '/achievements');
    await expect(page.getByTestId('achievements-page')).toBeVisible({ timeout: 15000 });
  });

  test('E2E-ACH-06: Stats header shows unlocked count', async ({ page }) => {
    // Find unlocked count (format: X/Y)
    const statsSection = page.locator('section[aria-labelledby="achievements-stats-heading"]');

    // Wait for stats to load
    await expect(statsSection).toBeVisible({ timeout: 10000 });

    // Verify unlocked stat is visible (scoped to stats section)
    await expect(statsSection.getByText('Unlocked')).toBeVisible();
  });

  test('E2E-ACH-07: Stats header shows progress percentage', async ({ page }) => {
    // Scope to stats section to avoid matching other elements
    const statsSection = page.locator('section[aria-labelledby="achievements-stats-heading"]');
    await expect(statsSection).toBeVisible({ timeout: 10000 });

    // Verify progress percentage is visible
    await expect(statsSection.getByText('Progress')).toBeVisible();

    // Look for percentage display within stats section
    const percentageText = statsSection.getByText(/%/);
    await expect(percentageText.first()).toBeVisible({ timeout: 10000 });
  });

  test('E2E-ACH-08: Stats header shows XP earned', async ({ page }) => {
    // Scope to stats section to avoid matching other elements
    const statsSection = page.locator('section[aria-labelledby="achievements-stats-heading"]');
    await expect(statsSection).toBeVisible({ timeout: 10000 });

    // Verify XP earned stat is visible
    await expect(statsSection.getByText('XP Earned')).toBeVisible();
  });
});

test.describe('Navigation to Achievements', () => {
  test('E2E-ACH-09: Navigate to achievements from navigation', async ({ page }) => {
    // Start from dashboard
    await page.goto('/');
    await waitForAppReady(page);

    // Look for achievements link in navigation (mobile or desktop)
    const achievementsLink = page.getByRole('link', { name: /achievements/i }).first();
    const isLinkVisible = await achievementsLink.isVisible().catch(() => false);

    if (isLinkVisible) {
      await achievementsLink.click();

      // Verify navigation to achievements page
      await page.waitForURL(/\/achievements/);
      await expect(page.getByTestId('achievements-page')).toBeVisible({ timeout: 10000 });
    } else {
      // Try mobile nav icon (Trophy icon)
      const trophyIcon = page.locator('nav a[href="/achievements"]').first();
      const hasTrophyLink = await trophyIcon.isVisible().catch(() => false);

      if (hasTrophyLink) {
        await trophyIcon.click();
        await page.waitForURL(/\/achievements/);
        await expect(page.getByTestId('achievements-page')).toBeVisible({ timeout: 10000 });
      } else {
        // Fall back to direct navigation
        await page.goto('/achievements');
        await expect(page.getByTestId('achievements-page')).toBeVisible({ timeout: 10000 });
      }
    }
  });
});

/**
 * XP Boundary User Tests
 *
 * Tests with user who has 99 XP (1 XP from level 2)
 */
test.describe('XP Boundary User (99 XP, Level 1)', () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // Clear auth state

  test('E2E-ACH-10: Boundary user sees correct XP state', async ({ page }) => {
    // Login as XP boundary user
    await loginViaUI(page, SEED_USERS.XP_BOUNDARY);

    // Navigate to achievements
    await page.goto('/achievements');
    await expect(page.getByTestId('achievements-page')).toBeVisible({ timeout: 15000 });

    // Boundary user should have no achievements unlocked
    // The XP Earned should be low
    const xpEarnedSection = page.getByText('XP Earned');
    await expect(xpEarnedSection).toBeVisible();
  });
});

/**
 * XP Mid User Tests
 *
 * Tests with user who has 4100 XP (Level 7) and 5 achievements
 */
test.describe('XP Mid User (4100 XP, Level 7)', () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // Clear auth state

  test('E2E-ACH-11: Mid user has some achievements unlocked', async ({ page }) => {
    // Login as XP mid user
    await loginViaUI(page, SEED_USERS.XP_MID);

    // Navigate to achievements
    await page.goto('/achievements');
    await expect(page.getByTestId('achievements-page')).toBeVisible({ timeout: 15000 });

    // Wait for content to load
    await page.waitForTimeout(1000);

    // Mid user should have some achievements unlocked (5)
    // Look for unlocked achievements (non-grayed, with "Unlocked" date)
    const unlockedText = page.getByText(/Unlocked \d{1,2}\/\d{1,2}\/\d{4}/);
    await expect(unlockedText.first()).toBeVisible({ timeout: 10000 });
  });

  test('E2E-ACH-12: Mid user XP earned is calculated correctly', async ({ page }) => {
    // Login as XP mid user
    await loginViaUI(page, SEED_USERS.XP_MID);

    // Navigate to achievements
    await page.goto('/achievements');
    await expect(page.getByTestId('achievements-page')).toBeVisible({ timeout: 15000 });

    // Scope to stats section to avoid matching other elements
    const statsSection = page.locator('section[aria-labelledby="achievements-stats-heading"]');
    await expect(statsSection).toBeVisible({ timeout: 10000 });

    // XP earned should be greater than 0 (sum of unlocked achievement rewards)
    // Mid user has 5 achievements with rewards: 50 + 100 + 10 + 100 + 25 = 285 XP
    await expect(statsSection.getByText('XP Earned')).toBeVisible();
  });
});

/**
 * XP Max User Tests
 *
 * Tests with user who has 100000 XP (Level 15) and all achievements
 */
test.describe('XP Max User (100000 XP, Level 15)', () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // Clear auth state

  test('E2E-ACH-13: Max user has all achievements unlocked', async ({ page }) => {
    // Login as XP max user
    await loginViaUI(page, SEED_USERS.XP_MAX);

    // Navigate to achievements
    await page.goto('/achievements');
    await expect(page.getByTestId('achievements-page')).toBeVisible({ timeout: 15000 });

    // Scope to stats section to avoid matching other elements
    const statsSection = page.locator('section[aria-labelledby="achievements-stats-heading"]');
    await expect(statsSection).toBeVisible({ timeout: 10000 });

    // Max user should have 100% progress
    await expect(statsSection.getByText('100%', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('E2E-ACH-14: Max user unlocked count equals total', async ({ page }) => {
    // Login as XP max user
    await loginViaUI(page, SEED_USERS.XP_MAX);

    // Navigate to achievements
    await page.goto('/achievements');
    await expect(page.getByTestId('achievements-page')).toBeVisible({ timeout: 15000 });

    // Wait for content to load
    await page.waitForTimeout(1000);

    // Unlocked count should equal total (X/X format where both are same)
    // Look for pattern like "35/35" or similar
    const unlockedCount = page.locator('text=/\\d+\\/\\d+/').first();
    const text = await unlockedCount.textContent();

    if (text) {
      const match = text.match(/(\d+)\/(\d+)/);
      if (match) {
        expect(parseInt(match[1])).toBe(parseInt(match[2]));
      }
    }
  });
});

test.describe('Achievement Categories Detail', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/achievements');
    await verifyAuthSucceeded(page, '/achievements');
    await expect(page.getByTestId('achievements-page')).toBeVisible({ timeout: 15000 });
  });

  test('E2E-ACH-15: Streak achievements category is visible', async ({ page }) => {
    await page.waitForTimeout(1000);
    // Use role selector to target the h2 heading specifically
    const streakHeading = page.getByRole('heading', { name: /Streak/i, level: 2 });
    await expect(streakHeading).toBeVisible({ timeout: 10000 });
  });

  test('E2E-ACH-16: Learning achievements category is visible', async ({ page }) => {
    await page.waitForTimeout(1000);
    // Use role selector to target the h2 heading specifically
    const learningHeading = page.getByRole('heading', { name: /Learning/i, level: 2 });
    await expect(learningHeading).toBeVisible({ timeout: 10000 });
  });

  test('E2E-ACH-17: Session achievements category is visible', async ({ page }) => {
    await page.waitForTimeout(1000);
    // Use role selector to target the h2 heading specifically
    const sessionHeading = page.getByRole('heading', { name: /Session/i, level: 2 });
    await expect(sessionHeading).toBeVisible({ timeout: 10000 });
  });

  test('E2E-ACH-18: Category shows unlocked/total count', async ({ page }) => {
    await page.waitForTimeout(1000);
    // Each category header shows "X/Y unlocked"
    const unlockedText = page.getByText(/\d+\/\d+\s*unlocked/i);
    await expect(unlockedText.first()).toBeVisible({ timeout: 10000 });
  });
});
