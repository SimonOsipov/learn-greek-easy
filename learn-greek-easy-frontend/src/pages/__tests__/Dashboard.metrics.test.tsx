/**
 * Dashboard Metrics — Due-Today Selector Regression Guard + Mastered Tile Guard (DASH2-01-04)
 *
 * 1. Due-Today regression: dashboard-summary fixture today.cards_due=5.
 *    Asserts the "Due Today" metric tile shows **5** (the SRS due count).
 *
 * 2. Mastered tile selector (PRACT2-7-03 AC-1):
 *    Verifies the "Mastered" metric tile shows summary.mastered (12).
 *    Selectors migrated from MetricCard (.card/.metric-value) to MetricStrip
 *    (.db-metric/.db-metric-v) as part of DASH2-01-04.
 *
 * PERF-15-05: both tiles now source from dashboardAPI.getSummary (mocked +
 * cache-seeded below) instead of analytics' wordStatus/today. The analytics
 * mock/fixture stays only because MetricStrip's all-time tile still reads it.
 */

import { act } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { renderWithProviders, createTestQueryClient } from '@/lib/test-utils';

import { Dashboard } from '../Dashboard';

// ---------------------------------------------------------------------------
// Hoisted mocks (mirrors the pattern in Dashboard.test.tsx)
// ---------------------------------------------------------------------------

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
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

// PERF-15-05: metric-strip data now comes from dashboardAPI.getSummary.
const mockGetSummary = vi.fn();
vi.mock('@/services/dashboardAPI', () => ({
  dashboardAPI: { getSummary: () => mockGetSummary() },
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
  },
}));

vi.mock('@/stores/deckStore', () => ({
  useDeckStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      decks: [],
      isLoading: false,
      fetchDecks: vi.fn(() => Promise.resolve()),
      ensureDecksFresh: vi.fn(() => Promise.resolve()),
    }),
}));

// ---------------------------------------------------------------------------
// Analytics fixture — kept minimal; MetricStrip's all-time tile is the only
// remaining reader (analyticsData.summary.totalTimeStudied). Due-today and
// mastered now come exclusively from the dashboard-summary fixture below.
// ---------------------------------------------------------------------------

const analyticsFixture = {
  summary: { totalTimeStudied: 60, totalCardsReviewed: 137 },
};

// ---------------------------------------------------------------------------
// Dashboard-summary fixture:
//   - today.cards_due = 5   (the Due-Today tile's sole source)
//   - mastered = 12         (the Mastered tile's sole source)
// ---------------------------------------------------------------------------

const masteredValue = 12;

const summaryFixture = {
  is_new_user: false,
  mastered: masteredValue,
  today: {
    reviews_completed: 0,
    cards_due: 5,
    daily_goal: 20,
    goal_progress_percentage: 0,
    study_time_seconds: 0,
  },
  streak: { current_streak: 3, longest_streak: 7 },
  week_heat: { heat: [0, 0, 0, 0, 0, 0, 0], today_idx: 6 },
  decks: [],
  feed: [],
  whats_new_count: 0,
  queue_count: 0,
  word_of_day: null,
  recently_added: null,
  review_time_estimate_minutes: null,
  resume_position: null,
  minutes_goal: null,
};

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderDashboard(queryClient: QueryClient) {
  const DashboardWithQuery = () =>
    createElement(QueryClientProvider, { client: queryClient }, createElement(Dashboard));
  return renderWithProviders(createElement(DashboardWithQuery));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Dashboard metric tile selectors (DASH2-01-04 + PRACT2-7-03 AC-1)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAnalytics.mockResolvedValue(analyticsFixture);
    mockGetSummary.mockResolvedValue(summaryFixture);
    queryClient = createTestQueryClient();
    // Seed caches so the component renders in loaded state immediately
    queryClient.setQueryData(['analytics', 'u1', 'last7'], analyticsFixture);
    queryClient.setQueryData(['dashboard-summary'], summaryFixture);
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('test_dashboard_due_today_uses_srs_cardsDue: Due Today tile shows summary.today.cards_due (5)', async () => {
    await act(async () => {
      renderDashboard(queryClient);
    });

    const metricsSection = screen.getByTestId('metrics-section');

    // Find the Due Today tile — works on both MetricCard (.card) and MetricStrip (.db-metric)
    const allTiles = Array.from(metricsSection.querySelectorAll('.card, .db-metric'));
    const dueTodayTile = allTiles.find(
      (el) => el.textContent?.includes('Due Today') || el.textContent?.includes('Due today')
    );
    expect(dueTodayTile).toBeDefined();

    // Find the value element — MetricCard uses .metric-value, MetricStrip uses .db-metric-v
    const valueEl = dueTodayTile!.querySelector('.metric-value, .db-metric-v');
    expect(valueEl).not.toBeNull();

    // Must show 5 (summary.today.cards_due)
    expect(valueEl!.textContent?.trim()).toBe('5');
  });

  it('test_dashboard_mastered_uses_canonical_selector: mastered tile shows summary.mastered (12)', async () => {
    await act(async () => {
      renderDashboard(queryClient);
    });

    const metricsSection = screen.getByTestId('metrics-section');

    // The metrics section must contain the mastered value somewhere
    expect(metricsSection).toHaveTextContent(String(masteredValue));

    // Find the Mastered tile using MetricStrip selectors (.db-metric / .db-metric-v)
    const allTiles = metricsSection.querySelectorAll('.db-metric');
    const masteredTile = Array.from(allTiles).find((tile) =>
      tile.textContent?.includes('Mastered')
    );
    expect(masteredTile).toBeDefined();

    // .db-metric-v contains {mastered}<small>words</small> — toContain handles the suffix
    const valueEl = masteredTile!.querySelector('.db-metric-v');
    expect(valueEl).not.toBeNull();
    expect(valueEl!.textContent).toContain(String(masteredValue));
  });
});
