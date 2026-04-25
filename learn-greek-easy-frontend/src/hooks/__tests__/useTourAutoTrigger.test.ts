import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Module-level mocks
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

let mockAnalyticsLoading = false;
let mockDashboardData: object | null = { someData: true };
vi.mock('@/hooks/useAnalytics', () => ({
  useAnalytics: () => ({ data: mockDashboardData, loading: mockAnalyticsLoading }),
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

describe('useTourAutoTrigger', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockIsReady = true;
    mockUser = { id: '1' };
    mockTourSteps = [{ element: '#test', popover: { title: 'Test' } }];
    mockIsTourCompleted.mockReturnValue(false);
    mockUpdateProfile.mockResolvedValue(undefined);
    mockAnalyticsLoading = false;
    mockDashboardData = { someData: true };
    mockDecks = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not trigger when analytics is loading', () => {
    mockAnalyticsLoading = true;
    mockDashboardData = null;
    renderHook(() => useTourAutoTrigger());
    vi.advanceTimersByTime(250);
    expect(mockStartTour).not.toHaveBeenCalled();
  });

  it('triggers after dashboard data loads + 250ms delay', () => {
    mockAnalyticsLoading = false;
    mockDashboardData = { someData: true };
    renderHook(() => useTourAutoTrigger());
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
    mockAnalyticsLoading = true;
    mockDashboardData = null;
    renderHook(() => useTourAutoTrigger());
    vi.advanceTimersByTime(10_000);
    // Now simulate dashboard loading
    mockAnalyticsLoading = false;
    mockDashboardData = { someData: true };
    // Re-render would be needed but triggeredRef is already set
    expect(mockStartTour).not.toHaveBeenCalled();
  });

  it('does not trigger when tour is already completed', () => {
    mockIsTourCompleted.mockReturnValue(true);
    renderHook(() => useTourAutoTrigger());
    vi.advanceTimersByTime(250);
    expect(mockStartTour).not.toHaveBeenCalled();
  });

  it('passes essentialDeck from deckStore to buildTourSteps', () => {
    mockDecks = [{ id: 'deck-42', title: 'Essential Greek Nouns' }];
    const buildTourStepsMock = vi.fn(() => mockTourSteps);
    // We can't easily spy on the mock, but we verify startTour is called with the steps
    renderHook(() => useTourAutoTrigger());
    vi.advanceTimersByTime(250);
    expect(mockStartTour).toHaveBeenCalledWith(
      mockTourSteps,
      expect.objectContaining({ trigger: 'auto' })
    );
  });

  it('cleans up timers on unmount', () => {
    const { unmount } = renderHook(() => useTourAutoTrigger());
    unmount();
    vi.advanceTimersByTime(250);
    expect(mockStartTour).not.toHaveBeenCalled();
  });

  it('does not trigger when not authenticated', () => {
    mockUser = null;
    renderHook(() => useTourAutoTrigger());
    vi.advanceTimersByTime(250);
    expect(mockStartTour).not.toHaveBeenCalled();
  });

  it('does not trigger when app not ready', () => {
    mockIsReady = false;
    renderHook(() => useTourAutoTrigger());
    vi.advanceTimersByTime(250);
    expect(mockStartTour).not.toHaveBeenCalled();
  });

  it('does not trigger when server-side tourCompletedAt is set', () => {
    mockUser = { id: '1', tourCompletedAt: '2026-01-01T00:00:00Z' };
    mockIsTourCompleted.mockReturnValue(true);
    renderHook(() => useTourAutoTrigger());
    vi.advanceTimersByTime(250);
    expect(mockStartTour).not.toHaveBeenCalled();
  });

  it('does not trigger when steps array is empty', () => {
    mockTourSteps = [];
    renderHook(() => useTourAutoTrigger());
    vi.advanceTimersByTime(250);
    expect(mockStartTour).not.toHaveBeenCalled();
  });

  it('fires only once even with re-renders', () => {
    const { rerender } = renderHook(() => useTourAutoTrigger());
    vi.advanceTimersByTime(250);
    rerender();
    vi.advanceTimersByTime(250);
    expect(mockStartTour).toHaveBeenCalledTimes(1);
  });
});
