/**
 * Dashboard Metrics — Due-Today Selector Regression Guard + Mastered Tile Guard (DASH2-01-04)
 *
 * 1. Due-Today regression: fixture today.cardsDue=5 AND learning+review=13.
 *    Asserts the "Due Today" metric tile shows **5** (true SRS), NOT 13.
 *    RED against old code (showed learning+review); GREEN after DASH2-01-04 rewire.
 *
 * 2. Mastered tile selector (PRACT2-7-03 AC-1):
 *    Verifies the "Mastered" metric tile shows wordStatus.mastered (12).
 *    Selectors migrated from MetricCard (.card/.metric-value) to MetricStrip
 *    (.db-metric/.db-metric-v) as part of DASH2-01-04.
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
    }),
}));

// ---------------------------------------------------------------------------
// Analytics fixture:
//   - today.cardsDue = 5  (SRS due — the CORRECT Due-Today source)
//   - wordStatus.learning=5 + wordStatus.review=8 = 13  (the WRONG old source)
//   - wordStatus.mastered = 12  (canonical mastered value)
// ---------------------------------------------------------------------------

const masteredValue = 12;

const analyticsFixture = {
  summary: { totalTimeStudied: 60, totalCardsReviewed: 137 },
  overview: { totalReviews: 137, cardsStudied: 50, averageAccuracy: 0.8, totalStudyTime: 60 },
  streak: { currentStreak: 3, longestStreak: 7, lastStudyDate: new Date().toISOString() },
  // today.cardsDue=5 is the canonical SRS source; learning+review=13 is NOT
  today: {
    cardsDue: 5,
    studyTimeSeconds: 0,
    dailyGoal: 20,
    reviewsCompleted: 0,
    goalProgressPercentage: 0,
  },
  // learning=5, review=8 → sum=13; mastered=12 is the canonical mastered value
  wordStatus: { learning: 5, review: 8, mastered: masteredValue, newCards: 0 },
  progressData: [],
  deckStats: [],
  recentActivity: [],
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
    queryClient = createTestQueryClient();
    // Seed cache so component renders in loaded state immediately
    queryClient.setQueryData(['analytics', 'u1', 'last7'], analyticsFixture);
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('test_dashboard_due_today_uses_srs_cardsDue: Due Today tile shows today.cardsDue (5), NOT learning+review (13)', async () => {
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

    // Must show 5 (today.cardsDue), NOT 13 (learning=5 + review=8)
    // RED against old code (shows 13); GREEN after Dashboard.tsx rewire.
    expect(valueEl!.textContent?.trim()).toBe('5');
  });

  it('test_dashboard_mastered_uses_canonical_selector: mastered tile shows wordStatus.mastered (12)', async () => {
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
