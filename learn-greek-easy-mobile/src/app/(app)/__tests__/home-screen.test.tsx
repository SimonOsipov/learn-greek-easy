/// <reference types="jest" />
/**
 * DASH-09 — RNTL screen-level tests for HomeScreen (src/app/(app)/index.tsx).
 *
 * Tests:
 *   1. isLoading=true (isNewUser undefined) → neither new-user heading NOR returning
 *      blocks render (no flash of either branch).
 *   2. isNewUser=true → NewUserStart "Three ways to start" renders; no StatGrid / shelves.
 *   3. isNewUser=false → blocks render in spec order (greeting precedes shelves);
 *      GreetingHeader, ProgressBand, StatGrid, block wrappers all present.
 *   4. isNewUser=false, resumeDeck null → ContinueHero is absent (empty block wrapper).
 *   5. A quick-wins card press fires showComingSoonToast and does NOT call router.push.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks — MUST precede any import that resolves the mocked module.
// ---------------------------------------------------------------------------

jest.mock('nativewind');

// expo-router — stub useRouter
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// useDashboard — we control its return value per test
const mockUseDashboard = jest.fn();
jest.mock('@/hooks/use-dashboard', () => ({
  useDashboard: () => mockUseDashboard(),
}));

// useReducedMotion — default to false (no reduced motion) for existing tests
jest.mock('@/hooks/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}));

// dashboard-skeleton — stub to a plain View so Animated doesn't complicate these tests
jest.mock('@/components/dashboard/dashboard-skeleton', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  return {
    DashboardSkeleton: ({ testID }: { testID?: string }) =>
      ce(View, { testID: testID ?? 'dashboard-skeleton' }),
    SectionError: ({
      testID,
      label,
      onRetry,
    }: {
      testID?: string;
      label: string;
      onRetry: () => void;
    }) =>
      ce(
        View,
        { testID: testID ?? 'section-error' },
        ce(View, { testID: `${testID ?? 'section-error'}-retry`, onPress: onRetry }),
      ),
  };
});

// useToast — capture showComingSoonToast calls
const mockShowComingSoonToast = jest.fn();
jest.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showComingSoonToast: mockShowComingSoonToast }),
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
// Import subject AFTER mocks.
// ---------------------------------------------------------------------------
import HomeScreen from '@/app/(app)/index';

// ---------------------------------------------------------------------------
// Shared fixture factories
// ---------------------------------------------------------------------------

function makeReturningSummary() {
  return {
    greeting: 'morning' as const,
    firstName: 'Maria',
    currentStreak: 6,
    cardsDueToday: 12,
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
    refetchAll: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 1. Loading state — isLoading=true, isNewUser=undefined
// ---------------------------------------------------------------------------

describe('HomeScreen — loading state', () => {
  it('renders the loading screen when isLoading is true', () => {
    mockUseDashboard.mockReturnValue({
      ...makeReturningSummary(),
      isLoading: true,
      isNewUser: undefined,
    });
    render(<HomeScreen />);
    expect(screen.getByTestId('home-loading')).toBeTruthy();
  });

  it('does NOT render new-user heading while loading', () => {
    mockUseDashboard.mockReturnValue({
      ...makeReturningSummary(),
      isLoading: true,
      isNewUser: undefined,
    });
    render(<HomeScreen />);
    expect(screen.queryByTestId('new-user-start')).toBeNull();
  });

  it('does NOT render returning-user blocks while loading', () => {
    mockUseDashboard.mockReturnValue({
      ...makeReturningSummary(),
      isLoading: true,
      isNewUser: undefined,
    });
    render(<HomeScreen />);
    expect(screen.queryByTestId('home-returning')).toBeNull();
  });

  it('renders the loading screen when isLoading=false but isNewUser=undefined (undefined guard)', () => {
    mockUseDashboard.mockReturnValue({
      ...makeReturningSummary(),
      isLoading: false,
      isNewUser: undefined,
    });
    render(<HomeScreen />);
    expect(screen.getByTestId('home-loading')).toBeTruthy();
    expect(screen.queryByTestId('new-user-start')).toBeNull();
    expect(screen.queryByTestId('home-returning')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. New-user branch — isNewUser=true
// ---------------------------------------------------------------------------

describe('HomeScreen — new-user branch', () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue({
      ...makeReturningSummary(),
      isNewUser: true,
      currentStreak: 0,
      masteredCards: 0,
    });
  });

  it('renders the new-user screen wrapper', () => {
    render(<HomeScreen />);
    expect(screen.getByTestId('home-new-user')).toBeTruthy();
  });

  it('renders "Three ways to start" heading (NewUserStart)', () => {
    render(<HomeScreen />);
    expect(screen.getByTestId('new-user-start-heading')).toBeTruthy();
    expect(screen.getByTestId('new-user-start-heading').props.children).toBe(
      'Three ways to start',
    );
  });

  it('does NOT render StatGrid in new-user branch', () => {
    render(<HomeScreen />);
    expect(screen.queryByTestId('stat-grid')).toBeNull();
  });

  it('does NOT render the shelves in new-user branch', () => {
    render(<HomeScreen />);
    expect(screen.queryByTestId('block-shelf-news')).toBeNull();
    expect(screen.queryByTestId('block-shelf-situations')).toBeNull();
    expect(screen.queryByTestId('block-shelf-decks')).toBeNull();
    expect(screen.queryByTestId('block-shelf-quick-wins')).toBeNull();
  });

  it('does NOT render home-returning wrapper', () => {
    render(<HomeScreen />);
    expect(screen.queryByTestId('home-returning')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. Returning-user branch — isNewUser=false, block order
// ---------------------------------------------------------------------------

describe('HomeScreen — returning-user branch', () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue(makeReturningSummary());
  });

  it('renders the returning-user screen wrapper', () => {
    render(<HomeScreen />);
    expect(screen.getByTestId('home-returning')).toBeTruthy();
  });

  it('renders the GreetingHeader', () => {
    render(<HomeScreen />);
    expect(screen.getByTestId('greeting-header')).toBeTruthy();
  });

  it('renders the ProgressBand', () => {
    render(<HomeScreen />);
    expect(screen.getByTestId('progress-band')).toBeTruthy();
  });

  it('renders the StatGrid', () => {
    render(<HomeScreen />);
    expect(screen.getByTestId('stat-grid')).toBeTruthy();
  });

  it('renders the WhatsNewChips', () => {
    render(<HomeScreen />);
    expect(screen.getByTestId('whats-new-chips')).toBeTruthy();
  });

  it('greeting header (block-greeting) appears before block-stat-grid in the tree', () => {
    const { UNSAFE_root } = render(<HomeScreen />);

    // Walk the fiber tree to collect testIDs in render order, then compare
    // their positions. This avoids JSON.stringify which fails on circular
    // refs introduced by RefreshControl's react-test-renderer fiber props.
    const testIDs: string[] = [];
    function collectTestIDs(node: { props?: { testID?: string }; children?: unknown }) {
      if (node.props?.testID) testIDs.push(node.props.testID);
      const kids = (node as { children?: unknown }).children;
      if (Array.isArray(kids)) {
        (kids as typeof node[]).forEach(collectTestIDs);
      } else if (kids && typeof kids === 'object') {
        collectTestIDs(kids as typeof node);
      }
    }
    collectTestIDs(UNSAFE_root);

    const greetingPos = testIDs.indexOf('block-greeting');
    const statGridPos = testIDs.indexOf('block-stat-grid');
    expect(greetingPos).toBeGreaterThan(-1);
    expect(statGridPos).toBeGreaterThan(-1);
    expect(greetingPos).toBeLessThan(statGridPos);
  });

  it('renders QuickWinsShelf block (block-shelf-quick-wins)', () => {
    render(<HomeScreen />);
    expect(screen.getByTestId('block-shelf-quick-wins')).toBeTruthy();
  });

  it('does NOT render new-user-start in returning branch', () => {
    render(<HomeScreen />);
    expect(screen.queryByTestId('new-user-start')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. ContinueHero absent when resumeDeck is null
// ---------------------------------------------------------------------------

describe('HomeScreen — ContinueHero visibility', () => {
  it('renders empty block wrapper (not the hero itself) when resumeDeck is null', () => {
    mockUseDashboard.mockReturnValue({
      ...makeReturningSummary(),
      resumeDeck: null,
    });
    render(<HomeScreen />);
    // ContinueHero itself should not render (it returns null internally, plus
    // the screen wraps with an empty block when null)
    expect(screen.queryByTestId('continue-hero')).toBeNull();
    // The empty sentinel block should be present
    expect(screen.getByTestId('block-continue-hero-empty')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 5. Quick-wins card press — toast, NO router.push
// ---------------------------------------------------------------------------

describe('HomeScreen — quick-wins card interactions', () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue(makeReturningSummary());
  });

  it('pressing a quick-wins card fires showComingSoonToast', () => {
    render(<HomeScreen />);
    // The QuickWinsShelf renders with testIDs quick-wins-card-<id>
    const card = screen.getByTestId('quick-wins-card-daily-mix');
    fireEvent.press(card);
    expect(mockShowComingSoonToast).toHaveBeenCalledTimes(1);
  });

  it('pressing a quick-wins card does NOT call router.push', () => {
    render(<HomeScreen />);
    const card = screen.getByTestId('quick-wins-card-daily-mix');
    fireEvent.press(card);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
