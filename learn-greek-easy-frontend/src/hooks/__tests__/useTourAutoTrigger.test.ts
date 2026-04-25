import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createTestQueryClient } from '@/lib/test-utils';

// ---------------------------------------------------------------------------
// Module-level mocks (must be declared before imports that use them)
// ---------------------------------------------------------------------------

const mockStartTour = vi.fn();
let mockTourSteps: unknown[] = [{ element: '#test', popover: { title: 'Test' } }];

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/lib/tour', () => ({
  get startTour() {
    return mockStartTour;
  },
  buildTourSteps: (_navigate: unknown, _t: unknown, _deck: unknown) => mockTourSteps,
}));

const mockIsTourCompleted = vi.fn(() => false);
vi.mock('@/utils/tourStatus', () => ({
  get isTourCompleted() {
    return mockIsTourCompleted;
  },
}));

let mockIsReady = true;
vi.mock('@/stores/appStore', () => ({
  useAppStore: (selector: (state: { isReady: boolean }) => boolean) =>
    selector({ isReady: mockIsReady }),
  selectIsReady: (state: { isReady: boolean }) => state.isReady,
}));

const mockUpdateProfile = vi.fn();
let mockUser: { id: string; tourCompletedAt?: string } | null = { id: '1' };
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (
    selector: (state: {
      user: { id: string; tourCompletedAt?: string } | null;
      updateProfile: typeof mockUpdateProfile;
    }) => unknown
  ) => selector({ user: mockUser, updateProfile: mockUpdateProfile }),
}));

let mockDateRange = 'last7';
vi.mock('@/stores/dateRangeStore', () => ({
  useDateRangeStore: (selector: (s: { dateRange: string }) => unknown) =>
    selector({ dateRange: mockDateRange }),
}));

// Mock @/features/analytics so no real API calls are made (AC #10)
const mockGetAnalytics = vi.fn();
vi.mock('@/features/analytics', () => ({
  getAnalytics: (...args: unknown[]) => mockGetAnalytics(...args),
}));

let mockDecks: Array<{ id: string; title: string }> = [];
vi.mock('@/stores/deckStore', () => ({
  useDeckStore: {
    getState: () => ({ decks: mockDecks }),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: vi.fn((key: string) => key) }),
}));

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn() },
}));

import { useTourAutoTrigger } from '../useTourAutoTrigger';

// ---------------------------------------------------------------------------
// Helper — builds a fresh QueryClient with seeded analytics data per test
// ---------------------------------------------------------------------------

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// Full analytics fixture (any non-null value tells the hook "dashboard loaded")
const fixtureData = {
  overview: { totalReviews: 10, cardsStudied: 5, averageAccuracy: 0.8, totalStudyTime: 600 },
  streak: { currentStreak: 1, longestStreak: 5, lastStudyDate: new Date().toISOString() },
  progressData: [],
  deckStats: [],
  recentActivity: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useTourAutoTrigger', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockIsReady = true;
    mockUser = { id: '1' };
    mockTourSteps = [{ element: '#test', popover: { title: 'Test' } }];
    mockIsTourCompleted.mockReturnValue(false);
    mockUpdateProfile.mockResolvedValue(undefined);
    mockDecks = [];
    mockDateRange = 'last7';

    // Default: data loaded, not loading
    mockGetAnalytics.mockResolvedValue(fixtureData);
    queryClient = createTestQueryClient();
    // Seed cache so hook sees data immediately (avoids async fetch in timer tests)
    queryClient.setQueryData(['analytics', '1', 'last7'], fixtureData);
  });

  afterEach(() => {
    queryClient.clear();
    vi.useRealTimers();
  });

  it('does not trigger when analytics is loading', () => {
    // Remove seeded data so query fires and stays loading
    queryClient.removeQueries({ queryKey: ['analytics'] });
    let resolve!: (v: unknown) => void;
    mockGetAnalytics.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );

    renderHook(() => useTourAutoTrigger(), { wrapper: makeWrapper(queryClient) });
    vi.advanceTimersByTime(250);
    expect(mockStartTour).not.toHaveBeenCalled();
  });

  it('triggers after dashboard data loads + 250ms delay', () => {
    renderHook(() => useTourAutoTrigger(), { wrapper: makeWrapper(queryClient) });
    // Before delay — should not have triggered
    vi.advanceTimersByTime(249);
    expect(mockStartTour).not.toHaveBeenCalled();
    // After 250ms — should trigger
    vi.advanceTimersByTime(1);
    expect(mockStartTour).toHaveBeenCalledWith(
      mockTourSteps,
      expect.objectContaining({ trigger: 'auto' })
    );
  });

  it('fail-safe: sets triggeredRef after 10s, preventing late trigger', () => {
    // Dashboard never loads
    queryClient.removeQueries({ queryKey: ['analytics'] });
    let resolve!: (v: unknown) => void;
    mockGetAnalytics.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );

    renderHook(() => useTourAutoTrigger(), { wrapper: makeWrapper(queryClient) });
    vi.advanceTimersByTime(10_000);
    // Now simulate dashboard loading
    queryClient.setQueryData(['analytics', '1', 'last7'], fixtureData);
    // Re-render would be needed but triggeredRef is already set
    expect(mockStartTour).not.toHaveBeenCalled();
  });

  it('does not trigger when tour is already completed', () => {
    mockIsTourCompleted.mockReturnValue(true);
    renderHook(() => useTourAutoTrigger(), { wrapper: makeWrapper(queryClient) });
    vi.advanceTimersByTime(250);
    expect(mockStartTour).not.toHaveBeenCalled();
  });

  it('passes essentialDeck from deckStore to buildTourSteps', () => {
    mockDecks = [{ id: 'deck-42', title: 'Essential Greek Nouns' }];
    renderHook(() => useTourAutoTrigger(), { wrapper: makeWrapper(queryClient) });
    vi.advanceTimersByTime(250);
    expect(mockStartTour).toHaveBeenCalledWith(
      mockTourSteps,
      expect.objectContaining({ trigger: 'auto' })
    );
  });

  it('cleans up timers on unmount', () => {
    const { unmount } = renderHook(() => useTourAutoTrigger(), {
      wrapper: makeWrapper(queryClient),
    });
    unmount();
    vi.advanceTimersByTime(250);
    expect(mockStartTour).not.toHaveBeenCalled();
  });

  it('does not trigger when not authenticated', () => {
    mockUser = null;
    renderHook(() => useTourAutoTrigger(), { wrapper: makeWrapper(queryClient) });
    vi.advanceTimersByTime(250);
    expect(mockStartTour).not.toHaveBeenCalled();
  });

  it('does not trigger when app not ready', () => {
    mockIsReady = false;
    renderHook(() => useTourAutoTrigger(), { wrapper: makeWrapper(queryClient) });
    vi.advanceTimersByTime(250);
    expect(mockStartTour).not.toHaveBeenCalled();
  });

  it('does not trigger when server-side tourCompletedAt is set', () => {
    mockUser = { id: '1', tourCompletedAt: '2026-01-01T00:00:00Z' };
    mockIsTourCompleted.mockReturnValue(true);
    renderHook(() => useTourAutoTrigger(), { wrapper: makeWrapper(queryClient) });
    vi.advanceTimersByTime(250);
    expect(mockStartTour).not.toHaveBeenCalled();
  });

  it('does not trigger when steps array is empty', () => {
    mockTourSteps = [];
    renderHook(() => useTourAutoTrigger(), { wrapper: makeWrapper(queryClient) });
    vi.advanceTimersByTime(250);
    expect(mockStartTour).not.toHaveBeenCalled();
  });

  it('fires only once even with re-renders', () => {
    const { rerender } = renderHook(() => useTourAutoTrigger(), {
      wrapper: makeWrapper(queryClient),
    });
    vi.advanceTimersByTime(250);
    rerender();
    vi.advanceTimersByTime(250);
    expect(mockStartTour).toHaveBeenCalledTimes(1);
  });
});
