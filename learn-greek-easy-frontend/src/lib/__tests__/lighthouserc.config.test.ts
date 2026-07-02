/**
 * PERF-23-01: Per-URL mobile LCP assertMatrix gate shape tests.
 *
 * Mobile Lighthouse config (`lighthouserc.mobile.cjs`) is moving from a
 * single top-level `ci.assert.assertions` block to `ci.assert.assertMatrix`
 * — an array of `{ matchingUrlPattern, assertions }` entries — so /register's
 * LCP can be demoted to `warn` (persistent red on release-verify.yml since
 * 2026-06-21, tracked in a GitHub issue) while `/` and `/login` keep the hard
 * `error@4000` floor. Desktop (`lighthouserc.cjs`) is untouched — it stays
 * flat.
 *
 * These 7 tests are authored RED pre-implementation (Test-first: yes; RALPH
 * Stage 2.5 Mode A): `lighthouserc.mobile.cjs` still has the old flat
 * `assert.assertions` shape today, so `mobileConfig.ci.assert.assertMatrix`
 * is `undefined` and the 6 mobile-shape tests below fail on that. They go
 * GREEN once the config is rewritten to assertMatrix (Stage 3 / Mode B).
 * Desktop tests are regression guards, unaffected by this change, and stay
 * GREEN throughout.
 *
 * CJS loading: package.json declares "type": "module", so `require` is not a
 * global. We use `createRequire(import.meta.url)` from Node's built-in
 * `module` package to load the `.cjs` config files.
 */

import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);

interface LighthouseAssertMatrixEntry {
  matchingUrlPattern: string;
  assertions: Record<string, unknown>;
}

interface DesktopLighthouseConfig {
  ci: {
    assert: {
      assertions: Record<string, unknown>;
    };
  };
}

interface MobileLighthouseConfig {
  ci: {
    assert: {
      // Target shape (post PERF-23-01): per-URL entries, no top-level
      // `assertions`. Both fields are optional here so the test file
      // type-checks against BOTH the current (flat) and target (matrix)
      // runtime shapes — the tests below assert which one is actually
      // present at runtime.
      assertMatrix?: LighthouseAssertMatrixEntry[];
      assertions?: Record<string, unknown>;
    };
  };
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const desktopConfig = require('../../../lighthouserc.cjs') as DesktopLighthouseConfig;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mobileConfig = require('../../../lighthouserc.mobile.cjs') as MobileLighthouseConfig;

const desktopAssertions = desktopConfig.ci.assert.assertions;
const mobileMatrix = mobileConfig.ci.assert.assertMatrix;

/** Finds the assertMatrix entry whose `matchingUrlPattern` matches `url`. */
function findMatrixEntry(
  matrix: LighthouseAssertMatrixEntry[] | undefined,
  url: string
): LighthouseAssertMatrixEntry | undefined {
  return matrix?.find((entry) => new RegExp(entry.matchingUrlPattern).test(url));
}

describe('lighthouserc LCP/assertMatrix gate (PERF-23-01)', () => {
  describe('mobile per-URL assertMatrix', () => {
    it('mobile_register_lcp_is_warn', () => {
      const entry = findMatrixEntry(mobileMatrix, 'https://x/register');
      expect(entry).toBeDefined();
      expect(entry?.assertions['largest-contentful-paint']).toEqual([
        'warn',
        { maxNumericValue: 4000 },
      ]);
    });

    it('mobile_nonregister_lcp_is_error', () => {
      const rootEntry = findMatrixEntry(mobileMatrix, 'https://x/');
      const loginEntry = findMatrixEntry(mobileMatrix, 'https://x/login');
      expect(rootEntry).toBeDefined();
      expect(loginEntry).toBeDefined();
      // Both non-register URLs must resolve to the SAME entry (the
      // complementary partner of the /register-only entry above).
      expect(rootEntry).toBe(loginEntry);
      expect(rootEntry?.assertions['largest-contentful-paint']).toEqual([
        'error',
        { maxNumericValue: 4000 },
      ]);
      expect(loginEntry?.assertions['largest-contentful-paint']).toEqual([
        'error',
        { maxNumericValue: 4000 },
      ]);
    });

    it('mobile_register_entry_carries_full_categories', () => {
      const entry = findMatrixEntry(mobileMatrix, 'https://x/register');
      expect(entry).toBeDefined();
      expect(entry?.assertions['categories:accessibility']).toEqual(['error', { minScore: 0.9 }]);
      expect(entry?.assertions['categories:performance']).toEqual(['warn', { minScore: 0.7 }]);
      expect(entry?.assertions['categories:best-practices']).toEqual(['warn', { minScore: 0.8 }]);
      expect(entry?.assertions['categories:seo']).toEqual(['warn', { minScore: 0.8 }]);
    });

    it('mobile_nonregister_entry_carries_full_categories', () => {
      const entry = findMatrixEntry(mobileMatrix, 'https://x/');
      expect(entry).toBeDefined();
      expect(entry?.assertions['categories:accessibility']).toEqual(['error', { minScore: 0.9 }]);
      expect(entry?.assertions['categories:performance']).toEqual(['warn', { minScore: 0.7 }]);
      expect(entry?.assertions['categories:best-practices']).toEqual(['warn', { minScore: 0.8 }]);
      expect(entry?.assertions['categories:seo']).toEqual(['warn', { minScore: 0.8 }]);
    });

    it('mobile_patterns_are_mutually_exclusive', () => {
      expect(mobileMatrix).toBeDefined();
      const matrix = mobileMatrix ?? [];
      expect(matrix.length).toBeGreaterThan(0);

      const testUrls = ['https://x/register', 'https://x/', 'https://x/login'];
      for (const url of testUrls) {
        const matches = matrix.filter((entry) => new RegExp(entry.matchingUrlPattern).test(url));
        // Exactly one match per URL — guards against both the additive-union
        // leak (URL matching >1 entry) and a silent zero-match gap. A
        // `.every()`/`.some()` check here would vacuously pass on an empty
        // matrix, so we assert the concrete count instead.
        expect(matches.length).toBe(1);
      }

      // The /register match must be a DIFFERENT entry than the root/login
      // match — cardinality-1 alone doesn't prove the partition is real.
      const registerEntry = findMatrixEntry(matrix, 'https://x/register');
      const rootEntry = findMatrixEntry(matrix, 'https://x/');
      expect(registerEntry).not.toBe(rootEntry);
    });

    it('mobile_no_residual_top_level_assertions', () => {
      // Defensive (Stage-1 addendum hardening #1): if a stray top-level
      // `assertions` block is left beside `assertMatrix`, LHCI treats them as
      // alternatives and the /register demotion could silently not apply.
      expect(mobileConfig.ci.assert.assertions).toBeUndefined();
      // Paired positive: the matrix is what actually carries assertions now.
      expect(mobileMatrix).toBeDefined();
    });
  });

  it('desktop_config_unchanged', () => {
    expect(desktopAssertions['largest-contentful-paint']).toEqual([
      'error',
      { maxNumericValue: 4000 },
    ]);
  });

  describe('other_assertions_unchanged', () => {
    it('desktop accessibility stays error at 0.9', () => {
      expect(desktopAssertions['categories:accessibility']).toEqual(['error', { minScore: 0.9 }]);
    });

    it('desktop performance stays warn at 0.8', () => {
      expect(desktopAssertions['categories:performance']).toEqual(['warn', { minScore: 0.8 }]);
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
