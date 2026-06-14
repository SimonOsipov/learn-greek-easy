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
 * - PRACT2-8: pluralized RU unit word appended to Due value (RED until implementation)
 */

import { render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

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

type WordProgress = {
  totalWords: number;
  masteredWords: number;
  inProgressWords: number;
  newWords: number;
  progressPct: number;
};

function renderStrip(
  progress: ProgressMetrics | undefined,
  statistics: DeckStatistics | undefined,
  wordProgress?: WordProgress | undefined
) {
  return render(
    <I18nextProvider i18n={i18n}>
      <DxMetricStrip progress={progress} statistics={statistics} wordProgress={wordProgress} />
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
    expect(value.textContent).toContain('7');
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

  it('Mastered card shows word-level masteredWords/totalWords from wordProgress', () => {
    const wordProgress = {
      totalWords: 7,
      masteredWords: 2,
      inProgressWords: 4,
      newWords: 1,
      progressPct: 43,
    };
    renderStrip(mockProgress, mockStatistics, wordProgress);
    const masteredCard = screen.getByTestId('dx-metric-mastered');
    const value = within(masteredCard).getByTestId('dx-metric-mastered-value');
    // i18n key metricMasteredValue = "{{mastered}}/{{total}}" — word-level now
    expect(value.textContent).toContain('2');
    expect(value.textContent).toContain('7');
  });

  it('Mastered card shows word-level progressPct of deck', () => {
    // wordProgress drives the % value
    const wordProgress = {
      totalWords: 7,
      masteredWords: 2,
      inProgressWords: 4,
      newWords: 1,
      progressPct: 43,
    };
    renderStrip(mockProgress, mockStatistics, wordProgress);
    const masteredCard = screen.getByTestId('dx-metric-mastered');
    expect(within(masteredCard).getByText(/43%/)).toBeInTheDocument();
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

// ============================================
// PRACT2-8: Pluralized RU unit word in Due card
// RED until implementation adds metricDueUnit i18n keys + <small> in DxMetricStrip
// ============================================

describe('DxMetricStrip — PRACT2-8 Due card pluralized RU unit (RED)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ru');
  });

  afterAll(async () => {
    await i18n.changeLanguage('en');
  });

  it('count=7 → due value contains "7" AND "карточек" (many form)', () => {
    const progress7 = { ...mockProgress, cards_due: 7 };
    renderStrip(progress7, mockStatistics);
    const dueCard = screen.getByTestId('dx-metric-due');
    const value = within(dueCard).getByTestId('dx-metric-due-value');
    expect(value.textContent).toContain('7');
    expect(value.textContent).toContain('карточек');
  });

  it('count=41 → due value contains "41" AND "карточка" (one form), NOT "карточек" or "карточки"', () => {
    const progress41 = { ...mockProgress, cards_due: 41 };
    renderStrip(progress41, mockStatistics);
    const dueCard = screen.getByTestId('dx-metric-due');
    const value = within(dueCard).getByTestId('dx-metric-due-value');
    expect(value.textContent).toContain('41');
    expect(value.textContent).toContain('карточка');
    expect(value.textContent).not.toContain('карточек');
    expect(value.textContent).not.toContain('карточки');
  });

  it('count=3 → due value contains "3" AND "карточки" (few form)', () => {
    const progress3 = { ...mockProgress, cards_due: 3 };
    renderStrip(progress3, mockStatistics);
    const dueCard = screen.getByTestId('dx-metric-due');
    const value = within(dueCard).getByTestId('dx-metric-due-value');
    expect(value.textContent).toContain('3');
    expect(value.textContent).toContain('карточки');
  });

  it('count=0 → due value contains "0" AND "карточек" (many/zero form)', () => {
    const progress0 = { ...mockProgress, cards_due: 0 };
    renderStrip(progress0, mockStatistics);
    const dueCard = screen.getByTestId('dx-metric-due');
    const value = within(dueCard).getByTestId('dx-metric-due-value');
    expect(value.textContent).toContain('0');
    expect(value.textContent).toContain('карточек');
  });

  it('count=7 → leading numeric token in due value is "7" (no recount, value === cards_due)', () => {
    const progress7 = { ...mockProgress, cards_due: 7 };
    renderStrip(progress7, mockStatistics);
    const dueCard = screen.getByTestId('dx-metric-due');
    const value = within(dueCard).getByTestId('dx-metric-due-value');
    const numericToken = value.textContent?.match(/\d+/)?.[0];
    expect(numericToken).toBe('7');
  });
});

// ============================================
// PRACT2-8: Adversarial / edge coverage
// AC2: CLDR RU plural boundary guards
// AC4: EN locale renders resolved string (not raw key)
// ============================================

describe('DxMetricStrip — PRACT2-8 adversarial edge coverage', () => {
  // ── RU CLDR boundary guards ───────────────────────────────────────────────

  describe('RU plural boundary guards', () => {
    beforeEach(async () => {
      await i18n.changeLanguage('ru');
    });

    afterAll(async () => {
      await i18n.changeLanguage('en');
    });

    it('count=21 → "карточка" (CLDR one: ends in 1, not 11 — guards "not just ==41")', () => {
      // CLDR RU rule: one = n%10==1 && n%100!=11
      // 21 satisfies this: 21%10=1, 21%100=21 (not 11) → "карточка"
      const progress21 = { ...mockProgress, cards_due: 21 };
      renderStrip(progress21, mockStatistics);
      const value = within(screen.getByTestId('dx-metric-due')).getByTestId('dx-metric-due-value');
      expect(value.textContent).toContain('21');
      expect(value.textContent).toContain('карточка');
      expect(value.textContent).not.toContain('карточек');
      expect(value.textContent).not.toContain('карточки');
    });

    it('count=11 → "карточек" (CLDR many: ends in 11 overrides ends-in-1 rule)', () => {
      // CLDR RU rule: 11 ends in 1 but n%100==11 → NOT one → falls to many
      const progress11 = { ...mockProgress, cards_due: 11 };
      renderStrip(progress11, mockStatistics);
      const value = within(screen.getByTestId('dx-metric-due')).getByTestId('dx-metric-due-value');
      expect(value.textContent).toContain('11');
      expect(value.textContent).toContain('карточек');
      expect(value.textContent).not.toContain('карточка');
      expect(value.textContent).not.toContain('карточки');
    });

    it('count=5 → "карточек" (CLDR many: 5–20 range)', () => {
      const progress5 = { ...mockProgress, cards_due: 5 };
      renderStrip(progress5, mockStatistics);
      const value = within(screen.getByTestId('dx-metric-due')).getByTestId('dx-metric-due-value');
      expect(value.textContent).toContain('5');
      expect(value.textContent).toContain('карточек');
      expect(value.textContent).not.toContain('карточка');
      expect(value.textContent).not.toContain('карточки');
    });

    it('due value contains a <small> element (unit word is wrapped, not inline text)', () => {
      // Guards against regressing the <small> wrapper being removed — the unit
      // text lives inside <small>, so if the wrapper is dropped the text is still
      // present but the structural contract breaks.
      const { container } = renderStrip({ ...mockProgress, cards_due: 3 }, mockStatistics);
      const dueValue = container.querySelector('[data-testid="dx-metric-due-value"]');
      const small = dueValue?.querySelector('small');
      expect(small).not.toBeNull();
      expect(small?.textContent).toContain('карточки');
    });
  });

  // ── EN locale AC4 guard ──────────────────────────────────────────────────

  describe('EN locale — metricDueUnit resolves to real string (AC4)', () => {
    beforeEach(async () => {
      await i18n.changeLanguage('en');
    });

    it('count=1 → due value contains "card" (EN singular, not raw key string)', () => {
      // AC4: EN fallback must resolve to "card"/"cards", not "detail.metricDueUnit_one"
      const progress1 = { ...mockProgress, cards_due: 1 };
      renderStrip(progress1, mockStatistics);
      const value = within(screen.getByTestId('dx-metric-due')).getByTestId('dx-metric-due-value');
      expect(value.textContent).toContain('1');
      expect(value.textContent).toContain('card');
      expect(value.textContent).not.toContain('metricDueUnit');
    });

    it('count=7 → due value contains "cards" (EN plural)', () => {
      renderStrip(mockProgress, mockStatistics); // mockProgress.cards_due = 7
      const value = within(screen.getByTestId('dx-metric-due')).getByTestId('dx-metric-due-value');
      expect(value.textContent).toContain('7');
      expect(value.textContent).toContain('cards');
      expect(value.textContent).not.toContain('metricDueUnit');
    });
  });
});
