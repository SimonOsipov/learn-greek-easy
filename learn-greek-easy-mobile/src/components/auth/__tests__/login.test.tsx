/// <reference types="jest" />
/**
 * LOGIN-11 (MOB-09) — RNTL component tests for the login screen.
 *
 * Mocking strategy:
 *  - useAuthStore: supports both selector-call form and .getState() static.
 *  - useAuth:      returns { isLoading: false } by default.
 *  - @/lib/analytics: track is a jest.fn().
 *  - Heavy native modules (reanimated, linear-gradient, safe-area, image-background)
 *    are mocked so jest-expo can render the component tree.
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mock: react-native-reanimated — minimal inline mock (v4 mock.js pulls in
// react-native-worklets native which is unavailable in jest).
// We only need useSharedValue, useAnimatedStyle, withTiming, and Animated.View.
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
// Mock: expo-linear-gradient — renders children only (no native blur/gradient).
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
// Mock: react-native's ImageBackground — renders children, no image loading.
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
// Mock: react-native-safe-area-context — thin stub.
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
// Mock: nativewind — no-op via __mocks__/nativewind.js (avoids factory hoisting
// conflict with nativewind's babel transform injecting _ReactNativeCSSInterop).
// ---------------------------------------------------------------------------
jest.mock('nativewind');

// ---------------------------------------------------------------------------
// Mock: lucide-react-native — stub each icon as a simple View so react-native-svg
// variants don't need to render in the test environment.
// ---------------------------------------------------------------------------
jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  const stub = (props: Record<string, unknown>) =>
    ce(View, { testID: 'icon', ...props } as any);
  return { AlertCircle: stub, Eye: stub, EyeOff: stub };
});

// ---------------------------------------------------------------------------
// Mock: @/components/icons/GoogleIcon — stub.
// ---------------------------------------------------------------------------
jest.mock('@/components/icons/GoogleIcon', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  return {
    GoogleIcon: () => ce(View, { testID: 'google-icon' }),
  };
});

// ---------------------------------------------------------------------------
// Mock: @/lib/analytics — track is a spy; identifyUser/resetIdentity are no-ops.
// ---------------------------------------------------------------------------
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({
  track: (...args: unknown[]) => mockTrack(...args),
  identifyUser: jest.fn(),
  resetIdentity: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Mock: @/hooks/use-auth — returns { isLoading: false } by default.
// Reassignable per test via mockUseAuth.
// ---------------------------------------------------------------------------
const mockUseAuth = jest.fn();
jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}));

// ---------------------------------------------------------------------------
// Mock: @/stores/auth-store
//
// Supports BOTH:
//   useAuthStore((s) => s.someField)  — selector-call form
//   useAuthStore.getState()           — static accessor (used in success guards)
//
// `mockState` is a mutable object so individual tests can override fields.
// ---------------------------------------------------------------------------
const mockState: {
  isSubmitting: boolean;
  error: string | null;
  isLoading: boolean;
  signIn: jest.Mock;
  signUp: jest.Mock;
  signInWithGoogle: jest.Mock;
  clearError: jest.Mock;
} = {
  isSubmitting: false,
  error: null,
  isLoading: false,
  signIn: jest.fn(),
  signUp: jest.fn(),
  signInWithGoogle: jest.fn(),
  clearError: jest.fn(),
};

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: Object.assign(
    jest.fn((sel: (s: typeof mockState) => unknown) => sel(mockState)),
    { getState: () => mockState },
  ),
}));

// ---------------------------------------------------------------------------
// Subject under test
// ---------------------------------------------------------------------------
// Import AFTER all mocks are registered.
import LoginScreen from '@/app/(auth)/login';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function resetState() {
  mockState.isSubmitting = false;
  mockState.error = null;
  mockState.isLoading = false;
  mockState.signIn.mockReset();
  mockState.signUp.mockReset();
  mockState.signInWithGoogle.mockReset();
  mockState.clearError.mockReset();
  mockTrack.mockReset();
  mockUseAuth.mockReturnValue({ isLoading: false, session: null, user: null });
}

const VALID_EMAIL = 'test@example.com';
const VALID_PASSWORD = 'password123';

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('LoginScreen', () => {
  beforeEach(() => {
    resetState();
  });

  // -------------------------------------------------------------------------
  // 1. Mode toggle
  // -------------------------------------------------------------------------
  describe('mode toggle', () => {
    it('starts in signin mode with "Welcome back" heading', () => {
      render(<LoginScreen />);
      expect(screen.getByText('Welcome back')).toBeTruthy();
    });

    it('switches to signup mode showing "Start learning Greek" heading', () => {
      render(<LoginScreen />);
      fireEvent.press(screen.getByRole('tab', { name: 'Sign up' }));
      expect(screen.getByText('Start learning Greek')).toBeTruthy();
    });

    it('switching back to signin shows "Welcome back" again', () => {
      render(<LoginScreen />);
      fireEvent.press(screen.getByRole('tab', { name: 'Sign up' }));
      fireEvent.press(screen.getByRole('tab', { name: 'Sign in' }));
      expect(screen.getByText('Welcome back')).toBeTruthy();
    });

    it('preserves typed email and password across mode switch', () => {
      render(<LoginScreen />);
      const emailInput = screen.getByPlaceholderText('you@example.com');
      const passwordInput = screen.getByPlaceholderText('••••••••');

      fireEvent.changeText(emailInput, VALID_EMAIL);
      fireEvent.changeText(passwordInput, VALID_PASSWORD);

      fireEvent.press(screen.getByRole('tab', { name: 'Sign up' }));

      expect(screen.getByDisplayValue(VALID_EMAIL)).toBeTruthy();
      expect(screen.getByDisplayValue(VALID_PASSWORD)).toBeTruthy();
    });

    it('calls clearError when switching mode', () => {
      render(<LoginScreen />);
      fireEvent.press(screen.getByRole('tab', { name: 'Sign up' }));
      expect(mockState.clearError).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // 2. formValid gating
  // -------------------------------------------------------------------------
  describe('formValid gating', () => {
    it('CTA is disabled when email and password are empty', () => {
      render(<LoginScreen />);
      const cta = screen.getByRole('button', { name: 'Sign in' });
      expect(cta.props.accessibilityState?.disabled ?? cta.props.disabled).toBe(true);
    });

    it('CTA is disabled with valid email but short password', () => {
      render(<LoginScreen />);
      fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), VALID_EMAIL);
      fireEvent.changeText(
        screen.getByPlaceholderText('••••••••'),
        '12345',
      ); // 5 chars
      const cta = screen.getByRole('button', { name: 'Sign in' });
      expect(cta.props.accessibilityState?.disabled ?? cta.props.disabled).toBe(true);
    });

    it('CTA is disabled with invalid email and sufficient password', () => {
      render(<LoginScreen />);
      fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'notanemail');
      fireEvent.changeText(
        screen.getByPlaceholderText('••••••••'),
        VALID_PASSWORD,
      );
      const cta = screen.getByRole('button', { name: 'Sign in' });
      expect(cta.props.accessibilityState?.disabled ?? cta.props.disabled).toBe(true);
    });

    it('pressing disabled CTA does not call signIn', () => {
      render(<LoginScreen />);
      // Fields empty — CTA disabled
      fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
      expect(mockState.signIn).not.toHaveBeenCalled();
    });

    it('CTA becomes enabled with valid email and password >= 6 chars', () => {
      render(<LoginScreen />);
      fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), VALID_EMAIL);
      fireEvent.changeText(
        screen.getByPlaceholderText('••••••••'),
        VALID_PASSWORD,
      );
      const cta = screen.getByRole('button', { name: 'Sign in' });
      const isDisabled = cta.props.accessibilityState?.disabled ?? cta.props.disabled;
      expect(isDisabled).toBeFalsy();
    });
  });

  // -------------------------------------------------------------------------
  // 3. Invalid-email blur message
  // -------------------------------------------------------------------------
  describe('email blur validation', () => {
    it('shows inline error after blur with invalid email', () => {
      render(<LoginScreen />);
      const emailInput = screen.getByPlaceholderText('you@example.com');
      fireEvent.changeText(emailInput, 'bademail');
      fireEvent(emailInput, 'blur');
      expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
    });

    it('does not show inline error for a valid email on blur', () => {
      render(<LoginScreen />);
      const emailInput = screen.getByPlaceholderText('you@example.com');
      fireEvent.changeText(emailInput, VALID_EMAIL);
      fireEvent(emailInput, 'blur');
      expect(screen.queryByText('Enter a valid email address.')).toBeNull();
    });

    it('clears inline error when user starts correcting the email', () => {
      render(<LoginScreen />);
      const emailInput = screen.getByPlaceholderText('you@example.com');
      fireEvent.changeText(emailInput, 'bademail');
      fireEvent(emailInput, 'blur');
      expect(screen.getByText('Enter a valid email address.')).toBeTruthy();

      fireEvent.changeText(emailInput, 'bademail@');
      expect(screen.queryByText('Enter a valid email address.')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 4. Submit dispatch
  // -------------------------------------------------------------------------
  describe('submit dispatch', () => {
    it('calls signIn(email, password) in signin mode', async () => {
      mockState.signIn.mockResolvedValue(undefined);
      render(<LoginScreen />);
      fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), VALID_EMAIL);
      fireEvent.changeText(
        screen.getByPlaceholderText('••••••••'),
        VALID_PASSWORD,
      );

      await act(async () => {
        fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
      });

      expect(mockState.signIn).toHaveBeenCalledWith(VALID_EMAIL, VALID_PASSWORD);
      expect(mockState.signUp).not.toHaveBeenCalled();
    });

    it('calls signUp(email, password) in signup mode', async () => {
      mockState.signUp.mockResolvedValue(undefined);
      render(<LoginScreen />);
      fireEvent.press(screen.getByRole('tab', { name: 'Sign up' }));
      fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), VALID_EMAIL);
      fireEvent.changeText(
        screen.getByPlaceholderText('••••••••'),
        VALID_PASSWORD,
      );

      await act(async () => {
        fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
      });

      expect(mockState.signUp).toHaveBeenCalledWith(VALID_EMAIL, VALID_PASSWORD);
      expect(mockState.signIn).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 5. Friendly error banner
  // -------------------------------------------------------------------------
  describe('friendly error banner', () => {
    it('renders the friendly copy for "Invalid login credentials"', () => {
      mockState.error = 'Invalid login credentials';
      render(<LoginScreen />);
      expect(
        screen.getByText(
          "That email or password doesn’t match. Give it another try.",
        ),
      ).toBeTruthy();
    });

    it('renders raw error message for other errors', () => {
      mockState.error = 'Email not confirmed';
      render(<LoginScreen />);
      expect(screen.getByText('Email not confirmed')).toBeTruthy();
    });

    it('renders no banner when there is no error', () => {
      mockState.error = null;
      render(<LoginScreen />);
      expect(
        screen.queryByText(
          "That email or password doesn’t match. Give it another try.",
        ),
      ).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 6. Social buttons: Apple absent / Google present
  // -------------------------------------------------------------------------
  describe('social buttons', () => {
    it('Google button is present', () => {
      render(<LoginScreen />);
      expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeTruthy();
    });

    it('no Apple button exists', () => {
      render(<LoginScreen />);
      expect(screen.queryByRole('button', { name: /apple/i })).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 7. Analytics
  // -------------------------------------------------------------------------
  describe('analytics', () => {
    it('fires track("user_logged_in", { method: "email" }) on successful signin', async () => {
      // signIn resolves and leaves error null (already null from resetState)
      mockState.signIn.mockImplementation(async () => {});
      render(<LoginScreen />);
      fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), VALID_EMAIL);
      fireEvent.changeText(
        screen.getByPlaceholderText('••••••••'),
        VALID_PASSWORD,
      );

      await act(async () => {
        fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
      });

      expect(mockTrack).toHaveBeenCalledWith('user_logged_in', { method: 'email' });
    });

    it('fires track("user_signed_up", { method: "email" }) on successful signup', async () => {
      mockState.signUp.mockImplementation(async () => {});
      render(<LoginScreen />);
      fireEvent.press(screen.getByRole('tab', { name: 'Sign up' }));
      fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), VALID_EMAIL);
      fireEvent.changeText(
        screen.getByPlaceholderText('••••••••'),
        VALID_PASSWORD,
      );

      await act(async () => {
        fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
      });

      expect(mockTrack).toHaveBeenCalledWith('user_signed_up', { method: 'email' });
    });

    it('does NOT fire track when signin fails (getState().error is truthy)', async () => {
      mockState.signIn.mockImplementation(async () => {
        // simulate failure: set error on mockState so getState().error is truthy
        mockState.error = 'Invalid login credentials';
      });
      render(<LoginScreen />);
      fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), VALID_EMAIL);
      fireEvent.changeText(
        screen.getByPlaceholderText('••••••••'),
        VALID_PASSWORD,
      );

      await act(async () => {
        fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
      });

      expect(mockTrack).not.toHaveBeenCalled();
    });
  });
});
