/**
 * DxMetricStrip Component Tests — DX-06 + DX-12 coverage
 *
 * Covers:
 * - Due card binds cards_due, NO UnwiredDot
 * - Time card: total_study_time_seconds=3600 → "60" min shown (DX-12 coverage)
 * - Time card has NO UnwiredDot on the numeric value itself
 * - Mastered card shows cards_mastered/total_cards + pct
 * - Streak + WeekHeat render real backend data (R1, R2 wired); no UnwiredDot markers
 * - Total UnwiredDots in the strip === 0
 */

import React from 'react';

import { render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { describe, it, expect } from 'vitest';

import i18n from '@/i18n';
import type { DeckStatistics, ProgressMetrics } from '@/services/progressAPI';

import { DxMetricStrip } from '../DxMetricStrip';

// ============================================
// Fixtures
// ============================================

const mockProgress: ProgressMetrics = {
  total_cards: 50,
  cards_studied: 30,
  cards_mastered: 15,
  cards_due: 7,
  cards_new: 10,
  cards_learning: 5,
  cards_review: 10,
  mastery_percentage: 30,
  completion_percentage: 60,
};

const mockStatistics: DeckStatistics = {
  total_reviews: 120,
  total_study_time_seconds: 3600, // 60 minutes
  average_quality: 3.5,
  average_easiness_factor: 2.4,
  average_interval_days: 7,
  deck_streak_current: 5,
  deck_streak_longest: 12,
  weekly_activity: [1, 2, 0, 3, 1, 0, 4],
};

function renderStrip(
  progress: ProgressMetrics | undefined,
  statistics: DeckStatistics | undefined
) {
  return render(
    <I18nextProvider i18n={i18n}>
      <DxMetricStrip progress={progress} statistics={statistics} />
    </I18nextProvider>
  );
}

// ============================================
// Tests
// ============================================

describe('DxMetricStrip', () => {
  // ── Due card ──────────────────────────────────────────────────────────────

  it('Due card displays cards_due value', () => {
    renderStrip(mockProgress, mockStatistics);
    const dueCard = screen.getByTestId('dx-metric-due');
    const value = within(dueCard).getByTestId('dx-metric-due-value');
    expect(value.textContent).toBe('7');
  });

  it('Due card has NO UnwiredDot', () => {
    const { container } = renderStrip(mockProgress, mockStatistics);
    const dueCard = container.querySelector('[data-testid="dx-metric-due"]');
    const unwired = dueCard?.querySelector('.dx-unwired-dot');
    expect(unwired).toBeNull();
  });

  // ── Time card (DX-12 coverage) ────────────────────────────────────────────

  it('Time card shows 60 min when total_study_time_seconds=3600 (DX-12)', () => {
    renderStrip(mockProgress, { ...mockStatistics, total_study_time_seconds: 3600 });
    const timeCard = screen.getByTestId('dx-metric-time');
    const value = within(timeCard).getByTestId('dx-metric-time-value');
    // Text content includes the number + "min" label — just verify "60" is present
    expect(value.textContent).toContain('60');
  });

  it('Time card shows 0 min when total_study_time_seconds=0', () => {
    renderStrip(mockProgress, { ...mockStatistics, total_study_time_seconds: 0 });
    const timeCard = screen.getByTestId('dx-metric-time');
    const value = within(timeCard).getByTestId('dx-metric-time-value');
    expect(value.textContent).toContain('0');
  });

  it('Time card shows 0 min when statistics is undefined', () => {
    renderStrip(mockProgress, undefined);
    const timeCard = screen.getByTestId('dx-metric-time');
    const value = within(timeCard).getByTestId('dx-metric-time-value');
    expect(value.textContent).toContain('0');
  });

  it('Time card numeric value is NOT wrapped in an UnwiredDot', () => {
    const { container } = renderStrip(mockProgress, mockStatistics);
    const timeCard = container.querySelector('[data-testid="dx-metric-time"]');
    const timeValue = timeCard?.querySelector('[data-testid="dx-metric-time-value"]');
    // The value element itself is not an UnwiredDot wrapper
    expect(timeValue?.classList.contains('dx-unwired-dot')).toBe(false);
  });

  // ── Mastered card ─────────────────────────────────────────────────────────

  it('Mastered card shows cards_mastered/total_cards', () => {
    renderStrip(mockProgress, mockStatistics);
    const masteredCard = screen.getByTestId('dx-metric-mastered');
    const value = within(masteredCard).getByTestId('dx-metric-mastered-value');
    // i18n key metricMasteredValue = "{{mastered}}/{{total}}"
    expect(value.textContent).toContain('15');
    expect(value.textContent).toContain('50');
  });

  it('Mastered card shows pct of deck', () => {
    // 15/50 = 30%
    renderStrip(mockProgress, mockStatistics);
    const masteredCard = screen.getByTestId('dx-metric-mastered');
    expect(within(masteredCard).getByText(/30%/)).toBeInTheDocument();
  });

  it('Mastered card has NO UnwiredDot', () => {
    const { container } = renderStrip(mockProgress, mockStatistics);
    const masteredCard = container.querySelector('[data-testid="dx-metric-mastered"]');
    const unwired = masteredCard?.querySelector('.dx-unwired-dot');
    expect(unwired).toBeNull();
  });

  // ── Streak card ───────────────────────────────────────────────────────────

  it('streak card renders real value, no UnwiredDot (R1 wired)', () => {
    const { container } = renderStrip(mockProgress, mockStatistics);
    const streakCard = container.querySelector('[data-testid="dx-metric-streak"]');
    // No unwired dot — R1 is now wired
    const dots = streakCard?.querySelectorAll('.dx-unwired-dot');
    expect(dots?.length).toBe(0);
    // Real streak value (deck_streak_current=5) renders in the stat value element
    const statValue = streakCard?.querySelector('.dx-stat-value');
    expect(statValue?.textContent).toBe('5');
  });

  // ── Time card WeekHeat (R2) ───────────────────────────────────────────────

  it('time card WeekHeat renders real data, no UnwiredDot (R2 wired)', () => {
    const { container } = renderStrip(mockProgress, mockStatistics);
    const timeCard = container.querySelector('[data-testid="dx-metric-time"]');
    // No unwired dot — R2 is now wired
    const unwiredInTime = timeCard?.querySelectorAll('.dx-unwired-dot');
    expect(unwiredInTime?.length).toBe(0);
    // WeekHeat cells render (7 cells from weekly_activity data)
    const cells = timeCard?.querySelectorAll('.dx-week-cell');
    expect(cells?.length).toBe(7);
  });

  it('WeekHeat in Time card outlines todayIdx cell', () => {
    const { container } = renderStrip(mockProgress, mockStatistics);
    const timeCard = container.querySelector('[data-testid="dx-metric-time"]');
    const todayCells = timeCard?.querySelectorAll('.dx-week-today');
    expect(todayCells?.length).toBe(1);
  });

  // ── Total UnwiredDot count ────────────────────────────────────────────────

  it('total UnwiredDots in the strip === 0 (R1 + R2 both wired)', () => {
    const { container } = renderStrip(mockProgress, mockStatistics);
    const strip = container.querySelector('[data-testid="dx-metric-strip"]');
    const allDots = strip?.querySelectorAll('.dx-unwired-dot');
    expect(allDots?.length).toBe(0);
  });
});
