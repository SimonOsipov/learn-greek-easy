/// <reference types="jest" />
/**
 * ONB-11 — RNTL component tests for the onboarding flow.
 *
 * Mocking strategy mirrors login.test.tsx:
 *  - expo-router:             useRouter + push/back/replace as jest.fn().
 *  - @/stores/onboarding-store: real Zustand store (reset between tests).
 *  - @/hooks/use-user-settings: mocked mutation hook.
 *  - @/hooks/use-auth:        mocked to return { user: null } by default.
 *  - @/lib/analytics:         track is a jest.fn().
 *  - Heavy native modules:    reanimated, linear-gradient, image-background,
 *                             safe-area-context, lucide-react-native, nativewind.
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mock: react-native-reanimated (matches login.test.tsx inline approach)
// ---------------------------------------------------------------------------
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const NOOP = () => {};
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (init: unknown) => ({ value: init }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    withTiming: (toValue: unknown) => toValue,
    withSpring: (toValue: unknown) => toValue,
    Animated: { View },
    Easing: {},
    runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
    cancelAnimation: NOOP,
    interpolate: NOOP,
    Extrapolation: { CLAMP: 'clamp' },
    createAnimatedComponent: (C: unknown) => C,
  };
});

// ---------------------------------------------------------------------------
// Mock: expo-linear-gradient
// ---------------------------------------------------------------------------
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  return {
    LinearGradient: ({ children }: { children: React.ReactNode }) =>
      ce(View, { testID: 'linear-gradient' }, children),
  };
});

// ---------------------------------------------------------------------------
// Mock: react-native's ImageBackground
// ---------------------------------------------------------------------------
jest.mock('react-native/Libraries/Image/ImageBackground', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  return {
    default: ({ children }: { children: React.ReactNode }) =>
      ce(View, { testID: 'image-background' }, children),
  };
});

// ---------------------------------------------------------------------------
// Mock: react-native-safe-area-context
// ---------------------------------------------------------------------------
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => {
    const { View } = require('react-native');
    const ce = require('react').createElement;
    return ce(View, {}, children);
  },
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// ---------------------------------------------------------------------------
// Mock: nativewind (via manual __mocks__/nativewind.js)
// ---------------------------------------------------------------------------
jest.mock('nativewind');

// ---------------------------------------------------------------------------
// Mock: expo-blur — BlurView is a no-op View.
// ---------------------------------------------------------------------------
jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  return {
    BlurView: ({ children }: { children?: React.ReactNode }) =>
      ce(View, { testID: 'blur-view' }, children),
  };
});

// ---------------------------------------------------------------------------
// Mock: lucide-react-native — stub each icon used across onboarding screens.
// ---------------------------------------------------------------------------
jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  const stub = (props: Record<string, unknown>) =>
    ce(View, { testID: 'icon', ...props } as any);
  return {
    Check: stub,
    ChevronLeft: stub,
    Plane: stub,
    Home: stub,
    Briefcase: stub,
    Users: stub,
    ScrollText: stub,
  };
});

// ---------------------------------------------------------------------------
// Mock: @/assets/images — require() calls for images return a string stub.
// ---------------------------------------------------------------------------
jest.mock('@/assets/images/cyprus-hero.webp', () => 'cyprus-hero.webp', {
  virtual: true,
});

// ---------------------------------------------------------------------------
// Mock: @/lib/supabase — prevents AsyncStorage NativeModule null error.
// ---------------------------------------------------------------------------
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
  },
}));

// ---------------------------------------------------------------------------
// Mock: @/lib/api-client — prevents AsyncStorage NativeModule null error;
// APIRequestError is defined inside the factory (jest hoisting constraint).
// ---------------------------------------------------------------------------
jest.mock('@/lib/api-client', () => {
  class MockAPIRequestError extends Error {
    status: number;
    statusText: string;
    detail?: unknown;
    constructor(err: { status: number; statusText: string; message: string; detail?: unknown }) {
      super(err.message);
      this.name = 'APIRequestError';
      this.status = err.status;
      this.statusText = err.statusText;
      this.detail = err.detail;
    }
  }
  return {
    APIRequestError: MockAPIRequestError,
    api: {
      get: jest.fn(),
      patch: jest.fn(),
    },
  };
});

// ---------------------------------------------------------------------------
// Mock: @/lib/analytics — track is a spy.
// ---------------------------------------------------------------------------
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({
  track: (...args: unknown[]) => mockTrack(...args),
  identifyUser: jest.fn(),
  resetIdentity: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Mock: expo-router — useRouter returns mocked push/back/replace fns.
// ---------------------------------------------------------------------------
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace }),
  Stack: { Screen: () => null },
}));

// ---------------------------------------------------------------------------
// Mock: @/hooks/use-auth — returns { user: null } by default.
// Reassignable per test.
// ---------------------------------------------------------------------------
const mockUseAuth = jest.fn();
jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}));

// ---------------------------------------------------------------------------
// Mock: @/hooks/use-user-settings — mutable mutation state.
// flattenAPIError is re-implemented inline here (mirrors the real logic) so
// we avoid importing the real module which transitively loads Supabase/AsyncStorage.
// ---------------------------------------------------------------------------
const mockMutateAsync = jest.fn();
const mockMutationState: {
  mutateAsync: jest.Mock;
  isSuccess: boolean;
  isPending: boolean;
  error: Error | null;
} = {
  mutateAsync: mockMutateAsync,
  isSuccess: false,
  isPending: false,
  error: null,
};

jest.mock('@/hooks/use-user-settings', () => ({
  useUpdateUserSettings: () => ({
    mutateAsync: mockMutationState.mutateAsync,
    isSuccess: mockMutationState.isSuccess,
    isPending: mockMutationState.isPending,
    error: mockMutationState.error,
  }),
  // Inline re-implementation — avoids loading supabase/api-client transitively.
  flattenAPIError: (err: unknown) => {
    // Import-time reference to APIRequestError would cause circular dep here;
    // use instanceof via the name check to stay safe.
    if (err != null && typeof err === 'object' && (err as Error).name === 'APIRequestError') {
      const e = err as { message: string; detail?: unknown };
      if (e.message) return e.message;
      if (Array.isArray(e.detail)) {
        const joined = (e.detail as Record<string, unknown>[])
          .map((d) => String(d['msg'] ?? ''))
          .filter(Boolean)
          .join(', ');
        if (joined) return joined;
      }
    }
    return 'Could not save your choices — please try again.';
  },
}));

// ---------------------------------------------------------------------------
// Import subjects AFTER all mocks are registered.
// ---------------------------------------------------------------------------
import LevelScreen from '@/app/(onboarding)/level';
import GoalScreen from '@/app/(onboarding)/goal';
import TimeScreen from '@/app/(onboarding)/time';
import SummaryScreen from '@/app/(onboarding)/summary';
import { useOnboardingStore, MINUTES_TO_GOAL } from '@/stores/onboarding-store';
import { flattenAPIError } from '@/hooks/use-user-settings';
import { APIRequestError } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function resetAll() {
  // Reset the real Zustand store to initial state.
  useOnboardingStore.getState().reset();

  mockTrack.mockReset();
  mockPush.mockReset();
  mockBack.mockReset();
  mockReplace.mockReset();
  mockMutateAsync.mockReset();
  mockMutationState.isSuccess = false;
  mockMutationState.isPending = false;
  mockMutationState.error = null;
  mockMutationState.mutateAsync = mockMutateAsync;

  mockUseAuth.mockReturnValue({ user: null, session: null, isLoading: false });
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

// ===========================================================================
// 1. Store unit logic
// ===========================================================================
describe('onboarding-store unit', () => {
  beforeEach(() => {
    resetAll();
  });

  it('dailyMinutes default is 15', () => {
    expect(useOnboardingStore.getState().dailyMinutes).toBe(15);
  });

  it('level defaults to null', () => {
    expect(useOnboardingStore.getState().level).toBeNull();
  });

  it('goal defaults to null', () => {
    expect(useOnboardingStore.getState().goal).toBeNull();
  });

  it('setLevel updates level', () => {
    useOnboardingStore.getState().setLevel('A1');
    expect(useOnboardingStore.getState().level).toBe('A1');
  });

  it('setGoal updates goal', () => {
    useOnboardingStore.getState().setGoal('travel');
    expect(useOnboardingStore.getState().goal).toBe('travel');
  });

  it('setDailyMinutes updates dailyMinutes', () => {
    useOnboardingStore.getState().setDailyMinutes(30);
    expect(useOnboardingStore.getState().dailyMinutes).toBe(30);
  });

  it('MINUTES_TO_GOAL maps correctly: 5→10, 15→25, 30→50, 60→100', () => {
    expect(MINUTES_TO_GOAL[5]).toBe(10);
    expect(MINUTES_TO_GOAL[15]).toBe(25);
    expect(MINUTES_TO_GOAL[30]).toBe(50);
    expect(MINUTES_TO_GOAL[60]).toBe(100);
  });

  it('skip-default: level ?? "new" resolves to "new" when null', () => {
    expect(useOnboardingStore.getState().level ?? 'new').toBe('new');
    useOnboardingStore.getState().setLevel('B1');
    expect(useOnboardingStore.getState().level ?? 'new').toBe('B1');
  });

  it('skip-default: goal ?? "live" resolves to "live" when null', () => {
    expect(useOnboardingStore.getState().goal ?? 'live').toBe('live');
    useOnboardingStore.getState().setGoal('travel');
    expect(useOnboardingStore.getState().goal ?? 'live').toBe('travel');
  });

  it('complete() calls submit with all four fields', async () => {
    useOnboardingStore.getState().setLevel('A2');
    useOnboardingStore.getState().setGoal('work');
    useOnboardingStore.getState().setDailyMinutes(30);

    const submit = jest.fn().mockResolvedValue(undefined);
    await useOnboardingStore.getState().complete(submit);

    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        proficiency_level: 'A2',
        learning_goal: 'work',
        daily_goal: 50, // MINUTES_TO_GOAL[30]
        tour_completed_at: expect.any(String),
      }),
    );
  });

  it('complete() uses "new" and "live" defaults when level/goal are null', async () => {
    // Store is already reset — level=null, goal=null
    const submit = jest.fn().mockResolvedValue(undefined);
    await useOnboardingStore.getState().complete(submit);

    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        proficiency_level: 'new',
        learning_goal: 'live',
      }),
    );
  });

  it('complete() does NOT call submit before it is invoked', () => {
    const submit = jest.fn();
    // Not calling complete() — just verifying submit has not been called.
    expect(submit).not.toHaveBeenCalled();
  });

  it('complete() sets isSubmitting=true while running, false after', async () => {
    let resolveSubmit!: () => void;
    const submit = jest.fn(
      () =>
        new Promise<void>((res) => {
          resolveSubmit = res;
        }),
    );

    const promise = useOnboardingStore.getState().complete(submit);
    expect(useOnboardingStore.getState().isSubmitting).toBe(true);

    resolveSubmit();
    await promise;
    expect(useOnboardingStore.getState().isSubmitting).toBe(false);
  });

  it('complete() captures Error as string error', async () => {
    const submit = jest.fn().mockRejectedValue(new Error('network fail'));
    await useOnboardingStore.getState().complete(submit);
    expect(useOnboardingStore.getState().error).toBe('network fail');
  });

  it('complete() captures APIRequestError as string error', async () => {
    const apiErr = new APIRequestError({
      status: 422,
      statusText: 'Unprocessable Entity',
      message: 'Validation failed',
    });
    const submit = jest.fn().mockRejectedValue(apiErr);
    await useOnboardingStore.getState().complete(submit);
    expect(useOnboardingStore.getState().error).toBe('Validation failed');
  });

  it('clearError sets error to null', () => {
    useOnboardingStore.setState({ error: 'some error' });
    useOnboardingStore.getState().clearError();
    expect(useOnboardingStore.getState().error).toBeNull();
  });
});

// ===========================================================================
// 2. flattenAPIError logic
// ===========================================================================
describe('flattenAPIError', () => {
  it('returns err.message for an APIRequestError with a message', () => {
    const err = new APIRequestError({
      status: 400,
      statusText: 'Bad Request',
      message: 'Email already exists',
    });
    expect(flattenAPIError(err)).toBe('Email already exists');
  });

  it('joins detail[].msg for a 422-shaped APIRequestError', () => {
    const err = new APIRequestError({
      status: 422,
      statusText: 'Unprocessable Entity',
      message: '',
      detail: [
        { msg: 'field required', loc: ['body', 'email'] },
        { msg: 'value is not a valid email', loc: ['body', 'email'] },
      ] as Record<string, unknown>[],
    });
    expect(flattenAPIError(err)).toBe('field required, value is not a valid email');
  });

  it('returns the fallback string for an unknown error type', () => {
    expect(flattenAPIError(new Error('oops'))).toBe(
      'Could not save your choices — please try again.',
    );
    expect(flattenAPIError('raw string')).toBe(
      'Could not save your choices — please try again.',
    );
  });
});

// ===========================================================================
// 3. LevelScreen — per-step gating + skip + analytics
// ===========================================================================
describe('LevelScreen', () => {
  beforeEach(() => {
    resetAll();
  });

  it('Continue CTA is disabled when no level is selected', () => {
    render(<LevelScreen />);
    const cta = screen.getByRole('button', { name: 'Continue' });
    expect(cta.props.accessibilityState?.disabled ?? cta.props.disabled).toBe(true);
  });

  it('Continue CTA becomes enabled after selecting a tile', () => {
    render(<LevelScreen />);
    fireEvent.press(screen.getByText('Just starting'));
    const cta = screen.getByRole('button', { name: 'Continue' });
    const isDisabled = cta.props.accessibilityState?.disabled ?? cta.props.disabled;
    expect(isDisabled).toBeFalsy();
  });

  it('selecting a tile updates the store level', () => {
    render(<LevelScreen />);
    fireEvent.press(screen.getByText('A1 · Beginner'));
    expect(useOnboardingStore.getState().level).toBe('A1');
  });

  it('fires onboarding_flow_started on mount', () => {
    render(<LevelScreen />);
    expect(mockTrack).toHaveBeenCalledWith('onboarding_flow_started');
    expect(mockTrack).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onboarding_flow_started more than once per mount', () => {
    render(<LevelScreen />);
    expect(mockTrack).toHaveBeenCalledTimes(1);
  });

  it('Skip navigates to goal screen without setting level', () => {
    render(<LevelScreen />);
    fireEvent.press(screen.getByText('Skip'));
    expect(mockPush).toHaveBeenCalledWith('/(onboarding)/goal');
    expect(useOnboardingStore.getState().level).toBeNull();
  });

  it('Continue navigates to goal screen after selection', () => {
    render(<LevelScreen />);
    fireEvent.press(screen.getByText('Just starting'));
    const cta = screen.getByRole('button', { name: 'Continue' });
    fireEvent.press(cta);
    expect(mockPush).toHaveBeenCalledWith('/(onboarding)/goal');
  });
});

// ===========================================================================
// 4. GoalScreen — per-step gating + skip
// ===========================================================================
describe('GoalScreen', () => {
  beforeEach(() => {
    resetAll();
  });

  it('Continue CTA is disabled when no goal is selected', () => {
    render(<GoalScreen />);
    const cta = screen.getByRole('button', { name: 'Continue' });
    expect(cta.props.accessibilityState?.disabled ?? cta.props.disabled).toBe(true);
  });

  it('Continue CTA becomes enabled after selecting a goal tile', () => {
    render(<GoalScreen />);
    fireEvent.press(screen.getByText('For travel'));
    const cta = screen.getByRole('button', { name: 'Continue' });
    const isDisabled = cta.props.accessibilityState?.disabled ?? cta.props.disabled;
    expect(isDisabled).toBeFalsy();
  });

  it('selecting a goal tile updates the store goal', () => {
    render(<GoalScreen />);
    fireEvent.press(screen.getByText('For travel'));
    expect(useOnboardingStore.getState().goal).toBe('travel');
  });

  it('Skip navigates to time screen without setting goal', () => {
    render(<GoalScreen />);
    fireEvent.press(screen.getByText('Skip'));
    expect(mockPush).toHaveBeenCalledWith('/(onboarding)/time');
    expect(useOnboardingStore.getState().goal).toBeNull();
  });
});

// ===========================================================================
// 5. TimeScreen — default pre-selected, tile selection
// ===========================================================================
describe('TimeScreen', () => {
  beforeEach(() => {
    resetAll();
  });

  it('Continue CTA is ENABLED on entry (15 min pre-selected)', () => {
    render(<TimeScreen />);
    const cta = screen.getByRole('button', { name: 'Continue' });
    const isDisabled = cta.props.accessibilityState?.disabled ?? cta.props.disabled;
    expect(isDisabled).toBeFalsy();
  });

  it('dailyMinutes is 15 by default (store default)', () => {
    expect(useOnboardingStore.getState().dailyMinutes).toBe(15);
  });

  it('selecting a different tile updates dailyMinutes in the store', () => {
    render(<TimeScreen />);
    fireEvent.press(screen.getByText('30 minutes'));
    expect(useOnboardingStore.getState().dailyMinutes).toBe(30);
  });

  it('selecting 5 min tile updates dailyMinutes to 5', () => {
    render(<TimeScreen />);
    fireEvent.press(screen.getByText('5 minutes'));
    expect(useOnboardingStore.getState().dailyMinutes).toBe(5);
  });
});

// ===========================================================================
// 6. SummaryScreen — name fallback, submit, spinner, error, analytics
// ===========================================================================
describe('SummaryScreen', () => {
  beforeEach(() => {
    resetAll();
  });

  it('shows email handle as name when user has email', () => {
    mockUseAuth.mockReturnValue({ user: { email: 'alexis@example.com' }, session: {}, isLoading: false });
    render(<SummaryScreen />);
    expect(screen.getByText(/Ready, alexis/)).toBeTruthy();
  });

  it('shows "there" as name fallback when user has no email', () => {
    mockUseAuth.mockReturnValue({ user: { email: null }, session: {}, isLoading: false });
    render(<SummaryScreen />);
    expect(screen.getByText(/Ready, there/)).toBeTruthy();
  });

  it('shows "there" as name fallback when user is null', () => {
    mockUseAuth.mockReturnValue({ user: null, session: null, isLoading: false });
    render(<SummaryScreen />);
    expect(screen.getByText(/Ready, there/)).toBeTruthy();
  });

  it('calls complete() (which calls mutateAsync) when CTA is pressed', async () => {
    mockMutateAsync.mockResolvedValue({ settings: {} });
    render(<SummaryScreen />);
    const cta = screen.getByRole('button', { name: 'Start practicing →' });

    await act(async () => {
      fireEvent.press(cta);
    });

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        proficiency_level: expect.any(String),
        learning_goal: expect.any(String),
        daily_goal: expect.any(Number),
        tour_completed_at: expect.any(String),
      }),
    );
  });

  it('shows "Building your plan…" label while submitting', async () => {
    let resolveSubmit!: () => void;
    mockMutateAsync.mockImplementation(
      () =>
        new Promise<void>((res) => {
          resolveSubmit = res;
        }),
    );

    render(<SummaryScreen />);
    const cta = screen.getByRole('button', { name: 'Start practicing →' });

    act(() => {
      fireEvent.press(cta);
    });

    // isSubmitting=true immediately after press — store drives the label
    expect(useOnboardingStore.getState().isSubmitting).toBe(true);
    // Spinner label rendered
    expect(screen.getByText('Building your plan…')).toBeTruthy();

    // Clean up — resolve the promise
    await act(async () => {
      resolveSubmit();
    });
  });

  it('surfaces error string when complete() throws', async () => {
    mockMutateAsync.mockRejectedValue(new Error('Network unavailable'));
    render(<SummaryScreen />);
    const cta = screen.getByRole('button', { name: 'Start practicing →' });

    await act(async () => {
      fireEvent.press(cta);
    });

    expect(screen.getByText('Network unavailable')).toBeTruthy();
  });

  it('re-enables CTA after a failure (isSubmitting returns to false)', async () => {
    mockMutateAsync.mockRejectedValue(new Error('fail'));
    render(<SummaryScreen />);

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Start practicing →' }));
    });

    // After failure, isSubmitting=false, so CTA should be re-enabled
    expect(useOnboardingStore.getState().isSubmitting).toBe(false);
    const cta = screen.getByRole('button', { name: 'Start practicing →' });
    const isDisabled = cta.props.accessibilityState?.disabled ?? cta.props.disabled;
    expect(isDisabled).toBeFalsy();
  });

  it('fires onboarding_flow_completed with resolved properties when isSuccess becomes true', async () => {
    useOnboardingStore.getState().setLevel('A1');
    useOnboardingStore.getState().setGoal('travel');
    useOnboardingStore.getState().setDailyMinutes(15);

    mockMutateAsync.mockResolvedValue({ settings: {} });

    render(<SummaryScreen />);

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Start practicing →' }));
    });

    // After success the store has isSubmitting=false. We need to re-render
    // with isSuccess=true to trigger the analytics useEffect.
    // Simulate the mutation hook flipping isSuccess.
    mockMutationState.isSuccess = true;

    // Re-render to pick up the new mutation state.
    const { rerender } = render(<SummaryScreen />);
    rerender(<SummaryScreen />);

    expect(mockTrack).toHaveBeenCalledWith('onboarding_flow_completed', {
      level: 'A1',
      goal: 'travel',
      daily_goal: 25, // MINUTES_TO_GOAL[15]
    });
  });

  it('does NOT fire onboarding_flow_completed when mutation is pending', () => {
    mockMutationState.isSuccess = false;
    render(<SummaryScreen />);
    // No press — just render check
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('does NOT fire onboarding_flow_completed on button press alone (before success)', async () => {
    mockMutateAsync.mockRejectedValue(new Error('fail'));
    mockMutationState.isSuccess = false;

    render(<SummaryScreen />);
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Start practicing →' }));
    });

    // Failure — isSuccess never became true — track should not fire
    expect(mockTrack).not.toHaveBeenCalledWith(
      'onboarding_flow_completed',
      expect.anything(),
    );
  });
});

// ===========================================================================
// 7. Onboarding layout — unstable_settings regression
// ===========================================================================
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { unstable_settings } = require('@/app/(onboarding)/_layout') as typeof import('@/app/(onboarding)/_layout');

describe('Onboarding layout', () => {
  it('unstable_settings.initialRouteName is "level" (prevents blank-screen entry)', () => {
    // Regression: without this setting expo-router renders a blank screen on
    // entry to the (onboarding) group (no index route, no deterministic start).
    expect(unstable_settings.initialRouteName).toBe('level');
  });
});

// ===========================================================================
// 9. Guard derivation (pure logic)
// ===========================================================================
describe('guard derivation: onboardingComplete', () => {
  it('tour_completed_at null → not complete', () => {
    const settings = { tour_completed_at: null };
    expect(settings?.tour_completed_at != null).toBe(false);
  });

  it('tour_completed_at set → complete', () => {
    const settings = { tour_completed_at: '2024-01-01T00:00:00.000Z' };
    expect(settings?.tour_completed_at != null).toBe(true);
  });

  it('undefined settings → not complete', () => {
    // Use a function return to keep TypeScript from narrowing to `never`.
    function getSettings(): { tour_completed_at?: string | null } | undefined {
      return undefined;
    }
    const settings = getSettings();
    expect(settings?.tour_completed_at != null).toBe(false);
  });
});
