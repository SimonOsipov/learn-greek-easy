/// <reference types="jest" />
/**
 * Unit tests for formatStudyTime — the SECONDS-based port from web timeFormatUtils.ts.
 *
 * Boundary cases mirror the web implementation exactly:
 *   0            → "0m"
 *   < 60 s       → "Ns"
 *   60 s         → "1m"
 *   < 3 600 s    → "Nm"
 *   3 600 s      → "1h"
 *   3 660 s      → "1h 1m"
 *   5 400 s      → "1h 30m"
 *   7 200 s      → "2h"        (minutes = 0 → drop)
 *   86 400 s     → "1d"
 *   90 000 s     → "1d 1h"
 *   90 060 s     → "1d 1h"    (minutes sub-unit ignored at day level)
 *   172 800 s    → "2d"        (hours = 0 → drop)
 */

import { formatStudyTime } from '@/lib/dashboard/format-study-time';

describe('formatStudyTime', () => {
  // ── Zero ──────────────────────────────────────────────────────────────────
  it('returns "0m" for 0 seconds', () => {
    expect(formatStudyTime(0)).toBe('0m');
  });

  // ── Sub-minute (raw seconds) ───────────────────────────────────────────────
  it('returns "1s" for 1 second', () => {
    expect(formatStudyTime(1)).toBe('1s');
  });

  it('returns "59s" for 59 seconds', () => {
    expect(formatStudyTime(59)).toBe('59s');
  });

  // ── Minutes only ──────────────────────────────────────────────────────────
  it('returns "1m" for 60 seconds (exactly one minute)', () => {
    expect(formatStudyTime(60)).toBe('1m');
  });

  it('returns "2m" for 120 seconds', () => {
    expect(formatStudyTime(120)).toBe('2m');
  });

  it('returns "59m" for 3 540 seconds (one minute short of an hour)', () => {
    expect(formatStudyTime(3540)).toBe('59m');
  });

  // ── Hours (minutes = 0 → drop) ───────────────────────────────────────────
  it('returns "1h" for 3 600 seconds (exactly one hour, no minutes)', () => {
    expect(formatStudyTime(3600)).toBe('1h');
  });

  it('returns "2h" for 7 200 seconds (two hours, no remaining minutes)', () => {
    expect(formatStudyTime(7200)).toBe('2h');
  });

  // ── Hours + minutes (minutes > 0 → show) ─────────────────────────────────
  it('returns "1h 1m" for 3 660 seconds', () => {
    expect(formatStudyTime(3660)).toBe('1h 1m');
  });

  it('returns "1h 30m" for 5 400 seconds', () => {
    expect(formatStudyTime(5400)).toBe('1h 30m');
  });

  it('returns "1h 59m" for 7 140 seconds', () => {
    expect(formatStudyTime(7140)).toBe('1h 59m');
  });

  // ── Days (hours = 0 → drop) ───────────────────────────────────────────────
  it('returns "1d" for 86 400 seconds (exactly one day, no remaining hours)', () => {
    expect(formatStudyTime(86400)).toBe('1d');
  });

  it('returns "2d" for 172 800 seconds (two days, no remaining hours)', () => {
    expect(formatStudyTime(172800)).toBe('2d');
  });

  // ── Days + hours (hours > 0 → show; minutes ignored at day level) ─────────
  it('returns "1d 1h" for 90 000 seconds (1 day + 1 hour)', () => {
    expect(formatStudyTime(90000)).toBe('1d 1h');
  });

  it('returns "1d 1h" for 90 060 seconds (1 day + 1 hour + 1 minute — minutes dropped)', () => {
    expect(formatStudyTime(90060)).toBe('1d 1h');
  });

  it('returns "2d 12h" for 216 000 seconds (2 days + 12 hours)', () => {
    expect(formatStudyTime(216000)).toBe('2d 12h');
  });

  // ── Large values ──────────────────────────────────────────────────────────
  it('returns "7d" for 604 800 seconds (exactly one week)', () => {
    expect(formatStudyTime(604800)).toBe('7d');
  });
});
