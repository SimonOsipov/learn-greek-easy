/**
 * PERF-12-06: Tests for write-k6-baseline.cjs
 *
 * Verifies:
 *   1. buildBaseline reads the correct scenario reports and extracts p95 values
 *   2. Partial-safe: missing scenarios / metrics are absent from output (not null/NaN)
 *   3. Empty dir → { metrics: {} } with no throw
 *   4. updated_at and commit are present strings
 *
 * Uses a real temp directory with fixture k6 summary JSON files to avoid
 * mocking the filesystem (same pattern as parse-k6-results.test.ts).
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { afterEach, describe, it, expect, vi } from 'vitest';

const require = createRequire(import.meta.url);

const MODULE_PATH = path.resolve(process.cwd(), 'scripts/write-k6-baseline.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Load write-k6-baseline.cjs with process.exit guarded so the vitest worker
 * doesn't die if the module's guard fires during require (it shouldn't, but
 * this matches the defensive pattern used in parse-k6-results.test.ts).
 */
function loadModule() {
  // Bust require cache for a fresh load each test
  delete require.cache[MODULE_PATH];
  // Also bust the parser module cache so findLatestReport/parseReport reload cleanly
  const PARSER_PATH = path.resolve(process.cwd(), 'scripts/parse-k6-results.cjs');
  delete require.cache[PARSER_PATH];

  const exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: number) => {
    throw new Error('process.exit called during import');
  });

  let mod: Record<string, unknown> = {};
  let importError: Error | null = null;
  try {
    mod = require(MODULE_PATH) as Record<string, unknown>;
  } catch (err) {
    importError = err as Error;
  }

  return { mod, exitSpy, importError };
}

/**
 * Build a minimal k6 JSON summary fixture with a single metric at the given p95.
 */
function makeK6Fixture(metricName: string, p95: number): string {
  return JSON.stringify({
    metrics: {
      [metricName]: {
        values: {
          'p(95)': p95,
          med: p95 / 2,
          avg: p95 / 2,
          min: 10,
          max: p95 * 1.5,
        },
      },
      // include a checks metric so parseReport doesn't stumble
      checks: {
        values: { rate: 1, passes: 5, fails: 0 },
      },
    },
  });
}

/**
 * Create a temp directory, write fixture files, and return the dir path.
 * Caller is responsible for cleanup.
 */
function makeTempReportsDir(fixtures: Array<{ prefix: string; metricName: string; p95: number }>): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-12-06-'));
  const now = Date.now();
  for (let i = 0; i < fixtures.length; i++) {
    const { prefix, metricName, p95 } = fixtures[i];
    const filename = `${prefix}${now + i}.json`;
    fs.writeFileSync(path.join(tmpDir, filename), makeK6Fixture(metricName, p95), 'utf8');
  }
  return tmpDir;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('write-k6-baseline.cjs — PERF-12-06', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete require.cache[MODULE_PATH];
    const PARSER_PATH = path.resolve(process.cwd(), 'scripts/parse-k6-results.cjs');
    delete require.cache[PARSER_PATH];
  });

  // --------------------------------------------------------------------------
  // 1. Importing the module does NOT run main()
  // --------------------------------------------------------------------------
  it('import_does_not_run_main — requiring module must not call process.exit', () => {
    const { importError, exitSpy } = loadModule();

    expect(importError).toBeNull();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // 2. Module exports buildBaseline and writeBaseline
  // --------------------------------------------------------------------------
  it('exports_buildBaseline_and_writeBaseline — both functions are exported', () => {
    const { mod } = loadModule();
    expect(mod).toHaveProperty('buildBaseline');
    expect(mod).toHaveProperty('writeBaseline');
    expect(typeof mod.buildBaseline).toBe('function');
    expect(typeof mod.writeBaseline).toBe('function');
  });

  // --------------------------------------------------------------------------
  // 3. buildBaseline extracts p95 from auth-preview-* report
  // --------------------------------------------------------------------------
  it('buildBaseline_reads_auth_report — auth_total_time.p95 from fixture is returned', () => {
    const tmpDir = makeTempReportsDir([
      { prefix: 'auth-preview-', metricName: 'auth_total_time', p95: 1234 },
    ]);
    try {
      const { mod } = loadModule();
      const buildBaseline = mod.buildBaseline as (dir: string) => {
        updated_at: string;
        commit: string;
        metrics: Record<string, { p95: number }>;
      };

      const result = buildBaseline(tmpDir);

      expect(result.metrics).toHaveProperty('auth_total_time');
      // p95 is Math.round(1234) = 1234
      expect(result.metrics.auth_total_time.p95).toBe(1234);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // --------------------------------------------------------------------------
  // 4. buildBaseline extracts p95 from api-latency-preview-* report
  // --------------------------------------------------------------------------
  it('buildBaseline_reads_api_latency_report — api_me_time.p95 from fixture is returned', () => {
    const tmpDir = makeTempReportsDir([
      { prefix: 'api-latency-preview-', metricName: 'api_me_time', p95: 750 },
    ]);
    try {
      const { mod } = loadModule();
      const buildBaseline = mod.buildBaseline as (dir: string) => {
        updated_at: string;
        commit: string;
        metrics: Record<string, { p95: number }>;
      };

      const result = buildBaseline(tmpDir);

      expect(result.metrics).toHaveProperty('api_me_time');
      expect(result.metrics.api_me_time.p95).toBe(750);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // --------------------------------------------------------------------------
  // 5. Partial-safe: metric absent from report is absent from output (not null)
  // --------------------------------------------------------------------------
  it('buildBaseline_partial_safe — metric absent from report is absent from output', () => {
    // Only auth_total_time is in the fixture; auth_navigate_time is absent.
    const tmpDir = makeTempReportsDir([
      { prefix: 'auth-preview-', metricName: 'auth_total_time', p95: 500 },
    ]);
    try {
      const { mod } = loadModule();
      const buildBaseline = mod.buildBaseline as (dir: string) => {
        metrics: Record<string, { p95: number }>;
      };

      const result = buildBaseline(tmpDir);

      // auth_total_time should be present (from fixture)
      expect(result.metrics).toHaveProperty('auth_total_time');
      // auth_navigate_time was not in the fixture — must be absent, not null/undefined
      expect(result.metrics).not.toHaveProperty('auth_navigate_time');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // --------------------------------------------------------------------------
  // 6. Empty reports dir → { metrics: {} }, no throw
  // --------------------------------------------------------------------------
  it('buildBaseline_empty_dir — returns empty metrics without throwing', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-12-06-empty-'));
    try {
      const { mod } = loadModule();
      const buildBaseline = mod.buildBaseline as (dir: string) => {
        updated_at: string;
        commit: string;
        metrics: Record<string, { p95: number }>;
      };

      let result: { updated_at: string; commit: string; metrics: Record<string, { p95: number }> } | null = null;
      expect(() => {
        result = buildBaseline(tmpDir);
      }).not.toThrow();

      expect(result).not.toBeNull();
      expect(result!.metrics).toEqual({});
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // --------------------------------------------------------------------------
  // 7. updated_at and commit fields are present with correct types
  // --------------------------------------------------------------------------
  it('buildBaseline_metadata_fields — updated_at is ISO string, commit is a string', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-12-06-meta-'));
    try {
      const { mod } = loadModule();
      const buildBaseline = mod.buildBaseline as (dir: string) => {
        updated_at: string;
        commit: string;
        metrics: Record<string, { p95: number }>;
      };

      const result = buildBaseline(tmpDir);

      expect(typeof result.updated_at).toBe('string');
      expect(result.updated_at.length).toBeGreaterThan(0);
      // Should be a parseable date (ISO 8601)
      expect(isNaN(Date.parse(result.updated_at))).toBe(false);

      expect(typeof result.commit).toBe('string');
      expect(result.commit.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // --------------------------------------------------------------------------
  // 8. Non-existent reports dir → empty metrics, no throw
  // --------------------------------------------------------------------------
  it('buildBaseline_nonexistent_dir — returns empty metrics when dir does not exist', () => {
    const { mod } = loadModule();
    const buildBaseline = mod.buildBaseline as (dir: string) => {
      metrics: Record<string, { p95: number }>;
    };

    let result: { metrics: Record<string, { p95: number }> } | null = null;
    expect(() => {
      result = buildBaseline('/no/such/directory/perf-12-06');
    }).not.toThrow();

    expect(result).not.toBeNull();
    expect(result!.metrics).toEqual({});
  });
});
