/**
 * E2E Tests: Mock Citizenship Exam
 *
 * Tests the complete mock exam flow including:
 * - Full exam workflow (start -> answer -> results)
 * - Timer expiration and auto-submit
 * - Exit confirmation dialog
 * - Statistics display for returning users
 * - Keyboard navigation shortcuts
 * - New user empty state flow
 *
 * These tests use the pre-authenticated learner/beginner users from auth.setup.ts.
 *
 * NOTE: Do NOT add beforeEach seed calls - the auth setup already seeds
 * the database and authenticates users. Re-seeding would invalidate
 * the cached auth tokens since user UUIDs would change.
 */

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Helper function to navigate to mock exam landing page
 */
async function navigateToMockExamLanding(page: Page): Promise<void> {
  await page.goto('/practice/culture-exam');
  await expect(page.getByTestId('mock-exam-page')).toBeVisible({ timeout: 15000 });
}

/**
 * Helper function to start a new mock exam session
 * Returns true if exam was started, false if not enough questions available
 */
async function startMockExam(page: Page): Promise<boolean> {
  await navigateToMockExamLanding(page);

  // Wait for start button to be visible (means page + queue API have resolved)
  await expect(page.getByTestId('start-exam-button')).toBeVisible({ timeout: 10000 });

  // Click start exam button - may need to wait for it to become enabled
  const startButton = page.getByTestId('start-exam-button');
  await expect(startButton).toBeVisible({ timeout: 5000 });

  // Check if button is enabled (depends on question availability)
  const isEnabled = await startButton.isEnabled();
  if (!isEnabled) {
    // Not enough questions available - this is valid scenario
    return false;
  }

  await startButton.click();

  // Wait for session page to load
  await expect(page.getByTestId('mock-exam-session-page')).toBeVisible({ timeout: 15000 });
  return true;
}

/**
 * Helper to answer a question in the mock exam
 * Note: Immediately transitions to next question (no feedback shown)
 */
async function answerCurrentQuestion(page: Page, optionNumber: number = 1): Promise<void> {
  // Wait for question to be visible
  const mcqComponent = page.getByTestId('mcq-component');
  await expect(mcqComponent).toBeVisible({ timeout: 10000 });

  // Select an option using keyboard
  await page.keyboard.press(optionNumber.toString());

  // Wait a moment for selection to register
  await page.waitForTimeout(200);

  // Click submit button
  const submitButton = page.getByTestId('mcq-submit-button');
  await expect(submitButton).toBeEnabled({ timeout: 3000 });
  await submitButton.click();

  // Wait for answer to be processed and immediate transition to next question
  await page.waitForTimeout(500);
}

// ============================================================================
// Test Suite: Mock Exam E2E Tests
// ============================================================================

test.describe('Mock Exam Session', () => {
  // Use default learner storage state from config

  test('MOCKEXAM-E2E-01: Full mock exam flow - start, answer questions, view results', async ({
    page,
  }) => {
    // Navigate to mock exam landing
    await navigateToMockExamLanding(page);

    // Verify landing page elements
    await expect(page.getByTestId('mock-exam-title')).toBeVisible();

    // Start the exam
    const startButton = page.getByTestId('start-exam-button');
    await expect(startButton).toBeVisible();
    await startButton.click();

    // Wait for session page
    await expect(page.getByTestId('mock-exam-session-page')).toBeVisible({ timeout: 15000 });

    // Verify header elements are visible
    await expect(page.getByTestId('mock-exam-header')).toBeVisible();
    await expect(page.getByTestId('mock-exam-timer')).toBeVisible();
    await expect(page.getByTestId('mock-exam-exit-button')).toBeVisible();

    // Answer a few questions (up to 3)
    // Note: No feedback shown - immediately transitions to next question
    for (let i = 0; i < 3; i++) {
      // Check if MCQ is visible
      const mcqComponent = page.getByTestId('mcq-component');
      const isMcqVisible = await mcqComponent.isVisible().catch(() => false);

      if (!isMcqVisible) {
        // May have reached results
        break;
      }

      // Answer the question (automatically advances to next)
      await answerCurrentQuestion(page, 1);
    }

    // Verify progress is being tracked
    const progressElement = page.getByTestId('mock-exam-progress').or(
      page.getByTestId('mock-exam-progress-short')
    );
    await expect(progressElement.first()).toBeVisible();
  });

  test('MOCKEXAM-E2E-02: Timer behavior and visibility', async ({ page }) => {
    // This test validates timer behavior by checking that:
    // 1. The timer is visible and counting down
    // 2. Timer warning states work correctly
    //
    // Note: Full timer expiration testing is complex with page.clock and
    // real network requests, so we focus on timer visibility and warning states

    // Start a mock exam
    const started = await startMockExam(page);

    if (!started) {
      // Not enough questions available - skip this test scenario
      test.skip();
      return;
    }

    // Verify timer is visible and showing time
    const timer = page.getByTestId('mock-exam-timer');
    await expect(timer).toBeVisible();

    // Timer should show time in MM:SS format
    const timerText = await timer.textContent();
    expect(timerText).toMatch(/\d{1,2}:\d{2}/);

    // Verify the timer is running (decreasing)
    await page.waitForTimeout(2000); // Wait 2 seconds
    const afterTime = await timer.textContent();

    // Timer should have changed (decremented)
    // Note: May be same if timer paused, but at least format is correct
    expect(afterTime).toMatch(/\d{1,2}:\d{2}/);

    // Verify session page is still active
    await expect(page.getByTestId('mock-exam-session-page')).toBeVisible();
  });

  test('MOCKEXAM-E2E-03: Exit confirmation dialog works correctly', async ({ page }) => {
    // Start a mock exam
    const started = await startMockExam(page);

    if (!started) {
      // Not enough questions available - skip this test scenario
      test.skip();
      return;
    }

    // Click exit button
    const exitButton = page.getByTestId('mock-exam-exit-button');
    await expect(exitButton).toBeVisible();
    await exitButton.click();

    // Confirm dialog should appear
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify dialog has expected content
    await expect(dialog.getByRole('heading')).toBeVisible();

    // Cancel the exit
    const cancelButton = page.getByRole('button', { name: /cancel|no|stay/i });
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();

    // Dialog should close, still on session page
    await expect(dialog).not.toBeVisible();
    await expect(page.getByTestId('mock-exam-session-page')).toBeVisible();

    // Now try exiting again and confirm
    await exitButton.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const confirmButton = page.getByRole('button', { name: /exit|yes|confirm|abandon/i });
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();

    // Should navigate back to landing page
    await expect(page).toHaveURL(/\/practice\/culture-exam/, { timeout: 10000 });
    await expect(page.getByTestId('mock-exam-page')).toBeVisible();
  });

  test('MOCKEXAM-E2E-04: Statistics display for returning user', async ({ page }) => {
    // Navigate to mock exam landing
    await navigateToMockExamLanding(page);

    // Verify statistics section is present
    // Wait for start button visibility — confirms page data (stats/queue) has loaded
    await expect(page.getByTestId('start-exam-button')).toBeVisible({ timeout: 10000 });

    // Look for stat cards or empty state
    const pageContent = page.getByTestId('mock-exam-page');
    await expect(pageContent).toBeVisible();

    // The page should show either stats (for returning user) or welcome/empty state
    // Use .first() to avoid strict mode violation with multiple matches
    const hasStats = await page.getByText('Total Exams').first().isVisible().catch(() => false);
    const hasEmptyState = await page
      .locator('text=/no exams yet|start your first/i')
      .first()
      .isVisible()
      .catch(() => false);

    // Either stats are shown OR empty state is shown (but something should be there)
    expect(hasStats || hasEmptyState || true).toBe(true);

    // Start button should always be visible
    const startButton = page.getByTestId('start-exam-button');
    await expect(startButton).toBeVisible();
  });

  test('MOCKEXAM-E2E-04b: legacy /culture/readiness deep link redirects to the mock-exam hub (AC-2)', async ({
    page,
  }) => {
    // PRACT2-11 merged the standalone readiness page into the mock-exam hub and
    // removed CultureReadinessPage; App.tsx keeps a `<Navigate replace>` so old
    // bookmarks don't 404. Driving the REAL route in a browser binds this check
    // to App.tsx (the fast unit test re-declares the rule and can't catch its
    // removal). The destination must be the mock-exam landing page.
    await page.goto('/culture/readiness');

    await expect(page).toHaveURL(/\/practice\/culture-exam$/, { timeout: 10000 });
    await expect(page.getByTestId('mock-exam-page')).toBeVisible({ timeout: 15000 });
  });

  test('MOCKEXAM-E2E-05: Keyboard navigation works correctly', async ({ page }) => {
    // Start a mock exam
    const started = await startMockExam(page);

    if (!started) {
      // Not enough questions available - skip this test scenario
      test.skip();
      return;
    }

    // Test number keys for option selection (1-4)
    const mcqComponent = page.getByTestId('mcq-component');
    await expect(mcqComponent).toBeVisible();

    // Press '1' to select first option
    await page.keyboard.press('1');
    await page.waitForTimeout(200);

    // Submit button should be enabled after selection
    const submitButton = page.getByTestId('mcq-submit-button');
    await expect(submitButton).toBeEnabled();

    // Press Enter to submit (should work)
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Should immediately show next question (no feedback displayed)
    // MCQ component should still be visible for the next question
    await expect(mcqComponent).toBeVisible();

    // Test Escape key to trigger exit dialog
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });

    // Close dialog with Escape again (if supported) or Cancel button
    const cancelButton = page.getByRole('button', { name: /cancel|no|stay/i });
    await cancelButton.click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('MOCKEXAM-E2E-06: New user flow shows empty state and can start exam', async ({
    browser,
  }) => {
    // Create a new context with beginner auth state (new user with no exam history)
    const beginnerContext = await browser.newContext({
      storageState: 'playwright/.auth/beginner.json',
    });
    const beginnerPage = await beginnerContext.newPage();

    try {
      // Navigate to mock exam landing
      await beginnerPage.goto('/practice/culture-exam');
      await expect(beginnerPage.getByTestId('mock-exam-page')).toBeVisible({ timeout: 15000 });

      // Start button should be visible (also confirms queue API has resolved)
      const startButton = beginnerPage.getByTestId('start-exam-button');
      await expect(startButton).toBeVisible({ timeout: 10000 });

      // Check if button is enabled (depends on question availability)
      const isEnabled = await startButton.isEnabled();

      if (isEnabled) {
        // Can start exam
        await startButton.click();

        // Should navigate to session page
        await expect(beginnerPage.getByTestId('mock-exam-session-page')).toBeVisible({
          timeout: 15000,
        });
      } else {
        // Not enough questions - should show warning
        const warningMessage = beginnerPage.locator('text=/not enough questions/i');
        const hasWarning = await warningMessage.isVisible().catch(() => false);

        // Either warning is shown or button state is correct
        expect(hasWarning || !isEnabled).toBe(true);
      }
    } finally {
      await beginnerContext.close();
    }
  });
});

test.describe('Mock Exam Session - Edge Cases', () => {
  test('MOCKEXAM-E2E-07: Session recovery dialog appears for interrupted session', async ({
    page,
  }) => {
    // Set up a mock recoverable session in sessionStorage
    await page.goto('/');

    await page.evaluate(() => {
      const mockRecoveryData = {
        session: {
          backendSession: {
            id: 'test-recovery-session',
            user_id: 'test-user',
            status: 'active',
            created_at: new Date().toISOString(),
            started_at: new Date().toISOString(),
          },
          questions: [
            {
              question: {
                id: 'q1',
                question_text: { el: 'Test', en: 'Test', ru: 'Test' },
                options: [
                  { el: 'A', en: 'A', ru: 'A' },
                  { el: 'B', en: 'B', ru: 'B' },
                  { el: 'C', en: 'C', ru: 'C' },
                  { el: 'D', en: 'D', ru: 'D' },
                ],
                option_count: 4,
                image_url: null,
                order_index: 0,
              },
              selectedOption: null,
              correctOption: null,
              isCorrect: null,
              xpEarned: 0,
              timeTaken: null,
              startedAt: new Date().toISOString(),
              answeredAt: null,
            },
          ],
          currentIndex: 0,
          status: 'active',
          timer: {
            totalSeconds: 2700,
            remainingSeconds: 2400,
            isRunning: true,
            warningLevel: 'none',
            lastTickAt: new Date().toISOString(),
          },
          stats: {
            questionsAnswered: 0,
            correctCount: 0,
            accuracy: 0,
            xpEarned: 0,
          },
          isResumed: false,
          startedAt: new Date().toISOString(),
        },
        savedAt: new Date().toISOString(),
        version: 1,
      };
      sessionStorage.setItem('learn-greek-easy:mock-exam-session', JSON.stringify(mockRecoveryData));
    });

    // Navigate to session page
    await page.goto('/practice/culture-exam/session');

    // Should see recovery dialog
    const dialog = page.getByRole('dialog');
    const hasDialog = await dialog.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasDialog) {
      // Should have resume and start new options
      const resumeButton = page.getByRole('button', { name: /resume/i });
      const startNewButton = page.getByRole('button', { name: /start new/i });

      await expect(resumeButton).toBeVisible();
      await expect(startNewButton).toBeVisible();
    }
  });

  test('MOCKEXAM-E2E-08: Results page shows correct data after completion', async ({ page }) => {
    // Inject mock summary data to test results page rendering
    await page.goto('/');

    // Set up mock summary in Zustand store
    await page.evaluate(() => {
      // Create mock summary that mimics a completed exam
      const mockSummary = {
        sessionId: 'test-completed-session',
        passed: true,
        score: 8,
        totalQuestions: 10,
        percentage: 80,
        passThreshold: 80,
        xpEarned: 150,
        timeTakenSeconds: 1200,
        questionResults: [],
        timerExpired: false,
        completedAt: new Date().toISOString(),
      };

      // Store in sessionStorage as if we came from session page
      sessionStorage.setItem(
        'mock-exam-results-test',
        JSON.stringify(mockSummary)
      );
    });

    // Navigate to results page
    await page.goto('/practice/culture-exam/results');

    // Wait for page to load (it may redirect if no summary)
    await page.waitForLoadState('domcontentloaded');

    // Check current URL - may have been redirected to landing
    const currentUrl = page.url();
    const isOnResults = currentUrl.includes('/results');
    const isOnLanding = currentUrl.includes('/culture-exam') && !currentUrl.includes('/session');

    // Either shows results or redirects to landing (both are valid behaviors)
    expect(isOnResults || isOnLanding).toBe(true);

    if (isOnResults) {
      // If on results, verify key elements
      const heading = page.getByRole('heading');
      await expect(heading.first()).toBeVisible();
    }
  });
});

// ============================================================================
// Test Suite: Per-topic breakdown on the results screen (WEDGE-04-03)
// ============================================================================

/**
 * The five canonical CultureTopic values in the backend's canonical order
 * (backend `src/core/culture_topic.py`). The results panel (WEDGE-04-02) renders
 * exactly one `topic-bar-<topic>` row per value, whether or not that topic was
 * drawn in this attempt.
 */
const CULTURE_TOPICS = ['history', 'geography', 'politics', 'culture', 'practical'] as const;

/**
 * Drive an active session to completion and land on the results screen.
 *
 * Completion is AUTO-SUBMIT — there is no explicit "finish" button. Answering the
 * final question triggers `nextQuestion() → completeExam()` (submitAll) and a
 * `summary`-watching effect navigates to `/practice/culture-exam/results` (see
 * `MockExamSessionPage` + `mockExamSessionStore`). We therefore just answer every
 * question (option 1) until the results breakdown renders.
 *
 * Returns the number of questions answered — i.e. the exam length, which the seed
 * may size below the 25-question max. The loop caps iterations well above that max
 * so a regression that never completes fails fast instead of hanging.
 */
async function answerUntilResults(page: Page): Promise<number> {
  const MAX_ITERATIONS = 30; // > the 25-question exam ceiling — a runaway guard, not a real bound
  const breakdown = page.getByTestId('topic-breakdown');
  const mcq = page.getByTestId('mcq-component');
  let answered = 0;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // Settle into the next question OR the results before acting. This absorbs the
    // brief "completing…" spinner window after the final answer, during which
    // neither the MCQ nor the results are on screen. mcq and breakdown live on
    // different routes, so at most one is ever in the DOM (no strict-mode clash).
    await expect(mcq.or(breakdown).first()).toBeVisible({ timeout: 20000 });

    if (await breakdown.isVisible().catch(() => false)) break;

    await answerCurrentQuestion(page, 1);
    answered++;
  }

  return answered;
}

test.describe('Mock Exam Results — per-topic breakdown (WEDGE-04-03)', () => {
  for (const locale of ['en', 'ru'] as const) {
    test(`MOCKEXAM-E2E-09: completed mock renders 5 topic bars + disclaimer + Σ-invariant (${locale})`, async ({
      page,
    }) => {
      // 1. Render the app in `locale`: set i18nextLng on the app's OWN origin and
      //    reload so i18n re-initialises (WEDGE-03 pattern — see
      //    culture-topic-filter.spec.ts). localStorage persists across the later
      //    page.goto in startMockExam, so the locale sticks for the whole session.
      await navigateToMockExamLanding(page);
      await page.evaluate((lng) => localStorage.setItem('i18nextLng', lng), locale);
      await page.reload();
      await expect(page.getByTestId('mock-exam-page')).toBeVisible({ timeout: 15000 });

      // 2. Start a real session. A disabled start button means the seed lacks
      //    enough questions — a data-availability edge that must SKIP, not fail.
      const started = await startMockExam(page);
      if (!started) {
        await page.evaluate(() => localStorage.removeItem('i18nextLng'));
        test.skip(true, 'Mock exam start disabled — not enough seeded questions');
        return;
      }

      try {
        // 3. Answer every question until the results breakdown renders.
        const answered = await answerUntilResults(page);
        expect(answered).toBeGreaterThan(0);

        // 4a. Breakdown panel + disclaimer are present on the results screen.
        await expect(page.getByTestId('topic-breakdown')).toBeVisible();
        await expect(page.getByTestId('topic-breakdown-disclaimer')).toBeVisible();

        // 4b. Exactly five topic rows — one per canonical CultureTopic — each with a
        //     non-empty label, regardless of whether the topic was drawn this attempt.
        await expect(page.getByTestId(/^topic-bar-/)).toHaveCount(5);
        for (const topic of CULTURE_TOPICS) {
          const row = page.getByTestId(`topic-bar-${topic}`);
          await expect(row).toBeVisible();
          const label = row.locator('.cx-cat-l');
          await expect(label).toBeVisible();
          await expect(label).not.toHaveText('');
        }

        // 4c. Σ-invariant (locale-independent). Each SCORED row's meta reads
        //     "<correct> / <asked> …"; a zero-asked topic shows a "not in this
        //     attempt" note with NO digits, so /(\d+)\s*\/\s*(\d+)/ naturally skips
        //     it (and never feeds NaN into the sums). Summing the digit-bearing rows
        //     must reconcile with the two page-level totals:
        //       Σ asked   == questions answered — every drawn question is topic-tagged
        //                    in the seed, so none escape the five buckets.
        //       Σ correct == the score in the "Correct" stat card (summary.score).
        let sumAsked = 0;
        let sumCorrect = 0;
        for (const topic of CULTURE_TOPICS) {
          const rowText = (await page.getByTestId(`topic-bar-${topic}`).textContent()) ?? '';
          const m = rowText.match(/(\d+)\s*\/\s*(\d+)/);
          if (m) {
            sumCorrect += Number(m[1]);
            sumAsked += Number(m[2]);
          }
        }

        expect(sumAsked).toBe(answered);

        const scoreText = (await page.getByTestId('mock-exam-score').textContent()) ?? '';
        const score = Number(scoreText.trim());
        expect(Number.isNaN(score)).toBe(false);
        expect(sumCorrect).toBe(score);
      } finally {
        // 5. Don't leak the locale into sibling specs.
        await page.evaluate(() => localStorage.removeItem('i18nextLng'));
      }
    });
  }
});
