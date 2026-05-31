// src/features/analytics/api/getAnalytics.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';

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
});
