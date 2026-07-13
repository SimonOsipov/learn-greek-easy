/**
 * PERF-25-03: Mobile Lighthouse LCP gate shape tests.
 *
 * Root cause (PERF-24, 2026-07-04): mobile LCP was RENDER-TIMING-bound, not
 * byte-budget-bound. The LHR showed a ~3-4s FCP-to-LCP gap: lazy-route text
 * elements sat behind (a) a post-mount lazy-chunk waterfall (routes only
 * started fetching after the initial bundle executed) and (b) the hero/header
 * entrance animation, which held its final text at `opacity-0` until a
 * post-mount JS transition fired. Byte-budget cuts landed in PERF-24
 * (i18n namespace split, deferred posthog import) did NOT move LCP, which is
 * what confirmed the render-timing diagnosis over a byte-budget one.
 *
 * PERF-25 fix (A+B, this story): (A, PERF-25-01) de-gate the hero + header
 * entrance animation so LCP text paints at its final opacity immediately,
 * no animation gate; (B, PERF-25-02) eager-load the 3 pre-auth routes
 * (`/`, `/login`, `/register`) instead of lazy-chunking them, removing the
 * post-mount waterfall.
 *
 * RV#1 (2026-07-12) measured mobile LCP after A+B: `/` 4302ms, `/login`
 * 3773ms, `/register` 3781ms — a 27-31% improvement from the PERF-24 band
 * (5891/5501/5475ms). `/login` and `/register` now clear the real Web Vitals
 * `error@4000` floor; `/` does not (4302 > 4000).
 *
 * Per user decision + story Decision #14, the gate is honestly RATCHETED
 * 7000 -> 4800 (not all the way to 4000): all three URLs clear 4800 with
 * >=500ms of headroom against RV#1's measured numbers, so 4800 is a real,
 * currently-passing regression gate rather than an aspirational one that
 * would immediately flake. `numberOfRuns` is bumped 1 -> 3 (median-of-3) to
 * reduce single-run lab noise now that the gate is tight enough for noise to
 * matter. Getting `/` under the true 4000 Web Vitals floor (its remaining
 * render-timing cost is largely below-fold content deferred to a later
 * paint) is tracked as follow-up story PERF-26.
 *
 * CJS loading: package.json declares "type": "module", so `require` is not a
 * global. We use `createRequire(import.meta.url)` from Node's built-in
 * `module` package to load the `.cjs` config files.
 */

import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);

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
      // Defensive: both optional so this test file type-checks whichever shape
      // is actually present at runtime. The tests below assert that it's the
      // flat `assertions` block, with no residual `assertMatrix`.
      assertMatrix?: unknown;
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
const mobileAssertions = mobileConfig.ci.assert.assertions ?? {};

describe('lighthouserc LCP gate (PERF-25)', () => {
  describe('mobile flat assertions (PERF-25-03: ratcheted error@4800 gate)', () => {
    it('mobile LCP is a flat error@4800 gate on all URLs', () => {
      expect(mobileAssertions['largest-contentful-paint']).toEqual([
        'error',
        { maxNumericValue: 4800 },
      ]);
    });

    it('mobile category thresholds are unchanged', () => {
      expect(mobileAssertions['categories:performance']).toEqual(['warn', { minScore: 0.7 }]);
      expect(mobileAssertions['categories:accessibility']).toEqual(['error', { minScore: 0.9 }]);
      expect(mobileAssertions['categories:best-practices']).toEqual(['warn', { minScore: 0.8 }]);
      expect(mobileAssertions['categories:seo']).toEqual(['warn', { minScore: 0.8 }]);
    });

    it('no residual assertMatrix — assertions is the live block', () => {
      expect(mobileConfig.ci.assert.assertMatrix).toBeUndefined();
      expect(mobileConfig.ci.assert.assertions).toBeDefined();
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

  describe('untouched collect/upload blocks survive the assert rewrite (QA adversarial)', () => {
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
      expect(mobileConfig.ci.collect.numberOfRuns).toBe(3);
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
