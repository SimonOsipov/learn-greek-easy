/**
 * RegisterForm Unit Tests
 *
 * Tests the auto-scroll behavior triggered by the onInvalid handler
 * when the form is submitted with validation errors.
 *
 * Also covers AC-6 live scenarios: empty-name submission reaches verification screen,
 * Google signup button is present.
 *
 * Additionally (INFRA-13-03, ported from the deleted Register.integration.test.tsx):
 * - field validation (email/password/terms) via the live Supabase seam
 * - Supabase signup error mapping (emailExists / invalidPassword / fallback)
 * - accessibility (input ARIA attributes)
 * - auto-confirm success path (signUp resolves with a session -> store populated
 *   via checkAuth -> navigate('/dashboard'))
 * - password-visibility eye-icon toggle
 */

import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { render as rtlRender } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import i18n from '@/i18n';
import { render, screen, waitFor } from '@/lib/test-utils';
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

/**
 * Render RegisterForm inside a router so the auto-confirm success path
 * (navigate('/dashboard')) can be observed via a sentinel destination route.
 * Mirrors LoginForm.test.tsx's renderLoginForm helper.
 */
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

/**
 * Fill the RegisterForm with valid email/password, accept terms, and submit.
 * Used by the signup-error-mapping and auto-confirm-success tests, which all
 * need a fully valid submission to reach the supabase.auth.signUp call.
 */
async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  email = 'test@example.com',
  password = 'password123'
) {
  await screen.findByTestId('email-input');
  await user.type(screen.getByTestId('email-input'), email);
  await user.type(screen.getByTestId('password-input'), password);
  const termsCheckbox = document.getElementById('acceptedTerms');
  await user.click(termsCheckbox!);
  await user.click(screen.getByTestId('register-submit'));
}

describe('RegisterForm auto-scroll behavior', () => {
  let scrollSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
  });

  afterEach(() => {
    scrollSpy.mockRestore();
  });

  it('should scroll to the first error field when submitting an empty form', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    const submitButton = screen.getByTestId('register-submit');
    await user.click(submitButton);

    await waitFor(() => {
      // After name becomes optional, the first error on an empty form is email → scroll target shifts
      const emailElement = document.getElementById('email');
      expect(emailElement).not.toBeNull();
      expect(scrollSpy).toHaveBeenCalled();
      expect(scrollSpy.mock.instances.at(-1)).toBe(emailElement);
      expect(scrollSpy).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'center' });
    });
  });

  it('should scroll to the password field when name and email are filled but password is empty', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByTestId('name-input'), 'Test User');
    await user.type(screen.getByTestId('email-input'), 'test@example.com');

    // Check the acceptedTerms checkbox
    const checkbox = document.getElementById('acceptedTerms');
    expect(checkbox).not.toBeNull();
    await user.click(checkbox!);

    const submitButton = screen.getByTestId('register-submit');
    await user.click(submitButton);

    await waitFor(() => {
      const passwordElement = document.getElementById('password');
      expect(passwordElement).not.toBeNull();
      expect(scrollSpy).toHaveBeenCalled();
      expect(scrollSpy.mock.instances.at(-1)).toBe(passwordElement);
      expect(scrollSpy).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'center' });
    });
  });
});

describe('RegisterForm live AC-6 coverage', () => {
  beforeEach(() => {
    // Simulate Supabase confirming the email (no session → verification screen)
    signUp.mockResolvedValue({
      data: { user: { id: 'test-user-id' }, session: null },
      error: null,
    });
  });

  afterEach(() => {
    signUp.mockReset();
  });

  it('submitting with empty name calls signUp once and reaches the verification screen', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    // Leave name empty — should be optional
    await user.type(screen.getByTestId('email-input'), 'test@example.com');
    await user.type(screen.getByTestId('password-input'), 'alllower8');

    const checkbox = document.getElementById('acceptedTerms');
    expect(checkbox).not.toBeNull();
    await user.click(checkbox!);

    await user.click(screen.getByTestId('register-submit'));

    await waitFor(() => {
      expect(signUp).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('verification-card')).toBeInTheDocument();
    });
  });

  it('renders the Google signup button on the registration form', () => {
    render(<RegisterForm />);

    expect(screen.getByTestId('google-signup-button')).toBeInTheDocument();
  });
});

describe('RegisterForm field validation', () => {
  it('shows an error when email is empty', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByTestId('password-input'), 'password123');
    await user.click(document.getElementById('acceptedTerms')!);
    await user.click(screen.getByTestId('register-submit'));

    await waitFor(() => {
      expect(
        screen.getByText(i18n.t('register.errors.emailRequired', { ns: 'auth' }))
      ).toBeInTheDocument();
    });
    expect(signUp).not.toHaveBeenCalled();
  });

  it('shows an error for an invalid email format', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    const emailInput = screen.getByTestId('email-input') as HTMLInputElement;
    await user.type(emailInput, 'invalid@');
    await user.type(screen.getByTestId('password-input'), 'password123');
    await user.click(document.getElementById('acceptedTerms')!);
    await user.click(screen.getByTestId('register-submit'));

    // Depending on whether the browser's native type="email" validity or
    // zod's stricter .email() catches it first, either the zod error message
    // shows or the input is marked invalid (mirrors the same hedge used in
    // ForgotPassword.integration.test.tsx / LoginForm.test.tsx for this exact
    // 'invalid@' value).
    await waitFor(() => {
      const zodError = screen.queryByText(i18n.t('register.errors.emailInvalid', { ns: 'auth' }));
      expect(zodError || emailInput.validity.valid === false).toBeTruthy();
    });
    expect(signUp).not.toHaveBeenCalled();
  });

  it('shows an error when password is empty', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByTestId('email-input'), 'test@example.com');
    await user.click(document.getElementById('acceptedTerms')!);
    await user.click(screen.getByTestId('register-submit'));

    await waitFor(() => {
      expect(
        screen.getByText(i18n.t('register.errors.passwordRequired', { ns: 'auth' }))
      ).toBeInTheDocument();
    });
    expect(signUp).not.toHaveBeenCalled();
  });

  it('shows an error when password is shorter than 8 characters', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByTestId('email-input'), 'test@example.com');
    await user.type(screen.getByTestId('password-input'), 'short');
    await user.click(document.getElementById('acceptedTerms')!);
    await user.click(screen.getByTestId('register-submit'));

    await waitFor(() => {
      expect(
        screen.getByText(i18n.t('register.errors.passwordMinLength', { ns: 'auth' }))
      ).toBeInTheDocument();
    });
    expect(signUp).not.toHaveBeenCalled();
  });

  it('shows an error when terms are not accepted', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByTestId('email-input'), 'test@example.com');
    await user.type(screen.getByTestId('password-input'), 'password123');
    await user.click(screen.getByTestId('register-submit'));

    await waitFor(() => {
      expect(
        screen.getByText(i18n.t('register.errors.termsRequired', { ns: 'auth' }))
      ).toBeInTheDocument();
    });
    expect(signUp).not.toHaveBeenCalled();
  });
});

describe('RegisterForm Supabase signup error mapping', () => {
  afterEach(() => {
    signUp.mockReset();
  });

  it('maps an "already registered" error to the emailExists message', async () => {
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: new Error('User already registered'),
    });
    const user = userEvent.setup();
    render(<RegisterForm />);

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(screen.getByTestId('form-error')).toHaveTextContent(
        i18n.t('register.errors.emailExists', { ns: 'auth' })
      );
    });
  });

  it('maps a password-related error to the invalidPassword message', async () => {
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: new Error('Password is too weak'),
    });
    const user = userEvent.setup();
    render(<RegisterForm />);

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(screen.getByTestId('form-error')).toHaveTextContent(
        i18n.t('register.errors.invalidPassword', { ns: 'auth' })
      );
    });
  });

  it('falls through to the raw message for an unknown Supabase error', async () => {
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: new Error('Some unexpected backend failure'),
    });
    const user = userEvent.setup();
    render(<RegisterForm />);

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(screen.getByTestId('form-error')).toHaveTextContent('Some unexpected backend failure');
    });
  });
});

describe('RegisterForm accessibility', () => {
  it('exposes proper ARIA attributes on the name, email, and password inputs', () => {
    render(<RegisterForm />);

    const nameInput = screen.getByTestId('name-input');
    const emailInput = screen.getByTestId('email-input');
    const passwordInput = screen.getByTestId('password-input');

    expect(nameInput).toHaveAttribute('type', 'text');
    expect(nameInput).toHaveAttribute('autoComplete', 'name');
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(emailInput).toHaveAttribute('autoComplete', 'email');
    expect(passwordInput).toHaveAttribute('autoComplete', 'new-password');
  });
});

describe('RegisterForm auto-confirm success path', () => {
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
    // After signup, getSession returns a valid session so checkAuth can proceed
    getSession.mockResolvedValue({ data: { session: stubSession } });
    getProfile.mockResolvedValue(baseProfile);
  });

  afterEach(() => {
    signUp.mockReset();
  });

  it('populates the auth store and navigates to /dashboard when signUp returns a session', async () => {
    const user = userEvent.setup();
    renderRegisterForm();

    await fillAndSubmit(user, 'demo@learngreekeasy.com');

    await waitFor(() => {
      expect(screen.getByText('Dashboard Destination')).toBeInTheDocument();
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toMatchObject({
      id: 'user-123',
      email: 'demo@learngreekeasy.com',
      name: 'Demo User',
    });
    expect(signUp).toHaveBeenCalledTimes(1);
  });
});

describe('RegisterForm password visibility toggle', () => {
  it('flips the password input type between password and text', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    const passwordInput = screen.getByTestId('password-input') as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    const showButton = screen.getByRole('button', {
      name: i18n.t('passwordVisibility.show', { ns: 'auth' }),
    });
    await user.click(showButton);
    expect(passwordInput.type).toBe('text');

    const hideButton = screen.getByRole('button', {
      name: i18n.t('passwordVisibility.hide', { ns: 'auth' }),
    });
    await user.click(hideButton);
    expect(passwordInput.type).toBe('password');
  });
});
