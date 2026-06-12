/**
 * Statistics page — "Выученные слова" tile wiring guard (PRACT2-7-03 AC-1)
 *
 * Verifies that the Statistics PAGE passes `learnedCount(wordStatus)` to
 * StatsGrid as `wordsLearned`, NOT `summary.totalCardsReviewed`.
 *
 * This test exposes a real regression risk:
 *   - wordStatus = { new:2, learning:3, review:8, mastered:5 }
 *     → learnedCount = review + mastered = 13
 *   - summary.totalCardsReviewed = 137
 *
 * Before the PRACT2-7-03 fix, Statistics.tsx passed `137`.
 * After the fix, it passes `13`. This test asserts the wiring, not just
 * that StatsGrid renders whatever value it receives (that's a tautology).
 *
 * Strategy: spy on StatsGrid so we can inspect exactly which `wordsLearned`
 * prop value Statistics.tsx passed down, regardless of StatsGrid internals.
 * This distinguishes learnedCount(13) from totalCardsReviewed(137).
 */

import { act } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { renderWithProviders, createTestQueryClient } from '@/lib/test-utils';

import Statistics from '../Statistics';

// ---------------------------------------------------------------------------
// Heavy sub-component stubs (prevent jsdom failures from recharts / canvas /
// complex stores — we only care about the StatsGrid prop wiring here).
// ---------------------------------------------------------------------------

vi.mock('@/components/charts', () => ({
  ProgressLineChart: () => null,
  AccuracyAreaChart: () => null,
  DeckPerformanceChart: () => null,
  StageDistributionChart: () => null,
}));

// ---------------------------------------------------------------------------
// StatsGrid spy — capture the props Statistics passes to it.
// The real StatsGrid is irrelevant for this test; we want the `wordsLearned`
// value at the call-site in Statistics.tsx.
// Statistics.tsx imports StatsGrid from '@/components/statistics' (barrel),
// so we mock the entire barrel and return stubs for all named exports.
// ---------------------------------------------------------------------------

const mockStatsGridProps: { wordsLearned?: number } = {};

vi.mock('@/components/statistics', () => ({
  StatsGrid: (props: { wordsLearned: number; [key: string]: unknown }) => {
    // Capture the prop for assertion
    mockStatsGridProps.wordsLearned = props.wordsLearned;
    return null;
  },
  LevelProgressCard: () => null,
  AchievementsGrid: () => null,
  CultureReadinessCard: () => null,
  MotivationalMessageCard: () => null,
  CategoryBreakdown: () => null,
  WeakAreaCTA: () => null,
  getStreakMessageKey: () => 'streak.ok',
}));

// ---------------------------------------------------------------------------
// Auth store — user must be truthy and have stats.joinedDate so the page
// renders past the "not logged in" guard.
// ---------------------------------------------------------------------------

const mockUser = {
  id: 'u-test',
  name: 'Test User',
  email: 'test@test.com',
  stats: { joinedDate: new Date('2024-01-01') },
};

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn((selector?: (s: Record<string, unknown>) => unknown) => {
    const state = { user: mockUser, isLoading: false, isAuthenticated: true };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('@/stores/dateRangeStore', () => ({
  useDateRangeStore: (selector: (s: { dateRange: string }) => unknown) =>
    selector({ dateRange: 'last7' }),
}));

// ---------------------------------------------------------------------------
// Analytics mock — mocked at the API-client level (same pattern as
// Dashboard.metrics.test.tsx, not at the hook level).
// ---------------------------------------------------------------------------

const mockGetAnalytics = vi.fn();
vi.mock('@/features/analytics', () => ({
  getAnalytics: (...args: unknown[]) => mockGetAnalytics(...args),
}));

// ---------------------------------------------------------------------------
// xpStore stub
// ---------------------------------------------------------------------------

vi.mock('@/stores/xpStore', () => ({
  useXPStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      xpStats: { total_xp: 500 },
      loadXPStats: vi.fn(() => Promise.resolve()),
      loadAchievements: vi.fn(() => Promise.resolve()),
    }),
  selectXPStats: (s: Record<string, unknown>) => s.xpStats,
}));

// ---------------------------------------------------------------------------
// Analytics fixture — the critical design:
//   learnedCount({ review:8, mastered:5 }) = 13
//   totalCardsReviewed = 137   (intentionally distinct)
//
// After the fix Statistics.tsx must pass 13 (not 137) to StatsGrid.
// ---------------------------------------------------------------------------

const REVIEW = 8;
const MASTERED = 5;
const LEARNED_COUNT = REVIEW + MASTERED; // 13
const TOTAL_CARDS_REVIEWED = 137; // old (wrong) value — must NOT appear

const analyticsFixture = {
  summary: {
    totalTimeStudied: 60,
    totalCardsReviewed: TOTAL_CARDS_REVIEWED,
    cultureQuestionsMastered: 0,
  },
  streak: { currentStreak: 3, longestStreak: 7, lastStudyDate: new Date().toISOString() },
  wordStatus: {
    new: 2,
    learning: 3,
    review: REVIEW,
    mastered: MASTERED,
    newPercent: 10,
    learningPercent: 15,
    reviewPercent: 40,
    masteredPercent: 25,
    total: 18,
    deckId: 'all',
    date: new Date(),
  },
  progressData: [],
  deckStats: [],
  recentActivity: [],
};

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderStatistics(queryClient: QueryClient) {
  const Page = () =>
    createElement(QueryClientProvider, { client: queryClient }, createElement(Statistics));
  return renderWithProviders(createElement(Page));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Statistics page — wordsLearned wiring (PRACT2-7-03 AC-1)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStatsGridProps.wordsLearned = undefined;
    mockGetAnalytics.mockResolvedValue(analyticsFixture);
    queryClient = createTestQueryClient();
    // Pre-seed cache so the page renders in loaded state immediately
    queryClient.setQueryData(['analytics', mockUser.id, 'last7'], analyticsFixture);
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('test_statistics_page_passes_learnedCount_not_totalCardsReviewed: StatsGrid receives learnedCount(13), not totalCardsReviewed(137)', async () => {
    await act(async () => {
      renderStatistics(queryClient);
    });

    // The prop captured by our StatsGrid spy must equal review+mastered (13),
    // not summary.totalCardsReviewed (137).
    // This assertion CANNOT be trivially satisfied — 13 !== 137.
    expect(mockStatsGridProps.wordsLearned).toBe(LEARNED_COUNT);

    // Belt-and-suspenders: explicitly reject the wrong value.
    // If Statistics.tsx ever regresses to passing totalCardsReviewed, this fails.
    expect(mockStatsGridProps.wordsLearned).not.toBe(TOTAL_CARDS_REVIEWED);
  });
});
