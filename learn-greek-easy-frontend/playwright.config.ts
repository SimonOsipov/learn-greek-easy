import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration
 * See https://playwright.dev/docs/test-configuration
 *
 * Authentication Strategy:
 * - Uses storageState pattern for pre-authenticated tests
 * - Setup project runs first to authenticate all user roles
 * - Browser projects depend on setup and use saved auth state
 * - This eliminates Zustand race conditions and speeds up tests
 */

// Storage state paths for authenticated users
const STORAGE_STATE = {
  LEARNER: 'playwright/.auth/learner.json',
  BEGINNER: 'playwright/.auth/beginner.json',
  ADVANCED: 'playwright/.auth/advanced.json',
  ADMIN: 'playwright/.auth/admin.json',
};

export default defineConfig({
  // Test directory
  testDir: './tests/e2e',

  // Test file pattern - exclude setup files from regular test runs
  testMatch: '**/*.spec.ts',

  // Timeout for each test (60 seconds)
  timeout: 60 * 1000,

  // Maximum time for expect() assertions (10 seconds)
  expect: {
    timeout: 10 * 1000,
  },

  // Run tests sequentially for stability (parallel can cause connection pool issues)
  fullyParallel: false,

  // Retry failed tests in CI (catch transient failures like network hiccups)
  retries: process.env.CI ? 1 : 0,

  // Number of parallel workers - reduced for stability
  workers: process.env.CI ? 1 : undefined, // CI: 1 worker for stability, Local: auto

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
    // Setup project - runs ONCE to authenticate all users
    // Saves browser state (localStorage, cookies) to JSON files
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // Browser projects - depend on setup, use saved auth state
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use learner auth state by default (most common test user)
        storageState: STORAGE_STATE.LEARNER,
      },
      dependencies: ['setup'],
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: STORAGE_STATE.LEARNER,
      },
      dependencies: ['setup'],
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: STORAGE_STATE.LEARNER,
      },
      dependencies: ['setup'],
    },

    // Mobile browsers (optional - uncomment if needed)
    // {
    //   name: 'Mobile Chrome',
    //   use: {
    //     ...devices['Pixel 5'],
    //     storageState: STORAGE_STATE.LEARNER,
    //   },
    //   dependencies: ['setup'],
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: {
    //     ...devices['iPhone 12'],
    //     storageState: STORAGE_STATE.LEARNER,
    //   },
    //   dependencies: ['setup'],
    // },
  ],

  // Web server configuration (start dev server before tests)
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI, // CI: always start fresh
    timeout: 120 * 1000, // 2 minutes to start
    env: {
      VITE_ENVIRONMENT: 'test',
      // API URL - explicitly pass to ensure Vite exposes to client code
      VITE_API_URL: process.env.VITE_API_URL || 'http://localhost:8000',
      // Supabase config for authentication
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || '',
    },
  },
});

// Export storage state paths for use in tests
export { STORAGE_STATE };
