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
    collect: {
      url?: string[];
      numberOfRuns: number;
      settings: {
        formFactor: string;
        screenEmulation: {
          mobile: boolean;
          width: number;
          height: number;
          deviceScaleFactor: number;
        };
        throttling: { rttMs: number; throughputKbps: number; cpuSlowdownMultiplier: number };
      };
    };
    assert: {
      // Target shape (post PERF-23-01): per-URL entries, no top-level
      // `assertions`. Both fields are optional here so the test file
      // type-checks against BOTH the current (flat) and target (matrix)
      // runtime shapes — the tests below assert which one is actually
      // present at runtime.
      assertMatrix?: LighthouseAssertMatrixEntry[];
      assertions?: Record<string, unknown>;
    };
    upload: {
      target: string;
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

  // --- QA adversarial/edge coverage (Stage 4, added post-implementation) ---
  // The 12 tests above are the AC-derived oracle authored RED pre-implementation
  // (Stage 2.5). These additional tests probe regex robustness, key-set
  // completeness, and untouched-block survival that the AC tests didn't cover.
  describe('assertMatrix regex robustness (QA adversarial)', () => {
    const registerEntry = () => findMatrixEntry(mobileMatrix, 'https://x/register')!;

    it('does NOT match /register lookalikes with extra trailing characters', () => {
      // '/register2' and '/registers' share the '/register' prefix but do not
      // END the path in exactly '/register' — the `$`-anchor must reject them,
      // else they'd be silently demoted to warn alongside the real /register.
      expect(findMatrixEntry(mobileMatrix, 'https://x/register2')).toBe(
        findMatrixEntry(mobileMatrix, 'https://x/')
      );
      expect(findMatrixEntry(mobileMatrix, 'https://x/registers')).toBe(
        findMatrixEntry(mobileMatrix, 'https://x/')
      );
    });

    it('does NOT match /register as a mid-path segment', () => {
      // '/admin/register/settings' contains '/register' but not at the end of
      // the path — must fall to the non-register (error) entry.
      const entry = findMatrixEntry(mobileMatrix, 'https://x/admin/register/settings');
      expect(entry?.assertions['largest-contentful-paint']).toEqual([
        'error',
        { maxNumericValue: 4000 },
      ]);
    });

    it('DOES match /register nested under a subpath (documented current behavior)', () => {
      // The pattern is '.*/register$' — ANY path ending in '/register' demotes,
      // not just the exact top-level route. This is intended-and-documented
      // behavior, not a bug: today only the top-level /register route is ever
      // Lighthouse-tested (LIGHTHOUSE_URLS), so the broader match is inert in
      // practice, but a future nested route ending in /register would also be
      // demoted. Asserting it here makes that a visible decision, not a
      // silent side effect.
      const entry = findMatrixEntry(mobileMatrix, 'https://x/foo/register');
      expect(entry).toBe(registerEntry());
      expect(entry?.assertions['largest-contentful-paint']).toEqual([
        'warn',
        { maxNumericValue: 4000 },
      ]);
    });

    it('trailing slash on /register falls to the non-register (error) entry today', () => {
      // 'https://x/register/' does not end in '/register' (it ends in '/'), so
      // the `$`-anchored register pattern does not match — it falls to the
      // catch-all non-register entry and keeps the hard error@4000 floor. This
      // is the Stage-1 addendum's edge-case note #2: if a redirect ever
      // appends a trailing slash to /register, the demotion silently stops
      // applying and the gate would go red again. Documented here so that
      // regression is a visible test failure, not a silent CI surprise.
      const entry = findMatrixEntry(mobileMatrix, 'https://x/register/');
      expect(entry).toBe(findMatrixEntry(mobileMatrix, 'https://x/'));
      expect(entry?.assertions['largest-contentful-paint']).toEqual([
        'error',
        { maxNumericValue: 4000 },
      ]);
    });

    it('query string on /register falls to the non-register (error) entry today', () => {
      // 'https://x/register?a=1' does not end in '/register' either (it ends
      // in '?a=1'), so it also falls through to the hard-error entry. Same
      // Stage-1 addendum note #2 caveat as the trailing-slash case above.
      const entry = findMatrixEntry(mobileMatrix, 'https://x/register?a=1');
      expect(entry).toBe(findMatrixEntry(mobileMatrix, 'https://x/'));
      expect(entry?.assertions['largest-contentful-paint']).toEqual([
        'error',
        { maxNumericValue: 4000 },
      ]);
    });
  });

  describe('assertMatrix entry key-set completeness (QA adversarial)', () => {
    const expectedKeys = [
      'categories:performance',
      'categories:accessibility',
      'categories:best-practices',
      'categories:seo',
      'largest-contentful-paint',
    ].sort();

    it('every assertMatrix entry carries EXACTLY the 5 expected assertion keys (no dropped/extra)', () => {
      expect(mobileMatrix).toBeDefined();
      const matrix = mobileMatrix ?? [];
      expect(matrix.length).toBe(2);
      for (const entry of matrix) {
        expect(Object.keys(entry.assertions).sort()).toEqual(expectedKeys);
      }
    });
  });

  describe('untouched collect/upload blocks survive the assertMatrix rewrite (QA adversarial)', () => {
    it('collect.url is absent-env-driven and unaffected by the assert rewrite', () => {
      // This subtask only touches `assert` + the header comment; `collect.url`
      // is env-driven and must still fall back to the localhost default (or
      // reflect LIGHTHOUSE_URLS verbatim) whenever a real env var IS set —
      // either way, it must not have been hardcoded or dropped by the rewrite.
      if (process.env.LIGHTHOUSE_URLS) {
        expect(mobileConfig.ci.collect.url).toEqual(process.env.LIGHTHOUSE_URLS.split(','));
      } else {
        expect(mobileConfig.ci.collect.url).toEqual(['http://localhost:5173']);
      }
    });

    it('collect.settings (mobile formFactor, screen emulation, throttling) is unchanged', () => {
      expect(mobileConfig.ci.collect.numberOfRuns).toBe(1);
      expect(mobileConfig.ci.collect.settings.formFactor).toBe('mobile');
      expect(mobileConfig.ci.collect.settings.screenEmulation).toEqual({
        mobile: true,
        width: 390,
        height: 844,
        deviceScaleFactor: 3,
      });
      expect(mobileConfig.ci.collect.settings.throttling).toEqual({
        rttMs: 150,
        throughputKbps: 1638.4,
        cpuSlowdownMultiplier: 2,
      });
    });

    it('upload.target is unchanged', () => {
      expect(mobileConfig.ci.upload.target).toBe('temporary-public-storage');
    });
  });
});
