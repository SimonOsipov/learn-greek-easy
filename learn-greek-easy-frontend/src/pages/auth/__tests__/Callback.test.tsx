/**
 * OAuth Callback Component Tests
 *
 * Covers the three cooperating effects on the Supabase OAuth landing page:
 *  1. Hash error param -> renders error card, never navigates.
 *  2. isAuthenticated -> navigates to /dashboard exactly once (hasNavigated guard).
 *  3. No auth within AUTH_TIMEOUT_MS -> renders timeout error card.
 *  4. posthog.identify is called with a valid ISO created_at, and does NOT crash
 *     when user.createdAt is null/Invalid Date.
 */

import posthog from 'posthog-js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { render, screen, waitFor, act } from '@/lib/test-utils';
import type { User } from '@/types/auth';
import { useAuthStore } from '@/stores/authStore';

import { Callback } from '../Callback';

// Mock react-router-dom navigation (BrowserRouter from test-utils still works
// via the `actual` spread).
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('posthog-js', () => ({
  default: { identify: vi.fn(), capture: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const buildUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-123',
  email: 'oauth@example.com',
  name: 'OAuth User',
  role: 'free',
  preferences: { language: 'en', dailyGoal: 20, notifications: true, theme: 'light' },
  stats: { streak: 0, wordsLearned: 0, totalXP: 0, joinedDate: new Date('2025-01-01T00:00:00Z') },
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  ...overrides,
});

const resetAuthStore = () => {
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });
};

const setHash = (hash: string) => {
  window.history.pushState({}, '', `/auth/callback${hash}`);
};

describe('Callback (OAuth landing)', () => {
  beforeEach(() => {
    resetAuthStore();
    mockNavigate.mockClear();
    vi.mocked(posthog.identify).mockClear();
    vi.mocked(posthog.capture).mockClear();
    setHash('');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('hash error param', () => {
    it('renders the error card and does NOT navigate', async () => {
      setHash('#error=access_denied&error_description=User%20denied%20access');

      render(<Callback />);

      await waitFor(() => {
        expect(screen.getByTestId('callback-error-card')).toBeInTheDocument();
      });
      // The decoded error description is shown in the alert
      expect(screen.getByRole('alert')).toHaveTextContent('User denied access');
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('does not navigate even if the store later becomes authenticated', async () => {
      setHash('#error=access_denied&error_description=Denied');

      render(<Callback />);

      await waitFor(() => {
        expect(screen.getByTestId('callback-error-card')).toBeInTheDocument();
      });

      // Auth arrives after the error was already shown — navigation must stay blocked.
      act(() => {
        useAuthStore.setState({ user: buildUser(), isAuthenticated: true });
      });

      await Promise.resolve();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('authenticated', () => {
    it('navigates to /dashboard exactly once', async () => {
      useAuthStore.setState({ user: buildUser(), isAuthenticated: true });

      const { rerender } = render(<Callback />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
      });

      // Re-render should not trigger a second navigation (hasNavigated guard).
      rerender(<Callback />);
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });

    it('calls posthog.identify with a valid ISO created_at and captures login', async () => {
      const createdAt = new Date('2025-03-15T08:30:00Z');
      useAuthStore.setState({ user: buildUser({ createdAt }), isAuthenticated: true });

      render(<Callback />);

      await waitFor(() => {
        expect(posthog.identify).toHaveBeenCalledTimes(1);
      });

      const [, props] = vi.mocked(posthog.identify).mock.calls[0];
      const createdAtProp = (props as { created_at: string }).created_at;
      // Round-trips to a valid ISO string (no NaN / RangeError).
      expect(createdAtProp).toBe('2025-03-15T08:30:00.000Z');
      expect(new Date(createdAtProp).toISOString()).toBe(createdAtProp);

      expect(posthog.capture).toHaveBeenCalledWith('user_logged_in', {
        method: 'oauth_google',
      });
    });

    it('does NOT crash when createdAt is null (FIX) and identify gets undefined created_at', async () => {
      // Simulate a malformed user where createdAt is null at runtime.
      useAuthStore.setState({
        user: buildUser({ createdAt: null as unknown as Date }),
        isAuthenticated: true,
      });

      render(<Callback />);

      await waitFor(() => {
        expect(posthog.identify).toHaveBeenCalledTimes(1);
      });

      const [, props] = vi.mocked(posthog.identify).mock.calls[0];
      expect((props as { created_at?: string }).created_at).toBeUndefined();
      // Navigation still proceeds — the crash would have aborted it.
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });

    it('does NOT crash when createdAt is an Invalid Date (FIX)', async () => {
      useAuthStore.setState({
        user: buildUser({ createdAt: new Date('not-a-date') }),
        isAuthenticated: true,
      });

      render(<Callback />);

      await waitFor(() => {
        expect(posthog.identify).toHaveBeenCalledTimes(1);
      });

      const [, props] = vi.mocked(posthog.identify).mock.calls[0];
      expect((props as { created_at?: string }).created_at).toBeUndefined();
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });

  describe('timeout', () => {
    it('shows the timeout error card after AUTH_TIMEOUT_MS with no auth', async () => {
      vi.useFakeTimers();

      render(<Callback />);

      // Loader while waiting
      expect(screen.getByTestId('page-loader')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(screen.getByTestId('callback-error-card')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(/timed out/i);
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('does not show timeout error if auth completes before the threshold', async () => {
      vi.useFakeTimers();

      const { rerender } = render(<Callback />);

      act(() => {
        useAuthStore.setState({ user: buildUser(), isAuthenticated: true });
      });
      rerender(<Callback />);

      // Navigation happened; advancing past timeout must not surface an error card.
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(screen.queryByTestId('callback-error-card')).not.toBeInTheDocument();
    });
  });
});
