/**
 * Dashboard — new-user StarterView gating tests (DASH2-01-07)
 *
 * Verifies that the StarterView replaces HeroEntries/WhatsNewStrip/Feed
 * when all new-user signals are zero, and that the metrics section always
 * renders (showing zeroes for new users).
 *
 * Shares the same mock infrastructure as Dashboard.test.tsx.
 * Existing returning-user tests are in that file and must remain untouched.
 *
 * PERF-15-05: the new-user gate is now server-authoritative
 * (summary.is_new_user) instead of the client isNewUser() predicate, so the
 * two fixtures below set is_new_user directly rather than deriving it from
 * all-zero analytics signals.
 *
 * PERF-15-06: Dashboard.tsx dropped its situationAPI/adminAPI/exerciseAPI/
 * deckStore reads entirely (isNew hides the feed anyway, so `feed: []` in
 * both fixtures is realistic either way), so those mocks were removed.
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

// PERF-15-05: is_new_user + due-today now come from dashboardAPI.getSummary.
const mockGetSummary = vi.fn();
vi.mock('@/services/dashboardAPI', () => ({
  dashboardAPI: { getSummary: () => mockGetSummary() },
}));

vi.mock('@/hooks/useTourAutoTrigger', () => ({
  useTourAutoTrigger: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Dashboard-summary fixtures — is_new_user is now server-authoritative.
// ---------------------------------------------------------------------------

/** New-user fixture: is_new_user=true, today.cards_due=0 → StarterView + zero tile. */
const newUserSummaryFixture = {
  is_new_user: true,
  mastered: 0,
  today: {
    reviews_completed: 0,
    cards_due: 0,
    daily_goal: 20,
    goal_progress_percentage: 0,
    study_time_seconds: 0,
  },
  streak: { current_streak: 0, longest_streak: 0 },
  week_heat: { heat: [0, 0, 0, 0, 0, 0, 0], today_idx: 6 },
  decks: [],
  feed: [],
  whats_new_count: 0,
  queue_count: 0,
  all_time_study_time_seconds: 0,
  word_of_day: null,
  recently_added: null,
  review_time_estimate_minutes: null,
  resume_position: null,
  minutes_goal: null,
};

/** Returning-user fixture: is_new_user=false, today.cards_due=5 → HeroEntries. */
const returningUserSummaryFixture = {
  ...newUserSummaryFixture,
  is_new_user: false,
  today: { ...newUserSummaryFixture.today, cards_due: 5 },
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
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('all-zero signals (isNew === true)', () => {
    beforeEach(() => {
      mockGetSummary.mockResolvedValue(newUserSummaryFixture);
      // User-scoped key (matches the mocked authStore's user.id = 'u1' above).
      queryClient.setQueryData(['dashboard-summary', 'u1'], newUserSummaryFixture);
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
      mockGetSummary.mockResolvedValue(returningUserSummaryFixture);
      // User-scoped key (matches the mocked authStore's user.id = 'u1' above).
      queryClient.setQueryData(['dashboard-summary', 'u1'], returningUserSummaryFixture);
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
