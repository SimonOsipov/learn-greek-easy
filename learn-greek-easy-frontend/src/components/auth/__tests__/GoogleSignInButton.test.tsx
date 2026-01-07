/**
 * GoogleSignInButton Unit Tests
 *
 * Tests for the Google Sign-In button component covering:
 * - Script loading states (loading, ready, error, timeout)
 * - Error boundary behavior
 * - Disabled state rendering
 * - Integration with auth store
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Must mock before importing components that use the hook
vi.mock('@/components/auth/AuthRoutesWrapper', () => ({
  useGSIScriptState: vi.fn(() => ({
    isScriptReady: true,
    hasScriptError: false,
  })),
}));

// Mock the auth store
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    loginWithGoogle: vi.fn(),
    isLoading: false,
  })),
}));

import { GoogleSignInButton } from '../GoogleSignInButton';
import { useGSIScriptState } from '@/components/auth/AuthRoutesWrapper';
import { useAuthStore } from '@/stores/authStore';

// Cast to mockable functions
const mockUseGSIScriptState = useGSIScriptState as ReturnType<typeof vi.fn>;
const mockUseAuthStore = useAuthStore as ReturnType<typeof vi.fn>;

describe('GoogleSignInButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up default mock state
    mockUseGSIScriptState.mockReturnValue({
      isScriptReady: true,
      hasScriptError: false,
    });
    mockUseAuthStore.mockReturnValue({
      loginWithGoogle: vi.fn().mockResolvedValue(undefined),
      isLoading: false,
    });
    // Mock VITE_GOOGLE_CLIENT_ID
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('when Google OAuth is not configured', () => {
    it('renders nothing when VITE_GOOGLE_CLIENT_ID is not set', () => {
      vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
      const { container } = render(<GoogleSignInButton />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('script loading states', () => {
    it('shows loading state when script is not ready', () => {
      mockUseGSIScriptState.mockReturnValue({
        isScriptReady: false,
        hasScriptError: false,
      });

      render(<GoogleSignInButton />);

      // Should show loading text
      expect(screen.getByText('Loading Google Sign-In...')).toBeInTheDocument();
      // Button should be disabled
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('shows Google Login button when script is ready', async () => {
      mockUseGSIScriptState.mockReturnValue({
        isScriptReady: true,
        hasScriptError: false,
      });

      render(<GoogleSignInButton />);

      // Should show the mocked Google Login button
      await waitFor(() => {
        expect(screen.getByTestId('google-login-mock')).toBeInTheDocument();
      });
    });

    it('shows fallback when script fails to load', () => {
      mockUseGSIScriptState.mockReturnValue({
        isScriptReady: false,
        hasScriptError: true,
      });

      render(<GoogleSignInButton />);

      // Should show unavailable text
      expect(screen.getByText('Google Sign-In unavailable')).toBeInTheDocument();
      // Button should be disabled
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('shows fallback when script times out', async () => {
      vi.useFakeTimers();

      mockUseGSIScriptState.mockReturnValue({
        isScriptReady: false,
        hasScriptError: false,
      });

      render(<GoogleSignInButton />);

      // Initially shows loading
      expect(screen.getByText('Loading Google Sign-In...')).toBeInTheDocument();

      // Fast-forward past the timeout (10 seconds)
      // Using act to ensure React processes all state updates
      await act(async () => {
        vi.advanceTimersByTime(10001);
      });

      // After advancing fake timers, state should already be updated
      // No waitFor needed - the setTimeout callback has already fired
      expect(screen.getByText('Google Sign-In unavailable')).toBeInTheDocument();

      vi.useRealTimers();
    });
  });

  describe('disabled state', () => {
    it('shows disabled button with Google icon when disabled prop is true', () => {
      render(<GoogleSignInButton disabled />);

      // In disabled state, data-testid IS the button element (not a wrapper)
      const buttonElement = screen.getByTestId('google-signin-button');
      expect(buttonElement.tagName).toBe('BUTTON');
      expect(buttonElement).toBeDisabled();
      expect(screen.getByText('Continue with Google')).toBeInTheDocument();
    });

    it('shows disabled button when auth store is loading', () => {
      mockUseAuthStore.mockReturnValue({
        loginWithGoogle: vi.fn(),
        isLoading: true,
      });

      render(<GoogleSignInButton />);

      // In loading state, data-testid IS the button element (not a wrapper)
      const buttonElement = screen.getByTestId('google-signin-button');
      expect(buttonElement.tagName).toBe('BUTTON');
      expect(buttonElement).toBeDisabled();
    });

    it('shows signing in state during Google login', async () => {
      const user = userEvent.setup();
      let resolveLogin: () => void;
      const loginPromise = new Promise<void>((resolve) => {
        resolveLogin = resolve;
      });

      mockUseAuthStore.mockReturnValue({
        loginWithGoogle: vi.fn().mockReturnValue(loginPromise),
        isLoading: false,
      });

      render(<GoogleSignInButton />);

      // Click the Google login button
      const googleButton = screen.getByTestId('google-login-mock');
      await user.click(googleButton);

      // Should show signing in state
      await waitFor(() => {
        expect(screen.getByText('Signing in...')).toBeInTheDocument();
      });

      // Resolve the login
      await act(async () => {
        resolveLogin!();
      });
    });
  });

  describe('success and error callbacks', () => {
    it('calls onSuccess callback on successful login', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();

      mockUseAuthStore.mockReturnValue({
        loginWithGoogle: vi.fn().mockResolvedValue(undefined),
        isLoading: false,
      });

      render(<GoogleSignInButton onSuccess={onSuccess} />);

      const googleButton = screen.getByTestId('google-login-mock');
      await user.click(googleButton);

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('calls onError callback when login fails', async () => {
      const user = userEvent.setup();
      const onError = vi.fn();

      mockUseAuthStore.mockReturnValue({
        loginWithGoogle: vi.fn().mockRejectedValue(new Error('Login failed')),
        isLoading: false,
      });

      render(<GoogleSignInButton onError={onError} />);

      const googleButton = screen.getByTestId('google-login-mock');
      await user.click(googleButton);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('Login failed');
      });
    });
  });

  describe('className prop', () => {
    it('applies custom className to container', () => {
      render(<GoogleSignInButton className="my-custom-class" />);

      const container = screen.getByTestId('google-signin-button');
      expect(container).toHaveClass('my-custom-class');
    });
  });
});
