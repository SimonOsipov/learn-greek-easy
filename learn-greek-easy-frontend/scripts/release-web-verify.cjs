#!/usr/bin/env node
/**
 * Authenticated Web Verify Script for Release Verify Pipeline
 *
 * Logs in as the seeded e2e_beginner user, confirms the dashboard renders,
 * and confirms the deck list is non-empty.  This is the oracle that the
 * dev-release-lease web-verify job uses in release-verify.yml.
 *
 * Usage:
 *   FRONTEND_URL=https://example.com node scripts/release-web-verify.cjs
 *
 * Exit codes:
 *   0 - All checks passed
 *   1 - Any check failed
 *
 * NEVER log SEED_PASSWORD — project rule 3.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ============================================================================
// Configuration
// ============================================================================

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const PR_NUMBER = (process.env.PR_NUMBER || '').trim();
const SEED_EMAIL = PR_NUMBER
  ? `e2e_beginner+pr${PR_NUMBER}@test.com`
  : 'e2e_beginner@test.com';
const SEED_PASSWORD = 'TestPassword123!';
const REPORTS_DIR = path.join(process.cwd(), 'web-verify-reports');

// ============================================================================
// Main Function
// ============================================================================

async function runWebVerify() {
  console.log('='.repeat(60));
  console.log('AUTHENTICATED WEB VERIFY');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Frontend URL: ${FRONTEND_URL}`);
  console.log(`Seed user: ${SEED_EMAIL}`);
  console.log('');

  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const browser = await chromium.launch();
  let failed = false;

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    // Step 3: Navigate to login
    console.log('Step 1: Navigating to /login ...');
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Step 4: Wait for login form + screenshot
    console.log('Step 2: Waiting for login form ...');
    await page.locator('[data-testid="login-form"]').waitFor({ state: 'visible', timeout: 15000 });
    await page.screenshot({ path: path.join(REPORTS_DIR, '01-login.png'), fullPage: true });
    console.log('  Screenshot: 01-login.png');

    // Step 5-6: Fill credentials (never log password)
    console.log(`Step 3: Filling credentials for ${SEED_EMAIL} ...`);
    await page.locator('[data-testid="email-input"]').fill(SEED_EMAIL);
    await page.locator('[data-testid="password-input"]').fill(SEED_PASSWORD);

    // Step 7: Submit login
    console.log('Step 4: Submitting login form ...');
    await page.locator('[data-testid="login-submit"]').click();

    // Step 8: Wait for redirect to dashboard
    console.log('Step 5: Waiting for /dashboard redirect ...');
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    console.log(`  Reached: ${page.url()}`);

    // Step 9: Wait for app-ready signal
    console.log('Step 6: Waiting for app-ready signal ...');
    await page.locator('[data-app-ready="true"]').waitFor({ state: 'attached', timeout: 30000 });

    // Step 10: Confirm dashboard visible + screenshot.
    // The [data-testid="dashboard"] container renders IMMEDIATELY (with an
    // internal loading skeleton) while useDashboardSummary is in flight, so
    // waiting on it alone screenshots the skeleton, not the real dashboard.
    // metric-strip mounts only once the summary resolves — for BOTH new and
    // returning users (Dashboard.tsx gates <MetricStrip> on `summary`, not
    // `!isNew`) — making it the deterministic loaded-state signal. This
    // mirrors the loaded-only waits used for decks (deck-card) and mock-exam
    // (start-exam-button) below.
    console.log('Step 7: Waiting for dashboard component ...');
    await page.locator('[data-testid="dashboard"]').waitFor({ state: 'visible', timeout: 15000 });
    console.log('Step 7b: Waiting for dashboard loaded state (metric-strip) ...');
    await page.locator('[data-testid="metric-strip"]').waitFor({ state: 'visible', timeout: 15000 });
    await page.screenshot({ path: path.join(REPORTS_DIR, '02-dashboard.png'), fullPage: true });
    console.log('  Screenshot: 02-dashboard.png');

    // Step 11: Navigate to /decks
    console.log('Step 8: Navigating to /decks ...');
    await page.goto(`${FRONTEND_URL}/decks`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Step 12: Wait for decks title
    console.log('Step 9: Waiting for decks-title ...');
    await page.locator('[data-testid="decks-title"]').waitFor({ state: 'visible', timeout: 15000 });

    // Step 13: Assert at least one deck card + screenshot
    console.log('Step 10: Waiting for deck-card (first) ...');
    await page.locator('[data-testid="deck-card"]').first().waitFor({ state: 'visible', timeout: 15000 });
    const deckCount = await page.locator('[data-testid="deck-card"]').count();
    if (deckCount < 1) {
      throw new Error('deck list empty — no [data-testid="deck-card"] elements found');
    }
    console.log(`  Found ${deckCount} deck card(s)`);
    await page.screenshot({ path: path.join(REPORTS_DIR, '03-decks.png'), fullPage: true });
    console.log('  Screenshot: 03-decks.png');

    // Step 11: Navigate to /practice/culture-exam + screenshot (best-effort,
    // supplementary regression coverage — must NEVER fail web-verify).
    console.log('Step 11: Navigating to /practice/culture-exam (best-effort) ...');
    try {
      await page.goto(`${FRONTEND_URL}/practice/culture-exam`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.locator('[data-testid="mock-exam-page"]').waitFor({ state: 'visible', timeout: 15000 });
      // Wait for the LOADED state (not the loading skeleton): start-exam-button
      // only mounts once statistics resolve (!isLoading && !error). A timeout
      // here falls through to the catch's best-effort capture (non-fatal).
      await page.locator('[data-testid="start-exam-button"]').waitFor({ state: 'visible', timeout: 20000 });
      await page.screenshot({ path: path.join(REPORTS_DIR, '04-mock-exam-landing.png'), fullPage: true });
      console.log('  Screenshot: 04-mock-exam-landing.png');
    } catch (mockExamErr) {
      console.warn('  WARNING: mock-exam landing capture failed (non-fatal):', mockExamErr.message);
      // Best-effort capture of whatever rendered, then continue.
      try {
        await page.screenshot({ path: path.join(REPORTS_DIR, '04-mock-exam-landing.png'), fullPage: true });
        console.warn('  (Captured best-effort 04-mock-exam-landing.png anyway)');
      } catch (mockExamShotErr) {
        console.warn('  (Could not capture mock-exam screenshot:', mockExamShotErr.message, ')');
      }
    }

    await context.close();
  } catch (err) {
    failed = true;
    console.error('');
    console.error('VERIFY FAILED:', err.message);
    console.error('');

    // Best-effort failure screenshot
    try {
      // Re-use an open page if possible — create a minimal one just for screenshot capture
      // The page variable is scoped inside try; we rely on the browser still being open
      const pages = browser.contexts().flatMap((c) => c.pages());
      if (pages.length > 0) {
        await pages[0].screenshot({
          path: path.join(REPORTS_DIR, '99-failure.png'),
          fullPage: true,
        });
        console.error('  Failure screenshot: 99-failure.png');
      }
    } catch (screenshotErr) {
      console.error('  (Could not capture failure screenshot:', screenshotErr.message, ')');
    }
  } finally {
    await browser.close();
  }

  // Summary
  console.log('');
  console.log('='.repeat(60));
  if (failed) {
    console.log('RESULT: FAILED');
    console.log('='.repeat(60));
    process.exit(1);
  } else {
    console.log('RESULT: PASSED — login, dashboard, and deck list verified');
    console.log('='.repeat(60));
    process.exit(0);
  }
}

// ============================================================================
// Run
// ============================================================================

runWebVerify().catch((e) => {
  console.error(e);
  process.exit(1);
});
