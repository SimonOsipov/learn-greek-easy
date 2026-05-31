/**
 * Reset Password Flow Integration Tests
 *
 * Covers the most security-sensitive write in the app:
 * - mismatched passwords block updateUser (client-side zod refine)
 * - password < 8 chars fails client-side and never calls updateUser
 * - successful update renders the success card
 * - a Supabase "session expired" error maps to the correct alert copy
 *
 * NOTE: ResetPassword is intentionally NOT wrapped in PublicRoute (see the
 * component docstring): Supabase fires SIGNED_IN before PASSWORD_RECOVERY, so
 * wrapping it would bounce the user to the dashboard before they can set a
 * password. These tests render the bare component (no route guard) to pin that
 * standalone contract.
 */

import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { render, screen, waitFor } from '@/lib/test-utils';

import { ResetPassword } from '../ResetPassword';

// Controllable Supabase auth mock. We override the global test-setup mock for
// this file so we can (a) provide getUser (called in useEffect) and
// (b) drive updateUser's resolved/rejected value per test.
const mockUpdateUser = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
    },
  },
}));

describe('ResetPassword Flow Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: a recovery session exists with a known email.
    mockGetUser.mockResolvedValue({ data: { user: { email: 'user@example.com' } } });
    // Default happy-path: update succeeds.
    mockUpdateUser.mockResolvedValue({ error: null });
  });

  it('renders the reset password form by default', async () => {
    render(<ResetPassword />);

    expect(await screen.findByTestId('reset-password-card')).toBeInTheDocument();
    expect(screen.getByTestId('password-input')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-password-input')).toBeInTheDocument();
  });

  it('blocks updateUser when passwords do not match', async () => {
    const user = userEvent.setup();
    render(<ResetPassword />);

    await user.type(screen.getByTestId('password-input'), 'ValidPass123!');
    await user.type(screen.getByTestId('confirm-password-input'), 'DifferentPass123!');
    await user.click(screen.getByTestId('reset-password-submit'));

    // Mismatch error surfaces and the Supabase write is never attempted.
    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
    // Still on the form (no success card).
    expect(screen.queryByTestId('reset-password-success-card')).not.toBeInTheDocument();
  });

  it('fails client-side and does not call updateUser when password is under 8 characters', async () => {
    const user = userEvent.setup();
    render(<ResetPassword />);

    // Both fields match so only the min-length rule can fail.
    await user.type(screen.getByTestId('password-input'), 'short');
    await user.type(screen.getByTestId('confirm-password-input'), 'short');
    await user.click(screen.getByTestId('reset-password-submit'));

    // Assert on the field-level zod error (the PasswordStrengthIndicator also
    // renders an "At least 8 characters" requirement hint, so scope to the
    // error node by id).
    await waitFor(() => {
      const error = document.getElementById('password-error');
      expect(error).toHaveTextContent(/password must be at least 8 characters/i);
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('renders the success card after a successful password update', async () => {
    const user = userEvent.setup();
    render(<ResetPassword />);

    await user.type(screen.getByTestId('password-input'), 'ValidPass123!');
    await user.type(screen.getByTestId('confirm-password-input'), 'ValidPass123!');
    await user.click(screen.getByTestId('reset-password-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('reset-password-success-card')).toBeInTheDocument();
    });
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'ValidPass123!' });
    expect(screen.getByTestId('go-to-dashboard')).toHaveAttribute('href', '/dashboard');
    // Form is gone.
    expect(screen.queryByTestId('reset-password-form')).not.toBeInTheDocument();
  });

  it('maps a Supabase "session expired" error to the session-expired alert', async () => {
    // Supabase returns an AuthError (an Error subclass) in `error`; the
    // component re-throws it and maps `.message` to an i18n key.
    mockUpdateUser.mockResolvedValue({
      error: new Error('Auth session missing!'),
    });

    const user = userEvent.setup();
    render(<ResetPassword />);

    await user.type(screen.getByTestId('password-input'), 'ValidPass123!');
    await user.type(screen.getByTestId('confirm-password-input'), 'ValidPass123!');
    await user.click(screen.getByTestId('reset-password-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('form-error')).toBeInTheDocument();
    });
    expect(
      screen.getByText(/your reset session has expired\. please request a new reset link\./i)
    ).toBeInTheDocument();
    // No success card on failure.
    expect(screen.queryByTestId('reset-password-success-card')).not.toBeInTheDocument();
  });

  it('shows the generic update-failed alert for an unrecognised error', async () => {
    mockUpdateUser.mockResolvedValue({
      error: new Error('Something unexpected happened'),
    });

    const user = userEvent.setup();
    render(<ResetPassword />);

    await user.type(screen.getByTestId('password-input'), 'ValidPass123!');
    await user.type(screen.getByTestId('confirm-password-input'), 'ValidPass123!');
    await user.click(screen.getByTestId('reset-password-submit'));

    await waitFor(() => {
      expect(
        screen.getByText(/failed to update password\. please try again\./i)
      ).toBeInTheDocument();
    });
  });
});
