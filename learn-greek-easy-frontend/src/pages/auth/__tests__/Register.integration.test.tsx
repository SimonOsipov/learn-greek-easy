/**
 * Registration Flow Integration Tests
 * Tests complete registration flow with auth store, form validation, and auto-login
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@/lib/test-utils';
import userEvent from '@testing-library/user-event';
import { Register } from '../Register';
import { useAuthStore } from '@/stores/authStore';

// Mock react-router-dom for navigation testing
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: null, pathname: '/register' }),
  };
});

describe('Registration Flow Integration Tests', () => {
  beforeEach(() => {
    // Reset auth store to initial state
    useAuthStore.getState().logout();
    localStorage.clear();
    sessionStorage.clear();
    mockNavigate.mockClear();
    vi.clearAllMocks();
  });

  describe('Successful Registration Flow', () => {
    it('should register new user with valid data and redirect to dashboard', async () => {
      const user = userEvent.setup();

      render(<Register />);

      // Verify registration form is rendered
      expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument();

      // Fill in valid registration data
      await user.type(screen.getByLabelText(/full name/i), 'John Smith');
      await user.type(screen.getByLabelText(/email/i), 'john.smith@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'SecurePass123!');

      // Accept terms
      const termsCheckbox = screen.getByRole('checkbox', { name: /terms and conditions/i });
      await user.click(termsCheckbox);

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      // Wait for registration to complete
      await waitFor(
        () => {
          const authState = useAuthStore.getState();
          expect(authState.isAuthenticated).toBe(true);
        },
        { timeout: 6000, interval: 100 }
      );

      // Verify auth state is updated correctly
      const authState = useAuthStore.getState();
      expect(authState.user).toBeTruthy();
      expect(authState.user?.email).toBe('john.smith@example.com');
      expect(authState.user?.name).toBe('John Smith');
      expect(authState.token).toBeTruthy();
      expect(authState.isLoading).toBe(false);
      expect(authState.error).toBeNull();

      // Verify navigation to dashboard
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('should auto-login user after successful registration', async () => {
      const user = userEvent.setup();

      render(<Register />);

      // Fill registration form
      await user.type(screen.getByLabelText(/full name/i), 'Jane Doe');
      await user.type(screen.getByLabelText(/email/i), 'jane.doe@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'MyPassword123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'MyPassword123!');
      await user.click(screen.getByRole('checkbox', { name: /terms and conditions/i }));

      await user.click(screen.getByRole('button', { name: /create account/i }));

      // Wait for auto-login
      await waitFor(
        () => {
          const authState = useAuthStore.getState();
          expect(authState.isAuthenticated).toBe(true);
          expect(authState.token).toBeTruthy();
        },
        { timeout: 6000, interval: 100 }
      );

      // Verify session is stored
      const authStorage = localStorage.getItem('auth-storage');
      expect(authStorage).toBeTruthy();
    });

    it('should persist new user data to localStorage', async () => {
      const user = userEvent.setup();

      render(<Register />);

      await user.type(screen.getByLabelText(/full name/i), 'Test User');
      await user.type(screen.getByLabelText(/email/i), 'test.user@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'TestPass123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'TestPass123!');
      await user.click(screen.getByRole('checkbox', { name: /terms and conditions/i }));

      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(
        () => {
          const authState = useAuthStore.getState();
          expect(authState.isAuthenticated).toBe(true);
        },
        { timeout: 6000, interval: 100 }
      );

      // Verify localStorage has auth data
      const authStorage = localStorage.getItem('auth-storage');
      expect(authStorage).toBeTruthy();

      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        expect(parsed.state.isAuthenticated).toBe(true);
        expect(parsed.state.user.email).toBe('test.user@example.com');
        expect(parsed.state.user.name).toBe('Test User');
      }
    });
  });

  describe('Form Validation', () => {
    it('should show validation error for empty name field', async () => {
      const user = userEvent.setup();

      render(<Register />);

      // Submit without name
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'Password123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'Password123!');
      await user.click(screen.getByRole('checkbox', { name: /terms and conditions/i }));
      await user.click(screen.getByRole('button', { name: /create account/i }));

      // Should show name validation error
      await waitFor(() => {
        expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      });
    });

    it('should show validation error for name less than 2 characters', async () => {
      const user = userEvent.setup();

      render(<Register />);

      await user.type(screen.getByLabelText(/full name/i), 'A');
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'Password123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'Password123!');
      await user.click(screen.getByRole('checkbox', { name: /terms and conditions/i }));
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/at least 2 characters/i)).toBeInTheDocument();
      });
    });

    it('should show validation error for invalid email format', async () => {
      const user = userEvent.setup();

      render(<Register />);

      await user.type(screen.getByLabelText(/full name/i), 'John Doe');
      await user.type(screen.getByLabelText(/email/i), 'invalid-email');
      await user.type(screen.getByLabelText(/^password$/i), 'Password123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'Password123!');
      await user.click(screen.getByRole('checkbox', { name: /terms and conditions/i }));
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/valid email address/i)).toBeInTheDocument();
      });
    });

    it('should show validation error for password less than 8 characters', async () => {
      const user = userEvent.setup();

      render(<Register />);

      await user.type(screen.getByLabelText(/full name/i), 'John Doe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'short');
      await user.type(screen.getByLabelText(/confirm password/i), 'short');
      await user.click(screen.getByRole('checkbox', { name: /terms and conditions/i }));
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
      });
    });

    it('should show validation error when passwords do not match', async () => {
      const user = userEvent.setup();

      render(<Register />);

      await user.type(screen.getByLabelText(/full name/i), 'John Doe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'Password123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'DifferentPassword123!');
      await user.click(screen.getByRole('checkbox', { name: /terms and conditions/i }));
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      });
    });

    it('should show validation error when terms are not accepted', async () => {
      const user = userEvent.setup();

      render(<Register />);

      // Fill form but don't check terms
      await user.type(screen.getByLabelText(/full name/i), 'John Doe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'Password123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'Password123!');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/accept the terms and conditions/i)).toBeInTheDocument();
      });
    });

    it('should display password strength indicator', async () => {
      const user = userEvent.setup();

      render(<Register />);

      const passwordInput = screen.getByLabelText(/^password$/i);

      // Type weak password
      await user.type(passwordInput, 'weak');

      // Should show password strength indicator
      await waitFor(() => {
        expect(screen.getByText(/password strength/i)).toBeInTheDocument();
        expect(screen.getByText(/weak/i)).toBeInTheDocument();
      });

      // Clear and type strong password
      await user.clear(passwordInput);
      await user.type(passwordInput, 'VeryStrongPass123!@#');

      // Should show strong indicator
      await waitFor(() => {
        expect(screen.getByText(/strong/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error when email already exists', async () => {
      const user = userEvent.setup();

      render(<Register />);

      // Use existing email (from mockData: demo@learngreek.com)
      await user.type(screen.getByLabelText(/full name/i), 'John Doe');
      await user.type(screen.getByLabelText(/email/i), 'demo@learngreek.com');
      await user.type(screen.getByLabelText(/^password$/i), 'Password123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'Password123!');
      await user.click(screen.getByRole('checkbox', { name: /terms and conditions/i }));
      await user.click(screen.getByRole('button', { name: /create account/i }));

      // Should show duplicate email error
      await waitFor(
        () => {
          expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
        },
        { timeout: 6000, interval: 100 }
      );

      // User should NOT be authenticated
      const authState = useAuthStore.getState();
      expect(authState.isAuthenticated).toBe(false);
    });

    it('should clear previous errors when submitting again', async () => {
      const user = userEvent.setup();

      render(<Register />);

      // First attempt with existing email
      await user.type(screen.getByLabelText(/full name/i), 'John Doe');
      await user.type(screen.getByLabelText(/email/i), 'demo@learngreek.com');
      await user.type(screen.getByLabelText(/^password$/i), 'Password123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'Password123!');
      await user.click(screen.getByRole('checkbox', { name: /terms and conditions/i }));
      await user.click(screen.getByRole('button', { name: /create account/i }));

      // Wait for error
      await waitFor(
        () => {
          expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
        },
        { timeout: 6000, interval: 100 }
      );

      // Clear and enter new email
      const emailInput = screen.getByLabelText(/email/i);
      await user.clear(emailInput);
      await user.type(emailInput, 'newemail@example.com');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      // Error should be cleared
      await waitFor(() => {
        expect(screen.queryByText(/email already exists/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('UI Interaction', () => {
    it('should toggle password visibility', async () => {
      const user = userEvent.setup();

      render(<Register />);

      const passwordInput = screen.getByLabelText(/^password$/i) as HTMLInputElement;

      // Initially hidden
      expect(passwordInput.type).toBe('password');

      // Click show password
      const showButtons = screen.getAllByRole('button', { name: /show password/i });
      await user.click(showButtons[0]); // First show button (password field)

      expect(passwordInput.type).toBe('text');

      // Click hide password
      const hideButtons = screen.getAllByRole('button', { name: /hide password/i });
      await user.click(hideButtons[0]);

      expect(passwordInput.type).toBe('password');
    });

    it('should toggle confirm password visibility', async () => {
      const user = userEvent.setup();

      render(<Register />);

      const confirmPasswordInput = screen.getByLabelText(/confirm password/i) as HTMLInputElement;

      // Initially hidden
      expect(confirmPasswordInput.type).toBe('password');

      // Type something first to ensure the field is focused
      await user.type(confirmPasswordInput, 'test');

      // Click show password for confirm field
      const showButtons = screen.getAllByRole('button', { name: /show password/i });
      await user.click(showButtons[1]); // Second show button (confirm password field)

      expect(confirmPasswordInput.type).toBe('text');
    });

    it('should disable form inputs during registration submission', async () => {
      const user = userEvent.setup();

      render(<Register />);

      const nameInput = screen.getByLabelText(/full name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await user.type(nameInput, 'John Doe');
      await user.type(emailInput, 'john@example.com');
      await user.type(passwordInput, 'Password123!');
      await user.type(confirmPasswordInput, 'Password123!');
      await user.click(screen.getByRole('checkbox', { name: /terms and conditions/i }));
      await user.click(submitButton);

      // All inputs should be disabled during submission
      expect(nameInput).toBeDisabled();
      expect(emailInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
      expect(confirmPasswordInput).toBeDisabled();
      expect(submitButton).toBeDisabled();

      // Wait for completion
      await waitFor(
        () => {
          const authState = useAuthStore.getState();
          expect(authState.isAuthenticated).toBe(true);
        },
        { timeout: 6000, interval: 100 }
      );
    });

    it('should display loading text on submit button during registration', async () => {
      const user = userEvent.setup();

      render(<Register />);

      await user.type(screen.getByLabelText(/full name/i), 'John Doe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'Password123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'Password123!');
      await user.click(screen.getByRole('checkbox', { name: /terms and conditions/i }));
      await user.click(screen.getByRole('button', { name: /create account/i }));

      // Should show loading text
      await waitFor(() => {
        expect(screen.getByText(/creating account/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes for form inputs', () => {
      render(<Register />);

      const nameInput = screen.getByLabelText(/full name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      expect(nameInput).toHaveAttribute('type', 'text');
      expect(nameInput).toHaveAttribute('autoComplete', 'name');

      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('autoComplete', 'email');

      expect(passwordInput).toHaveAttribute('autoComplete', 'new-password');
      expect(confirmPasswordInput).toHaveAttribute('autoComplete', 'new-password');
    });

    it('should associate error messages with form fields using aria-describedby', async () => {
      const user = userEvent.setup();

      render(<Register />);

      // Submit empty form to trigger validation
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/full name/i);
        const nameError = screen.getByText(/name is required/i);

        expect(nameInput).toHaveAttribute('aria-invalid', 'true');
        expect(nameInput).toHaveAttribute('aria-describedby', 'name-error');
        expect(nameError).toHaveAttribute('id', 'name-error');
      });
    });
  });
});
