import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory
  testDir: './tests/e2e',

  // Test file pattern
  testMatch: '**/*.spec.ts',

  // Timeout for each test (60 seconds)
  timeout: 60 * 1000,

  // Maximum time for expect() assertions (10 seconds)
  expect: {
    timeout: 10 * 1000,
  },

  // Fail fast: stop after first failure (useful for debugging)
  // fullyParallel: false,

  // Run tests sequentially for stability (parallel can cause connection pool issues)
  fullyParallel: false,

  // Retry failed tests in CI (catch flaky tests) - increased retries for stability
  retries: process.env.CI ? 3 : 0,

  // Number of parallel workers - reduced for stability
  workers: process.env.CI ? 2 : undefined, // CI: 2 workers for stability, Local: auto

  // Reporter configuration
  reporter: [
    ['list'], // Console output
    ['html', { outputFolder: 'playwright-report' }], // HTML report
    ['json', { outputFile: 'playwright-report/results.json' }], // JSON for CI
  ],

  // Shared settings for all projects
  use: {
    // Base URL for navigation (e.g., page.goto('/'))
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',

    // Collect trace on failure (for debugging)
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Browser context options
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    locale: 'en-US',
    timezoneId: 'America/New_York',
  },

  // Test projects (browsers to run tests in)
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile browsers (optional - uncomment if needed)
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  // Web server configuration (start dev server before tests)
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI, // CI: always start fresh
    timeout: 120 * 1000, // 2 minutes to start
  },
});
