// src/features/analytics/lib/__tests__/transform.test.ts

import { describe, it, expect, afterEach, vi } from 'vitest';

import type {
  DashboardStatsResponse,
  LearningTrendsResponse,
  DeckProgressListResponse,
  DailyStats,
  DeckProgressSummary,
  RecentActivityEntry,
} from '@/services/progressAPI';

import { transformToAnalyticsDashboardData } from '../transform';

// ── Builders ─────────────────────────────────────────────────────────────────

const makeDailyStats = (overrides: Partial<DailyStats> = {}): DailyStats => ({
  date: '2026-05-01',
  reviews_count: 10,
  cards_learned: 2,
  cards_learning: 3,
  cards_mastered: 1,
  study_time_seconds: 300,
  average_quality: 4,
  vocab_accuracy: 80,
  culture_accuracy: 70,
  combined_accuracy: 75,
  ...overrides,
});

const makeDeck = (overrides: Partial<DeckProgressSummary> = {}): DeckProgressSummary => ({
  deck_id: 'deck-1',
  deck_name: 'Greek Basics',
  deck_level: 'A1',
  total_cards: 100,
  cards_studied: 40,
  cards_mastered: 10,
  cards_due: 5,
  mastery_percentage: 25,
  completion_percentage: 40,
  last_studied_at: '2026-05-01',
  average_easiness_factor: 2.5,
  estimated_review_time_minutes: 10,
  deck_type: 'vocabulary',
  ...overrides,
});

const makeDashboard = (
  overrides: Partial<DashboardStatsResponse> = {}
): DashboardStatsResponse => ({
  overview: {
    total_cards_studied: 50,
    total_cards_mastered: 10,
    total_decks_started: 2,
    overall_mastery_percentage: 30,
    accuracy_percentage: 85,
    culture_questions_mastered: 3,
    total_study_time_seconds: 1200,
  },
  today: {
    reviews_completed: 5,
    cards_due: 2,
    daily_goal: 10,
    goal_progress_percentage: 50,
    study_time_seconds: 100,
  },
  streak: {
    current_streak: 3,
    longest_streak: 9,
    last_study_date: '2026-05-01',
    vocabulary_current_streak: 3,
    vocabulary_longest_streak: 9,
    culture_current_streak: 0,
    culture_longest_streak: 0,
    exercise_current_streak: 0,
    exercise_longest_streak: 0,
  },
  cards_by_status: { new: 20, learning: 10, review: 5, mastered: 15 },
  recent_activity: [],
  ...overrides,
});

const makeTrends = (overrides: Partial<LearningTrendsResponse> = {}): LearningTrendsResponse => ({
  period: 'last7',
  start_date: '2026-04-25',
  end_date: '2026-05-01',
  daily_stats: [],
  summary: {
    total_reviews: 100,
    total_study_time_seconds: 3000,
    cards_mastered: 10,
    average_daily_reviews: 14,
    best_day: '2026-05-01',
    quality_trend: 'improving',
  },
  ...overrides,
});

const makeDeckProgress = (
  decks: DeckProgressSummary[] = [makeDeck()]
): DeckProgressListResponse => ({
  total: decks.length,
  page: 1,
  page_size: 20,
  decks,
});

const run = (
  opts: {
    dashboard?: DashboardStatsResponse;
    trends?: LearningTrendsResponse;
    deckProgress?: DeckProgressListResponse;
  } = {}
) =>
  transformToAnalyticsDashboardData(
    'user-1',
    'last7',
    opts.dashboard ?? makeDashboard(),
    opts.trends ?? makeTrends(),
    opts.deckProgress ?? makeDeckProgress()
  );

afterEach(() => {
  vi.useRealTimers();
});

// ── cardsNew clamp ─────────────────────────────────────────────────────────

describe('deckStats.cardsNew', () => {
  it('is total_cards - cards_studied for the normal case', () => {
    const result = run({
      deckProgress: makeDeckProgress([makeDeck({ total_cards: 100, cards_studied: 40 })]),
    });
    expect(result.deckStats[0].cardsNew).toBe(60);
  });

  it('clamps at 0 when cards_studied exceeds total_cards (no negative)', () => {
    const result = run({
      deckProgress: makeDeckProgress([makeDeck({ total_cards: 30, cards_studied: 50 })]),
    });
    expect(result.deckStats[0].cardsNew).toBe(0);
    expect(result.deckStats[0].cardsNew).toBeGreaterThanOrEqual(0);
  });

  it('is 0 when total equals studied', () => {
    const result = run({
      deckProgress: makeDeckProgress([makeDeck({ total_cards: 40, cards_studied: 40 })]),
    });
    expect(result.deckStats[0].cardsNew).toBe(0);
  });
});

// ── accuracy fallback (quality * 20) ──────────────────────────────────────

describe('progressData.accuracy fallback', () => {
  it('uses combined_accuracy when present', () => {
    const result = run({
      trends: makeTrends({
        daily_stats: [makeDailyStats({ combined_accuracy: 90, average_quality: 1 })],
      }),
    });
    expect(result.progressData[0].accuracy).toBe(90);
  });

  it('falls back to average_quality * 20 when combined_accuracy is null', () => {
    const result = run({
      trends: makeTrends({
        daily_stats: [
          makeDailyStats({
            combined_accuracy: null as unknown as number,
            average_quality: 4,
          }),
        ],
      }),
    });
    expect(result.progressData[0].accuracy).toBe(80);
  });

  it('maps average_quality 0 to accuracy 0 (not NaN) on fallback', () => {
    const result = run({
      trends: makeTrends({
        daily_stats: [
          makeDailyStats({
            combined_accuracy: null as unknown as number,
            average_quality: 0,
          }),
        ],
      }),
    });
    expect(result.progressData[0].accuracy).toBe(0);
    expect(Number.isNaN(result.progressData[0].accuracy)).toBe(false);
  });

  it('maps recent_activity average_quality 0 to 0% accuracy (not NaN)', () => {
    const result = run({
      dashboard: makeDashboard({
        recent_activity: [
          { date: '2026-05-01', reviews_count: 4, average_quality: 0 },
        ] as RecentActivityEntry[],
      }),
    });
    expect(result.recentActivity[0].accuracy).toBe(0);
    expect(result.recentActivity[0].description).toBe('0% accuracy');
  });
});

// ── streak milestone integer-division math ────────────────────────────────

describe('streak milestone math', () => {
  const milestoneFor = (current_streak: number) => {
    const result = run({
      dashboard: makeDashboard({ streak: { ...makeDashboard().streak, current_streak } }),
    });
    return result.streak;
  };

  it('current_streak=0 → reached 0, next 7, daysToNext 7', () => {
    const s = milestoneFor(0);
    expect(s.milestoneReached).toBe(0);
    expect(s.nextMilestone).toBe(7);
    expect(s.daysToNextMilestone).toBe(7);
  });

  it('current_streak=6 → reached 0, next 7, daysToNext 1', () => {
    const s = milestoneFor(6);
    expect(s.milestoneReached).toBe(0);
    expect(s.nextMilestone).toBe(7);
    expect(s.daysToNextMilestone).toBe(1);
  });

  it('current_streak=7 → reached 7, next 14, daysToNext 7', () => {
    const s = milestoneFor(7);
    expect(s.milestoneReached).toBe(7);
    expect(s.nextMilestone).toBe(14);
    expect(s.daysToNextMilestone).toBe(7);
  });

  it('current_streak=13 → reached 7, next 14, daysToNext 1', () => {
    const s = milestoneFor(13);
    expect(s.milestoneReached).toBe(7);
    expect(s.nextMilestone).toBe(14);
    expect(s.daysToNextMilestone).toBe(1);
  });
});

// ── formatRelativeTime (via recentActivity.relativeTime) ──────────────────

describe('formatRelativeTime — local calendar days', () => {
  const relativeTimeFor = (activityIso: string) => {
    const result = run({
      dashboard: makeDashboard({
        recent_activity: [{ date: activityIso, reviews_count: 1, average_quality: 4 }],
      }),
    });
    return result.recentActivity[0].relativeTime;
  };

  it('same local day → "Today"', () => {
    // now: 2026-05-15 09:00 local
    vi.setSystemTime(new Date(2026, 4, 15, 9, 0, 0));
    // activity earlier same local day
    expect(relativeTimeFor(new Date(2026, 4, 15, 1, 0, 0).toISOString())).toBe('Today');
  });

  it('previous local calendar day → "Yesterday" even if <24h elapsed', () => {
    // now: 2026-05-15 09:00 local
    vi.setSystemTime(new Date(2026, 4, 15, 9, 0, 0));
    // activity: 2026-05-14 23:00 local — only ~10h ago, but a different calendar day.
    // The buggy elapsed-window math would call this "Today"; calendar-day math says "Yesterday".
    expect(relativeTimeFor(new Date(2026, 4, 14, 23, 0, 0).toISOString())).toBe('Yesterday');
  });

  it('two local calendar days ago → "2 days ago"', () => {
    vi.setSystemTime(new Date(2026, 4, 15, 9, 0, 0));
    expect(relativeTimeFor(new Date(2026, 4, 13, 12, 0, 0).toISOString())).toBe('2 days ago');
  });

  it('within the same day but later in the day still counts as Today', () => {
    // now: 2026-05-15 09:00 local; activity at 2026-05-15 08:59 local
    vi.setSystemTime(new Date(2026, 4, 15, 9, 0, 0));
    expect(relativeTimeFor(new Date(2026, 4, 15, 8, 59, 0).toISOString())).toBe('Today');
  });

  it('7+ calendar days ago → falls back to a formatted date (not "N days ago")', () => {
    vi.setSystemTime(new Date(2026, 4, 15, 9, 0, 0));
    const formatted = relativeTimeFor(new Date(2026, 4, 1, 12, 0, 0).toISOString());
    expect(formatted).not.toMatch(/Today|Yesterday|days ago/);
  });
});

// ── wordStatus percentages (total=0 must not be NaN) ──────────────────────

describe('wordStatus percentages', () => {
  it('computes percentages from card counts', () => {
    const result = run({
      dashboard: makeDashboard({
        cards_by_status: { new: 25, learning: 25, review: 25, mastered: 25 },
      }),
    });
    expect(result.wordStatus.total).toBe(100);
    expect(result.wordStatus.newPercent).toBe(25);
    expect(result.wordStatus.masteredPercent).toBe(25);
  });

  it('returns 0 percentages (not NaN) when total is 0', () => {
    const result = run({
      dashboard: makeDashboard({
        cards_by_status: { new: 0, learning: 0, review: 0, mastered: 0 },
      }),
    });
    expect(result.wordStatus.total).toBe(0);
    expect(result.wordStatus.newPercent).toBe(0);
    expect(result.wordStatus.learningPercent).toBe(0);
    expect(result.wordStatus.reviewPercent).toBe(0);
    expect(result.wordStatus.masteredPercent).toBe(0);
    expect(Number.isNaN(result.wordStatus.newPercent)).toBe(false);
  });
});

// ── basic summary / shape ─────────────────────────────────────────────────

describe('summary mapping', () => {
  it('uses accuracy_percentage when present, else overall_mastery_percentage', () => {
    const withAcc = run();
    expect(withAcc.summary.averageAccuracy).toBe(85);

    const withoutAcc = run({
      dashboard: makeDashboard({
        overview: {
          ...makeDashboard().overview,
          accuracy_percentage: undefined,
          overall_mastery_percentage: 42,
        },
      }),
    });
    expect(withoutAcc.summary.averageAccuracy).toBe(42);
  });

  it('sets the date range label from the dateRange arg', () => {
    expect(run().dateRange.label).toBe('Last 7 days');
  });
});
