/**
 * Dashboard — new-user StarterView gating tests (DASH2-01-07)
 *
 * Verifies that the StarterView replaces HeroEntries/WhatsNewStrip/Feed
 * when all new-user signals are zero, and that the metrics section always
 * renders (showing zeroes for new users).
 *
 * Shares the same mock infrastructure as Dashboard.test.tsx.
 * Existing returning-user tests are in that file and must remain untouched.
 */

import { act } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { renderWithProviders, createTestQueryClient } from '@/lib/test-utils';

import { Dashboard } from '../Dashboard';

// ---------------------------------------------------------------------------
// Hoisted mocks (same pattern as Dashboard.test.tsx)
// ---------------------------------------------------------------------------

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockAuthState = {
  user: { id: 'u1', name: 'Test User', email: 'test@test.com' },
  isAuthenticated: true,
};

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn((selector?: (s: Record<string, unknown>) => unknown) =>
    selector ? selector(mockAuthState) : mockAuthState
  ),
}));

vi.mock('@/stores/dateRangeStore', () => ({
  useDateRangeStore: (selector: (s: { dateRange: string }) => unknown) =>
    selector({ dateRange: 'last7' }),
}));

const mockGetAnalytics = vi.fn();
vi.mock('@/features/analytics', () => ({
  getAnalytics: (...args: unknown[]) => mockGetAnalytics(...args),
}));

vi.mock('@/hooks/useTourAutoTrigger', () => ({
  useTourAutoTrigger: vi.fn(),
}));

vi.mock('@/lib/errorReporting', () => ({
  reportAPIError: vi.fn(),
}));

vi.mock('@/services/situationAPI', () => ({
  situationAPI: {
    getComprehension: vi.fn().mockResolvedValue({
      whats_new_count: 0,
      comprehension_percentage: 0,
      verdict: '',
      topic_confidence: [],
      streak: 0,
      recent_sessions: [],
    }),
    getList: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 6 }),
  },
}));

vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    getNewsItems: vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 6,
      country_counts: { cyprus: 0, greece: 0, world: 0 },
      audio_count: 0,
      b1_audio_count: 0,
      b1_pending_regen_count: 0,
    }),
  },
}));

vi.mock('@/services/exerciseAPI', () => ({
  exerciseAPI: {
    getQueue: vi.fn().mockResolvedValue({ total_in_queue: 0, exercises: [] }),
  },
}));

// ---------------------------------------------------------------------------
// deckStore mock — mutable decks list swapped per-test
// ---------------------------------------------------------------------------

let mockDecks: unknown[] = [];
const mockFetchDecks = vi.fn(() => Promise.resolve());

vi.mock('@/stores/deckStore', () => ({
  useDeckStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      decks: mockDecks,
      isLoading: false,
      fetchDecks: mockFetchDecks,
    }),
}));

// ---------------------------------------------------------------------------
// Analytics fixtures
// ---------------------------------------------------------------------------

/** All-zero fixture: every isNewUser signal is zero → isNew === true. */
const newUserFixture = {
  summary: { totalTimeStudied: 0, totalCardsReviewed: 0 },
  overview: { totalReviews: 0, cardsStudied: 0, averageAccuracy: 0, totalStudyTime: 0 },
  streak: { currentStreak: 0, longestStreak: 0, lastStudyDate: new Date().toISOString() },
  wordStatus: {
    new: 0,
    learning: 0,
    review: 0,
    mastered: 0,
    newPercent: 0,
    learningPercent: 0,
    reviewPercent: 0,
    masteredPercent: 0,
    total: 0,
    deckId: '',
    date: new Date(),
  },
  today: {
    cardsDue: 0,
    studyTimeSeconds: 0,
    dailyGoal: 20,
    reviewsCompleted: 0,
    goalProgressPercentage: 0,
  },
  progressData: [],
  deckStats: [],
  recentActivity: [],
};

/** Returning-user fixture: cardsDue > 0 → isNew === false. */
const returningUserFixture = {
  ...newUserFixture,
  streak: { currentStreak: 0, longestStreak: 0, lastStudyDate: new Date().toISOString() },
  today: { ...newUserFixture.today, cardsDue: 5 },
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderDashboard(queryClient: QueryClient) {
  const DashboardWithQuery = () =>
    createElement(QueryClientProvider, { client: queryClient }, createElement(Dashboard));
  return renderWithProviders(createElement(DashboardWithQuery));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Dashboard — new-user StarterView gating', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDecks = [];
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('all-zero signals (isNew === true)', () => {
    beforeEach(() => {
      mockGetAnalytics.mockResolvedValue(newUserFixture);
      queryClient.setQueryData(['analytics', 'u1', 'last7'], newUserFixture);
    });

    it('renders StarterView with the correct heading', async () => {
      await act(async () => {
        renderDashboard(queryClient);
      });

      const starter = screen.getByTestId('starter-view');
      expect(starter).toBeTruthy();
      expect(starter.textContent).toContain('Three ways to start learning Greek today');
    });

    it('hides HeroEntries (hero-entries not in the DOM)', async () => {
      await act(async () => {
        renderDashboard(queryClient);
      });

      expect(screen.queryByTestId('hero-entries')).toBeNull();
    });

    it('hides WhatsNewStrip (whats-new-strip not in the DOM)', async () => {
      await act(async () => {
        renderDashboard(queryClient);
      });

      expect(screen.queryByTestId('whats-new-strip')).toBeNull();
    });

    it('hides Feed (feed-section not in the DOM)', async () => {
      await act(async () => {
        renderDashboard(queryClient);
      });

      expect(screen.queryByTestId('feed-section')).toBeNull();
    });

    it('always renders metrics section (shows zero Due-Today tile)', async () => {
      await act(async () => {
        renderDashboard(queryClient);
      });

      expect(screen.getByTestId('metrics-section')).toBeTruthy();
      // MetricStrip's due-today value tile should show 0
      const dueTile = screen.getByTestId('db-metric-due-value');
      expect(dueTile.textContent).toBe('0');
    });
  });

  describe('returning user (cardsDue > 0 → isNew === false)', () => {
    beforeEach(() => {
      mockGetAnalytics.mockResolvedValue(returningUserFixture);
      queryClient.setQueryData(['analytics', 'u1', 'last7'], returningUserFixture);
    });

    it('renders HeroEntries (hero-entries in the DOM)', async () => {
      await act(async () => {
        renderDashboard(queryClient);
      });

      expect(screen.getByTestId('hero-entries')).toBeTruthy();
    });

    it('does NOT render StarterView (starter-view absent)', async () => {
      await act(async () => {
        renderDashboard(queryClient);
      });

      expect(screen.queryByTestId('starter-view')).toBeNull();
    });
  });
});
