/**
 * E2E Tests: Admin Question Review Modal
 *
 * Tests the question review workflow including:
 * - Viewing pending questions
 * - Approving questions (assigning to deck)
 * - Rejecting questions (deletion)
 * - Language switching in the modal
 *
 * Uses Playwright's storageState pattern for admin authentication.
 * Requires seed data with pending questions.
 */

import { test, expect } from '@playwright/test';
import { verifyAuthSucceeded, waitForAppReady } from './helpers/auth-helpers';

/**
 * Helper function to navigate to News tab and open the discovered articles modal
 * with a pending question for review testing.
 */
async function navigateToReviewModal(page: import('@playwright/test').Page) {
  // Click on the News tab to show news sources section
  await page.getByTestId('admin-tab-news').click();

  // Wait for news sources section to load
  await expect(page.getByTestId('news-sources-section')).toBeVisible({ timeout: 15000 });

  // Wait for sources to load
  const sourceRows = page.locator('[data-testid^="source-row-"]');
  await expect(sourceRows.first()).toBeVisible({ timeout: 20000 });

  // Expand first source to see fetch history
  const firstSourceRow = sourceRows.first();
  const accordionTrigger = firstSourceRow.locator('[data-radix-collection-item]');
  await accordionTrigger.click();

  // Wait for fetch history table to load
  const historyTable = page.getByTestId('fetch-history-table');
  await expect(historyTable.or(page.getByTestId('fetch-history-empty'))).toBeVisible({
    timeout: 15000,
  });

  // Find and click view articles button
  const viewArticlesBtns = page.locator('[data-testid^="view-articles-"]:not([disabled])');
  if ((await viewArticlesBtns.count()) === 0) {
    return { success: false, reason: 'No view articles button available' };
  }

  await viewArticlesBtns.first().click();

  // Wait for discovered articles modal
  await expect(page.getByTestId('discovered-articles-modal')).toBeVisible({ timeout: 10000 });

  // Wait for loading to complete
  const loadingIndicator = page.getByTestId('discovered-articles-loading');
  try {
    await loadingIndicator.waitFor({ state: 'hidden', timeout: 15000 });
  } catch {
    // Loading might not have appeared or already gone
  }

  return { success: true };
}

test.describe('Admin Question Review', () => {
  // Use admin storage state (superuser)
  test.use({ storageState: 'playwright/.auth/admin.json' });

  // Run tests serially to avoid race conditions when seeding the pending question
  // Each test's beforeEach seeds a new pending question, which requires exclusive DB access
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page, request }) => {
    // Seed pending question for each test
    const seedResponse = await request.post(
      'http://localhost:8000/api/v1/test/seed/pending-question'
    );
    expect(seedResponse.ok()).toBeTruthy();

    await page.goto('/admin');

    // Fail fast with clear error if auth failed
    await verifyAuthSucceeded(page, '/admin');

    // Wait for app to be ready
    await waitForAppReady(page);

    // Wait for admin tab switcher to load
    await expect(page.getByTestId('admin-tab-switcher')).toBeVisible({ timeout: 15000 });
  });

  test('E2E-QR.1: Admin can view pending questions via Review Question button', async ({
    page,
  }) => {
    // Navigate to discovered articles modal
    const navResult = await navigateToReviewModal(page);
    if (!navResult.success) {
      test.skip(true, navResult.reason || 'Could not navigate to review modal');
      return;
    }

    // Ensure no review modal is already open (dismiss if present)
    // Wait a moment for any animations to settle after navigation
    await page.waitForTimeout(500);
    const existingModal = page.getByTestId('question-review-modal');
    if (await existingModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Use force:true to handle potential overlay issues with nested modals
      const closeBtn = existingModal.getByRole('button', { name: 'Close' });
      await closeBtn.click({ force: true });
      await expect(existingModal).not.toBeVisible({ timeout: 5000 });
    }

    // Look for a Review Question button (indicates generated question ready for review)
    const reviewBtns = page.locator('[data-testid^="review-question-btn-"]');
    if ((await reviewBtns.count()) === 0) {
      // No review buttons - try to generate a question first
      const generateBtns = page.locator('[data-testid^="generate-question-btn-"]');
      if ((await generateBtns.count()) === 0) {
        test.skip(true, 'No articles available for question generation');
        return;
      }

      // Click generate on first article
      await generateBtns.first().click();

      // Wait for generation to complete (button should change to review)
      await expect(page.locator('[data-testid="review-question-btn-0"]')).toBeVisible({
        timeout: 30000,
      });
    }

    // Click review button
    const reviewBtn = page.locator('[data-testid^="review-question-btn-"]').first();
    await reviewBtn.click();

    // Verify review modal opened
    await expect(page.getByTestId('question-review-modal')).toBeVisible({ timeout: 5000 });

    // Verify question content is displayed (the seeded question)
    await expect(
      page.getByText('Who was the first president of the Republic of Cyprus?')
    ).toBeVisible();
  });

  test('E2E-QR.2: Admin can approve a pending question', async ({ page }) => {
    const navResult = await navigateToReviewModal(page);
    if (!navResult.success) {
      test.skip(true, navResult.reason || 'Could not navigate to review modal');
      return;
    }

    // Ensure no review modal is already open (dismiss if present)
    // Wait a moment for any animations to settle after navigation
    await page.waitForTimeout(500);
    const existingModal = page.getByTestId('question-review-modal');
    if (await existingModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Use force:true to handle potential overlay issues with nested modals
      const closeBtn = existingModal.getByRole('button', { name: 'Close' });
      await closeBtn.click({ force: true });
      await expect(existingModal).not.toBeVisible({ timeout: 5000 });
    }

    // Look for or create a review button
    let reviewBtn = page.locator('[data-testid^="review-question-btn-"]').first();
    if (!(await reviewBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      const generateBtns = page.locator('[data-testid^="generate-question-btn-"]');
      if ((await generateBtns.count()) === 0) {
        test.skip(true, 'No articles available');
        return;
      }
      await generateBtns.first().click();
      await expect(page.locator('[data-testid^="review-question-btn-"]').first()).toBeVisible({
        timeout: 30000,
      });
      reviewBtn = page.locator('[data-testid^="review-question-btn-"]').first();
    }

    await reviewBtn.click();
    await expect(page.getByTestId('question-review-modal')).toBeVisible({ timeout: 5000 });

    // Approve button should be disabled without deck selection
    const approveBtn = page.getByRole('button', { name: 'Approve' });
    await expect(approveBtn).toBeDisabled();

    // Select a deck using the dropdown
    const deckSelector = page.getByRole('combobox');
    await deckSelector.click();

    // Select first available deck
    const deckOptions = page.getByRole('option');
    await expect(deckOptions.first()).toBeVisible({ timeout: 5000 });
    await deckOptions.first().click();

    // Now approve button should be enabled
    await expect(approveBtn).toBeEnabled();

    // Click approve
    await approveBtn.click();

    // Verify success toast
    await expect(page.getByText('Question approved successfully')).toBeVisible({ timeout: 5000 });

    // Verify modal closed
    await expect(page.getByTestId('question-review-modal')).not.toBeVisible({ timeout: 3000 });
  });

  test('E2E-QR.3: Admin can reject a pending question', async ({ page }) => {
    const navResult = await navigateToReviewModal(page);
    if (!navResult.success) {
      test.skip(true, navResult.reason || 'Could not navigate to review modal');
      return;
    }

    // Ensure no review modal is already open (dismiss if present)
    // Wait a moment for any animations to settle after navigation
    await page.waitForTimeout(500);
    const existingModal = page.getByTestId('question-review-modal');
    if (await existingModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Use force:true to handle potential overlay issues with nested modals
      const closeBtn = existingModal.getByRole('button', { name: 'Close' });
      await closeBtn.click({ force: true });
      await expect(existingModal).not.toBeVisible({ timeout: 5000 });
    }

    // Look for or create a review button
    let reviewBtn = page.locator('[data-testid^="review-question-btn-"]').first();
    if (!(await reviewBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      const generateBtns = page.locator('[data-testid^="generate-question-btn-"]');
      if ((await generateBtns.count()) === 0) {
        test.skip(true, 'No articles available');
        return;
      }
      await generateBtns.first().click();
      await expect(page.locator('[data-testid^="review-question-btn-"]').first()).toBeVisible({
        timeout: 30000,
      });
      reviewBtn = page.locator('[data-testid^="review-question-btn-"]').first();
    }

    await reviewBtn.click();
    await expect(page.getByTestId('question-review-modal')).toBeVisible({ timeout: 5000 });

    // Click Reject button
    const rejectBtn = page.getByRole('button', { name: 'Reject' });
    await rejectBtn.click();

    // Verify confirmation dialog appears
    await expect(page.getByText('Delete Question?')).toBeVisible({ timeout: 3000 });

    // Confirm deletion
    await page.getByRole('button', { name: 'Delete' }).click();

    // Verify success toast
    await expect(page.getByText('Question deleted successfully')).toBeVisible({ timeout: 5000 });

    // Verify modal closed
    await expect(page.getByTestId('question-review-modal')).not.toBeVisible({ timeout: 3000 });
  });

  test('E2E-QR.4: Language switching in review modal', async ({ page }) => {
    const navResult = await navigateToReviewModal(page);
    if (!navResult.success) {
      test.skip(true, navResult.reason || 'Could not navigate to review modal');
      return;
    }

    // Ensure no review modal is already open (dismiss if present)
    // Wait a moment for any animations to settle after navigation
    await page.waitForTimeout(500);
    const existingModal = page.getByTestId('question-review-modal');
    if (await existingModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Use force:true to handle potential overlay issues with nested modals
      const closeBtn = existingModal.getByRole('button', { name: 'Close' });
      await closeBtn.click({ force: true });
      await expect(existingModal).not.toBeVisible({ timeout: 5000 });
    }

    // Look for or create a review button
    let reviewBtn = page.locator('[data-testid^="review-question-btn-"]').first();
    if (!(await reviewBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      const generateBtns = page.locator('[data-testid^="generate-question-btn-"]');
      if ((await generateBtns.count()) === 0) {
        test.skip(true, 'No articles available');
        return;
      }
      await generateBtns.first().click();
      await expect(page.locator('[data-testid^="review-question-btn-"]').first()).toBeVisible({
        timeout: 30000,
      });
      reviewBtn = page.locator('[data-testid^="review-question-btn-"]').first();
    }

    await reviewBtn.click();
    await expect(page.getByTestId('question-review-modal')).toBeVisible({ timeout: 5000 });

    // Verify English is default (from seeded question)
    await expect(
      page.getByText('Who was the first president of the Republic of Cyprus?')
    ).toBeVisible();

    // Switch to Greek
    await page.getByRole('tab', { name: 'Greek' }).click();
    await expect(
      page.getByText('Ποιος ήταν ο πρώτος πρόεδρος της Κυπριακής Δημοκρατίας;')
    ).toBeVisible();

    // Switch to Russian
    await page.getByRole('tab', { name: 'Russian' }).click();
    await expect(page.getByText('Кто был первым президентом Республики Кипр?')).toBeVisible();
  });

  test('E2E-QR.5: Correct answer is highlighted in review modal', async ({ page }) => {
    const navResult = await navigateToReviewModal(page);
    if (!navResult.success) {
      test.skip(true, navResult.reason || 'Could not navigate to review modal');
      return;
    }

    // Ensure no review modal is already open (dismiss if present)
    // Wait a moment for any animations to settle after navigation
    await page.waitForTimeout(500);
    const existingModal = page.getByTestId('question-review-modal');
    if (await existingModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Use force:true to handle potential overlay issues with nested modals
      const closeBtn = existingModal.getByRole('button', { name: 'Close' });
      await closeBtn.click({ force: true });
      await expect(existingModal).not.toBeVisible({ timeout: 5000 });
    }

    // Look for or create a review button
    let reviewBtn = page.locator('[data-testid^="review-question-btn-"]').first();
    if (!(await reviewBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      const generateBtns = page.locator('[data-testid^="generate-question-btn-"]');
      if ((await generateBtns.count()) === 0) {
        test.skip(true, 'No articles available');
        return;
      }
      await generateBtns.first().click();
      await expect(page.locator('[data-testid^="review-question-btn-"]').first()).toBeVisible({
        timeout: 30000,
      });
      reviewBtn = page.locator('[data-testid^="review-question-btn-"]').first();
    }

    await reviewBtn.click();
    await expect(page.getByTestId('question-review-modal')).toBeVisible({ timeout: 5000 });

    // Verify correct option (B - Makarios III) has green styling
    // The seeded question has correct_option=2 which is option B
    const optionB = page.getByTestId('option-B');
    await expect(optionB).toBeVisible();
    await expect(optionB).toHaveClass(/bg-green/);
    await expect(optionB.getByText('Correct')).toBeVisible();
  });
});
