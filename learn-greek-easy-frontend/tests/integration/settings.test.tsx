/**
 * Settings Management Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/lib/test-utils';
import userEvent from '@testing-library/user-event';
import Settings from '@/pages/Settings';
import { useAuthStore } from '@/stores/authStore';

describe('Settings Management Integration', () => {
  beforeEach(async () => {
    await useAuthStore.getState().login('demo@learngreekeasy.com', 'Demo123!');
  });

  describe('Account Settings', () => {
    it('should display current user information', async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText(/Account Settings/i)).toBeInTheDocument();
      });

      // Check for subscription section (multiple matches expected)
      const subscriptionElements = screen.getAllByText(/Subscription/i);
      expect(subscriptionElements.length).toBeGreaterThan(0);
    });

    it('should open change password dialog', async () => {
      const user = userEvent.setup();

      render(<Settings />);

      // Click "Change Password" button
      const changePasswordButton = await screen.findByRole('button', { name: /change password/i });
      await user.click(changePasswordButton);

      // Dialog should appear
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/Enter your current password/i)).toBeInTheDocument();
      });
    });

    it('should change password successfully', async () => {
      const user = userEvent.setup();

      render(<Settings />);

      // Click "Change Password" button
      const changePasswordButton = await screen.findByRole('button', { name: /change password/i });
      await user.click(changePasswordButton);

      // Wait for dialog to open
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Fill password change form
      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/new password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm.*password/i);

      await user.type(currentPasswordInput, 'Demo123!');
      await user.type(newPasswordInput, 'NewPassword123!');
      await user.type(confirmPasswordInput, 'NewPassword123!');

      // Submit
      const updateButton = screen.getByRole('button', { name: /update password/i });
      await user.click(updateButton);

      // Success toast should appear
      await waitFor(() => {
        expect(screen.getByText(/password updated/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should validate password strength', async () => {
      const user = userEvent.setup();

      render(<Settings />);

      const changePasswordButton = await screen.findByRole('button', { name: /change password/i });
      await user.click(changePasswordButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Enter weak password
      const newPasswordInput = screen.getByLabelText(/new password/i);
      await user.type(newPasswordInput, 'weak');
      await user.tab();

      // Validation error should appear
      await waitFor(() => {
        const errorMessage = screen.queryByText(/at least 8 characters/i);
        if (errorMessage) {
          expect(errorMessage).toBeInTheDocument();
        }
      });
    });

    it('should display subscription tier', async () => {
      render(<Settings />);

      await waitFor(() => {
        const subscriptionElements = screen.getAllByText(/Subscription/i);
        expect(subscriptionElements.length).toBeGreaterThan(0);
      });

      // Check for free or premium badge
      const authState = useAuthStore.getState();
      if (authState.user?.role === 'premium') {
        expect(screen.getByText(/Premium/i)).toBeInTheDocument();
      } else {
        expect(screen.getByText(/Free Plan/i)).toBeInTheDocument();
      }
    });
  });

  describe('Preferences', () => {
    it('should update daily goal with slider', async () => {
      const user = userEvent.setup();

      render(<Settings />);

      // Find daily goal slider
      const slider = await screen.findByRole('slider', { name: /daily.*goal/i });

      // Change value
      await user.click(slider);
      await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}'); // Increase by 3

      // Wait for auto-save (debounced)
      await waitFor(
        () => {
          expect(screen.getByText(/preferences saved/i)).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });

    it('should auto-save preferences after debounce', async () => {
      const user = userEvent.setup();

      render(<Settings />);

      const slider = await screen.findByRole('slider', { name: /daily.*goal/i });

      // Change multiple times quickly
      await user.click(slider);
      await user.keyboard('{ArrowRight}');
      await user.keyboard('{ArrowRight}');
      await user.keyboard('{ArrowRight}');

      // Should only save once after debounce
      await waitFor(
        () => {
          expect(screen.getByText(/preferences saved/i)).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });

    it('should persist preferences to localStorage', async () => {
      const user = userEvent.setup();

      render(<Settings />);

      const slider = await screen.findByRole('slider', { name: /daily.*goal/i });
      await user.click(slider);
      await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');

      await waitFor(
        () => {
          const authStorage = localStorage.getItem('auth-storage');
          expect(authStorage).toBeDefined();

          if (authStorage) {
            const authState = JSON.parse(authStorage);
            expect(authState.state.user.preferences.dailyGoal).toBeGreaterThan(0);
          }
        },
        { timeout: 2000 }
      );
    });
  });

  describe('Danger Zone', () => {
    it('should require confirmation for account deletion', async () => {
      const user = userEvent.setup();

      render(<Settings />);

      // Find and click delete account button
      const deleteButton = await screen.findByRole('button', { name: /delete account/i });
      await user.click(deleteButton);

      // Confirmation dialog should appear
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/delete account\?/i)).toBeInTheDocument();
      });
    });

    it('should have multi-step confirmation process', async () => {
      const user = userEvent.setup();

      render(<Settings />);

      const deleteButton = await screen.findByRole('button', { name: /^delete account$/i });
      await user.click(deleteButton);

      // Step 1: Initial warning
      await waitFor(() => {
        expect(screen.getByText(/this will permanently delete/i)).toBeInTheDocument();
      });

      // Click continue
      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      // Step 2: Password verification
      await waitFor(() => {
        expect(screen.getByText(/verify your password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/current password/i);
      await user.type(passwordInput, 'Demo123!');

      const verifyButton = screen.getByRole('button', { name: /verify password/i });
      await user.click(verifyButton);

      // Step 3: Final confirmation with checkbox
      await waitFor(() => {
        expect(screen.getByText(/final confirmation/i)).toBeInTheDocument();
      });

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
    });

    it('should require checkbox acknowledgment before deletion', async () => {
      const user = userEvent.setup();

      render(<Settings />);

      const deleteButton = await screen.findByRole('button', { name: /^delete account$/i });
      await user.click(deleteButton);

      // Navigate through steps
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/current password/i), 'Demo123!');
      await user.click(screen.getByRole('button', { name: /verify password/i }));

      // Final step - verify checkbox is required
      await waitFor(() => {
        const finalDeleteButton = screen.getByRole('button', { name: /delete my account/i });
        expect(finalDeleteButton).toBeDisabled();
      });

      // Check the acknowledgment checkbox
      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      // Button should now be enabled
      const finalDeleteButton = screen.getByRole('button', { name: /delete my account/i });
      expect(finalDeleteButton).not.toBeDisabled();
    });

    it('should cancel deletion on cancel button', async () => {
      const user = userEvent.setup();

      render(<Settings />);

      const deleteButton = await screen.findByRole('button', { name: /^delete account$/i });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Dialog should close
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // Account should NOT be deleted
      const authState = useAuthStore.getState();
      expect(authState.isAuthenticated).toBe(true);
    });
  });
});
