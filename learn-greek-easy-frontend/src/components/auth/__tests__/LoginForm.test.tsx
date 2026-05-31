/**
 * LoginForm Unit Tests
 *
 * Covers the primary email/password auth flow:
 * - successful login populates the auth store + navigates to /dashboard
 * - role derivation: effective_role ?? (is_superuser ? 'admin' : 'free')
 * - mapSupabaseError key mapping (incl. unknown fallthrough)
 * - return-to redirect honored via location.state.from
 *
 * Supabase client is globally mocked in src/lib/test-setup.ts; authAPI is
 * mocked per-file (matching the sibling RegisterForm / ProtectedRoute tests).
 */

import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import i18n from '@/i18n';
import { supabase } from '@/lib/supabaseClient';
import { authAPI } from '@/services/authAPI';
import type { UserProfileResponse } from '@/services/authAPI';
import { useAuthStore } from '@/stores/authStore';

import { LoginForm } from '../LoginForm';

// authAPI is imported by LoginForm but not globally mocked
vi.mock('@/services/authAPI', () => ({
  authAPI: {
    getProfile: vi.fn(),
  },
}));

// Typed handles to the globally-mocked supabase auth methods
const signInWithPassword = supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>;
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

/**
 * Render LoginForm inside a router so navigation lands on a sentinel route.
 * Accepts an optional location state (for return-to redirect testing).
 */
function renderLoginForm(
  initialEntries: Array<string | { pathname: string; state: unknown }> = ['/login']
) {
  return rtlRender(
    <I18nextProvider i18n={i18n}>
      <LanguageProvider>
        <ThemeProvider>
          <MemoryRouter initialEntries={initialEntries}>
            <Routes>
              <Route path="/login" element={<LoginForm />} />
              <Route path="/dashboard" element={<div>Dashboard Destination</div>} />
              <Route path="/decks" element={<div>Decks Destination</div>} />
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

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    // Default: supabase auth succeeds
    signInWithPassword.mockResolvedValue({
      data: { user: { id: 'supabase-user', email: 'demo@learngreekeasy.com' } },
      error: null,
    });
    getProfile.mockResolvedValue(baseProfile);
  });

  describe('successful login', () => {
    it('populates the auth store and navigates to /dashboard', async () => {
      const user = userEvent.setup();
      renderLoginForm();

      await fillAndSubmit(user);

      // Lands on the default destination
      await waitFor(() => {
        expect(screen.getByText('Dashboard Destination')).toBeInTheDocument();
      });

      // Store is populated from the profile response
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.error).toBeNull();
      expect(state.user).toMatchObject({
        id: 'user-123',
        email: 'demo@learngreekeasy.com',
        name: 'Demo User',
      });

      // Supabase called with the entered credentials
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: 'demo@learngreekeasy.com',
        password: 'password123',
      });
    });
  });

  describe('role derivation: effective_role ?? (is_superuser ? admin : free)', () => {
    it('uses effective_role when present', async () => {
      getProfile.mockResolvedValue({
        ...baseProfile,
        effective_role: 'premium',
        is_superuser: true,
      });
      const user = userEvent.setup();
      renderLoginForm();

      await fillAndSubmit(user);

      await waitFor(() => {
        expect(useAuthStore.getState().user?.role).toBe('premium');
      });
    });

    it('falls back to admin when effective_role absent and is_superuser true', async () => {
      getProfile.mockResolvedValue({
        ...baseProfile,
        effective_role: undefined,
        is_superuser: true,
      });
      const user = userEvent.setup();
      renderLoginForm();

      await fillAndSubmit(user);

      await waitFor(() => {
        expect(useAuthStore.getState().user?.role).toBe('admin');
      });
    });

    it('falls back to free when effective_role absent and is_superuser false', async () => {
      getProfile.mockResolvedValue({
        ...baseProfile,
        effective_role: undefined,
        is_superuser: false,
      });
      const user = userEvent.setup();
      renderLoginForm();

      await fillAndSubmit(user);

      await waitFor(() => {
        expect(useAuthStore.getState().user?.role).toBe('free');
      });
    });
  });

  describe('mapSupabaseError key mapping', () => {
    it('maps invalid login credentials to the translated invalidCredentials message', async () => {
      // Supabase SDK surfaces errors as Error instances (AuthError); the
      // component only maps errors that pass `instanceof Error`.
      signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: new Error('Invalid login credentials'),
      });
      const user = userEvent.setup();
      renderLoginForm();

      await fillAndSubmit(user);

      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toHaveTextContent(
          'Login failed. Please check your credentials and try again.'
        );
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(getProfile).not.toHaveBeenCalled();
    });

    it('maps "Email not confirmed" to the requiresVerification message', async () => {
      signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: new Error('Email not confirmed'),
      });
      const user = userEvent.setup();
      renderLoginForm();

      await fillAndSubmit(user);

      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toHaveTextContent(
          'Please verify your email first'
        );
      });
    });

    it('maps "Too many requests" to the tooManyAttempts message', async () => {
      signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: new Error('Too many requests'),
      });
      const user = userEvent.setup();
      renderLoginForm();

      await fillAndSubmit(user);

      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toHaveTextContent(
          'Too many attempts. Please try again later.'
        );
      });
    });

    it('falls through to the raw message for an unknown Supabase error', async () => {
      signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: new Error('Some unexpected backend failure'),
      });
      const user = userEvent.setup();
      renderLoginForm();

      await fillAndSubmit(user);

      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toHaveTextContent(
          'Some unexpected backend failure'
        );
      });
    });
  });

  describe('return-to redirect', () => {
    it('navigates to location.state.from when present', async () => {
      const user = userEvent.setup();
      renderLoginForm([{ pathname: '/login', state: { from: '/decks' } }]);

      await fillAndSubmit(user);

      await waitFor(() => {
        expect(screen.getByText('Decks Destination')).toBeInTheDocument();
      });
      expect(screen.queryByText('Dashboard Destination')).not.toBeInTheDocument();
    });
  });
});
