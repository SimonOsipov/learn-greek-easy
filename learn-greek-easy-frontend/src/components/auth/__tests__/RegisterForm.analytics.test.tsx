/**
 * RegisterForm PostHog Analytics Tests (PERF-24-02, Mode A — RED)
 *
 * AC-2 requires that on the auto-confirm signup success path (signUp resolves
 * with a session — no email-verification step), RegisterForm identifies and
 * tracks the new user through the DEFERRED @/lib/analytics seam
 * (getPosthogInstance() / track()) rather than a statically-imported
 * `posthog-js` singleton.
 *
 * On the CURRENT implementation, RegisterForm calls `posthog.identify(...)` /
 * `posthog.capture('user_signed_up', ...)` on the STATIC
 * `import posthog from 'posthog-js'` (globally mocked once, module-wide, in
 * test-setup.ts) — a different object than the one injected here via
 * __setPosthogInstance(). The assertion below fails today; it is expected to
 * go GREEN once the executor migrates RegisterForm onto the seam.
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

    // FAILS today: RegisterForm's identify/capture calls hit the statically
    // imported posthog-js mock (test-setup.ts), never the object injected
    // here via __setPosthogInstance.
    expect(mockIdentify).toHaveBeenCalledWith(
      'user-123',
      expect.objectContaining({ email: 'demo@learngreekeasy.com' })
    );
    expect(mockCapture).toHaveBeenCalledWith('user_signed_up', { method: 'email' });
  });
});
