/**
 * Lighthouse CI Configuration - Desktop
 *
 * This configuration is used for desktop performance testing in the PR preview workflow.
 * URLs are set dynamically via LIGHTHOUSE_URLS environment variable.
 *
 * Score thresholds:
 * - Performance: 80+ (warn)
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
        preset: 'desktop',
        // Required for CI environment
        chromeFlags: '--no-sandbox --disable-gpu',
        // Skip audits that aren't relevant for preview environments
        skipAudits: ['uses-http2', 'uses-long-cache-ttl'],
      },
    },

    assert: {
      assertions: {
        // Category thresholds
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.8 }],
        'categories:seo': ['warn', { minScore: 0.8 }],

        // Core Web Vitals thresholds
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 3000 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],
      },
    },

    upload: {
      // Upload to temporary public storage for easy report access
      target: 'temporary-public-storage',
    },
  },
};
