/**
 * Dashboard Metrics — Mastered Tile Selector Regression Guard (PRACT2-7-03 AC-1)
 *
 * Verifies that the "Освоено" (mastered) metric tile on the Dashboard shows
 * the value from `wordStatus.mastered` (= `masteredCount(cardsByStatus)`).
 *
 * This is a REGRESSION GUARD: the current code already reads `wordStatus.mastered`
 * directly (Dashboard.tsx:129). If a future refactor accidentally swaps it for
 * e.g. `wordStatus.total` or `summary.totalCardsReviewed`, this test will catch it.
 *
 * Strategy: inject analytics data with `wordStatus.mastered = 12` and assert
 * the "Освоено" MetricCard renders the value `12`.
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

vi.mock('@/stores/deckStore', () => ({
  useDeckStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      decks: [],
      isLoading: false,
      fetchDecks: vi.fn(() => Promise.resolve()),
    }),
}));

// ---------------------------------------------------------------------------
// Analytics fixture: mastered=12, other statuses have distinct values
// ---------------------------------------------------------------------------

const masteredValue = 12;

const analyticsFixture = {
  summary: { totalTimeStudied: 60, totalCardsReviewed: 137 },
  overview: { totalReviews: 137, cardsStudied: 50, averageAccuracy: 0.8, totalStudyTime: 60 },
  streak: { currentStreak: 3, longestStreak: 7, lastStudyDate: new Date().toISOString() },
  // mastered=12 is the value under test; learning/review are distinct non-12 values
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
// Test
// ---------------------------------------------------------------------------

describe('Dashboard mastered tile selector (PRACT2-7-03 AC-1)', () => {
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

  it('test_dashboard_mastered_uses_canonical_selector: mastered tile shows wordStatus.mastered (12)', async () => {
    await act(async () => {
      renderDashboard(queryClient);
    });

    // The MetricCard for "Mastered" renders its `value` prop as text inside
    // a `.metric-value` element. We look up the metric section and find the
    // MetricCard that contains the "Mastered" label, then assert its value text.
    // Note: i18n renders in English ("Mastered") in the test environment;
    // the RU label "Освоено" appears in production (dashboard.metrics.mastered).
    const metricsSection = screen.getByTestId('metrics-section');

    // The mastered MetricCard shows the value directly as a text node.
    // `masteredValue` (12) is a unique number in the fixture — no other
    // metric equals 12 — so querying by its text is unambiguous.
    expect(metricsSection).toHaveTextContent(String(masteredValue));

    // Additional: confirm the card labelled "Mastered" shows exactly 12.
    const allCards = metricsSection.querySelectorAll('.card');
    const masteredCard = Array.from(allCards).find((card) =>
      card.textContent?.includes('Mastered')
    );
    expect(masteredCard).toBeDefined();
    const valueEl = masteredCard!.querySelector('.metric-value');
    expect(valueEl?.textContent).toBe(String(masteredValue));
  });
});
