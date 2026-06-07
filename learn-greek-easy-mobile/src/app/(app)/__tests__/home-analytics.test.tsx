/// <reference types="jest" />
/**
 * DASH-12 — Analytics event tests for HomeScreen (src/app/(app)/index.tsx).
 *
 * Tests:
 *   1. home_screen_viewed fires exactly once after isNewUser resolves (not while
 *      loading/undefined), with the state prop ('new_user' or 'returning').
 *   2. home_screen_viewed does NOT fire while isNewUser is undefined (loading).
 *   3. home_card_tapped fires with { section, target, coming_soon } on a card press
 *      in the returning-user branch (quick-wins card).
 *   4. A coming-soon press (quick-wins card) has coming_soon: true AND does NOT
 *      call router.push.
 *   5. home_card_tapped fires with coming_soon: false for a navigation press
 *      (avatar → profile).
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks — MUST precede any import that resolves the mocked module.
// ---------------------------------------------------------------------------

jest.mock('nativewind');

// @/lib/analytics — capture track() calls
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));

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

// useReducedMotion — default false
jest.mock('@/hooks/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}));

// dashboard-skeleton — stub
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

function makeReturningSummary(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reset mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 1. home_screen_viewed — returning user
// ---------------------------------------------------------------------------

describe('DASH-12 — home_screen_viewed analytics', () => {
  it('fires home_screen_viewed once on mount for a returning user', () => {
    mockUseDashboard.mockReturnValue(makeReturningSummary());
    render(<HomeScreen />);
    expect(mockTrack).toHaveBeenCalledWith('home_screen_viewed', { state: 'returning' });
    // Only once
    const viewedCalls = mockTrack.mock.calls.filter(([event]) => event === 'home_screen_viewed');
    expect(viewedCalls).toHaveLength(1);
  });

  it('fires home_screen_viewed with state=new_user for a new user', () => {
    mockUseDashboard.mockReturnValue(
      makeReturningSummary({ isNewUser: true, currentStreak: 0, masteredCards: 0 }),
    );
    render(<HomeScreen />);
    expect(mockTrack).toHaveBeenCalledWith('home_screen_viewed', { state: 'new_user' });
  });

  it('does NOT fire home_screen_viewed while isNewUser is undefined (loading)', () => {
    mockUseDashboard.mockReturnValue(
      makeReturningSummary({ isLoading: true, isNewUser: undefined }),
    );
    render(<HomeScreen />);
    const viewedCalls = mockTrack.mock.calls.filter(([event]) => event === 'home_screen_viewed');
    expect(viewedCalls).toHaveLength(0);
  });

  it('does NOT fire home_screen_viewed when isLoading=false but isNewUser still undefined', () => {
    mockUseDashboard.mockReturnValue(
      makeReturningSummary({ isLoading: false, isNewUser: undefined }),
    );
    render(<HomeScreen />);
    const viewedCalls = mockTrack.mock.calls.filter(([event]) => event === 'home_screen_viewed');
    expect(viewedCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2. home_card_tapped — coming-soon card (quick-wins)
// ---------------------------------------------------------------------------

describe('DASH-12 — home_card_tapped analytics on quick-wins card', () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue(makeReturningSummary());
  });

  it('fires home_card_tapped with section=quick-wins and coming_soon=true when pressing a quick-wins card', () => {
    render(<HomeScreen />);
    const card = screen.getByTestId('quick-wins-card-daily-mix');
    fireEvent.press(card);
    expect(mockTrack).toHaveBeenCalledWith('home_card_tapped', {
      section: 'quick-wins',
      target: 'daily-mix',
      coming_soon: true,
    });
  });

  it('pressing a coming-soon card also fires showComingSoonToast', () => {
    render(<HomeScreen />);
    const card = screen.getByTestId('quick-wins-card-daily-mix');
    fireEvent.press(card);
    expect(mockShowComingSoonToast).toHaveBeenCalledTimes(1);
  });

  it('pressing a coming-soon card does NOT call router.push', () => {
    render(<HomeScreen />);
    const card = screen.getByTestId('quick-wins-card-daily-mix');
    fireEvent.press(card);
    expect(mockPush).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3. home_card_tapped — navigation press (avatar → profile), coming_soon=false
// ---------------------------------------------------------------------------

describe('DASH-12 — home_card_tapped analytics on navigation press', () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue(makeReturningSummary());
  });

  it('fires home_card_tapped with coming_soon=false when pressing the avatar (greeting section)', () => {
    render(<HomeScreen />);
    const avatar = screen.getByTestId('avatar-button');
    fireEvent.press(avatar);
    expect(mockTrack).toHaveBeenCalledWith('home_card_tapped', {
      section: 'greeting',
      target: 'profile',
      coming_soon: false,
    });
  });

  it('pressing avatar DOES call router.push (navigation, not toast)', () => {
    render(<HomeScreen />);
    const avatar = screen.getByTestId('avatar-button');
    fireEvent.press(avatar);
    expect(mockPush).toHaveBeenCalledWith('/(app)/you');
    expect(mockShowComingSoonToast).not.toHaveBeenCalled();
  });
});
