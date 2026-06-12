/**
 * PERF-09-03: LCP gate shape tests.
 *
 * AC-1 + AC-2 are RED pre-implementation (wrong severity/threshold).
 * AC-3 is GREEN now — regression guard for untouched assertions.
 *
 * CJS loading: package.json declares "type": "module", so `require` is not a
 * global. We use `createRequire(import.meta.url)` from Node's built-in
 * `module` package to load the `.cjs` config files.
 */

import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const desktopConfig = require('../../../lighthouserc.cjs') as {
  ci: {
    assert: {
      assertions: Record<string, unknown>;
    };
  };
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mobileConfig = require('../../../lighthouserc.mobile.cjs') as {
  ci: {
    assert: {
      assertions: Record<string, unknown>;
    };
  };
};

const desktopAssertions = desktopConfig.ci.assert.assertions;
const mobileAssertions = mobileConfig.ci.assert.assertions;

describe('lighthouserc LCP gate (PERF-09-03)', () => {
  // AC-1 — RED now: currently ['warn', { maxNumericValue: 3000 }]
  it('desktop_lcp_is_error_at_4000', () => {
    expect(desktopAssertions['largest-contentful-paint']).toEqual([
      'error',
      { maxNumericValue: 4000 },
    ]);
  });

  // AC-2 — RED now: currently undefined (no LCP assertion on mobile)
  it('mobile_lcp_is_error_at_4000', () => {
    expect(mobileAssertions['largest-contentful-paint']).toEqual([
      'error',
      { maxNumericValue: 4000 },
    ]);
  });

  // AC-3 — GREEN now: regression guard for untouched assertions
  describe('other_assertions_unchanged', () => {
    it('desktop accessibility stays error at 0.9', () => {
      expect(desktopAssertions['categories:accessibility']).toEqual(['error', { minScore: 0.9 }]);
    });

    it('mobile accessibility stays error at 0.9', () => {
      expect(mobileAssertions['categories:accessibility']).toEqual(['error', { minScore: 0.9 }]);
    });

    it('desktop performance stays warn at 0.8', () => {
      expect(desktopAssertions['categories:performance']).toEqual(['warn', { minScore: 0.8 }]);
    });

    it('mobile performance stays warn at 0.7', () => {
      expect(mobileAssertions['categories:performance']).toEqual(['warn', { minScore: 0.7 }]);
    });

    it('desktop first-contentful-paint stays warn at 2000', () => {
      expect(desktopAssertions['first-contentful-paint']).toEqual([
        'warn',
        { maxNumericValue: 2000 },
      ]);
    });

    it('desktop cumulative-layout-shift stays warn at 0.1', () => {
      expect(desktopAssertions['cumulative-layout-shift']).toEqual([
        'warn',
        { maxNumericValue: 0.1 },
      ]);
    });

    it('desktop total-blocking-time stays warn at 300', () => {
      expect(desktopAssertions['total-blocking-time']).toEqual(['warn', { maxNumericValue: 300 }]);
    });
  });
});
