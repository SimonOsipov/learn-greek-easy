/**
 * PERF-23-01: Mobile Lighthouse LCP gate shape tests.
 *
 * Final state (user decision 2026-07-03): the mobile Lighthouse config
 * (`lighthouserc.mobile.cjs`) uses a single flat `ci.assert.assertions` block
 * — the same shape as desktop — with a flat LCP gate of `error @ 7000ms` on
 * ALL three tested URLs (`/`, `/login`, `/register`). This supersedes the
 * PERF-23-01 per-URL `assertMatrix` (warn on /register, error@4000 elsewhere):
 * Phase 3.5 runs showed `/` and `/login` had ALSO always exceeded the 4000
 * floor on the shared dev box (the "only /register is red" premise was
 * stale), so the per-URL split gated nothing. 7000 is a dev-environment
 * regression TRIPWIRE (observed stable LCP band 5.3-6.3s across all retained
 * runs, Jun 23 - Jul 2 2026), NOT a Web Vitals line — restoring the real
 * `error@4000` Web Vitals floor is tracked in the PERF-24 Obsidian story
 * ("Get Pre-Auth Mobile LCP Under the Web Vitals Poor Line"). GitHub issue
 * #679 (the prior tracker) was deleted; PERF-24 is the sole tracker now.
 *
 * PERF-24 (2026-07-04) measured post-optimization mobile LCP after landing
 * the i18n namespace split (PERF-24-01) and the deferred posthog import
 * (PERF-24-02): `/` 5891ms, `/login` 5501ms, `/register` 5475ms — unchanged
 * from the pre-optimization band above. The LHR shows a render-timing
 * bottleneck (a ~3-4s FCP-to-LCP gap on lazy-route text elements behind an
 * opacity-0 entrance animation), not a byte-budget one, so the 7000 tripwire
 * asserted below is RETAINED deliberately and the 4000 Web Vitals floor is
 * DEFERRED to follow-up story PERF-25. See `lighthouserc.mobile.cjs`'s
 * assertion comment for the full writeup.
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

describe('lighthouserc LCP gate (PERF-23)', () => {
  describe('mobile flat assertions (user decision 2026-07-03: error@7000 tripwire)', () => {
    it('mobile LCP is a flat error@7000 tripwire on all URLs', () => {
      expect(mobileAssertions['largest-contentful-paint']).toEqual([
        'error',
        { maxNumericValue: 7000 },
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
