#!/usr/bin/env node
/**
 * K6 Baseline Writer
 *
 * Reads the most recent k6 scenario reports and writes a committed
 * baselines.json that the PR-comment parser uses for the "Δ vs main" column.
 *
 * Usage (run from repo root, or set K6_REPORTS_DIR / K6_BASELINE_FILE):
 *   node learn-greek-easy-frontend/scripts/write-k6-baseline.cjs
 *
 * Environment variables:
 *   K6_REPORTS_DIR    - Directory containing k6 JSON reports (default: ./k6-data)
 *   K6_BASELINE_FILE  - Path to output baselines.json (default: <repo-root>/k6/baselines.json)
 *   GITHUB_SHA        - Commit SHA to embed in baselines (default: 'local')
 *
 * Output file schema:
 *   {
 *     "updated_at": "<ISO-8601>",
 *     "commit": "<sha>",
 *     "metrics": {
 *       "<metric-name>": { "p95": <number ms, rounded> }
 *     }
 *   }
 *
 * Partial-safe: missing scenarios or metrics are simply absent from the output.
 * The PR-comment parser renders absent metrics as "new" on the first run.
 *
 * Exit codes:
 *   0 - Always exits 0 (errors are logged but do not block CI)
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Reuse helpers from parse-k6-results.cjs
// ---------------------------------------------------------------------------
const {
  findLatestReport,
  parseReport,
  extractPercentiles,
  AUTH_METRICS,
  DASHBOARD_METRICS,
  PROTOCOL_METRICS,
} = require('./parse-k6-results.cjs');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const REPORTS_DIR = process.env.K6_REPORTS_DIR || path.join(process.cwd(), 'k6-data');
const DEFAULT_BASELINE_FILE = path.resolve(__dirname, '../../k6/baselines.json');
const BASELINE_FILE = process.env.K6_BASELINE_FILE || DEFAULT_BASELINE_FILE;

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

/**
 * Build a baseline object from the latest scenario reports in reportsDir.
 *
 * For each known metric (union of AUTH, DASHBOARD, PROTOCOL maps), reads the
 * p95 value from the corresponding scenario's report. Only finite numbers are
 * written; missing scenarios or missing metrics are simply absent.
 *
 * @param {string} reportsDir - Directory containing k6 JSON reports
 * @returns {{ updated_at: string, commit: string, metrics: Record<string, { p95: number }> }}
 */
function buildBaseline(reportsDir) {
  // Find the latest report for each scenario
  // We pass reportsDir directly since findLatestReport uses the module-level REPORTS_DIR.
  // To support an injected dir we temporarily override via env (the function reads
  // process.env.K6_REPORTS_DIR at call time via module-level const; it won't help
  // after module load). Instead we inline the same logic here, referencing reportsDir.

  /**
   * Find the most recent file in `dir` whose filename starts with `prefix` and ends with `.json`.
   * @param {string} dir
   * @param {string} prefix
   * @returns {string|null}
   */
  function findLatest(dir, prefix) {
    try {
      if (!fs.existsSync(dir)) return null;
      const files = fs.readdirSync(dir)
        .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
        .map((f) => ({
          name: f,
          fullPath: path.join(dir, f),
          mtime: fs.statSync(path.join(dir, f)).mtime,
        }))
        .sort((a, b) => b.mtime - a.mtime);
      return files.length > 0 ? files[0].fullPath : null;
    } catch (_err) {
      return null;
    }
  }

  const authPath = findLatest(reportsDir, 'auth-preview-');
  const dashboardPath = findLatest(reportsDir, 'dashboard-preview-');
  const apiLatencyPath = findLatest(reportsDir, 'api-latency-preview-');

  // Parse each found report (parseReport returns null on error)
  const authReport = authPath ? parseReport(authPath) : null;
  const dashboardReport = dashboardPath ? parseReport(dashboardPath) : null;
  const apiLatencyReport = apiLatencyPath ? parseReport(apiLatencyPath) : null;

  // Map scenario → its metric config
  const scenarioMetrics = [
    { report: authReport, metricConfig: AUTH_METRICS },
    { report: dashboardReport, metricConfig: DASHBOARD_METRICS },
    { report: apiLatencyReport, metricConfig: PROTOCOL_METRICS },
  ];

  // Build the metrics map
  /** @type {Record<string, { p95: number }>} */
  const metrics = {};

  for (const { report, metricConfig } of scenarioMetrics) {
    if (!report) continue; // scenario missing — skip silently (partial-safe)

    for (const metricName of Object.keys(metricConfig)) {
      const rawMetric = report.metrics[metricName];
      const percentiles = extractPercentiles(rawMetric);
      const p95 = percentiles.p95;

      if (typeof p95 === 'number' && isFinite(p95)) {
        metrics[metricName] = { p95: Math.round(p95) };
      }
      // Absent or non-finite → omit (renders as "new" in PR comment)
    }
  }

  return {
    updated_at: new Date().toISOString(),
    commit: process.env.GITHUB_SHA || 'local',
    metrics,
  };
}

/**
 * Build baselines from reportsDir and write them to outPath as formatted JSON.
 *
 * @param {string} [reportsDir] - Directory to read reports from (default: REPORTS_DIR env)
 * @param {string} [outPath] - Destination file path (default: BASELINE_FILE env / repo-root default)
 */
function writeBaseline(reportsDir, outPath) {
  const dir = reportsDir || REPORTS_DIR;
  const dest = outPath || BASELINE_FILE;

  console.log('='.repeat(60));
  console.log('K6 BASELINE WRITER');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Reports dir : ${dir}`);
  console.log(`Output file : ${dest}`);
  console.log('');

  const baseline = buildBaseline(dir);
  const json = JSON.stringify(baseline, null, 2) + '\n';

  fs.writeFileSync(dest, json, 'utf8');

  const metricCount = Object.keys(baseline.metrics).length;
  console.log(`Written ${metricCount} metric(s) to ${dest}`);
  console.log(`commit: ${baseline.commit}`);
  console.log(`updated_at: ${baseline.updated_at}`);
  console.log('');
  console.log('Done.');
}

// ---------------------------------------------------------------------------
// Run (when executed directly)
// ---------------------------------------------------------------------------

if (require.main === module) {
  try {
    writeBaseline();
  } catch (err) {
    console.error(`Error writing baselines: ${err.message}`);
    // Exit 0 — best-effort; do not block CI
  }
  process.exit(0);
}

module.exports = { buildBaseline, writeBaseline };
