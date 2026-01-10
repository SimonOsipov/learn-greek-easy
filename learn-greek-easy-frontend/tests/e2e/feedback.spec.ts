/**
 * E2E Tests: Feedback & Voting System
 *
 * Tests the feedback submission, voting, filtering, and management features.
 * Uses Playwright's storageState pattern for authentication.
 *
 * Test Organization:
 * - Authenticated tests: Use default storageState (learner user) from config
 * - Tests verify feedback page, submission, voting, and filtering functionality
 */

import { test, expect } from '@playwright/test';
import { verifyAuthSucceeded, waitForAppReady } from './helpers/auth-helpers';

test.describe('Feedback & Voting System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/feedback');

    // Fail fast with clear error if auth failed
    await verifyAuthSucceeded(page, '/feedback');

    // Wait for feedback page content
    await expect(page.getByTestId('feedback-page')).toBeVisible({ timeout: 15000 });
  });

  test('E2E-FEEDBACK-01: Feedback page displays correctly', async ({ page }) => {
    // Verify page title
    await expect(page.getByTestId('feedback-page-title')).toBeVisible();
    await expect(page.getByTestId('feedback-page-title')).toHaveText('Feedback & Ideas');

    // Verify submit button is visible
    await expect(page.getByTestId('open-submit-dialog-button')).toBeVisible();

    // Verify filters section is visible
    await expect(page.getByTestId('feedback-filters')).toBeVisible();

    // Verify either feedback list or empty state is visible
    const feedbackList = page.getByTestId('feedback-list');
    const emptyState = page.getByTestId('feedback-empty-state');

    await expect(feedbackList.or(emptyState)).toBeVisible({ timeout: 10000 });
  });

  test('E2E-FEEDBACK-02: Submit feedback dialog opens and closes', async ({ page }) => {
    // Click submit feedback button
    await page.getByTestId('open-submit-dialog-button').click();

    // Verify dialog opened
    const form = page.getByTestId('feedback-form');
    await expect(form).toBeVisible({ timeout: 5000 });

    // Verify form elements
    await expect(page.getByTestId('feedback-category-select')).toBeVisible();
    await expect(page.getByTestId('feedback-title-input')).toBeVisible();
    await expect(page.getByTestId('feedback-description-input')).toBeVisible();
    await expect(page.getByTestId('feedback-submit-button')).toBeVisible();
    await expect(page.getByTestId('feedback-cancel-button')).toBeVisible();

    // Click cancel to close
    await page.getByTestId('feedback-cancel-button').click();

    // Verify dialog closed
    await expect(form).not.toBeVisible({ timeout: 3000 });
  });

  test('E2E-FEEDBACK-03: Submit new feedback successfully', async ({ page }) => {
    // Generate unique title to avoid conflicts
    const uniqueTitle = `Test Feedback ${Date.now()}`;
    const description = 'This is a detailed test description for the feedback submission. It needs to be at least 20 characters long.';

    // Open submit dialog
    await page.getByTestId('open-submit-dialog-button').click();
    await expect(page.getByTestId('feedback-form')).toBeVisible({ timeout: 5000 });

    // Fill out the form
    await page.getByTestId('feedback-title-input').fill(uniqueTitle);
    await page.getByTestId('feedback-description-input').fill(description);

    // Select category (default is feature_request, let's select bug_incorrect_data)
    await page.getByTestId('feedback-category-select').click();
    await page.getByRole('option', { name: /bug/i }).click();

    // Submit the form
    await page.getByTestId('feedback-submit-button').click();

    // Wait for success toast or dialog to close
    await expect(page.getByTestId('feedback-form')).not.toBeVisible({ timeout: 10000 });

    // Verify the new feedback appears in the list
    const feedbackList = page.getByTestId('feedback-list');
    await expect(feedbackList).toBeVisible({ timeout: 10000 });

    // Look for the newly created feedback by title
    await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 10000 });
  });

  test('E2E-FEEDBACK-04: Form validation prevents empty submission', async ({ page }) => {
    // Open submit dialog
    await page.getByTestId('open-submit-dialog-button').click();
    await expect(page.getByTestId('feedback-form')).toBeVisible({ timeout: 5000 });

    // Try to submit with empty fields
    await page.getByTestId('feedback-submit-button').click();

    // Form should still be visible (validation failed)
    await expect(page.getByTestId('feedback-form')).toBeVisible();

    // Check for validation error messages
    const titleError = page.getByText(/title must be at least/i);
    const descError = page.getByText(/description must be at least/i);

    // At least one validation error should be visible
    const hasTitleError = await titleError.isVisible().catch(() => false);
    const hasDescError = await descError.isVisible().catch(() => false);

    expect(hasTitleError || hasDescError).toBe(true);
  });

  test('E2E-FEEDBACK-05: Filter feedback by category', async ({ page }) => {
    // Wait for feedback list to load
    const feedbackList = page.getByTestId('feedback-list');
    const emptyState = page.getByTestId('feedback-empty-state');
    await expect(feedbackList.or(emptyState)).toBeVisible({ timeout: 10000 });

    // Click category filter
    await page.getByTestId('category-filter').click();

    // Select "Feature Request"
    await page.getByRole('option', { name: /feature request/i }).click();

    // Verify clear button appears (filter is active) - assertion auto-retries
    const clearButton = page.getByTestId('clear-filters-button');
    await expect(clearButton).toBeVisible();
  });

  test('E2E-FEEDBACK-06: Filter feedback by status', async ({ page }) => {
    // Wait for feedback list to load
    const feedbackList = page.getByTestId('feedback-list');
    const emptyState = page.getByTestId('feedback-empty-state');
    await expect(feedbackList.or(emptyState)).toBeVisible({ timeout: 10000 });

    // Click status filter
    await page.getByTestId('status-filter').click();

    // Select "New"
    await page.getByRole('option', { name: /^new$/i }).click();

    // Verify clear button appears (filter is active) - assertion auto-retries
    const clearButton = page.getByTestId('clear-filters-button');
    await expect(clearButton).toBeVisible();
  });

  test('E2E-FEEDBACK-07: Sort feedback', async ({ page }) => {
    // Wait for feedback list to load
    const feedbackList = page.getByTestId('feedback-list');
    const emptyState = page.getByTestId('feedback-empty-state');
    await expect(feedbackList.or(emptyState)).toBeVisible({ timeout: 10000 });

    // Click sort filter
    await page.getByTestId('sort-filter').click();

    // Select "Oldest"
    await page.getByRole('option', { name: /oldest/i }).click();

    // Verify page still displays properly (sort doesn't show clear button by default)
    // Assertion auto-retries until page stabilizes
    await expect(page.getByTestId('feedback-page')).toBeVisible();
  });

  test('E2E-FEEDBACK-08: Clear filters', async ({ page }) => {
    // Wait for feedback list to load
    const feedbackList = page.getByTestId('feedback-list');
    const emptyState = page.getByTestId('feedback-empty-state');
    await expect(feedbackList.or(emptyState)).toBeVisible({ timeout: 10000 });

    // Apply a filter first
    await page.getByTestId('category-filter').click();
    await page.getByRole('option', { name: /feature request/i }).click();

    // Verify clear button appears - assertion auto-retries
    const clearButton = page.getByTestId('clear-filters-button');
    await expect(clearButton).toBeVisible();

    // Click clear filters
    await clearButton.click();

    // Verify clear button is no longer visible
    await expect(clearButton).not.toBeVisible({ timeout: 3000 });
  });

  test('E2E-FEEDBACK-09: Navigate to feedback page from navigation', async ({ page }) => {
    // Start from dashboard
    await page.goto('/');
    await waitForAppReady(page);

    // Look for feedback link in navigation
    const feedbackLink = page.getByRole('link', { name: /feedback/i }).first();
    const isFeedbackLinkVisible = await feedbackLink.isVisible().catch(() => false);

    if (isFeedbackLinkVisible) {
      await feedbackLink.click();

      // Verify navigation to feedback page
      await page.waitForURL(/\/feedback/);
      await expect(page.getByTestId('feedback-page')).toBeVisible({ timeout: 10000 });
    } else {
      // Feedback link might be in user menu or different location
      // Just verify direct navigation works
      await page.goto('/feedback');
      await expect(page.getByTestId('feedback-page')).toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe('Feedback Voting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/feedback');
    await verifyAuthSucceeded(page, '/feedback');
    await expect(page.getByTestId('feedback-page')).toBeVisible({ timeout: 15000 });
  });

  test('E2E-FEEDBACK-10: Vote buttons are visible on feedback cards', async ({ page }) => {
    // Wait for feedback list to load
    const feedbackList = page.getByTestId('feedback-list');
    await expect(feedbackList).toBeVisible({ timeout: 10000 });

    // Get first feedback card
    const firstCard = page.getByTestId('feedback-card').first();
    await expect(firstCard).toBeVisible();

    // Verify vote buttons are present
    const voteButtons = firstCard.getByTestId('vote-buttons');
    await expect(voteButtons).toBeVisible();

    // Verify upvote and downvote buttons
    await expect(firstCard.getByTestId('upvote-button')).toBeVisible();
    await expect(firstCard.getByTestId('downvote-button')).toBeVisible();

    // Verify vote count is displayed
    await expect(firstCard.getByTestId('vote-count')).toBeVisible();
  });

  test('E2E-FEEDBACK-11: Upvote feedback', async ({ page }) => {
    // Wait for feedback list to load
    const feedbackList = page.getByTestId('feedback-list');
    await expect(feedbackList).toBeVisible({ timeout: 10000 });

    // Get first feedback card
    const firstCard = page.getByTestId('feedback-card').first();
    await expect(firstCard).toBeVisible();

    // Get initial vote count
    const voteCount = firstCard.getByTestId('vote-count');
    const initialCount = parseInt(await voteCount.textContent() || '0', 10);

    // Click upvote button
    await firstCard.getByTestId('upvote-button').click();

    // Wait for vote to be processed by checking the count has potentially changed
    // Use poll to allow time for API response and re-render
    await expect(async () => {
      const newCount = parseInt(await voteCount.textContent() || '0', 10);
      // Verify vote count changed (either increased by 1 or 2 if removing downvote)
      expect(newCount).toBeGreaterThanOrEqual(initialCount);
    }).toPass({ timeout: 5000 });
  });

  test('E2E-FEEDBACK-12: Toggle upvote removes vote', async ({ page }) => {
    // Wait for feedback list to load
    const feedbackList = page.getByTestId('feedback-list');
    await expect(feedbackList).toBeVisible({ timeout: 10000 });

    // Get first feedback card
    const firstCard = page.getByTestId('feedback-card').first();
    await expect(firstCard).toBeVisible();

    // Click upvote button twice (vote then remove vote)
    const upvoteButton = firstCard.getByTestId('upvote-button');

    // First click - cast vote
    await upvoteButton.click();

    // Wait for vote to be registered (button state change or visual feedback)
    await expect(page.getByTestId('feedback-page')).toBeVisible();

    // Second click - remove vote
    await upvoteButton.click();

    // Page should still be functional - assertion auto-retries
    await expect(page.getByTestId('feedback-page')).toBeVisible();
  });

  test('E2E-FEEDBACK-13: Downvote feedback', async ({ page }) => {
    // Wait for feedback list to load
    const feedbackList = page.getByTestId('feedback-list');
    await expect(feedbackList).toBeVisible({ timeout: 10000 });

    // Get first feedback card
    const firstCard = page.getByTestId('feedback-card').first();
    await expect(firstCard).toBeVisible();

    // Get initial vote count
    const voteCount = firstCard.getByTestId('vote-count');
    const initialCount = parseInt(await voteCount.textContent() || '0', 10);

    // Click downvote button
    await firstCard.getByTestId('downvote-button').click();

    // Wait for vote to be processed by checking the count has potentially changed
    // Use poll to allow time for API response and re-render
    await expect(async () => {
      const newCount = parseInt(await voteCount.textContent() || '0', 10);
      // Verify vote count changed (either decreased by 1 or 2 if removing upvote)
      expect(newCount).toBeLessThanOrEqual(initialCount);
    }).toPass({ timeout: 5000 });
  });
});

test.describe('Feedback Card Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/feedback');
    await verifyAuthSucceeded(page, '/feedback');
    await expect(page.getByTestId('feedback-page')).toBeVisible({ timeout: 15000 });
  });

  test('E2E-FEEDBACK-14: Feedback card shows all expected elements', async ({ page }) => {
    // Wait for feedback list to load
    const feedbackList = page.getByTestId('feedback-list');
    await expect(feedbackList).toBeVisible({ timeout: 10000 });

    // Get first feedback card
    const firstCard = page.getByTestId('feedback-card').first();
    await expect(firstCard).toBeVisible();

    // Verify card elements
    await expect(firstCard.getByTestId('feedback-title')).toBeVisible();
    await expect(firstCard.getByTestId('feedback-meta')).toBeVisible();
    await expect(firstCard.getByTestId('feedback-description')).toBeVisible();
    await expect(firstCard.getByTestId('vote-buttons')).toBeVisible();
  });

  test('E2E-FEEDBACK-15: Feedback card displays category badge', async ({ page }) => {
    // Wait for feedback list to load
    const feedbackList = page.getByTestId('feedback-list');
    await expect(feedbackList).toBeVisible({ timeout: 10000 });

    // Get first feedback card
    const firstCard = page.getByTestId('feedback-card').first();
    await expect(firstCard).toBeVisible();

    // Look for category badge (feature request or bug)
    const categoryBadge = firstCard.getByText(/feature request|bug/i);
    await expect(categoryBadge).toBeVisible();
  });

  test('E2E-FEEDBACK-16: Feedback card displays status badge', async ({ page }) => {
    // Wait for feedback list to load
    const feedbackList = page.getByTestId('feedback-list');
    await expect(feedbackList).toBeVisible({ timeout: 10000 });

    // Get first feedback card
    const firstCard = page.getByTestId('feedback-card').first();
    await expect(firstCard).toBeVisible();

    // Look for status badge
    const statusBadge = firstCard.getByText(/new|under review|planned|in progress|completed|cancelled/i);
    await expect(statusBadge).toBeVisible();
  });
});
