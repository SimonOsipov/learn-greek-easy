/**
 * MetricStrip — adversarial unit tests (DASH2-01-04 QA)
 *
 * Covers:
 *  1. Exactly 3 UnwiredDot instances (Due Today, Mastered, All-time) — NOT streak
 *  2. All 3 UnwiredDot trends are inside .db-metric-trend.is-flat (not green positive deltas)
 *  3. The streak trend shows longestStreak value (real data, no dot) when currentStreak > 0
 *  4. The streak trend has NO is-flat class when currentStreak > 0 (it's a real/positive line)
 *  5. When currentStreak === 0, streak shows "start one today" in .is-flat (no UnwiredDot)
 *  6. Each UnwiredDot has a DISTINCT aria-label (accessibility)
 *  7. Edge case: dueToday=0 renders value "0", still shows UnwiredDot trend
 *  8. CD order verified: primary→amber→green→violet via data-tone attributes
 */

import { screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { renderWithProviders } from '@/lib/test-utils';

import { MetricStrip } from '../MetricStrip';
import type { MetricStripProps } from '../MetricStrip';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderStrip(overrides: Partial<MetricStripProps> = {}) {
  const defaults: MetricStripProps = {
    dueToday: 5,
    currentStreak: 3,
    longestStreak: 7,
    mastered: 42,
    allTimeLabel: '4h 30m',
    ...overrides,
  };
  renderWithProviders(<MetricStrip {...defaults} />);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('MetricStrip adversarial (DASH2-01-04)', () => {
  // ── AC D1: CD order and tones ───────────────────────────────────────────────

  it('test_metric_strip_cd_order: 4 tiles in CD order (primary→amber→green→violet)', () => {
    renderStrip();
    const tiles = document.querySelectorAll('.db-metric[data-tone]');
    expect(tiles).toHaveLength(4);
    const tones = Array.from(tiles).map((el) => el.getAttribute('data-tone'));
    expect(tones).toEqual(['primary', 'amber', 'green', 'violet']);
  });

  // ── AC D3 + adversarial #3: Streak real trend uses longestStreak ────────────

  it('test_metric_streak_trend_real_when_active: streak trend shows longestStreak, no UnwiredDot, no is-flat', () => {
    renderStrip({ currentStreak: 3, longestStreak: 7 });

    const streakTile = document.querySelector('[data-testid="db-metric-streak"]')!;
    expect(streakTile).not.toBeNull();

    const trendEl = streakTile.querySelector('.db-metric-trend');
    expect(trendEl).not.toBeNull();

    // Real trend shows longestStreak value in text
    expect(trendEl!.textContent).toContain('7');

    // NOT inside is-flat (it's a real positive delta — should render in success color)
    expect(trendEl!.classList.contains('is-flat')).toBe(false);

    // No UnwiredDot inside the streak trend
    const dot = trendEl!.querySelector('.dx-unwired-dot');
    expect(dot).toBeNull();
  });

  // ── AC D3: streak=0 path shows flat text, not UnwiredDot ───────────────────

  it('test_metric_streak_trend_zero: currentStreak=0 shows flat text, no UnwiredDot', () => {
    renderStrip({ currentStreak: 0, longestStreak: 0 });

    const streakTile = document.querySelector('[data-testid="db-metric-streak"]')!;
    const trendEl = streakTile.querySelector('.db-metric-trend');
    expect(trendEl).not.toBeNull();

    // is-flat when streak is 0
    expect(trendEl!.classList.contains('is-flat')).toBe(true);

    // No UnwiredDot — it's a plain text prompt, not a red-dot placeholder
    const dot = trendEl!.querySelector('.dx-unwired-dot');
    expect(dot).toBeNull();
  });

  // ── AC D4 + adversarial #1: exactly 3 UnwiredDot instances ─────────────────

  it('test_metric_strip_exactly_3_unwired_dots: Due Today, Mastered, All-time have dots; Streak does not', () => {
    renderStrip({ currentStreak: 3 }); // currentStreak > 0 so streak uses real trend

    const allDots = document.querySelectorAll('.dx-unwired-dot');
    expect(allDots).toHaveLength(3);

    // Streak tile must NOT have a dot
    const streakTile = document.querySelector('[data-testid="db-metric-streak"]')!;
    expect(streakTile.querySelector('.dx-unwired-dot')).toBeNull();

    // Due Today tile must have a dot
    const dueTile = document.querySelector('[data-testid="db-metric-due"]')!;
    expect(dueTile.querySelector('.dx-unwired-dot')).not.toBeNull();

    // Mastered tile must have a dot
    const masteredTile = document.querySelector('[data-testid="db-metric-mastered"]')!;
    expect(masteredTile.querySelector('.dx-unwired-dot')).not.toBeNull();

    // All-time tile must have a dot
    const alltimeTile = document.querySelector('[data-testid="db-metric-alltime"]')!;
    expect(alltimeTile.querySelector('.dx-unwired-dot')).not.toBeNull();
  });

  // ── AC D4 + adversarial #2: all 3 dots inside .db-metric-trend.is-flat ─────

  it('test_metric_strip_dots_inside_isflat: all 3 UnwiredDot trends carry is-flat class', () => {
    renderStrip({ currentStreak: 3 });

    const dotTiles = [
      document.querySelector('[data-testid="db-metric-due"]')!,
      document.querySelector('[data-testid="db-metric-mastered"]')!,
      document.querySelector('[data-testid="db-metric-alltime"]')!,
    ];

    for (const tile of dotTiles) {
      const trendEl = tile.querySelector('.db-metric-trend');
      expect(trendEl).not.toBeNull();
      expect(trendEl!.classList.contains('is-flat')).toBe(
        true,
        `Expected .is-flat on trend in tile ${tile.getAttribute('data-testid')}`
      );
      expect(trendEl!.querySelector('.dx-unwired-dot')).not.toBeNull();
    }
  });

  // ── adversarial #4: distinct aria-labels ────────────────────────────────────

  it('test_metric_strip_distinct_aria_labels: 3 UnwiredDots have distinct aria-labels', () => {
    renderStrip({ currentStreak: 3 });

    const dots = document.querySelectorAll('.dx-unwired-dot');
    expect(dots).toHaveLength(3);

    const ariaLabels = Array.from(dots).map((el) => el.getAttribute('aria-label'));
    const unique = new Set(ariaLabels);
    expect(unique.size).toBe(3);

    // None should be empty/null
    for (const label of ariaLabels) {
      expect(label).toBeTruthy();
    }
  });

  // ── adversarial #7: dueToday=0 edge case ───────────────────────────────────

  it('test_metric_strip_due_today_zero: dueToday=0 renders "0" and still shows UnwiredDot trend', () => {
    renderStrip({ dueToday: 0 });

    const dueTile = document.querySelector('[data-testid="db-metric-due"]')!;
    const valueEl = dueTile.querySelector('[data-testid="db-metric-due-value"]')!;
    expect(valueEl.textContent?.trim()).toBe('0');

    // UnwiredDot still present even when dueToday=0
    const dot = dueTile.querySelector('.dx-unwired-dot');
    expect(dot).not.toBeNull();
  });

  // ── AC D2: Due-Today value comes from the dueToday prop (not derived inside component) ──

  it('test_metric_strip_due_today_prop_passthrough: renders the exact dueToday prop value', () => {
    renderStrip({ dueToday: 99 });
    const valueEl = document.querySelector('[data-testid="db-metric-due-value"]')!;
    expect(valueEl.textContent?.trim()).toBe('99');
  });

  // ── AC D1: all-time tile uses allTimeLabel as raw string ────────────────────

  it('test_metric_strip_alltime_label_passthrough: renders allTimeLabel string in all-time tile', () => {
    renderStrip({ allTimeLabel: '12h 05m' });
    const valueEl = document.querySelector('[data-testid="db-metric-alltime-value"]')!;
    expect(valueEl.textContent?.trim()).toBe('12h 05m');
  });

  // ── AC D1: mastered tile includes mastered count + words unit suffix ─────────

  it('test_metric_strip_mastered_value_with_suffix: mastered tile shows count followed by words unit', () => {
    renderStrip({ mastered: 42 });
    const valueEl = document.querySelector('[data-testid="db-metric-mastered-value"]')!;
    expect(valueEl.textContent).toContain('42');
    // Suffix "words" is present inside <small>
    const small = valueEl.querySelector('small');
    expect(small).not.toBeNull();
    expect(small!.textContent).toBeTruthy();
  });
});
