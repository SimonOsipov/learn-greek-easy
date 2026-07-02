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
 * 3. All-time tile (PERF-15-05 follow-up): now sources from
 *    summary.all_time_study_time_seconds — the DTO-gap fix that let
 *    Dashboard.tsx drop its own separate useAnalytics() mount entirely.
 *
 * PERF-15-05: all three tiles now source exclusively from dashboardAPI.getSummary
 * (mocked + cache-seeded below); no `@/features/analytics` mock is needed.
 *
 * PERF-15-06: Dashboard.tsx dropped its situationAPI/deckStore reads
 * entirely, so those mocks were removed from this file too (they'd otherwise
 * be dead registrations for modules the component no longer imports).
 */

import { act } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { formatStudyTime } from '@/lib/timeFormatUtils';
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

// PERF-15-05: metric-strip data now comes from dashboardAPI.getSummary.
const mockGetSummary = vi.fn();
vi.mock('@/services/dashboardAPI', () => ({
  dashboardAPI: { getSummary: () => mockGetSummary() },
}));

vi.mock('@/hooks/useTourAutoTrigger', () => ({
  useTourAutoTrigger: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Dashboard-summary fixture:
//   - today.cards_due = 5                    (the Due-Today tile's sole source)
//   - mastered = 12                           (the Mastered tile's sole source)
//   - all_time_study_time_seconds = 5400      (the All-Time tile's sole source)
// ---------------------------------------------------------------------------

const masteredValue = 12;
const allTimeStudyTimeSeconds = 5400; // formatStudyTime(5400) === "1h 30m"

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
  all_time_study_time_seconds: allTimeStudyTimeSeconds,
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
    mockGetSummary.mockResolvedValue(summaryFixture);
    queryClient = createTestQueryClient();
    // Seed the cache so the component renders in loaded state immediately
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

  it('test_dashboard_alltime_uses_summary_study_time: all-time tile shows formatStudyTime(summary.all_time_study_time_seconds)', async () => {
    await act(async () => {
      renderDashboard(queryClient);
    });

    const valueEl = screen.getByTestId('db-metric-alltime-value');
    expect(valueEl.textContent?.trim()).toBe(formatStudyTime(allTimeStudyTimeSeconds));
  });
});
