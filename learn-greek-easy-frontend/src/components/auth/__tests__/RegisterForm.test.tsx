/**
 * RegisterForm Unit Tests
 *
 * Tests the auto-scroll behavior triggered by the onInvalid handler
 * when the form is submitted with validation errors.
 *
 * Also covers AC-6 live scenarios: empty-name submission reaches verification screen,
 * Google signup button is present.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import userEvent from '@testing-library/user-event';

import { render, screen, waitFor } from '@/lib/test-utils';
import * as supabaseClientModule from '@/lib/supabaseClient';

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
    };
  };
};
const signUp = mockedModule.supabase.auth.signUp;

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
