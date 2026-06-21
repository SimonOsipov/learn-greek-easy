/**
 * RED spec — PERF-12-01
 *
 * Tests for the testability refactor of scripts/parse-k6-results.cjs.
 * Before the fix: main() runs at import (calls process.exit + writes files),
 * and no exports exist. These tests FAIL for those reasons.
 * After the fix: require is side-effect-free, 8 symbols are exported, tests pass.
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import { afterEach, describe, it, expect, vi } from 'vitest';

// ============================================================================
// Import-safety scaffolding
// ============================================================================
// We need to require a CJS file that TODAY calls main() → process.exit(0) and
// writes to disk on load. To keep the suite *collectable* (not crash the vitest
// worker) we:
//   1. Spy on process.exit so it throws instead of killing the process
//   2. Mock fs.writeFileSync so no file is written to disk
//   3. Wrap require() in try/catch so an import-time failure is a caught error,
//      not an uncaught crash that aborts collection
//
// After the executor's fix, requiring the module is a pure no-op — the spies
// are never called, no throw, and all 8 exports are available.

// NOTE: In vitest's happy-dom environment, `import.meta.url` for files under
// `scripts/` resolves to a short path (e.g. `/scripts/parse-k6-results.test.ts`)
// rather than the full filesystem path. We use process.cwd() + path.resolve
// instead, which vitest always sets to the package root (learn-greek-easy-frontend/).
const require = createRequire(import.meta.url);

// Path to the CJS module under test — resolved relative to the frontend package root
const MODULE_PATH = path.resolve(process.cwd(), 'scripts/parse-k6-results.cjs');

/**
 * Load (or reload) the module with side-effect guards in place.
 * Returns { mod, exitSpy, writeSpy, importError }.
 * - exitSpy: the spy on process.exit (asserted in test 1 as proxy for "main ran")
 * - writeSpy: spy on fs.writeFileSync (asserted in test 1 as proxy for "main ran")
 * - importError: the error thrown by process.exit mock, or null if clean load
 *
 * BEFORE the fix: main() runs synchronously during require().
 *   process.exit(0) is called → our mock throws → importError is non-null.
 *   The writeSpy is also called (error-markdown path writes a file even on error).
 * AFTER the fix: require is a pure side-effect-free load.
 *   importError stays null, spies are never called.
 */
function loadModule() {
  // Bust the require cache so each call gets a fresh load
  delete require.cache[MODULE_PATH];

  // Guard 1: process.exit throws instead of killing the worker.
  // In vitest's happy-dom environment we spy on process.exit AND replace it
  // with a throw so the worker doesn't die. The importError return value
  // is the observable that test 1 asserts on (non-null = main() ran).
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: number) => {
    throw new Error('process.exit called during import');
  });

  // Guard 2: fs.writeFileSync — neutralise disk writes triggered by main().
  // We grab the actual fs module that the CJS file will use (same require cache).
  const fsModule = require('fs') as typeof import('fs');
  const writeSpy = vi.spyOn(fsModule, 'writeFileSync').mockImplementation(() => undefined);

  let mod: Record<string, unknown> = {};
  let importError: Error | null = null;

  try {
    mod = require(MODULE_PATH) as Record<string, unknown>;
  } catch (err) {
    importError = err as Error;
  }

  return { mod, exitSpy, writeSpy, importError };
}

// ============================================================================
// Tests
// ============================================================================

describe('parse-k6-results.cjs — testability refactor (PERF-12-01)', () => {
  afterEach(() => {
    // Restore all spies after each test
    vi.restoreAllMocks();
    // Clear require cache for fresh state
    delete require.cache[MODULE_PATH];
  });

  // --------------------------------------------------------------------------
  // Test 1: importing the module must NOT run main()
  // --------------------------------------------------------------------------
  it('test_importing_module_does_not_run_main — requiring module must not call process.exit or write files', () => {
    const { importError, writeSpy } = loadModule();

    // After the fix: require completes without error (main() was NOT called,
    // so process.exit was never invoked, so our mock never threw).
    // BEFORE the fix this is non-null (main() ran → process.exit mock threw).
    expect(importError).toBeNull();

    // After the fix: fs.writeFileSync is never called on import.
    // BEFORE the fix: writeSpy is called once (error-markdown write inside main()).
    expect(writeSpy).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // Test 2: module must export all 8 named symbols
  // --------------------------------------------------------------------------
  it('test_exports_pure_helpers — module must export all 8 symbols', () => {
    const { mod } = loadModule();

    const expectedExports = [
      'extractPercentiles',
      'formatMs',
      'formatMetricValue',
      'getMetricStatus',
      'generateMetricsSection',
      'getMetricLabel',
      'AUTH_METRICS',
      'DASHBOARD_METRICS',
    ];

    for (const name of expectedExports) {
      expect(mod, `module.exports should have "${name}"`).toHaveProperty(name);
    }
  });

  // --------------------------------------------------------------------------
  // Helpers below: require the module once with guards, then use exports.
  // If the module still runs main() on import the require will throw — we
  // catch that and let the individual assertions fail clearly.
  // --------------------------------------------------------------------------

  // Test 3: formatMs
  it('test_format_ms_seconds_and_millis', () => {
    const { mod } = loadModule();
    const formatMs = mod.formatMs as (ms: number | null | undefined) => string;

    expect(formatMs(1500)).toBe('1.50s');
    expect(formatMs(1000)).toBe('1.00s');
    expect(formatMs(500)).toBe('500ms');
    expect(formatMs(null)).toBe('N/A');
    expect(formatMs(undefined)).toBe('N/A');
  });

  // Test 4: extractPercentiles
  it('test_extract_percentiles_reads_p95', () => {
    const { mod } = loadModule();
    type ExtractFn = (m: unknown) => {
      p50: number | null;
      p90: number | null;
      p95: number | null;
      p99: number | null;
      avg: number | null;
      min: number | null;
      max: number | null;
    };
    const extractPercentiles = mod.extractPercentiles as ExtractFn;

    // Partial values object — only p95 and med present
    const result = extractPercentiles({ values: { 'p(95)': 1234, med: 100 } });
    expect(result.p95).toBe(1234);
    expect(result.p50).toBe(100);
    expect(result.p90).toBeNull();
    expect(result.p99).toBeNull();
    expect(result.avg).toBeNull();
    expect(result.min).toBeNull();
    expect(result.max).toBeNull();

    // Empty object — metric present but no values → all null
    const empty = extractPercentiles({});
    expect(empty.p50).toBeNull();
    expect(empty.p95).toBeNull();

    // null metric → all null
    const fromNull = extractPercentiles(null);
    expect(fromNull.p50).toBeNull();
    expect(fromNull.p95).toBeNull();
  });

  // Test 5: getMetricStatus
  it('test_metric_status_pass_warn_fail', () => {
    const { mod } = loadModule();
    const getMetricStatus = mod.getMetricStatus as (
      value: number | null,
      threshold: number
    ) => 'pass' | 'warning' | 'fail';

    // threshold = 1000
    // 700 < 800 (80%) → pass
    expect(getMetricStatus(700, 1000)).toBe('pass');
    // 800 is NOT > 800, so not warning → pass
    expect(getMetricStatus(800, 1000)).toBe('pass');
    // 850 > 800 (80%) but not > 1000 → warning
    expect(getMetricStatus(850, 1000)).toBe('warning');
    // 1200 > 1000 → fail
    expect(getMetricStatus(1200, 1000)).toBe('fail');
    // null → pass (no data)
    expect(getMetricStatus(null, 1000)).toBe('pass');
  });

  // Test 6: getMetricLabel
  it('test_metric_label_lookup', () => {
    const { mod } = loadModule();
    const getMetricLabel = mod.getMetricLabel as (name: string) => string;

    // Known key from AUTH_METRICS
    expect(getMetricLabel('auth_total_time')).toBe('Total Auth Flow');
    // Unknown key → returns the raw name
    expect(getMetricLabel('nope_xyz')).toBe('nope_xyz');
  });
});

// ============================================================================
// Adversarial / edge coverage (PERF-12-01 Mode B)
// ============================================================================
// These tests are appended AFTER the 6 AC tests and must NOT modify them.
// All assertions were verified against the real implementation before writing.

describe('parse-k6-results.cjs — adversarial / edge coverage (PERF-12-01)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    const MODULE_PATH_INNER = path.resolve(process.cwd(), 'scripts/parse-k6-results.cjs');
    delete require.cache[MODULE_PATH_INNER];
  });

  // --------------------------------------------------------------------------
  // formatMs boundaries
  // --------------------------------------------------------------------------
  it('edge_formatMs_boundaries — 0, 999, 1000 exact boundaries and non-integer ≥ 1000', () => {
    const { mod } = loadModule();
    const formatMs = mod.formatMs as (ms: number | null | undefined) => string;

    // 0 is < 1000 → Math.round(0) → '0ms'
    expect(formatMs(0)).toBe('0ms');

    // 999 is < 1000 → Math.round(999) → '999ms'
    expect(formatMs(999)).toBe('999ms');

    // 1000 is >= 1000 → (1000/1000).toFixed(2) → '1.00s'
    expect(formatMs(1000)).toBe('1.00s');

    // Non-integer ≥ 1000: 1234.6 → (1234.6/1000).toFixed(2) = '1.23s'
    // NOT '1235ms' — the ≥ 1000 branch fires, producing seconds format.
    expect(formatMs(1234.6)).toBe('1.23s');
  });

  // --------------------------------------------------------------------------
  // getMetricStatus exact-threshold boundary
  // --------------------------------------------------------------------------
  it('edge_getMetricStatus_exact_threshold — value === threshold yields warning, not pass', () => {
    const { mod } = loadModule();
    const getMetricStatus = mod.getMetricStatus as (
      value: number | null,
      threshold: number
    ) => 'pass' | 'warning' | 'fail';

    // value === threshold: 1000 > 1000 is false (not fail),
    // but 1000 > 1000*0.8 = 800 is true → 'warning', NOT 'pass'.
    expect(getMetricStatus(1000, 1000)).toBe('warning');

    // value === threshold * 0.8: 800 > 800 is false → 'pass' (boundary is strict >)
    expect(getMetricStatus(800, 1000)).toBe('pass');

    // value = 0 is always < threshold → 'pass'
    expect(getMetricStatus(0, 1000)).toBe('pass');
  });

  // --------------------------------------------------------------------------
  // extractPercentiles — p(50) fallback vs med priority
  // --------------------------------------------------------------------------
  it('edge_extractPercentiles_p50_fallback — p(50) used when med absent; med wins when both present', () => {
    const { mod } = loadModule();
    type ExtractFn = (m: unknown) => { p50: number | null };
    const extractPercentiles = mod.extractPercentiles as ExtractFn;

    // Only p(50) present → p50 = 77
    const onlyP50 = extractPercentiles({ values: { 'p(50)': 77 } });
    expect(onlyP50.p50).toBe(77);

    // Both med and p(50): med wins via ?? short-circuit (values.med ?? values['p(50)'])
    const bothPresent = extractPercentiles({ values: { med: 50, 'p(50)': 77 } });
    expect(bothPresent.p50).toBe(50);
  });

  // --------------------------------------------------------------------------
  // getMetricLabel — DASHBOARD metric + edge inputs
  // --------------------------------------------------------------------------
  it('edge_getMetricLabel_dashboard_and_edge_inputs — known dashboard key, empty string, undefined', () => {
    const { mod } = loadModule();
    const getMetricLabel = mod.getMetricLabel as (name: unknown) => unknown;

    // Known DASHBOARD key
    expect(getMetricLabel('dashboard_load_time')).toBe('Dashboard Load');

    // Empty string: not in AUTH_METRICS or DASHBOARD_METRICS → allMetrics[''] is undefined
    // → falls back to returning the raw name (''), does not throw.
    expect(getMetricLabel('')).toBe('');

    // undefined: allMetrics[undefined] is undefined → returns undefined, does not throw.
    expect(getMetricLabel(undefined)).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // module.exports does NOT leak main (exactly 8 symbols)
  // --------------------------------------------------------------------------
  it('edge_exports_no_main_leak — module.exports has exactly 8 keys, main is absent', () => {
    const { mod } = loadModule();

    const exportedKeys = Object.keys(mod);
    const expectedExports = [
      'extractPercentiles',
      'formatMs',
      'formatMetricValue',
      'getMetricStatus',
      'generateMetricsSection',
      'getMetricLabel',
      'AUTH_METRICS',
      'DASHBOARD_METRICS',
    ];

    // Exactly the 8 pure helpers — no side-effectful 'main'
    expect(exportedKeys).toHaveLength(8);
    expect(exportedKeys.sort()).toEqual(expectedExports.sort());
    expect(mod).not.toHaveProperty('main');
  });

  // --------------------------------------------------------------------------
  // require.main === module guard — second require is idempotent (cached)
  // --------------------------------------------------------------------------
  it('edge_second_require_idempotent — re-requiring module hits cache, main never runs again', () => {
    // First load (clears cache via afterEach of previous test, sets up spies)
    const { mod: mod1, exitSpy, writeSpy } = loadModule();

    // Second require of the same path — Node caches CJS modules, so the guard
    // code path (if require.main === module) is not re-evaluated.
    // The spies are still installed; if main() ran again, exitSpy would be called.
    const MODULE_PATH_INNER = path.resolve(process.cwd(), 'scripts/parse-k6-results.cjs');
    const mod2 = require(MODULE_PATH_INNER) as Record<string, unknown>;

    // Both should be the exact same cached object reference
    expect(mod1).toBe(mod2);

    // process.exit was never called — main() did not run on either require
    expect(exitSpy).not.toHaveBeenCalled();
    expect(writeSpy).not.toHaveBeenCalled();
  });
});
