/**
 * Login Flow Integration Tests
 * Tests complete login flow with auth store, form validation, and navigation
 */

import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { render, screen, waitFor } from '@/lib/test-utils';
import { useAuthStore } from '@/stores/authStore';

import { Login } from '../Login';

// Mock react-router-dom for navigation testing
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: null, pathname: '/login' }),
  };
});

describe('Login Flow Integration Tests', () => {
  beforeEach(() => {
    // Reset auth store to initial state
    useAuthStore.getState().logout();
    localStorage.clear();
    sessionStorage.clear();
    mockNavigate.mockClear();
    vi.clearAllMocks();
  });

  describe('Successful Login Flow', () => {
    it('should login user with valid credentials and redirect to dashboard', async () => {
      const user = userEvent.setup();

      render(<Login />);

      // Verify login form is rendered
      expect(screen.getByText(/Καλώς ήρθατε!/i)).toBeInTheDocument();

      // Fill in valid credentials (from mockAuthAPI mockData)
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'demo@learngreekeasy.com');
      await user.type(passwordInput, 'Demo123!');

      // Verify button is enabled before submit
      expect(submitButton).not.toBeDisabled();

      // Submit form
      await user.click(submitButton);

      // Wait for login to complete (mockAuthAPI has 1000ms delay)
      await waitFor(
        () => {
          const authState = useAuthStore.getState();
          expect(authState.isAuthenticated).toBe(true);
        },
        { timeout: 5000, interval: 100 }
      );

      // Verify auth state is updated correctly
      const authState = useAuthStore.getState();
      expect(authState.user).toBeTruthy();
      expect(authState.user?.email).toBe('demo@learngreekeasy.com');
      expect(authState.token).toBeTruthy();
      expect(authState.isLoading).toBe(false);
      expect(authState.error).toBeNull();

      // Verify navigation to dashboard
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
      });
    });

    it('should persist session to localStorage when user logs in with remember me', async () => {
      const user = userEvent.setup();

      render(<Login />);

      // Check "remember me" to enable localStorage persistence
      const rememberMeCheckbox = screen.getByRole('checkbox', { name: /remember me/i });
      await user.click(rememberMeCheckbox);

      await user.type(screen.getByLabelText(/email/i), 'demo@learngreekeasy.com');
      await user.type(screen.getByLabelText(/^password$/i), 'Demo123!');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Wait for login to complete (mockAuthAPI skips delay in test mode)
      await waitFor(
        () => {
          const authState = useAuthStore.getState();
          expect(authState.isAuthenticated).toBe(true);
        },
        { timeout: 5000, interval: 100 }
      );

      // Verify localStorage has auth data (only persisted when rememberMe is true)
      const authStorage = localStorage.getItem('auth-storage');
      expect(authStorage).toBeTruthy();

      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        expect(parsed.state.isAuthenticated).toBe(true);
        expect(parsed.state.user).toBeTruthy();
        expect(parsed.state.token).toBeTruthy();
      }
    });

    it('should handle "remember me" checkbox functionality', async () => {
      const user = userEvent.setup();

      render(<Login />);

      // Check "remember me" checkbox
      const rememberMeCheckbox = screen.getByRole('checkbox', { name: /remember me/i });
      await user.click(rememberMeCheckbox);

      expect(rememberMeCheckbox).toBeChecked();

      // Login with remember me
      await user.type(screen.getByLabelText(/email/i), 'demo@learngreekeasy.com');
      await user.type(screen.getByLabelText(/^password$/i), 'Demo123!');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(
        () => {
          const authState = useAuthStore.getState();
          expect(authState.isAuthenticated).toBe(true);
        },
        { timeout: 5000, interval: 100 }
      );

      // Verify rememberMe is stored in auth state
      const authState = useAuthStore.getState();
      expect(authState.rememberMe).toBe(true);
    });
  });

  describe('Form Validation', () => {
    it('should show validation error for empty email field', async () => {
      const user = userEvent.setup();

      render(<Login />);

      // Try to submit without filling email
      await user.type(screen.getByLabelText(/^password$/i), 'SomePassword123!');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Should show email validation error
      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      });

      // User should NOT be authenticated
      const authState = useAuthStore.getState();
      expect(authState.isAuthenticated).toBe(false);
    });

    it('should show validation error for invalid email format', async () => {
      const user = userEvent.setup();

      render(<Login />);

      const emailInput = screen.getByLabelText(/email/i);

      // Enter invalid email format (has @ but invalid domain)
      // Note: HTML5 email inputs have their own validation; we use a format that
      // passes HTML5 but fails zod's stricter email validation
      await user.type(emailInput, 'invalid@');
      await user.type(screen.getByLabelText(/^password$/i), 'Test1234!');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Should show email format validation error - the full message is "Please enter a valid email address"
      // Note: If HTML5 validation catches it first, the native browser error will show instead
      await waitFor(
        () => {
          // Check for either Zod validation error or HTML5 validation state
          const emailError = screen.queryByText(/please enter a valid email/i);
          const emailInputState = screen.getByLabelText(/email/i) as HTMLInputElement;

          // Either we see the Zod error message, or the email input is marked invalid
          expect(emailError || emailInputState.validity.valid === false).toBeTruthy();
        },
        { timeout: 2000 }
      );
    });

    it('should show validation error for empty password field', async () => {
      const user = userEvent.setup();

      render(<Login />);

      // Try to submit without password
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Should show password validation error
      await waitFor(() => {
        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
      });
    });

    it('should show validation error for password less than 8 characters', async () => {
      const user = userEvent.setup();

      render(<Login />);

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'short');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Should show password length validation error
      await waitFor(() => {
        expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message for invalid credentials', async () => {
      const user = userEvent.setup();

      render(<Login />);

      // Enter invalid credentials
      await user.type(screen.getByLabelText(/email/i), 'wrong@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'WrongPassword123!');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Wait for error message to appear
      // Note: mockAuthAPI throws a plain object, not an Error, so the Login component
      // falls back to the generic error message
      await waitFor(
        () => {
          expect(screen.getByText(/login failed/i)).toBeInTheDocument();
        },
        { timeout: 5000, interval: 100 }
      );

      // User should NOT be authenticated
      const authState = useAuthStore.getState();
      expect(authState.isAuthenticated).toBe(false);
      expect(authState.user).toBeNull();
    });

    it('should clear previous errors when submitting again', async () => {
      const user = userEvent.setup();

      render(<Login />);

      // First attempt with invalid credentials
      await user.type(screen.getByLabelText(/email/i), 'wrong@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'WrongPassword123!');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Wait for error
      await waitFor(
        () => {
          expect(screen.getByText(/login failed/i)).toBeInTheDocument();
        },
        { timeout: 5000, interval: 100 }
      );

      // Clear form and enter valid credentials
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);

      await user.clear(emailInput);
      await user.clear(passwordInput);

      await user.type(emailInput, 'demo@learngreekeasy.com');
      await user.type(passwordInput, 'Demo123!');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Error should be cleared during new attempt
      await waitFor(() => {
        expect(screen.queryByText(/login failed/i)).not.toBeInTheDocument();
      });

      // Login should succeed
      await waitFor(
        () => {
          const authState = useAuthStore.getState();
          expect(authState.isAuthenticated).toBe(true);
        },
        { timeout: 5000, interval: 100 }
      );
    });
  });

  describe('UI Interaction', () => {
    it('should toggle password visibility when clicking eye icon', async () => {
      const user = userEvent.setup();

      render(<Login />);

      const passwordInput = screen.getByLabelText(/^password$/i) as HTMLInputElement;

      // Initially password should be hidden
      expect(passwordInput.type).toBe('password');

      // Click show password button
      const showPasswordButton = screen.getByRole('button', { name: /show password/i });
      await user.click(showPasswordButton);

      // Password should be visible
      expect(passwordInput.type).toBe('text');

      // Click hide password button
      const hidePasswordButton = screen.getByRole('button', { name: /hide password/i });
      await user.click(hidePasswordButton);

      // Password should be hidden again
      expect(passwordInput.type).toBe('password');
    });

    // Loading state tests are skipped because mockAuthAPI skips delays in test mode (NODE_ENV='test')
    // The API call completes instantly, making it impossible to catch transient loading states
    it.skip('should disable form inputs during login submission', async () => {
      const user = userEvent.setup();

      render(<Login />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'demo@learngreekeasy.com');
      await user.type(passwordInput, 'Demo123!');
      await user.click(submitButton);

      // Inputs should be disabled during API call
      expect(emailInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
      expect(submitButton).toBeDisabled();

      // Wait for completion
      await waitFor(
        () => {
          const authState = useAuthStore.getState();
          expect(authState.isAuthenticated).toBe(true);
        },
        { timeout: 5000, interval: 100 }
      );
    });

    // Loading state tests are skipped because mockAuthAPI skips delays in test mode (NODE_ENV='test')
    it.skip('should display loading text on submit button during login', async () => {
      const user = userEvent.setup();

      render(<Login />);

      await user.type(screen.getByLabelText(/email/i), 'demo@learngreekeasy.com');
      await user.type(screen.getByLabelText(/^password$/i), 'Demo123!');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Should show loading text
      await waitFor(() => {
        expect(screen.getByText(/signing in/i)).toBeInTheDocument();
      });

      // Wait for completion
      await waitFor(
        () => {
          const authState = useAuthStore.getState();
          expect(authState.isAuthenticated).toBe(true);
        },
        { timeout: 5000, interval: 100 }
      );
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes for form inputs', () => {
      render(<Login />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);

      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('autoComplete', 'email');

      expect(passwordInput).toHaveAttribute('autoComplete', 'current-password');
    });

    it('should associate error messages with form fields using aria-describedby', async () => {
      const user = userEvent.setup();

      render(<Login />);

      // Submit empty form to trigger validation
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        const emailInput = screen.getByLabelText(/email/i);
        const emailError = screen.getByText(/email is required/i);

        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
        expect(emailInput).toHaveAttribute('aria-describedby', 'email-error');
        expect(emailError).toHaveAttribute('id', 'email-error');
      });
    });
  });
});
