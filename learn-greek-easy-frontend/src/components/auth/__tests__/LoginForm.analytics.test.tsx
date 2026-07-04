/**
 * LoginForm PostHog Analytics Tests (PERF-24-02, Mode A — RED)
 *
 * AC-2 requires that once a user logs in successfully, LoginForm identifies
 * and tracks the user through the DEFERRED @/lib/analytics seam
 * (getPosthogInstance() / track()) — the same instance PostHogProvider
 * installs via __setPosthogInstance() once its dynamic `import('posthog-js')`
 * resolves post-paint — rather than a statically-imported `posthog-js`
 * singleton.
 *
 * On the CURRENT implementation, LoginForm calls `posthog.identify(...)` /
 * `posthog.capture(...)` on the STATIC `import posthog from 'posthog-js'`
 * (globally mocked once, module-wide, in test-setup.ts). That static-mocked
 * object is a completely different object than the one we inject here via
 * __setPosthogInstance(), so the assertions below fail today — they are
 * expected to go GREEN once the executor migrates LoginForm onto the seam.
 *
 * AC-3 (no-throw when posthog is null) is included for completeness; see the
 * note on that test for why it does not gate on current behavior.
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

    // FAILS today: LoginForm's identify/capture calls hit the statically
    // imported posthog-js mock (test-setup.ts), never the object injected
    // here via __setPosthogInstance.
    expect(mockIdentify).toHaveBeenCalledWith(
      'user-123',
      expect.objectContaining({ email: 'demo@learngreekeasy.com' })
    );
    expect(mockCapture).toHaveBeenCalledWith('user_logged_in', { method: 'email' });
  });

  it('does not throw and still navigates when the deferred posthog instance is null (AC-3)', async () => {
    // NOTE: on CURRENT code this assertion does not gate red/green — the
    // static `import posthog from 'posthog-js'` is always the test-setup.ts
    // mock object (never actually null), so __setPosthogInstance(null) has no
    // effect on today's code path and this test currently PASSES. It becomes
    // a real regression guard once LoginForm is migrated onto the seam,
    // where getPosthogInstance() really can return null pre-hydration.
    __setPosthogInstance(null);

    const user = userEvent.setup();
    renderLoginForm();

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(screen.getByText('Dashboard Destination')).toBeInTheDocument();
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});
