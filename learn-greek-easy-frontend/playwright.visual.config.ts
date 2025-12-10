import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Visual Regression Testing with Chromatic
 *
 * This config is separate from the main E2E tests because:
 * 1. Visual tests run against deployed environment (not local dev server)
 * 2. Only Chromium is used to save Chromatic snapshots
 * 3. Tests are in tests/visual/ directory, separate from E2E tests
 *
 * Usage:
 * - Local: VISUAL_TEST_URL=https://frontend-dev-8db9.up.railway.app npm run test:visual
 * - CI: Set VISUAL_TEST_URL env var to deployed preview URL
 */
export default defineConfig({
  // Visual tests directory (separate from E2E tests)
  testDir: './tests/visual',
  testMatch: '**/*.spec.ts',

  // Timeout settings
  timeout: 30 * 1000,
  expect: { timeout: 10 * 1000 },

  // Run tests in parallel
  fullyParallel: true,

  // Retry on CI for flaky network conditions
  retries: process.env.CI ? 1 : 0,

  // Workers for parallel execution
  workers: process.env.CI ? 2 : undefined,

  // Reporter configuration
  reporter: [
    ['list'],
    ['html', { outputFolder: 'visual-report' }],
  ],

  // Output directory for Chromatic archives
  // Chromatic looks for test-results/ to find snapshots
  outputDir: 'test-results',

  // Shared settings
  use: {
    // Base URL: use deployed environment URL
    // In CI, this will be the Railway preview URL
    baseURL: process.env.VISUAL_TEST_URL || 'http://localhost:5173',

    // Collect trace on first retry for debugging
    trace: 'on-first-retry',

    // Screenshot only on failure (Chromatic handles visual snapshots)
    screenshot: 'only-on-failure',
  },

  // Single browser project: Chromium only
  // This saves Chromatic snapshots (5,000/month free tier)
  // Can expand to multiple browsers with 'visual-test' label if needed
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // No webServer - tests run against deployed environment
  // The VISUAL_TEST_URL env var should point to Railway preview
});
