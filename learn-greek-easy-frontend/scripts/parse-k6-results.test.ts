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
  it('test_exports_pure_helpers — module must export all core symbols', () => {
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
// PERF-12-02: Baseline Δ tracking (RED spec — Mode A)
// ============================================================================
// Tests for: readBaselines, computeDelta, formatDelta, and the new
// "Δ vs main" column in generateMetricsSection.
//
// Before the executor's implementation these tests FAIL because:
//   - mod.readBaselines / computeDelta / formatDelta → undefined (not a function)
//   - generateMetricsSection output has no "Δ vs main" header (tests 7–9)
// After the fix all 9 pass.
// ============================================================================

import os from 'node:os';
import fs from 'node:fs';

describe('PERF-12-02 baseline diff', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete require.cache[MODULE_PATH];
  });

  // --------------------------------------------------------------------------
  // computeDelta
  // --------------------------------------------------------------------------

  it('test_compute_delta_regression_up — 1200 vs 1000 → absMs=200, pct=20, direction=up', () => {
    const { mod } = loadModule();
    const computeDelta = mod.computeDelta as (
      current: number,
      baseline: number | null | undefined
    ) => { absMs: number; pct: number; direction: string };

    const delta = computeDelta(1200, 1000);
    expect(delta.absMs).toBe(200);
    expect(delta.pct).toBe(20);
    expect(delta.direction).toBe('up');
  });

  it('test_compute_delta_improvement_down — 900 vs 1000 → absMs=-100, pct=-10, direction=down', () => {
    const { mod } = loadModule();
    const computeDelta = mod.computeDelta as (
      current: number,
      baseline: number | null | undefined
    ) => { absMs: number; pct: number; direction: string };

    const delta = computeDelta(900, 1000);
    expect(delta.absMs).toBe(-100);
    expect(delta.pct).toBe(-10);
    expect(delta.direction).toBe('down');
  });

  it('test_compute_delta_flat_band — 1010 vs 1000 → direction=flat (|1%| < 2%)', () => {
    const { mod } = loadModule();
    const computeDelta = mod.computeDelta as (
      current: number,
      baseline: number | null | undefined
    ) => { absMs: number; pct: number; direction: string };

    const delta = computeDelta(1010, 1000);
    expect(delta.direction).toBe('flat');
  });

  it('test_compute_delta_no_baseline_is_new — null and undefined baselines → direction=new, no throw', () => {
    const { mod } = loadModule();
    const computeDelta = mod.computeDelta as (
      current: number,
      baseline: number | null | undefined
    ) => { absMs: number; pct: number; direction: string };

    expect(() => {
      const d1 = computeDelta(1000, null);
      expect(d1.direction).toBe('new');
    }).not.toThrow();

    expect(() => {
      const d2 = computeDelta(1000, undefined);
      expect(d2.direction).toBe('new');
    }).not.toThrow();
  });

  // --------------------------------------------------------------------------
  // readBaselines
  // --------------------------------------------------------------------------

  it('test_read_baselines_missing_file_returns_empty — absent path returns {metrics:{}} without throwing', () => {
    const { mod } = loadModule();
    const readBaselines = mod.readBaselines as (
      p: string
    ) => { metrics: Record<string, unknown> };

    let result: { metrics: Record<string, unknown> } | null = null;
    expect(() => {
      result = readBaselines('/no/such/path/baselines.json');
    }).not.toThrow();

    // Must return an object with a .metrics key (not null/undefined/throw)
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('metrics');
    expect(typeof (result as { metrics: Record<string, unknown> }).metrics).toBe('object');
  });

  it('test_read_baselines_parses_valid_file — temp JSON file is parsed correctly', () => {
    // Capture the real writeFileSync BEFORE loadModule() installs the spy so
    // that our fixture write actually lands on disk. loadModule() spies on the
    // `require('fs')` instance (Guard 2), which under vitest's ESM environment
    // is the same object reference as the `import fs from 'node:fs'` at the top
    // of this file — so calling `fs.writeFileSync` after loadModule() is a no-op.
    const realWriteFileSync = fs.writeFileSync.bind(fs);
    const realExistsSync = fs.existsSync.bind(fs);
    const realUnlinkSync = fs.unlinkSync.bind(fs);

    const { mod } = loadModule();
    const readBaselines = mod.readBaselines as (
      p: string
    ) => { metrics: Record<string, { p95: number }> };

    const tmpPath = path.join(os.tmpdir(), `perf-12-02-baselines-${Date.now()}.json`);
    const payload = {
      updated_at: '2026-06-21T00:00:00Z',
      commit: 'abc1234',
      metrics: {
        auth_total_time: { p95: 1000 },
        dashboard_load_time: { p95: 500 },
      },
    };
    // Use the real (un-spied) writeFileSync so the file is actually written to disk.
    realWriteFileSync(tmpPath, JSON.stringify(payload), 'utf8');

    try {
      const result = readBaselines(tmpPath);
      expect(result.metrics.auth_total_time.p95).toBe(1000);
      expect(result.metrics.dashboard_load_time.p95).toBe(500);
    } finally {
      // Guard: file may not exist if readBaselines threw (pre-impl)
      if (realExistsSync(tmpPath)) {
        realUnlinkSync(tmpPath);
      }
    }
  });

  // --------------------------------------------------------------------------
  // generateMetricsSection — Δ vs main column
  // --------------------------------------------------------------------------

  it('test_metrics_section_renders_delta_column — Δ header and formatted cell present', () => {
    const { mod } = loadModule();
    const generateMetricsSection = mod.generateMetricsSection as (
      title: string,
      metrics: Record<string, unknown>,
      metricConfig: Record<string, { label: string; threshold: number }>,
      baselines?: Record<string, { p95: number }>
    ) => string;
    const AUTH_METRICS = mod.AUTH_METRICS as Record<string, { label: string; threshold: number }>;

    // auth_total_time: p95=1200 vs baseline p95=1000 → +200ms (+20.0%)
    const metricsObj = {
      auth_total_time: { values: { 'p(95)': 1200, med: 100 } },
    };
    const baselinesMap = { auth_total_time: { p95: 1000 } };

    const output = generateMetricsSection('Auth Flow Metrics', metricsObj, AUTH_METRICS, baselinesMap);

    // Δ header must be present (escaped unicode or literal Δ)
    expect(output).toMatch(/Δ\s*vs\s*main|δ\s*vs\s*main|Δ\s*vs\s*main/i);

    // Formatted delta cell must appear: +200ms and (+20.0%)
    expect(output).toContain('+200ms');
    expect(output).toContain('+20.0%');
  });

  it('test_metrics_section_missing_baseline_renders_new — absent metric → "new", no NaN, no throw', () => {
    const { mod } = loadModule();
    const generateMetricsSection = mod.generateMetricsSection as (
      title: string,
      metrics: Record<string, unknown>,
      metricConfig: Record<string, { label: string; threshold: number }>,
      baselines?: Record<string, { p95: number }>
    ) => string;
    const AUTH_METRICS = mod.AUTH_METRICS as Record<string, { label: string; threshold: number }>;

    const metricsObj = {
      auth_total_time: { values: { 'p(95)': 1200, med: 100 } },
    };
    // Empty baselines map — auth_total_time has no baseline entry
    const baselinesMap: Record<string, { p95: number }> = {};

    let output = '';
    expect(() => {
      output = generateMetricsSection('Auth Flow Metrics', metricsObj, AUTH_METRICS, baselinesMap);
    }).not.toThrow();

    expect(output).toContain('new');
    expect(output).not.toContain('NaN');
  });

  it('test_delta_does_not_change_status — high-vs-baseline regression but under threshold keeps ✅; section has Δ header', () => {
    const { mod } = loadModule();
    const generateMetricsSection = mod.generateMetricsSection as (
      title: string,
      metrics: Record<string, unknown>,
      metricConfig: Record<string, { label: string; threshold: number }>,
      baselines?: Record<string, { p95: number }>
    ) => string;
    const AUTH_METRICS = mod.AUTH_METRICS as Record<string, { label: string; threshold: number }>;

    // auth_total_time threshold = 8000; p95=1200 is well under 8000 → status='pass' → ✅
    // But p95=1200 is 200ms above baseline 1000 (20% regression by delta, informational only).
    const metricsObj: Record<string, unknown> = {};
    // Populate all AUTH_METRICS keys so every row is present; only auth_total_time has non-null p95
    for (const name of Object.keys(AUTH_METRICS)) {
      if (name === 'auth_total_time') {
        metricsObj[name] = { values: { 'p(95)': 1200, med: 100 } };
      } else {
        metricsObj[name] = null;
      }
    }
    const baselinesMap = { auth_total_time: { p95: 1000 } };

    const output = generateMetricsSection('Auth Flow Metrics', metricsObj, AUTH_METRICS, baselinesMap);

    // Status icon for p95=1200 vs threshold=8000 must be ✅ (pass), NOT ❌ or ⚠️
    expect(output).toContain('✅'); // ✅

    // The Δ column header must be present (this is what fails pre-impl, making the test RED)
    expect(output).toMatch(/Δ\s*vs\s*main|δ\s*vs\s*main|Δ\s*vs\s*main/i);
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
  it('edge_exports_no_main_leak — module.exports has exactly 13 keys, main is absent', () => {
    const { mod } = loadModule();

    const exportedKeys = Object.keys(mod);
    const expectedExports = [
      'extractPercentiles',
      'formatMs',
      'formatMetricValue',
      'getMetricStatus',
      'generateMetricsSection',
      'getMetricLabel',
      'generateMarkdown',
      'AUTH_METRICS',
      'DASHBOARD_METRICS',
      'PROTOCOL_METRICS',
      'readBaselines',
      'computeDelta',
      'formatDelta',
    ];

    // Exactly the 13 pure helpers (8 original + 3 baseline-diff + 2 protocol additions) — no side-effectful 'main'
    expect(exportedKeys).toHaveLength(13);
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

// ============================================================================
// Adversarial / edge coverage (PERF-12-02 Mode B)
// ============================================================================
// These tests document the TRUE behavior of the implementation for every
// adversarial edge case requested. Where the code has a genuine robustness
// defect, the test LOCKS the actual (broken) output so CI catches any future
// change — and the defect is reported to the executor separately.
//
// DEFECT FOUND (QA_FAILED flag below):
//   computeDelta(1000, 0): zero baseline causes pct=Infinity (unguarded divide-
//   by-zero). formatDelta then renders '+1000ms (+Infinity%)' in the PR comment
//   markdown — not 'new', not 'flat', but a literal "+Infinity%" string.
//   This is a real robustness bug against AC-2's "no error / first-run safe"
//   spirit; a zero-baseline is an edge case that should render 'new' or a safe
//   sentinel, not expose JavaScript's Infinity artefact in a GitHub comment.
// ============================================================================

describe('parse-k6-results.cjs — adversarial / edge coverage (PERF-12-02)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    const MODULE_PATH_INNER = path.resolve(process.cwd(), 'scripts/parse-k6-results.cjs');
    delete require.cache[MODULE_PATH_INNER];
  });

  // --------------------------------------------------------------------------
  // Division-by-zero / zero baseline
  // Defect: pct = Infinity (unguarded). formatDelta renders '+Infinity%'.
  // This test LOCKS the actual broken behavior so a future guard is explicit.
  // --------------------------------------------------------------------------
  it('edge_zero_baseline_is_new — zero baseline treated as no-baseline (direction=new, no Infinity)', () => {
    const { mod } = loadModule();
    const computeDelta = mod.computeDelta as (
      current: number | null,
      baseline: number | null
    ) => { absMs: number | null; pct: number | null; direction: string };
    const formatDelta = mod.formatDelta as (
      delta: { absMs: number | null; pct: number | null; direction: string }
    ) => string;

    // 0 baseline: now guarded by baselineP95 <= 0 → returns 'new' shape
    const delta = computeDelta(1000, 0);

    expect(delta.direction).toBe('new');
    expect(delta.absMs).toBeNull();
    expect(delta.pct).toBeNull();

    // formatDelta must render 'new', never '+Infinity%' or any NaN/Infinity string
    const rendered = formatDelta(delta);
    expect(rendered).toBe('new');
    expect(rendered).not.toContain('Infinity');
    expect(rendered).not.toContain('NaN');
  });

  // --------------------------------------------------------------------------
  // Null current p95 — handled safely by the == null guard
  // --------------------------------------------------------------------------
  it('edge_null_current_p95 — computeDelta(null, 1000) returns direction=new, does not throw', () => {
    const { mod } = loadModule();
    const computeDelta = mod.computeDelta as (
      current: number | null,
      baseline: number | null
    ) => { absMs: number | null; pct: number | null; direction: string };
    const formatDelta = mod.formatDelta as (
      delta: { absMs: number | null; pct: number | null; direction: string }
    ) => string;

    let delta: { absMs: number | null; pct: number | null; direction: string } | null = null;
    expect(() => {
      delta = computeDelta(null, 1000);
    }).not.toThrow();

    // null current triggers the == null guard → direction='new', absMs=null, pct=null
    expect(delta!.direction).toBe('new');
    expect(delta!.absMs).toBeNull();
    expect(delta!.pct).toBeNull();
    expect(formatDelta(delta!)).toBe('new');
  });

  // --------------------------------------------------------------------------
  // Malformed baselines file (real-fs write, no writeFileSync spy active)
  // The spy from loadModule() is installed only on the require('fs') instance
  // AFTER loadModule() runs. We capture real bindings BEFORE calling loadModule().
  // --------------------------------------------------------------------------
  it('edge_malformed_baselines_file — invalid JSON → readBaselines returns {metrics:{}}, no throw', () => {
    // Capture real fs methods before loadModule installs its spy
    const realWrite = fs.writeFileSync.bind(fs);
    const realExists = fs.existsSync.bind(fs);
    const realUnlink = fs.unlinkSync.bind(fs);

    const { mod } = loadModule();
    const readBaselines = mod.readBaselines as (
      p: string
    ) => { metrics: Record<string, unknown> };

    const tmpPath = path.join(os.tmpdir(), `perf-12-02-malformed-${Date.now()}.json`);
    realWrite(tmpPath, '{ not json', 'utf8');

    try {
      let result: { metrics: Record<string, unknown> } | null = null;
      expect(() => {
        result = readBaselines(tmpPath);
      }).not.toThrow();

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('metrics');
      expect(result!.metrics).toEqual({});
    } finally {
      if (realExists(tmpPath)) realUnlink(tmpPath);
    }
  });

  // --------------------------------------------------------------------------
  // Baselines file missing the 'metrics' key entirely
  // readBaselines uses `parsed.metrics || {}` so missing key → empty map.
  // Downstream lookup of a metric → null → formatDelta renders 'new', no NaN.
  // --------------------------------------------------------------------------
  it('edge_baselines_no_metrics_key — {updated_at:"x"} → metrics:{}, downstream renders new', () => {
    const realWrite = fs.writeFileSync.bind(fs);
    const realExists = fs.existsSync.bind(fs);
    const realUnlink = fs.unlinkSync.bind(fs);

    const { mod } = loadModule();
    const readBaselines = mod.readBaselines as (
      p: string
    ) => { metrics: Record<string, { p95: number }> };
    const generateMetricsSection = mod.generateMetricsSection as (
      title: string,
      metrics: Record<string, unknown>,
      metricConfig: Record<string, { label: string; threshold: number }>,
      baselines?: Record<string, { p95: number }>
    ) => string;
    const AUTH_METRICS = mod.AUTH_METRICS as Record<string, { label: string; threshold: number }>;

    const tmpPath = path.join(os.tmpdir(), `perf-12-02-no-metrics-${Date.now()}.json`);
    realWrite(tmpPath, JSON.stringify({ updated_at: 'x' }), 'utf8');

    try {
      const result = readBaselines(tmpPath);
      // metrics key is absent in JSON → `parsed.metrics || {}` → empty object
      expect(result.metrics).toEqual({});

      // Downstream: no baseline entry for auth_total_time → baselineP95=null → 'new'
      const metricsObj = { auth_total_time: { values: { 'p(95)': 1200, med: 100 } } };
      let output = '';
      expect(() => {
        output = generateMetricsSection('Test', metricsObj, AUTH_METRICS, result.metrics);
      }).not.toThrow();

      expect(output).toContain('new');
      expect(output).not.toContain('NaN');
      expect(output).not.toContain('undefined');
    } finally {
      if (realExists(tmpPath)) realUnlink(tmpPath);
    }
  });

  // --------------------------------------------------------------------------
  // Table alignment: every pipe-delimited row has the same column count
  // Header and separator are fixed by the template; each data row must match.
  // --------------------------------------------------------------------------
  it('edge_delta_column_table_alignment — header, separator, and every data row have 9 pipes', () => {
    const { mod } = loadModule();
    const generateMetricsSection = mod.generateMetricsSection as (
      title: string,
      metrics: Record<string, unknown>,
      metricConfig: Record<string, { label: string; threshold: number }>,
      baselines?: Record<string, { p95: number }>
    ) => string;
    const AUTH_METRICS = mod.AUTH_METRICS as Record<string, { label: string; threshold: number }>;

    const metricsObj = { auth_total_time: { values: { 'p(95)': 1200, med: 100 } } };
    const baselinesMap = { auth_total_time: { p95: 1000 } };

    const output = generateMetricsSection('Auth Flow Metrics', metricsObj, AUTH_METRICS, baselinesMap);

    // Each markdown table row starts with '|'. Count pipes per row.
    const tableRows = output.split('\n').filter((l) => l.trim().startsWith('|'));
    expect(tableRows.length).toBeGreaterThan(0);

    // The header row pipe count determines the expected column count for all rows
    const headerPipeCount = (tableRows[0].match(/\|/g) ?? []).length;
    // 8 columns (Metric | p50 | p90 | p95 | p99 | Δ vs main | Threshold | Status) = 9 pipes
    expect(headerPipeCount).toBe(9);

    for (const row of tableRows) {
      const pipeCount = (row.match(/\|/g) ?? []).length;
      expect(pipeCount).toBe(headerPipeCount);
    }
  });

  // --------------------------------------------------------------------------
  // formatDelta rounding: 1-decimal percent and correct sign on negative
  // --------------------------------------------------------------------------
  it('edge_formatDelta_rounding — 12.3% rounds to one decimal; negative delta has - sign', () => {
    const { mod } = loadModule();
    const computeDelta = mod.computeDelta as (
      current: number,
      baseline: number
    ) => { absMs: number; pct: number; direction: string };
    const formatDelta = mod.formatDelta as (
      delta: { absMs: number; pct: number; direction: string }
    ) => string;

    // 1123 vs 1000: absMs=123, pct=12.3, direction='up'
    const up = computeDelta(1123, 1000);
    expect(up.absMs).toBe(123);
    expect(up.pct).toBeCloseTo(12.3, 5);
    expect(up.direction).toBe('up');
    expect(formatDelta(up)).toBe('+123ms (+12.3%)');

    // 877 vs 1000: absMs=-123, pct=-12.3, direction='down'
    const down = computeDelta(877, 1000);
    expect(down.absMs).toBe(-123);
    expect(down.pct).toBeCloseTo(-12.3, 5);
    expect(down.direction).toBe('down');
    expect(formatDelta(down)).toBe('-123ms (-12.3%)');
  });

  // --------------------------------------------------------------------------
  // Flat-band boundary: |pct| < 2 is STRICT — exactly 2.0% is NOT flat
  // --------------------------------------------------------------------------
  it('edge_flat_band_boundary — 2.0% exact is up (strict < 2); 1.9% is flat', () => {
    const { mod } = loadModule();
    const computeDelta = mod.computeDelta as (
      current: number,
      baseline: number
    ) => { absMs: number; pct: number; direction: string };

    // computeDelta(1020, 1000): absMs=20, pct=2.0 exactly
    // Math.abs(2.0) < 2 is false → direction='up' (not flat)
    const exactly2 = computeDelta(1020, 1000);
    expect(exactly2.pct).toBe(2);
    expect(exactly2.direction).toBe('up');

    // computeDelta(1019, 1000): pct=1.9 → |1.9| < 2 is true → 'flat'
    const justUnder2 = computeDelta(1019, 1000);
    expect(justUnder2.direction).toBe('flat');

    // computeDelta(981, 1000): pct=-1.9 → |−1.9| < 2 → 'flat'
    const negJustUnder2 = computeDelta(981, 1000);
    expect(negJustUnder2.direction).toBe('flat');

    // computeDelta(980, 1000): pct=-2.0 → |−2| < 2 is false → pct < 0 → 'down'
    const negExactly2 = computeDelta(980, 1000);
    expect(negExactly2.pct).toBe(-2);
    expect(negExactly2.direction).toBe('down');
  });
});

// ============================================================================
// PERF-12-04 protocol render
// ============================================================================
// Tests for the new protocol/API-latency section in generateMarkdown and
// the PROTOCOL_METRICS map + getMetricLabel F5 extension.
// ============================================================================

describe('PERF-12-04 protocol render', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete require.cache[MODULE_PATH];
  });

  // Build minimal authData / dashboardData objects matching what parseReport() returns.
  // We only need metrics + iterations + errorRate + violations for generateMarkdown.
  function makeAuthData() {
    return {
      iterations: 5,
      errorRate: 0,
      checksRate: 100,
      metrics: {
        auth_total_time: { values: { 'p(95)': 1000, med: 500 } },
      },
      violations: [],
    };
  }

  function makeDashboardData() {
    return {
      iterations: 5,
      errorRate: 0,
      checksRate: 100,
      metrics: {
        dashboard_flow_total_time: { values: { 'p(95)': 3000, med: 1500 } },
      },
      violations: [],
    };
  }

  function makeProtocolData() {
    return {
      iterations: 10,
      errorRate: 0,
      checksRate: 100,
      metrics: {
        api_total_time: { values: { 'p(95)': 4000, med: 100 } },
        api_review_time: { values: { 'p(95)': 1800, med: 900 } },
      },
      violations: [],
    };
  }

  // (i) generateMarkdown with protocolData contains 'API Latency / SM-2 Loop Metrics'
  it('protocol_section_heading — output contains the protocol metrics section heading', () => {
    const { mod } = loadModule();
    const generateMarkdown = mod.generateMarkdown as (
      auth: unknown,
      dash: unknown,
      baselines: unknown,
      protocol?: unknown
    ) => string;

    const output = generateMarkdown(makeAuthData(), makeDashboardData(), null, makeProtocolData());
    expect(output).toContain('API Latency / SM-2 Loop Metrics');
  });

  // (ii) generateMarkdown with protocolData contains an 'API Latency' summary row
  it('protocol_summary_row — summary table contains API Latency row', () => {
    const { mod } = loadModule();
    const generateMarkdown = mod.generateMarkdown as (
      auth: unknown,
      dash: unknown,
      baselines: unknown,
      protocol?: unknown
    ) => string;

    const output = generateMarkdown(makeAuthData(), makeDashboardData(), null, makeProtocolData());
    expect(output).toContain('API Latency');
    // The row must NOT be 'Skipped' when protocolData is provided
    const apiLatencyRow = output.split('\n').find((l) => l.includes('API Latency'));
    expect(apiLatencyRow).toBeDefined();
    expect(apiLatencyRow).not.toContain('Skipped');
  });

  // (iii) the protocol section contains the 'Δ vs main' column
  it('protocol_section_delta_column — protocol metrics section has Δ vs main column', () => {
    const { mod } = loadModule();
    const generateMarkdown = mod.generateMarkdown as (
      auth: unknown,
      dash: unknown,
      baselines: unknown,
      protocol?: unknown
    ) => string;

    const output = generateMarkdown(makeAuthData(), makeDashboardData(), null, makeProtocolData());
    // Find the API Latency section
    const sectionIdx = output.indexOf('API Latency / SM-2 Loop Metrics');
    expect(sectionIdx).toBeGreaterThan(-1);
    const sectionText = output.slice(sectionIdx);
    expect(sectionText).toMatch(/Δ\s*vs\s*main/i);
  });

  // (iv) with protocolData=null the output contains the Skipped API-latency row and does NOT throw
  it('protocol_null_renders_skipped — null protocolData → Skipped row, no throw', () => {
    const { mod } = loadModule();
    const generateMarkdown = mod.generateMarkdown as (
      auth: unknown,
      dash: unknown,
      baselines: unknown,
      protocol?: unknown
    ) => string;

    let output = '';
    expect(() => {
      output = generateMarkdown(makeAuthData(), makeDashboardData(), null, null);
    }).not.toThrow();

    // Skipped sentinel must appear in the API Latency row
    const apiLatencyRow = output.split('\n').find((l) => l.includes('API Latency'));
    expect(apiLatencyRow).toBeDefined();
    expect(apiLatencyRow).toContain('Skipped');

    // Protocol section heading must NOT appear
    expect(output).not.toContain('API Latency / SM-2 Loop Metrics');
  });

  // (iv-b) with protocolData omitted entirely also does not throw
  it('protocol_omitted_does_not_throw — omitting 4th arg → Skipped row, no throw', () => {
    const { mod } = loadModule();
    const generateMarkdown = mod.generateMarkdown as (
      auth: unknown,
      dash: unknown,
      baselines: unknown
    ) => string;

    let output = '';
    expect(() => {
      output = generateMarkdown(makeAuthData(), makeDashboardData(), null);
    }).not.toThrow();

    const apiLatencyRow = output.split('\n').find((l) => l.includes('API Latency'));
    expect(apiLatencyRow).toBeDefined();
    expect(apiLatencyRow).toContain('Skipped');
  });

  // (v) getMetricLabel('api_review_time') returns 'API Review (SM-2)'
  it('protocol_getMetricLabel_api_review — F5: api_review_time resolves to correct label', () => {
    const { mod } = loadModule();
    const getMetricLabel = mod.getMetricLabel as (name: string) => string;

    expect(getMetricLabel('api_review_time')).toBe('API Review (SM-2)');
  });

  // Bonus: PROTOCOL_METRICS is exported and has the right shape
  it('protocol_metrics_exported — PROTOCOL_METRICS is exported and has 5 entries', () => {
    const { mod } = loadModule();
    const PROTOCOL_METRICS = mod.PROTOCOL_METRICS as Record<string, { label: string; threshold: number }>;

    expect(PROTOCOL_METRICS).toBeDefined();
    expect(Object.keys(PROTOCOL_METRICS)).toHaveLength(5);
    expect(PROTOCOL_METRICS.api_me_time.threshold).toBe(1500);
    expect(PROTOCOL_METRICS.api_total_time.threshold).toBe(6000);
  });

  // Bonus: protocol violations are included in the aggregated violations table
  it('protocol_violations_in_table — protocol violations appear in violations section with API Latency scenario label', () => {
    const { mod } = loadModule();
    const generateMarkdown = mod.generateMarkdown as (
      auth: unknown,
      dash: unknown,
      baselines: unknown,
      protocol?: unknown
    ) => string;

    const protocolWithViolation = {
      ...makeProtocolData(),
      violations: [
        {
          metric: 'api_review_time',
          threshold: 'p(95)<2000',
          value: 'p95: 2.50s',
        },
      ],
    };

    const output = generateMarkdown(makeAuthData(), makeDashboardData(), null, protocolWithViolation);
    expect(output).toContain('API Latency');
    expect(output).toContain('API Review (SM-2)');
  });
});

// ============================================================================
// PERF-12-04 adversarial / edge coverage (Mode B)
// ============================================================================
// Added by QA in Mode B. Concrete F5 proof + edge cases for the protocol path.
// ============================================================================

describe('PERF-12-04 adversarial edge coverage (Mode B)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete require.cache[MODULE_PATH];
  });

  function makeAuthData() {
    return {
      iterations: 5,
      errorRate: 0,
      checksRate: 100,
      metrics: { auth_total_time: { values: { 'p(95)': 1000, med: 500 } } },
      violations: [],
    };
  }

  function makeDashboardData() {
    return {
      iterations: 5,
      errorRate: 0,
      checksRate: 100,
      metrics: { dashboard_flow_total_time: { values: { 'p(95)': 3000, med: 1500 } } },
      violations: [],
    };
  }

  // --------------------------------------------------------------------------
  // F5 concrete proof: violation metric raw name → human label in violations table
  // --------------------------------------------------------------------------
  it('adv_protocol_violation_renders_label_not_raw_name — F5 proof: api_review_time shows "API Review (SM-2)" not raw name', () => {
    const { mod } = loadModule();
    const generateMarkdown = mod.generateMarkdown as (
      auth: unknown,
      dash: unknown,
      baselines: unknown,
      protocol?: unknown
    ) => string;

    // Build protocolData with a violation whose metric is the raw k6 name.
    // The violations table must render the PROTOCOL_METRICS label, not the raw name.
    const protocolWithViolation = {
      iterations: 10,
      errorRate: 0,
      checksRate: 100,
      metrics: {
        api_total_time: { values: { 'p(95)': 4000, med: 100 } },
        api_review_time: {
          values: { 'p(95)': 2500, med: 1200 },
          thresholds: { 'p(95)<2000': { ok: false } },
        },
      },
      violations: [
        {
          metric: 'api_review_time',
          threshold: 'p(95)<2000',
          value: 'p95: 2.50s',
        },
      ],
    };

    const output = generateMarkdown(makeAuthData(), makeDashboardData(), null, protocolWithViolation);

    // The violations table must use the human label, not the raw k6 metric name
    expect(output).toContain('API Review (SM-2)');
    expect(output).not.toContain('| API Latency | api_review_time |');
  });

  // --------------------------------------------------------------------------
  // Protocol summary row shows 'Skipped' when protocolData is null
  // --------------------------------------------------------------------------
  it('adv_protocol_summary_skipped_no_undefined — null protocol → Skipped row, no undefined/NaN in output', () => {
    const { mod } = loadModule();
    const generateMarkdown = mod.generateMarkdown as (
      auth: unknown,
      dash: unknown,
      baselines: unknown,
      protocol?: unknown
    ) => string;

    let output = '';
    expect(() => {
      output = generateMarkdown(makeAuthData(), makeDashboardData(), { metrics: {} }, null);
    }).not.toThrow();

    // The API Latency row must appear and show Skipped
    const apiLatencyRow = output.split('\n').find((l) => l.includes('API Latency'));
    expect(apiLatencyRow).toBeDefined();
    expect(apiLatencyRow).toContain('Skipped');

    // No corruption markers
    expect(output).not.toContain('undefined');
    expect(output).not.toContain('NaN');
  });

  // --------------------------------------------------------------------------
  // Protocol section Δ column shows real delta when baselines contain api_total_time
  // --------------------------------------------------------------------------
  it('adv_protocol_section_delta_from_baseline — api_total_time baseline in baselines map produces real delta', () => {
    const { mod } = loadModule();
    const generateMarkdown = mod.generateMarkdown as (
      auth: unknown,
      dash: unknown,
      baselines: unknown,
      protocol?: unknown
    ) => string;

    const protocolData = {
      iterations: 10,
      errorRate: 0,
      checksRate: 100,
      metrics: {
        api_total_time: { values: { 'p(95)': 3500, med: 1800 } },
      },
      violations: [],
    };

    // baselines contains api_total_time: p95=3000
    // delta: 3500 - 3000 = +500ms (+16.7%)
    const baselines = { metrics: { api_total_time: { p95: 3000 } } };

    const output = generateMarkdown(makeAuthData(), makeDashboardData(), baselines, protocolData);

    // The protocol section must include a real delta (not 'new')
    const sectionIdx = output.indexOf('API Latency / SM-2 Loop Metrics');
    expect(sectionIdx).toBeGreaterThan(-1);
    const sectionText = output.slice(sectionIdx);

    // +500ms and positive percentage must appear
    expect(sectionText).toContain('+500ms');
    expect(sectionText).toContain('+16.7%');
  });

  // --------------------------------------------------------------------------
  // Both auth+dashboard present but protocol absent: must NOT throw
  // (the guard is: throw only if BOTH auth+dashboard are null)
  // --------------------------------------------------------------------------
  it('adv_protocol_absent_no_throw — auth+dashboard present, protocol missing does not throw', () => {
    const { mod } = loadModule();
    const generateMarkdown = mod.generateMarkdown as (
      auth: unknown,
      dash: unknown,
      baselines: unknown,
      protocol?: unknown
    ) => string;

    // Protocol is absent (not passed), auth and dashboard are present.
    // The "No k6 report files found" error only triggers when auth AND dashboard are null.
    let output = '';
    expect(() => {
      output = generateMarkdown(makeAuthData(), makeDashboardData(), null);
    }).not.toThrow();

    // API Latency row exists but is Skipped
    const apiLatencyRow = output.split('\n').find((l) => l.includes('API Latency'));
    expect(apiLatencyRow).toBeDefined();
    expect(apiLatencyRow).toContain('Skipped');
  });

  // --------------------------------------------------------------------------
  // Table alignment: protocol section header/separator/data-row pipe count matches
  // --------------------------------------------------------------------------
  it('adv_protocol_table_alignment — header, separator, and all data rows have 9 pipes in protocol section', () => {
    const { mod } = loadModule();
    const generateMarkdown = mod.generateMarkdown as (
      auth: unknown,
      dash: unknown,
      baselines: unknown,
      protocol?: unknown
    ) => string;

    const protocolData = {
      iterations: 5,
      errorRate: 0,
      checksRate: 100,
      metrics: {
        api_me_time: { values: { 'p(95)': 500, med: 250 } },
        api_dashboard_time: { values: { 'p(95)': 800, med: 400 } },
        api_study_queue_time: { values: { 'p(95)': 600, med: 300 } },
        api_review_time: { values: { 'p(95)': 1000, med: 500 } },
        api_total_time: { values: { 'p(95)': 3000, med: 1500 } },
      },
      violations: [],
    };

    const output = generateMarkdown(makeAuthData(), makeDashboardData(), null, protocolData);

    // Extract just the protocol section
    const sectionIdx = output.indexOf('API Latency / SM-2 Loop Metrics');
    expect(sectionIdx).toBeGreaterThan(-1);

    // Find the next section heading after the protocol section (or end of string)
    const afterSection = output.slice(sectionIdx);
    const nextSectionIdx = afterSection.search(/\n###\s(?!API Latency)/);
    const protocolSection = nextSectionIdx > -1 ? afterSection.slice(0, nextSectionIdx) : afterSection;

    const tableRows = protocolSection.split('\n').filter((l) => l.trim().startsWith('|'));
    expect(tableRows.length).toBeGreaterThan(0);

    // Header row: 8 columns = 9 pipes
    // | Metric | p50 | p90 | p95 | p99 | Δ vs main | Threshold | Status |
    const headerPipeCount = (tableRows[0].match(/\|/g) ?? []).length;
    expect(headerPipeCount).toBe(9);

    // Every row must match the header pipe count
    for (const row of tableRows) {
      const pipeCount = (row.match(/\|/g) ?? []).length;
      expect(pipeCount).toBe(headerPipeCount);
    }
  });
});
