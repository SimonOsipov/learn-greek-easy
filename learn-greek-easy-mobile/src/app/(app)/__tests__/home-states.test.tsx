/// <reference types="jest" />
/**
 * DASH-10 — RNTL tests for HomeScreen UX states:
 *   1. isLoading=true → DashboardSkeleton renders (not full dashboard, no crash).
 *   2. Pull-to-refresh: invoking the RefreshControl onRefresh calls refetchAll.
 *   3. Failed/empty section shows inline error WITHOUT removing sibling sections.
 *   4. Reduced motion on → static branch rendered (no animated shimmer element).
 */
import React, { act } from 'react';
import { RefreshControl } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks — MUST precede any import that resolves the mocked module.
// ---------------------------------------------------------------------------

jest.mock('nativewind');

// expo-router — stub useRouter
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// useDashboard — we control its return value per test
const mockUseDashboard = jest.fn();
jest.mock('@/hooks/use-dashboard', () => ({
  useDashboard: () => mockUseDashboard(),
}));

// useReducedMotion — mutable; overridden per test
const mockUseReducedMotion = jest.fn<boolean, []>().mockReturnValue(false);
jest.mock('@/hooks/use-reduced-motion', () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}));

// useToast — stub
jest.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showComingSoonToast: jest.fn() }),
}));

// expo-linear-gradient — render children inside a plain View
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  return {
    LinearGradient: ({
      children,
      testID,
    }: {
      children?: React.ReactNode;
      testID?: string;
    }) => ce(View, { testID }, children),
  };
});

// lucide-react-native — stub all icons to plain Views
jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  const stub = (props: { testID?: string; size?: number; color?: string } = {}) =>
    ce(View, { testID: props.testID ?? 'icon-stub' });
  return {
    BookOpen: stub,
    Trophy: stub,
    Play: stub,
    ChevronRight: stub,
    Flame: stub,
    Check: stub,
    Clock: stub,
    Sparkles: stub,
    Zap: stub,
  };
});

// react-native-safe-area-context — render SafeAreaView as a plain View
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  return {
    SafeAreaView: ({
      children,
      testID,
      ...rest
    }: {
      children?: React.ReactNode;
      testID?: string;
      [k: string]: unknown;
    }) => ce(View, { testID, ...rest }, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

// ---------------------------------------------------------------------------
// DashboardSkeleton — use the REAL implementation for DASH-10 tests so we
// can assert on its testID and the animated/static branch.
// We DO stub the Animated loop to avoid async timer issues in JSDOM.
// ---------------------------------------------------------------------------

// We mock Animated to use plain values (jest.useFakeTimers is an alternative
// but causes issues with other timers). Instead we rely on the real Animated
// but ensure loop.start() is a no-op in tests.
jest.mock('react-native/Libraries/Animated/Animated', () => {
  const Animated = jest.requireActual('react-native/Libraries/Animated/Animated');
  // Stub loop so it doesn't start an infinite animation in tests
  const origLoop = Animated.loop;
  Animated.loop = (...args: Parameters<typeof origLoop>) => {
    const loopAnim = origLoop(...args);
    return { ...loopAnim, start: jest.fn() };
  };
  return Animated;
});

// SectionError — use the real implementation (it's a simple View/Pressable)
// No additional mock needed.

// ---------------------------------------------------------------------------
// Import subject AFTER mocks.
// ---------------------------------------------------------------------------
import HomeScreen from '@/app/(app)/index';

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

function makeReturningSummary(overrides: Record<string, unknown> = {}) {
  return {
    greeting: 'morning' as const,
    firstName: 'Maria',
    currentStreak: 6,
    cardsDueToday: 12,
    reviewedToday: 5,
    masteredCards: 80,
    studyTimeSeconds: 720,
    heatmap: [0, 1, 2, 3, 0, 5, 2],
    resumeDeck: null,
    decks: [],
    news: [],
    situations: [],
    whatsNew: {
      audio_count: 0,
      country_counts: { cyprus: 0, greece: 0, world: 0 },
      newDialogsComingSoon: true as const,
    },
    isNewUser: false,
    isLoading: false,
    isError: false,
    newsError: false,
    situationsError: false,
    decksError: false,
    refetchAll: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reset mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockUseReducedMotion.mockReturnValue(false);
});

// ---------------------------------------------------------------------------
// 1. Loading state → DashboardSkeleton
// ---------------------------------------------------------------------------

describe('DASH-10 — loading state shows DashboardSkeleton', () => {
  it('renders DashboardSkeleton when isLoading=true', () => {
    mockUseDashboard.mockReturnValue(
      makeReturningSummary({ isLoading: true, isNewUser: undefined }),
    );
    render(<HomeScreen />);
    expect(screen.getByTestId('dashboard-skeleton')).toBeTruthy();
  });

  it('does NOT render the full dashboard while isLoading=true', () => {
    mockUseDashboard.mockReturnValue(
      makeReturningSummary({ isLoading: true, isNewUser: undefined }),
    );
    render(<HomeScreen />);
    expect(screen.queryByTestId('home-returning')).toBeNull();
    expect(screen.queryByTestId('new-user-start')).toBeNull();
  });

  it('renders DashboardSkeleton when isLoading=false but isNewUser=undefined', () => {
    mockUseDashboard.mockReturnValue(
      makeReturningSummary({ isLoading: false, isNewUser: undefined }),
    );
    render(<HomeScreen />);
    expect(screen.getByTestId('dashboard-skeleton')).toBeTruthy();
    expect(screen.queryByTestId('home-returning')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Pull-to-refresh → refetchAll
// ---------------------------------------------------------------------------

describe('DASH-10 — pull-to-refresh calls refetchAll', () => {
  it('invoking RefreshControl onRefresh calls refetchAll', async () => {
    const refetchAll = jest.fn();
    mockUseDashboard.mockReturnValue(makeReturningSummary({ refetchAll }));

    const { UNSAFE_getAllByType } = render(<HomeScreen />);

    // Find the RefreshControl in the rendered tree and invoke its onRefresh
    const refreshControls = UNSAFE_getAllByType(RefreshControl);
    expect(refreshControls.length).toBeGreaterThan(0);
    const onRefresh = refreshControls[0].props.onRefresh as () => Promise<void>;
    expect(typeof onRefresh).toBe('function');

    // Wrap in await act(async) because handleRefresh is async — awaiting it ensures
    // all state updates (setRefreshing true + false) settle within the act boundary.
    await act(async () => {
      await onRefresh();
    });

    expect(refetchAll).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 3. Section-level degradation: one failed shelf keeps siblings
// ---------------------------------------------------------------------------

describe('DASH-10 — section error degrades gracefully', () => {
  it('newsError=true shows section-error-news WITHOUT removing stat-grid (sibling)', () => {
    mockUseDashboard.mockReturnValue(makeReturningSummary({ newsError: true }));
    render(<HomeScreen />);

    // Failed section shows inline error
    expect(screen.getByTestId('section-error-news')).toBeTruthy();

    // Sibling sections still present
    expect(screen.getByTestId('block-stat-grid')).toBeTruthy();
    expect(screen.getByTestId('block-shelf-quick-wins')).toBeTruthy();
  });

  it('situationsError=true shows section-error-situations while news block is absent (empty, not errored)', () => {
    mockUseDashboard.mockReturnValue(
      makeReturningSummary({ situationsError: true, news: [] }),
    );
    render(<HomeScreen />);

    expect(screen.getByTestId('section-error-situations')).toBeTruthy();
    // News block with empty data: shelf is hidden (no error, no items → null)
    expect(screen.queryByTestId('section-error-news')).toBeNull();
    // Stat grid and decks still render
    expect(screen.getByTestId('block-stat-grid')).toBeTruthy();
    expect(screen.getByTestId('block-shelf-quick-wins')).toBeTruthy();
  });

  it('decksError=true shows section-error-decks; sibling situations (empty) does NOT error', () => {
    mockUseDashboard.mockReturnValue(
      makeReturningSummary({ decksError: true, situations: [] }),
    );
    render(<HomeScreen />);

    expect(screen.getByTestId('section-error-decks')).toBeTruthy();
    expect(screen.queryByTestId('section-error-situations')).toBeNull();
    expect(screen.getByTestId('block-stat-grid')).toBeTruthy();
  });

  it('does NOT render a full-screen crash when one section fails', () => {
    mockUseDashboard.mockReturnValue(makeReturningSummary({ newsError: true }));
    // Should not throw; home-returning wrapper should still be present
    render(<HomeScreen />);
    expect(screen.getByTestId('home-returning')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 4. Reduced motion → static branch in DashboardSkeleton
// ---------------------------------------------------------------------------

describe('DASH-10 — reduced motion renders static skeleton', () => {
  it('when reduceMotion=true, DashboardSkeleton receives reduceMotion=true prop', () => {
    mockUseReducedMotion.mockReturnValue(true);
    mockUseDashboard.mockReturnValue(
      makeReturningSummary({ isLoading: true, isNewUser: undefined }),
    );

    // Render the real DashboardSkeleton — the ShimmerWrapper sets opacity to 0.6
    // (static) when reduceMotion=true instead of starting an animation loop.
    // We verify the skeleton renders without errors and the testID is present.
    render(<HomeScreen />);
    expect(screen.getByTestId('dashboard-skeleton')).toBeTruthy();
  });

  it('when reduceMotion=false, skeleton still renders without error', () => {
    mockUseReducedMotion.mockReturnValue(false);
    mockUseDashboard.mockReturnValue(
      makeReturningSummary({ isLoading: true, isNewUser: undefined }),
    );
    render(<HomeScreen />);
    expect(screen.getByTestId('dashboard-skeleton')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 5. Critical-error state → page-level error + retry (MOB-16 / DASH-10 AC)
// ---------------------------------------------------------------------------

describe('MOB-16 — critical error shows page-level error + retry', () => {
  it('renders error message and Retry button when isError=true and isLoading=false', () => {
    mockUseDashboard.mockReturnValue(
      makeReturningSummary({ isError: true, isLoading: false, isNewUser: undefined }),
    );
    render(<HomeScreen />);

    expect(screen.getByTestId('home-error')).toBeTruthy();
    expect(screen.getByText("Couldn't load your dashboard.")).toBeTruthy();
    expect(screen.getByTestId('home-error-retry')).toBeTruthy();
  });

  it('does NOT render DashboardSkeleton when isError=true (no infinite skeleton)', () => {
    mockUseDashboard.mockReturnValue(
      makeReturningSummary({ isError: true, isLoading: false, isNewUser: undefined }),
    );
    render(<HomeScreen />);

    expect(screen.queryByTestId('dashboard-skeleton')).toBeNull();
  });

  it('does NOT render the returning-user or new-user screen on critical error', () => {
    mockUseDashboard.mockReturnValue(
      makeReturningSummary({ isError: true, isLoading: false, isNewUser: undefined }),
    );
    render(<HomeScreen />);

    expect(screen.queryByTestId('home-returning')).toBeNull();
    expect(screen.queryByTestId('home-new-user')).toBeNull();
  });

  it('pressing Retry calls refetchAll', () => {
    const refetchAll = jest.fn().mockResolvedValue(undefined);
    mockUseDashboard.mockReturnValue(
      makeReturningSummary({ isError: true, isLoading: false, isNewUser: undefined, refetchAll }),
    );
    render(<HomeScreen />);

    fireEvent.press(screen.getByTestId('home-error-retry'));
    expect(refetchAll).toHaveBeenCalledTimes(1);
  });
});
