/**
 * RegisterForm PostHog Analytics Tests (PERF-24-02, Mode B — verified GREEN)
 *
 * AC-2 requires that on the auto-confirm signup success path (signUp resolves
 * with a session — no email-verification step), RegisterForm identifies and
 * tracks the new user through the DEFERRED @/lib/analytics seam
 * (getPosthogInstance() / track()) rather than a statically-imported
 * `posthog-js` singleton.
 *
 * RegisterForm now routes identify/capture through the injected seam
 * (`getPosthogInstance()?.identify(...)` / `track('user_signed_up', ...)`),
 * confirmed meaningful by QA: reverting to a static
 * `import posthog from 'posthog-js'` + direct `posthog.identify/capture`
 * calls reproduces the original RED failure on the assertions below.
 *
 * QA adversarial additions (not part of the original RED spec): the exact
 * identify/capture payload-shape lock, the null-instance no-throw guard
 * (mirroring LoginForm AC-3), and the email-confirmation branch below (no
 * session returned) asserting analytics stay silent outside the auto-confirm
 * guard.
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

import { RegisterForm } from '../RegisterForm';

// authAPI is imported by RegisterForm but not globally mocked
vi.mock('@/services/authAPI', () => ({
  authAPI: {
    getProfile: vi.fn(),
  },
}));

// Access the globally-mocked supabase auth methods (mocked in test-setup.ts)
const mockedModule = supabaseClientModule as unknown as {
  supabase: {
    auth: {
      signUp: ReturnType<typeof vi.fn>;
      getSession: ReturnType<typeof vi.fn>;
    };
  };
};
const signUp = mockedModule.supabase.auth.signUp;
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

function renderRegisterForm() {
  return rtlRender(
    <I18nextProvider i18n={i18n}>
      <LanguageProvider>
        <ThemeProvider>
          <MemoryRouter initialEntries={['/register']}>
            <Routes>
              <Route path="/register" element={<RegisterForm />} />
              <Route path="/dashboard" element={<div>Dashboard Destination</div>} />
            </Routes>
          </MemoryRouter>
        </ThemeProvider>
      </LanguageProvider>
    </I18nextProvider>
  );
}

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  email = 'demo@learngreekeasy.com',
  password = 'password123'
) {
  await screen.findByTestId('email-input');
  await user.type(screen.getByTestId('email-input'), email);
  await user.type(screen.getByTestId('password-input'), password);
  const termsCheckbox = document.getElementById('acceptedTerms');
  await user.click(termsCheckbox!);
  await user.click(screen.getByTestId('register-submit'));
}

describe('RegisterForm PostHog analytics via the deferred seam (auto-confirm path)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    // Auto-confirm: signUp resolves with a session present (no email verification needed)
    signUp.mockResolvedValue({
      data: { user: { id: 'test-user-id' }, session: { access_token: 'tok' } },
      error: null,
    });
    getSession.mockResolvedValue({ data: { session: stubSession } });
    getProfile.mockResolvedValue(baseProfile);
  });

  afterEach(() => {
    signUp.mockReset();
    __setPosthogInstance(null);
  });

  it('identifies and captures user_signed_up through the injected deferred posthog instance (AC-2)', async () => {
    const mockIdentify = vi.fn();
    const mockCapture = vi.fn();
    __setPosthogInstance({
      identify: mockIdentify,
      capture: mockCapture,
    } as unknown as import('posthog-js').PostHog);

    const user = userEvent.setup();
    renderRegisterForm();

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(screen.getByText('Dashboard Destination')).toBeInTheDocument();
    });

    expect(mockIdentify).toHaveBeenCalledWith(
      'user-123',
      expect.objectContaining({ email: 'demo@learngreekeasy.com' })
    );
    expect(mockCapture).toHaveBeenCalledWith('user_signed_up', { method: 'email' });
  });

  it('locks the identify/capture contract shape exactly: { email, created_at } and { method: "email" } (QA adversarial)', async () => {
    const mockIdentify = vi.fn();
    const mockCapture = vi.fn();
    __setPosthogInstance({
      identify: mockIdentify,
      capture: mockCapture,
    } as unknown as import('posthog-js').PostHog);

    const user = userEvent.setup();
    renderRegisterForm();

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
    expect(mockCapture).toHaveBeenCalledWith('user_signed_up', { method: 'email' });
    expect(mockIdentify).toHaveBeenCalledTimes(1);
    // mockCapture also observes ThemeContext's own mount-time
    // track('theme_preference_loaded', ...) call, since both go through the
    // same shared @/lib/analytics seam — so we assert on the specific
    // 'user_signed_up' event count, not the spy's total call count.
    const signupCaptures = mockCapture.mock.calls.filter(([event]) => event === 'user_signed_up');
    expect(signupCaptures).toHaveLength(1);
  });

  it('does not throw and still navigates when the deferred posthog instance is null (QA adversarial, mirrors LoginForm AC-3)', async () => {
    __setPosthogInstance(null);

    const user = userEvent.setup();
    renderRegisterForm();

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(screen.getByText('Dashboard Destination')).toBeInTheDocument();
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('still navigates to /dashboard and shows no auth-failure error when the posthog instance throws (CodeRabbit fix regression guard)', async () => {
    // capture() only throws for the signup-success event — ThemeContext also
    // calls track('theme_preference_loaded', ...) through this same seam on
    // mount, and that unrelated call must keep succeeding (it isn't guarded,
    // and isn't part of the Fix 2 isolation this test targets).
    __setPosthogInstance({
      identify: () => {
        throw new Error('boom');
      },
      capture: (event: string) => {
        if (event === 'user_signed_up') {
          throw new Error('boom');
        }
      },
    } as unknown as import('posthog-js').PostHog);

    const user = userEvent.setup();
    renderRegisterForm();

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

describe('RegisterForm PostHog analytics — email-confirmation branch (QA adversarial)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    // Email confirmation required: signUp resolves with a user but NO session.
    signUp.mockResolvedValue({
      data: { user: { id: 'test-user-id' }, session: null },
      error: null,
    });
    getSession.mockResolvedValue({ data: { session: stubSession } });
    getProfile.mockResolvedValue(baseProfile);
  });

  afterEach(() => {
    signUp.mockReset();
    __setPosthogInstance(null);
  });

  it('fires no identify/capture and shows the verification screen when signUp returns no session', async () => {
    const mockIdentify = vi.fn();
    const mockCapture = vi.fn();
    __setPosthogInstance({
      identify: mockIdentify,
      capture: mockCapture,
    } as unknown as import('posthog-js').PostHog);

    const user = userEvent.setup();
    renderRegisterForm();

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(screen.getByTestId('verification-card')).toBeInTheDocument();
    });

    // Guards against the identify/capture calls accidentally moving outside
    // the `if (authData.session)` auto-confirm guard in RegisterForm.
    // identify has no other caller in this render tree, so a blanket
    // not-called assertion is safe. capture is also driven by ThemeContext's
    // own mount-time track('theme_preference_loaded', ...) call through the
    // same shared seam, so we assert the signup event specifically was never
    // captured rather than asserting capture was never called at all.
    expect(mockIdentify).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalledWith('user_signed_up', expect.anything());
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
