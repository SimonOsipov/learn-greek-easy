/// <reference types="jest" />
/**
 * MOB-11 — RNTL screen tests for YouScreen (src/app/(app)/you.tsx).
 *
 * Tests:
 *   1. Loading → skeleton, no profile header.
 *   2. Error → retry affordance, refetch on press.
 *   3. Loaded → kicker, profile header, heatmap card, stat grid, settings list, sign out.
 *   4. Settings row press → showComingSoonToast + analytics.
 *   5. Gear press → showComingSoonToast + analytics.
 *   6. Sign out press → triggers Alert.alert (native dialog).
 *   7. Analytics: profile_screen_viewed fires once on load.
 *   8. Falls back to "Learner" level when xp query not loaded.
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks — MUST precede any import that resolves the mocked module.
// ---------------------------------------------------------------------------

jest.mock('nativewind');

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

jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  const stub = () => ce(View, { testID: 'icon-stub' });
  return {
    Settings: stub,
    ChevronRight: stub,
    Flame: stub,
    Check: stub,
    Clock: stub,
    Trophy: stub,
  };
});

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

// hooks
const mockUseUserProfile = jest.fn();
jest.mock('@/hooks/use-user-profile', () => ({
  useUserProfile: () => mockUseUserProfile(),
}));

const mockUseXpStats = jest.fn();
jest.mock('@/hooks/use-xp-stats', () => ({
  useXpStats: () => mockUseXpStats(),
}));

const mockUseProgressDashboard = jest.fn();
jest.mock('@/hooks/use-progress-dashboard', () => ({
  useProgressDashboard: () => mockUseProgressDashboard(),
}));

const mockUseWeekTrends = jest.fn();
jest.mock('@/hooks/use-week-trends', () => ({
  useWeekTrends: () => mockUseWeekTrends(),
}));

const mockSignOut = jest.fn().mockResolvedValue(undefined);
jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: { signOut: jest.Mock }) => unknown) =>
    selector({ signOut: mockSignOut }),
}));

const mockShowComingSoonToast = jest.fn();
jest.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showComingSoonToast: mockShowComingSoonToast }),
}));

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

// ---------------------------------------------------------------------------
// Import subject AFTER all mocks.
// ---------------------------------------------------------------------------
import YouScreen from '@/app/(app)/you';
import { track } from '@/lib/analytics';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROFILE_DATA = {
  id: 'user-1',
  email: 'maria@example.com',
  full_name: 'Maria Stavrou',
  avatar_url: null,
  is_active: true,
  is_superuser: false,
  auth_provider: 'email',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  effective_role: 'free' as const,
  settings: {
    id: 'settings-1',
    user_id: 'user-1',
    daily_goal: 20,
    email_notifications: true,
    theme: null,
    preferred_language: null,
    tour_completed_at: null,
    proficiency_level: null,
    learning_goal: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
};

const XP_DATA = {
  total_xp: 1500,
  current_level: 4,
  level_name_english: 'Beginner',
  level_name_greek: 'Αρχάριος',
  xp_in_level: 150,
  xp_for_next_level: 500,
  progress_percentage: 30,
};

const DASHBOARD_DATA = {
  streak: {
    current_streak: 6,
    longest_streak: 14,
    last_study_date: '2024-06-09',
    vocabulary_current_streak: 6,
    vocabulary_longest_streak: 14,
    culture_current_streak: 2,
    culture_longest_streak: 5,
    exercise_current_streak: 1,
    exercise_longest_streak: 3,
  },
  today: {
    cards_due: 5,
    daily_goal: 20,
    reviews_completed: 8,
    study_time_seconds: 720,
  },
  overview: {
    total_cards_mastered: 142,
    total_study_time_seconds: 4860,
  },
  recent_activity: [],
};

const TRENDS_DATA = {
  period: 'week',
  start_date: '2024-06-03',
  end_date: '2024-06-09',
  daily_stats: [
    { date: '2024-06-03', reviews_count: 4 },
    { date: '2024-06-04', reviews_count: 8 },
    { date: '2024-06-05', reviews_count: 0 },
    { date: '2024-06-06', reviews_count: 12 },
    { date: '2024-06-07', reviews_count: 5 },
    { date: '2024-06-08', reviews_count: 3 },
    { date: '2024-06-09', reviews_count: 7 },
  ],
  summary: {
    total_reviews: 39,
    total_study_time_seconds: 4860,
    cards_mastered: 7,
    average_daily_reviews: 5.6,
    best_day: '2024-06-06',
    quality_trend: 'stable' as const,
  },
};

function setQueries({
  profileLoading = false,
  profileError = false,
  dashboardLoading = false,
  dashboardError = false,
  trendsLoading = false,
  xpLoading = false,
}: {
  profileLoading?: boolean;
  profileError?: boolean;
  dashboardLoading?: boolean;
  dashboardError?: boolean;
  trendsLoading?: boolean;
  xpLoading?: boolean;
} = {}) {
  mockUseUserProfile.mockReturnValue({
    data: profileLoading || profileError ? undefined : PROFILE_DATA,
    isLoading: profileLoading,
    isError: profileError,
    refetch: jest.fn().mockResolvedValue(undefined),
  });
  mockUseXpStats.mockReturnValue({
    data: xpLoading ? undefined : XP_DATA,
    isLoading: xpLoading,
    isError: false,
    refetch: jest.fn().mockResolvedValue(undefined),
  });
  mockUseProgressDashboard.mockReturnValue({
    data: dashboardLoading || dashboardError ? undefined : DASHBOARD_DATA,
    isLoading: dashboardLoading,
    isError: dashboardError,
    refetch: jest.fn().mockResolvedValue(undefined),
  });
  mockUseWeekTrends.mockReturnValue({
    data: trendsLoading ? undefined : TRENDS_DATA,
    isLoading: trendsLoading,
    isError: false,
    refetch: jest.fn().mockResolvedValue(undefined),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  // Reset track mock (imported after jest.mock() factory, so it IS the mock function)
  (track as jest.Mock).mockReset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('YouScreen', () => {
  it('shows the skeleton while loading', () => {
    setQueries({ profileLoading: true, dashboardLoading: true });
    render(<YouScreen />);
    expect(screen.getByTestId('you-loading')).toBeTruthy();
    expect(screen.queryByTestId('you-screen')).toBeNull();
  });

  it('shows error + retry when profile fails', () => {
    setQueries({ profileError: true });
    render(<YouScreen />);
    expect(screen.getByTestId('you-error')).toBeTruthy();
    fireEvent.press(screen.getByTestId('you-error-retry'));
    expect(mockUseUserProfile.mock.results.at(-1)?.value.refetch).toHaveBeenCalled();
  });

  it('renders all main blocks on success', () => {
    setQueries();
    render(<YouScreen />);
    expect(screen.getByTestId('you-screen')).toBeTruthy();
    expect(screen.getByTestId('you-kicker')).toHaveTextContent('Your profile');
    expect(screen.getByTestId('you-profile-header')).toBeTruthy();
    expect(screen.getByTestId('you-heatmap-card')).toBeTruthy();
    expect(screen.getByTestId('profile-stat-grid')).toBeTruthy();
    expect(screen.getByTestId('you-settings-list')).toBeTruthy();
    expect(screen.getByTestId('you-sign-out-button')).toBeTruthy();
  });

  it('renders full name from profile', () => {
    setQueries();
    render(<YouScreen />);
    expect(screen.getByTestId('profile-full-name')).toHaveTextContent('Maria Stavrou');
  });

  it('renders level name from xp stats', () => {
    setQueries();
    render(<YouScreen />);
    expect(screen.getByTestId('profile-level-pill')).toHaveTextContent('Beginner');
  });

  it('falls back to "Learner" when xp data is not yet loaded', () => {
    setQueries({ xpLoading: true });
    render(<YouScreen />);
    expect(screen.getByTestId('profile-level-pill')).toHaveTextContent('Learner');
  });

  it('settings row press shows coming soon toast and tracks analytics', () => {
    setQueries();
    render(<YouScreen />);
    fireEvent.press(screen.getByTestId('settings-row-daily-goal'));
    expect(mockShowComingSoonToast).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('profile_row_tapped', {
      row: 'daily-goal',
      coming_soon: true,
    });
  });

  it('gear button press shows coming soon toast', () => {
    setQueries();
    render(<YouScreen />);
    fireEvent.press(screen.getByTestId('you-gear-button'));
    expect(mockShowComingSoonToast).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('profile_row_tapped', {
      row: 'gear',
      coming_soon: true,
    });
  });

  it('sign-out button triggers Alert.alert', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    setQueries();
    render(<YouScreen />);
    fireEvent.press(screen.getByTestId('you-sign-out-button'));
    expect(alertSpy).toHaveBeenCalledWith(
      'Sign out',
      'Are you sure you want to sign out?',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel' }),
        expect.objectContaining({ text: 'Sign out', style: 'destructive' }),
      ]),
      expect.anything(),
    );
    alertSpy.mockRestore();
  });

  it('fires profile_screen_viewed analytics once when data loads', () => {
    setQueries();
    render(<YouScreen />);
    expect(track).toHaveBeenCalledWith('profile_screen_viewed', {
      current_streak: 6,
      mastered_cards: 142,
    });
    // Should only fire once
    expect(
      (track as jest.Mock).mock.calls.filter((c) => c[0] === 'profile_screen_viewed'),
    ).toHaveLength(1);
  });

  it('renders daily goal sublabel from settings', () => {
    setQueries();
    render(<YouScreen />);
    // The row contains both label "Daily goal" and sublabel "20 cards"
    expect(screen.getByTestId('settings-row-daily-goal')).toHaveTextContent(/20 cards/);
  });
});
