/**
 * Lighthouse CI Configuration - Mobile
 *
 * This configuration is used for mobile performance testing in the PR preview workflow.
 * Uses mobile emulation with throttling to simulate real mobile conditions.
 *
 * Score thresholds (lower than desktop due to mobile constraints):
 * - Performance: 70+ (warn)
 * - Accessibility: 90+ (error)
 * - Best Practices: 80+ (warn)
 * - SEO: 80+ (warn)
 */
module.exports = {
  ci: {
    collect: {
      // URLs to test (set dynamically via env var, comma-separated)
      url: process.env.LIGHTHOUSE_URLS
        ? process.env.LIGHTHOUSE_URLS.split(',')
        : ['http://localhost:5173'],

      // Number of runs per URL (for consistency)
      numberOfRuns: 3,

      settings: {
        // Mobile preset and form factor
        preset: 'mobile',
        formFactor: 'mobile',

        // Required for CI environment
        chromeFlags: '--no-sandbox --disable-gpu',

        // Mobile screen emulation (iPhone 8 dimensions)
        screenEmulation: {
          mobile: true,
          width: 375,
          height: 667,
          deviceScaleFactor: 2,
        },

        // Mobile network throttling (simulates 4G connection)
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          cpuSlowdownMultiplier: 4,
        },
      },
    },

    assert: {
      assertions: {
        // Category thresholds (lower performance threshold for mobile)
        'categories:performance': ['warn', { minScore: 0.7 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.8 }],
        'categories:seo': ['warn', { minScore: 0.8 }],
      },
    },

    upload: {
      // Upload to temporary public storage for easy report access
      target: 'temporary-public-storage',
    },
  },
};
