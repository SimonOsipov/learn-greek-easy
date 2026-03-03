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
  buildTourSteps: (_navigate: unknown, _t: unknown) => mockTourSteps,
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

let mockUser: object | null = { id: '1' };
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: object | null }) => boolean) =>
    selector({ user: mockUser }),
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('triggers tour when app ready + authenticated + not completed + steps exist', () => {
    renderHook(() => useTourAutoTrigger());
    vi.advanceTimersByTime(1000);
    expect(mockStartTour).toHaveBeenCalledWith(
      mockTourSteps,
      expect.objectContaining({ trigger: 'auto' })
    );
  });

  it('does not trigger when tour already completed', () => {
    mockIsTourCompleted.mockReturnValue(true);
    renderHook(() => useTourAutoTrigger());
    vi.advanceTimersByTime(1000);
    expect(mockStartTour).not.toHaveBeenCalled();
  });

  it('does not trigger when not authenticated', () => {
    mockUser = null;
    renderHook(() => useTourAutoTrigger());
    vi.advanceTimersByTime(1000);
    expect(mockStartTour).not.toHaveBeenCalled();
  });

  it('does not trigger when app not ready', () => {
    mockIsReady = false;
    renderHook(() => useTourAutoTrigger());
    vi.advanceTimersByTime(1000);
    expect(mockStartTour).not.toHaveBeenCalled();
  });

  it('does not trigger when steps array is empty', () => {
    mockTourSteps = [];
    renderHook(() => useTourAutoTrigger());
    vi.advanceTimersByTime(1000);
    expect(mockStartTour).not.toHaveBeenCalled();
  });

  it('fires only once even with re-renders', () => {
    const { rerender } = renderHook(() => useTourAutoTrigger());
    vi.advanceTimersByTime(1000);
    rerender();
    vi.advanceTimersByTime(1000);
    expect(mockStartTour).toHaveBeenCalledTimes(1);
  });

  it('cancels timer on unmount', () => {
    const { unmount } = renderHook(() => useTourAutoTrigger());
    unmount();
    vi.advanceTimersByTime(1000);
    expect(mockStartTour).not.toHaveBeenCalled();
  });
});
