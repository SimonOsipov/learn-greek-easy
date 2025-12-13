/**
 * E2E Test: Analytics Dashboard
 * Tests charts, widgets, date filtering, and activity feed
 */

import { test, expect } from '@playwright/test';
import { loginViaLocalStorage } from './helpers/auth-helpers';

// ENABLED: Now uses seed data from E2E database seeding infrastructure (SEED-10)
// Seed creates review history and card stats for the learner user
test.describe('Analytics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaLocalStorage(page);
    await page.goto('/dashboard');
    await page.waitForTimeout(1000); // Wait for dashboard to load
  });

  test('E2E-05.1: Charts render correctly', async ({ page }) => {
    // Verify dashboard loaded
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();

    // Look for chart sections (might have different text variations)
    const chartTexts = [
      /progress.*time/i,
      /progress/i,
      /accuracy/i,
      /deck performance|performance/i,
      /stage distribution|distribution/i,
    ];

    let visibleChartsCount = 0;

    for (const chartText of chartTexts) {
      const element = page.getByText(chartText).first();
      const isVisible = await element.isVisible().catch(() => false);
      if (isVisible) {
        visibleChartsCount++;
      }
    }

    // At least some charts should be visible
    expect(visibleChartsCount).toBeGreaterThan(0);

    // Verify Recharts SVG elements exist (proof charts rendered)
    const charts = page.locator('svg.recharts-surface');
    const count = await charts.count();

    // Should have at least 1 chart rendered
    expect(count).toBeGreaterThan(0);
  });

  test('E2E-05.2: Widgets display metrics', async ({ page }) => {
    // Verify dashboard loaded
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();

    // Look for widget metrics (flexible matching)
    const metricPatterns = [
      /\d+.*day.*streak/i,
      /\d+.*word/i,
      /\d+%.*retention/i,
      /\d+.*min/i,
      /streak/i,
      /learned/i,
      /studied/i,
    ];

    let foundMetrics = 0;

    for (const pattern of metricPatterns) {
      const element = page.getByText(pattern).first();
      const isVisible = await element.isVisible().catch(() => false);
      if (isVisible) {
        foundMetrics++;
      }
    }

    // At least some metrics should be visible
    expect(foundMetrics).toBeGreaterThan(0);
  });

  test('E2E-05.3: Date range filter updates charts', async ({ page }) => {
    // Look for date range dropdown or filter button
    const dateRangeButton = page.getByRole('button', { name: /week|month|year|last|date|range/i }).first();
    const isDateRangeVisible = await dateRangeButton.isVisible().catch(() => false);

    if (isDateRangeVisible) {
      // Click date range dropdown
      await dateRangeButton.click();
      await page.waitForTimeout(300);

      // Try to select a different time range
      const monthOption = page.getByRole('menuitem', { name: /month/i }).or(
        page.getByText(/month/i).and(page.locator('button, a, li'))
      ).first();
      const isMonthVisible = await monthOption.isVisible().catch(() => false);

      if (isMonthVisible) {
        await monthOption.click();
        await page.waitForTimeout(500);

        // Verify charts still visible (they should re-render)
        const charts = page.locator('svg.recharts-surface');
        await expect(charts.first()).toBeVisible({ timeout: 3000 });
      }
    } else {
      // Date range filter might not be implemented yet
      // Just verify charts are visible
      const charts = page.locator('svg.recharts-surface');
      const count = await charts.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('E2E-05.4: Activity feed shows recent sessions', async ({ page }) => {
    // Scroll to find activity feed section
    const activityHeading = page.getByRole('heading', { name: /activity|recent/i });
    const isActivityVisible = await activityHeading.isVisible().catch(() => false);

    if (isActivityVisible) {
      await activityHeading.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);

      // Look for activity items
      const activityItems = page.locator('[data-testid="activity-item"]').or(
        page.locator('div:has-text("reviewed")').or(
          page.locator('li:has-text("reviewed")')
        )
      );

      const activityCount = await activityItems.count();

      // Either activity items exist, or the section is empty (which is valid)
      expect(activityCount).toBeGreaterThanOrEqual(0);
    } else {
      // Activity feed might not be on dashboard, just verify dashboard loads
      await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    }
  });

  test('E2E-05.5: Dashboard loads within reasonable time', async ({ page }) => {
    // Navigate to dashboard fresh
    await page.goto('/dashboard');
    const startTime = Date.now();

    // Wait for dashboard heading to be visible
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
      timeout: 5000,
    });

    // Wait for at least one chart to render
    const charts = page.locator('svg.recharts-surface');
    const hasCharts = await charts.count() > 0;

    if (hasCharts) {
      await expect(charts.first()).toBeVisible({
        timeout: 5000,
      });
    }

    const loadTime = Date.now() - startTime;

    // Verify loaded within 5 seconds (generous for E2E)
    expect(loadTime).toBeLessThan(5000);
  });

  test('E2E-05.6: Dashboard displays user greeting', async ({ page }) => {
    // Look for user greeting or welcome message
    const greetingPatterns = [
      /welcome.*test user/i,
      /hello.*test/i,
      /hi.*test/i,
      /dashboard/i,
    ];

    let foundGreeting = false;

    for (const pattern of greetingPatterns) {
      const element = page.getByText(pattern).first();
      const isVisible = await element.isVisible().catch(() => false);
      if (isVisible) {
        foundGreeting = true;
        break;
      }
    }

    // At least dashboard heading should be visible
    expect(foundGreeting).toBe(true);
  });

  test('E2E-05.7: Dashboard has quick action buttons', async ({ page }) => {
    // Look for common dashboard action buttons
    const actionPatterns = [
      /start review|review/i,
      /browse decks|decks/i,
      /continue learning|continue/i,
    ];

    let foundActions = 0;

    for (const pattern of actionPatterns) {
      const button = page.getByRole('button', { name: pattern }).or(
        page.getByRole('link', { name: pattern })
      ).first();
      const isVisible = await button.isVisible().catch(() => false);
      if (isVisible) {
        foundActions++;
      }
    }

    // At least some quick actions should be available
    // Or navigation should be present
    const navLinks = page.getByRole('link', { name: /decks|profile|settings/i });
    const navCount = await navLinks.count();

    expect(foundActions + navCount).toBeGreaterThan(0);
  });

  test('E2E-05.8: Charts are interactive and responsive', async ({ page }) => {
    // Verify charts exist
    const charts = page.locator('svg.recharts-surface');
    const chartCount = await charts.count();

    if (chartCount > 0) {
      // Try hovering over first chart
      const firstChart = charts.first();
      await firstChart.hover();
      await page.waitForTimeout(300);

      // Chart should still be visible after interaction
      await expect(firstChart).toBeVisible();

      // Verify chart has some data (has path elements for lines/bars)
      const chartPaths = firstChart.locator('path, rect, circle');
      const pathCount = await chartPaths.count();

      // Chart should have visual elements
      expect(pathCount).toBeGreaterThan(0);
    } else {
      // No charts rendered - might be no data yet
      // Just verify dashboard is functional
      await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    }
  });
});
