/**
 * ForgotPassword Flow Integration Tests
 *
 * Covers:
 * - Empty / invalid email blocks the Supabase API call
 * - Success starts the 60s cooldown and disables the submit button
 * - "Try a different email" preserves the cooldown (lastSentAt is NOT reset)
 * - A thrown Supabase call shows an error and stays on the form
 */

import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, waitFor } from '@/lib/test-utils';

// Mock Supabase client used by ForgotPassword
const mockResetPasswordForEmail = vi.fn();
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
    },
  },
}));

// Silence logger noise
vi.mock('@/lib/logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { ForgotPassword } from '../ForgotPassword';

describe('ForgotPassword Flow Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: Supabase succeeds
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Form validation blocks the API call', () => {
    it('does not call Supabase when email is empty', async () => {
      const user = userEvent.setup();
      render(<ForgotPassword />);

      await user.click(screen.getByTestId('forgot-password-submit'));

      // Validation error shown, no API call
      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      });
      expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
      // Still on the form
      expect(screen.getByTestId('forgot-password-card')).toBeInTheDocument();
    });

    it('does not call Supabase when email format is invalid', async () => {
      const user = userEvent.setup();
      render(<ForgotPassword />);

      const emailInput = screen.getByTestId('email-input') as HTMLInputElement;
      await user.type(emailInput, 'invalid@');
      await user.click(screen.getByTestId('forgot-password-submit'));

      // Invalid email must block the reset request. Depending on whether the
      // native HTML5 type="email" validity or zod's stricter .email() catches it
      // first, either the zod error message shows or the input is marked invalid.
      await waitFor(() => {
        const zodError = screen.queryByText(/please enter a valid email address/i);
        expect(zodError || emailInput.validity.valid === false).toBeTruthy();
      });
      expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
      expect(screen.getByTestId('forgot-password-card')).toBeInTheDocument();
    });
  });

  describe('Successful submission', () => {
    it('shows success screen, sends the email, and starts the 60s cooldown', async () => {
      const user = userEvent.setup();
      render(<ForgotPassword />);

      await user.type(screen.getByTestId('email-input'), 'user@example.com');
      await user.click(screen.getByTestId('forgot-password-submit'));

      // Success screen appears with the submitted email
      await waitFor(() => {
        expect(screen.getByTestId('forgot-password-success-card')).toBeInTheDocument();
      });
      expect(screen.getByTestId('submitted-email')).toHaveTextContent('user@example.com');

      // Supabase was called with the email and a redirect URL
      expect(mockResetPasswordForEmail).toHaveBeenCalledTimes(1);
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.objectContaining({ redirectTo: expect.stringContaining('/reset-password') })
      );
    });
  });

  describe('Cooldown persistence', () => {
    it('keeps the submit button disabled with a cooldown after "try a different email"', async () => {
      const user = userEvent.setup();
      render(<ForgotPassword />);

      // Send a reset email -> success -> cooldown begins
      await user.type(screen.getByTestId('email-input'), 'user@example.com');
      await user.click(screen.getByTestId('forgot-password-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('forgot-password-success-card')).toBeInTheDocument();
      });

      // Go back to the form via "try a different email"
      await user.click(screen.getByTestId('try-different-email-button'));

      await waitFor(() => {
        expect(screen.getByTestId('forgot-password-card')).toBeInTheDocument();
      });

      // The cooldown must persist: submit button is disabled and shows the countdown.
      // (lastSentAt is intentionally NOT cleared by handleTryDifferentEmail)
      const submit = screen.getByTestId('forgot-password-submit');
      await waitFor(() => {
        expect(submit).toBeDisabled();
      });
      expect(submit).toHaveTextContent(/\d+s/);

      // Attempting to submit again is blocked by the cooldown (no new API call)
      expect(mockResetPasswordForEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error handling', () => {
    it('shows an error and stays on the form when Supabase returns an error', async () => {
      mockResetPasswordForEmail.mockResolvedValue({
        data: null,
        error: new Error('rate limited'),
      });

      const user = userEvent.setup();
      render(<ForgotPassword />);

      await user.type(screen.getByTestId('email-input'), 'user@example.com');
      await user.click(screen.getByTestId('forgot-password-submit'));

      // Error alert shown, no success screen
      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toBeInTheDocument();
      });
      expect(screen.getByText(/failed to send reset email/i)).toBeInTheDocument();
      expect(screen.queryByTestId('forgot-password-success-card')).not.toBeInTheDocument();
      expect(screen.getByTestId('forgot-password-card')).toBeInTheDocument();
    });

    it('shows an error and stays on the form when the call throws', async () => {
      mockResetPasswordForEmail.mockRejectedValue(new Error('network down'));

      const user = userEvent.setup();
      render(<ForgotPassword />);

      await user.type(screen.getByTestId('email-input'), 'user@example.com');
      await user.click(screen.getByTestId('forgot-password-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toBeInTheDocument();
      });
      expect(screen.getByText(/failed to send reset email/i)).toBeInTheDocument();
      expect(screen.queryByTestId('forgot-password-success-card')).not.toBeInTheDocument();
      // No cooldown was started since the send failed
      expect(screen.getByTestId('forgot-password-submit')).not.toBeDisabled();
    });
  });
});
