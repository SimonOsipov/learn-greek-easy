// src/features/analytics/api/getAnalytics.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { queryClient } from '@/lib/queryClient';
import type {
  DashboardStatsResponse,
  LearningTrendsResponse,
  DeckProgressListResponse,
} from '@/services/progressAPI';
import type { DateRangeType } from '@/stores/dateRangeStore';

// Mock progressAPI before importing the module under test.
vi.mock('@/services/progressAPI', () => ({
  progressAPI: {
    getDashboard: vi.fn(),
    getTrends: vi.fn(),
    getDeckProgressList: vi.fn(),
  },
}));

// Mock the transform to keep unit tests focused on getAnalytics wiring.
vi.mock('../../lib/transform', () => ({
  transformToAnalyticsDashboardData: vi.fn((_userId, _dateRange, _dashboard, _trends, _decks) => ({
    userId: _userId,
    dateRange: _dateRange,
  })),
}));

// Import after mocks are registered.
import { getAnalytics } from '../getAnalytics';
import { progressAPI } from '@/services/progressAPI';

// ---------------------------------------------------------------------------
// Minimal response stubs
// ---------------------------------------------------------------------------

const stubDashboard: DashboardStatsResponse = {
  overview: {
    total_cards_studied: 0,
    total_cards_mastered: 0,
    total_decks_started: 0,
    overall_mastery_percentage: 0,
    culture_questions_mastered: 0,
    total_study_time_seconds: 0,
    culture_weekly_study_time_seconds: 0,
  },
  today: {
    reviews_completed: 0,
    cards_due: 0,
    daily_goal: 0,
    goal_progress_percentage: 0,
    study_time_seconds: 0,
  },
  streak: {
    current_streak: 0,
    longest_streak: 0,
    last_study_date: null,
    vocabulary_current_streak: 0,
    vocabulary_longest_streak: 0,
    culture_current_streak: 0,
    culture_longest_streak: 0,
    exercise_current_streak: 0,
    exercise_longest_streak: 0,
  },
  cards_by_status: { new: 0, learning: 0, review: 0, mastered: 0 },
  recent_activity: [],
};

const stubTrends: LearningTrendsResponse = {
  period: 'month',
  start_date: '2026-05-01',
  end_date: '2026-05-31',
  daily_stats: [],
  summary: {
    total_reviews: 0,
    total_study_time_seconds: 0,
    cards_mastered: 0,
    average_daily_reviews: 0,
    best_day: null,
    quality_trend: 'stable',
  },
};

const stubDeckProgress: DeckProgressListResponse = {
  total: 0,
  page: 1,
  page_size: 50,
  decks: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupHappyPath() {
  vi.mocked(progressAPI.getDashboard).mockResolvedValue(stubDashboard);
  vi.mocked(progressAPI.getTrends).mockResolvedValue(stubTrends);
  vi.mocked(progressAPI.getDeckProgressList).mockResolvedValue(stubDeckProgress);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // PERF-22-01 (AC5): getAnalytics's deck-progress leg is routed through
    // fetchDeckProgressList, which is backed by the SINGLETON queryClient.
    // Clear it so cache carry-over from a previous test can't mask a
    // missing/duplicate call.
    queryClient.clear();
  });

  // ── mapDateRangeToPeriod: indirect coverage via getTrends call arg ─────────

  describe('mapDateRangeToPeriod — period passed to getTrends', () => {
    it('maps last7 → week', async () => {
      setupHappyPath();
      await getAnalytics('user-1', 'last7');
      expect(progressAPI.getTrends).toHaveBeenCalledWith({ period: 'week' });
    });

    it('maps last30 → month', async () => {
      setupHappyPath();
      await getAnalytics('user-1', 'last30');
      expect(progressAPI.getTrends).toHaveBeenCalledWith({ period: 'month' });
    });

    it('maps alltime → year', async () => {
      setupHappyPath();
      await getAnalytics('user-1', 'alltime');
      expect(progressAPI.getTrends).toHaveBeenCalledWith({ period: 'year' });
    });

    it('coerces unknown dateRange value → month (silent default)', async () => {
      setupHappyPath();
      // Cast to DateRangeType to simulate an unrecognised runtime value reaching the switch default.
      await getAnalytics('user-1', 'unknown_value' as DateRangeType);
      expect(progressAPI.getTrends).toHaveBeenCalledWith({ period: 'month' });
    });
  });

  // ── Promise.all failure propagation ──────────────────────────────────────

  describe('Promise.all rejection propagation', () => {
    it('rejects when getTrends rejects — no partial result', async () => {
      vi.mocked(progressAPI.getDashboard).mockResolvedValue(stubDashboard);
      vi.mocked(progressAPI.getTrends).mockRejectedValue(new Error('trends API down'));
      vi.mocked(progressAPI.getDeckProgressList).mockResolvedValue(stubDeckProgress);

      await expect(getAnalytics('user-1', 'last30')).rejects.toThrow('trends API down');
    });

    it('rejects when getDashboard rejects', async () => {
      vi.mocked(progressAPI.getDashboard).mockRejectedValue(new Error('dashboard API down'));
      vi.mocked(progressAPI.getTrends).mockResolvedValue(stubTrends);
      vi.mocked(progressAPI.getDeckProgressList).mockResolvedValue(stubDeckProgress);

      await expect(getAnalytics('user-1', 'last30')).rejects.toThrow('dashboard API down');
    });

    it('rejects when getDeckProgressList rejects', async () => {
      vi.mocked(progressAPI.getDashboard).mockResolvedValue(stubDashboard);
      vi.mocked(progressAPI.getTrends).mockResolvedValue(stubTrends);
      vi.mocked(progressAPI.getDeckProgressList).mockRejectedValue(new Error('decks API down'));

      await expect(getAnalytics('user-1', 'last30')).rejects.toThrow('decks API down');
    });

    it('does not call transform when any Promise.all leg rejects', async () => {
      const { transformToAnalyticsDashboardData } = await import('../../lib/transform');

      vi.mocked(progressAPI.getDashboard).mockResolvedValue(stubDashboard);
      vi.mocked(progressAPI.getTrends).mockRejectedValue(new Error('trends API down'));
      vi.mocked(progressAPI.getDeckProgressList).mockResolvedValue(stubDeckProgress);

      await expect(getAnalytics('user-1', 'last30')).rejects.toThrow();
      expect(transformToAnalyticsDashboardData).not.toHaveBeenCalled();
    });
  });

  // ── Happy path wiring ─────────────────────────────────────────────────────

  describe('successful call', () => {
    it('calls all three API methods with correct fixed args', async () => {
      setupHappyPath();
      await getAnalytics('user-1', 'last7');

      expect(progressAPI.getDashboard).toHaveBeenCalledOnce();
      expect(progressAPI.getTrends).toHaveBeenCalledOnce();
      expect(progressAPI.getDeckProgressList).toHaveBeenCalledWith({ page: 1, page_size: 50 });
    });

    it('returns the transformed result from transformToAnalyticsDashboardData', async () => {
      setupHappyPath();
      const result = await getAnalytics('user-42', 'last30');

      // The mock transform returns { userId, dateRange } — verify wiring.
      expect(result).toMatchObject({ userId: 'user-42', dateRange: 'last30' });
    });
  });

  // ── PERF-22-01: shared deck-progress fetcher wiring ──────────────────────
  //
  // These two guard the AC3/AC4 invariants (unchanged params, unchanged
  // single-attempt reject semantics) once getAnalytics is switched to source
  // its deck-progress leg from fetchDeckProgressList(userId) instead of
  // calling progressAPI.getDeckProgressList directly. They assert on the
  // observable boundary (progressAPI.getDeckProgressList, the innermost API
  // call) rather than on fetchDeckProgressList itself, so they hold true
  // both before AND after the executor's swap — the swap must not change
  // what params reach the API, nor how many times it's invoked on failure.

  describe('PERF-22-01 — shared deck-progress fetcher wiring', () => {
    it('getAnalytics still requests page 1 size 50', async () => {
      setupHappyPath();
      await getAnalytics('user-1', 'last30');

      expect(progressAPI.getDeckProgressList).toHaveBeenCalledWith({ page: 1, page_size: 50 });
    });

    it('getAnalytics rejects (single attempt) when deck-progress rejects', async () => {
      vi.mocked(progressAPI.getDashboard).mockResolvedValue(stubDashboard);
      vi.mocked(progressAPI.getTrends).mockResolvedValue(stubTrends);
      vi.mocked(progressAPI.getDeckProgressList).mockRejectedValue(new Error('decks API down'));

      await expect(getAnalytics('user-1', 'last30')).rejects.toThrow();
      // Singleton default is retry:1 — fetchDeckProgressList must override
      // with retry:false, or this would be called twice.
      expect(progressAPI.getDeckProgressList).toHaveBeenCalledTimes(1);
    });

    // QA adversarial addition: none of the pre-authored specs actually pin
    // that getAnalytics threads its OWN userId argument into
    // fetchDeckProgressList — they only assert on the fixed request params
    // and call counts. Because fetchDeckProgressList is backed by the real
    // singleton cache here (only progressAPI is mocked), if getAnalytics
    // hardcoded/dropped the userId (e.g. called fetchDeckProgressList
    // (undefined) for every user), two different users within the same
    // (uncleared) cache window would collapse onto the same cache entry and
    // the second call would be served from cache — this test would then
    // observe ONE API call instead of TWO and fail, proving the thread.
    it('threads userId into the deck-progress cache key — distinct users each hit the API', async () => {
      setupHappyPath();

      await getAnalytics('user-1', 'last30');
      await getAnalytics('user-2', 'last30');

      expect(progressAPI.getDeckProgressList).toHaveBeenCalledTimes(2);
    });
  });
});
