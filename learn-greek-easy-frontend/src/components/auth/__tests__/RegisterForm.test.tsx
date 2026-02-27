/**
 * RegisterForm Unit Tests
 *
 * Tests the auto-scroll behavior triggered by the onInvalid handler
 * when the form is submitted with validation errors.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import userEvent from '@testing-library/user-event';

import { render, screen, waitFor } from '@/lib/test-utils';

import { RegisterForm } from '../RegisterForm';

// authAPI is imported by RegisterForm but not globally mocked
vi.mock('@/services/authAPI', () => ({
  authAPI: {
    getProfile: vi.fn(),
  },
}));

describe('RegisterForm auto-scroll behavior', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('should scroll to the first error field when submitting an empty form', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    const submitButton = screen.getByTestId('register-submit');
    await user.click(submitButton);

    await waitFor(() => {
      const nameElement = document.getElementById('name');
      expect(nameElement).not.toBeNull();
      expect(nameElement!.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
      });
    });
  });

  it('should scroll to the password field when name and email are filled but password is empty', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByTestId('name-input'), 'Test User');
    await user.type(screen.getByTestId('email-input'), 'test@example.com');

    // Check the acceptedTerms checkbox
    const checkbox = document.getElementById('acceptedTerms');
    if (checkbox) {
      await user.click(checkbox);
    }

    const submitButton = screen.getByTestId('register-submit');
    await user.click(submitButton);

    await waitFor(() => {
      const passwordElement = document.getElementById('password');
      expect(passwordElement).not.toBeNull();
      expect(passwordElement!.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
      });
    });
  });
});
