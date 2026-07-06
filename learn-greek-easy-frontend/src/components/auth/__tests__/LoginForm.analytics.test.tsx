/**
 * LoginForm PostHog Analytics Tests (PERF-24-02, Mode B — verified GREEN)
 *
 * AC-2 requires that once a user logs in successfully, LoginForm identifies
 * and tracks the user through the DEFERRED @/lib/analytics seam
 * (getPosthogInstance() / track()) — the same instance PostHogProvider
 * installs via __setPosthogInstance() once its dynamic `import('posthog-js')`
 * resolves post-paint — rather than a statically-imported `posthog-js`
 * singleton.
 *
 * LoginForm now routes identify/capture through the injected seam
 * (`getPosthogInstance()?.identify(...)` / `track('user_logged_in', ...)`),
 * confirmed meaningful by QA: reverting to a static
 * `import posthog from 'posthog-js'` + direct `posthog.identify/capture`
 * calls reproduces the original RED failure on the assertion below.
 *
 * AC-3 (no-throw when posthog is null) is a real regression guard now that
 * getPosthogInstance() can genuinely return null pre-hydration.
 */

import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import i18n from '@/i18n';
import { __setPosthogInstance } from '@/lib/analytics';
import * as supabaseClientModule from '@/lib/supabaseClient';
import { authAPI } from '@/services/authAPI';
import type { UserProfileResponse } from '@/services/authAPI';
import { useAuthStore } from '@/stores/authStore';

import { LoginForm } from '../LoginForm';

// authAPI is called by authStore.checkAuth (not directly by LoginForm any more)
vi.mock('@/services/authAPI', () => ({
  authAPI: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
  },
}));

// Typed handles to the globally-mocked supabase auth methods (test-setup.ts)
const mockedModule = supabaseClientModule as unknown as {
  supabase: {
    auth: { signInWithPassword: ReturnType<typeof vi.fn>; getSession: ReturnType<typeof vi.fn> };
  };
};
const signInWithPassword = mockedModule.supabase.auth.signInWithPassword;
const getSession = mockedModule.supabase.auth.getSession;
const getProfile = authAPI.getProfile as ReturnType<typeof vi.fn>;

const baseProfile: UserProfileResponse = {
  id: 'user-123',
  email: 'demo@learngreekeasy.com',
  full_name: 'Demo User',
  avatar_url: null,
  is_active: true,
  is_superuser: false,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-02T00:00:00Z',
};

// A Supabase session stub (enough for checkAuth to proceed past the session guard)
const stubSession = { access_token: 'tok', user: { id: 'supabase-user' } };

function renderLoginForm() {
  return rtlRender(
    <I18nextProvider i18n={i18n}>
      <LanguageProvider>
        <ThemeProvider>
          <MemoryRouter initialEntries={['/login']}>
            <Routes>
              <Route path="/login" element={<LoginForm />} />
              <Route path="/dashboard" element={<div>Dashboard Destination</div>} />
            </Routes>
          </MemoryRouter>
        </ThemeProvider>
      </LanguageProvider>
    </I18nextProvider>
  );
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, password = 'password123') {
  await user.type(screen.getByTestId('email-input'), 'demo@learngreekeasy.com');
  await user.type(screen.getByTestId('password-input'), password);
  await user.click(screen.getByTestId('login-submit'));
}

describe('LoginForm PostHog analytics via the deferred seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    signInWithPassword.mockResolvedValue({
      data: { user: { id: 'supabase-user', email: 'demo@learngreekeasy.com' } },
      error: null,
    });
    getSession.mockResolvedValue({ data: { session: stubSession } });
    getProfile.mockResolvedValue(baseProfile);
  });

  afterEach(() => {
    __setPosthogInstance(null);
  });

  it('identifies and captures user_logged_in through the injected deferred posthog instance (AC-2)', async () => {
    const mockIdentify = vi.fn();
    const mockCapture = vi.fn();
    __setPosthogInstance({
      identify: mockIdentify,
      capture: mockCapture,
    } as unknown as import('posthog-js').PostHog);

    const user = userEvent.setup();
    renderLoginForm();

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(screen.getByText('Dashboard Destination')).toBeInTheDocument();
    });

    expect(mockIdentify).toHaveBeenCalledWith(
      'user-123',
      expect.objectContaining({ email: 'demo@learngreekeasy.com' })
    );
    expect(mockCapture).toHaveBeenCalledWith('user_logged_in', { method: 'email' });
  });

  it('locks the identify/capture contract shape exactly: { email, created_at } and { method: "email" } (QA adversarial)', async () => {
    const mockIdentify = vi.fn();
    const mockCapture = vi.fn();
    __setPosthogInstance({
      identify: mockIdentify,
      capture: mockCapture,
    } as unknown as import('posthog-js').PostHog);

    const user = userEvent.setup();
    renderLoginForm();

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(screen.getByText('Dashboard Destination')).toBeInTheDocument();
    });

    // Exact shape, not just a subset — pins the contract so a future refactor
    // that adds/renames a property is caught.
    expect(mockIdentify).toHaveBeenCalledWith('user-123', {
      email: 'demo@learngreekeasy.com',
      created_at: '2025-01-01T00:00:00.000Z',
    });
    expect(mockCapture).toHaveBeenCalledWith('user_logged_in', { method: 'email' });
    expect(mockIdentify).toHaveBeenCalledTimes(1);
    // mockCapture also observes ThemeContext's own mount-time
    // track('theme_preference_loaded', ...) call, since both go through the
    // same shared @/lib/analytics seam — so we assert on the specific
    // 'user_logged_in' event count, not the spy's total call count.
    const loginCaptures = mockCapture.mock.calls.filter(([event]) => event === 'user_logged_in');
    expect(loginCaptures).toHaveLength(1);
  });

  it('does not throw and still navigates when the deferred posthog instance is null (AC-3)', async () => {
    __setPosthogInstance(null);

    const user = userEvent.setup();
    renderLoginForm();

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(screen.getByText('Dashboard Destination')).toBeInTheDocument();
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('still navigates to the destination and shows no auth-failure error when the posthog instance throws (CodeRabbit fix regression guard)', async () => {
    // capture() only throws for the login-success event — ThemeContext also
    // calls track('theme_preference_loaded', ...) through this same seam on
    // mount, and that unrelated call must keep succeeding (it isn't guarded,
    // and isn't part of the Fix 1 isolation this test targets).
    __setPosthogInstance({
      identify: () => {
        throw new Error('boom');
      },
      capture: (event: string) => {
        if (event === 'user_logged_in') {
          throw new Error('boom');
        }
      },
    } as unknown as import('posthog-js').PostHog);

    const user = userEvent.setup();
    renderLoginForm();

    await fillAndSubmit(user);

    // Without the fix, the throw inside the analytics block bubbles to the
    // outer try/catch, which sets a form error and never navigates.
    await waitFor(() => {
      expect(screen.getByText('Dashboard Destination')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('form-error')).not.toBeInTheDocument();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});
