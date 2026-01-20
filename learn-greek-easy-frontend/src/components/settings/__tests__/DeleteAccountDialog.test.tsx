/**
 * DeleteAccountDialog Component Tests
 *
 * Tests for the DeleteAccountDialog component verifying:
 * - Modal renders when open
 * - PostHog event fires on open
 * - Confirm button disabled when input empty
 * - Confirm button disabled when input is partial match
 * - Confirm button disabled when case mismatch
 * - Confirm button enabled when input matches exactly
 * - API called on confirm
 * - Logout called on success
 * - Error displayed on failure
 * - Cancel fires PostHog event and closes modal
 * - Buttons disabled while deleting
 */

import React from 'react';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import posthog from 'posthog-js';
import { I18nextProvider } from 'react-i18next';
import { initReactI18next } from 'react-i18next';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { DeleteAccountDialog } from '../DeleteAccountDialog';

// Mock useAuth
const mockLogout = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    logout: mockLogout,
  }),
}));

// Mock usersAPI
vi.mock('@/services/usersAPI', () => ({
  usersAPI: {
    deleteAccount: vi.fn(),
  },
}));

// Mock posthog
vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
  },
}));

// Mock English translations
const enSettings = {
  danger: {
    cancel: 'Cancel',
    deleteAccount: {
      dialogTitle: 'Delete Account?',
      willDelete: 'This will permanently delete:',
      deleteItems: {
        account: 'Your account and all login credentials',
        progress: 'All learning progress and review history',
        statistics: 'All statistics, analytics, and achievements',
        deckData: 'All deck data and flashcards',
        settings: 'All settings and preferences',
      },
      permanentWarning: 'This action cannot be undone. All data will be lost permanently.',
      typeToConfirm: 'To confirm, type <strong>DELETE</strong> below:',
      typeDelete: 'Type DELETE',
      confirmationWord: 'DELETE',
      mustTypeDelete: 'Must type "DELETE" exactly (case-sensitive)',
      deleting: 'Deleting...',
      deleteMyAccount: 'Delete My Account',
      error: 'Failed to delete account',
    },
  },
};

// Setup i18n for tests
const setupI18n = (language: string = 'en') => {
  const testI18n = i18n.createInstance();
  testI18n.use(initReactI18next).init({
    resources: {
      en: { settings: enSettings },
    },
    lng: language,
    fallbackLng: 'en',
    ns: ['settings'],
    defaultNS: 'settings',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return testI18n;
};

const renderWithI18n = (ui: React.ReactElement, language: string = 'en') => {
  const testI18n = setupI18n(language);
  return render(<I18nextProvider i18n={testI18n}>{ui}</I18nextProvider>);
};

describe('DeleteAccountDialog', () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render modal when open is true', () => {
      renderWithI18n(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.getByTestId('delete-account-modal')).toBeInTheDocument();
      expect(screen.getByTestId('delete-account-title')).toHaveTextContent('Delete Account?');
    });

    it('should not render modal when open is false', () => {
      renderWithI18n(<DeleteAccountDialog open={false} onOpenChange={mockOnOpenChange} />);

      expect(screen.queryByTestId('delete-account-modal')).not.toBeInTheDocument();
    });

    it('should display all data that will be deleted', () => {
      renderWithI18n(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.getByText('This will permanently delete:')).toBeInTheDocument();
      expect(screen.getByText('Your account and all login credentials')).toBeInTheDocument();
      expect(screen.getByText('All learning progress and review history')).toBeInTheDocument();
      expect(screen.getByText('All statistics, analytics, and achievements')).toBeInTheDocument();
      expect(screen.getByText('All deck data and flashcards')).toBeInTheDocument();
      expect(screen.getByText('All settings and preferences')).toBeInTheDocument();
    });

    it('should display warning text', () => {
      renderWithI18n(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />);

      expect(
        screen.getByText('This action cannot be undone. All data will be lost permanently.')
      ).toBeInTheDocument();
    });

    it('should have all required data-testid attributes', () => {
      renderWithI18n(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.getByTestId('delete-account-modal')).toBeInTheDocument();
      expect(screen.getByTestId('delete-account-title')).toBeInTheDocument();
      expect(screen.getByTestId('delete-confirmation-input')).toBeInTheDocument();
      expect(screen.getByTestId('delete-cancel-button')).toBeInTheDocument();
      expect(screen.getByTestId('delete-confirm-button')).toBeInTheDocument();
    });

    it('should display confirmation input with placeholder', () => {
      renderWithI18n(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />);

      const input = screen.getByTestId('delete-confirmation-input');
      expect(input).toHaveAttribute('placeholder', 'Type DELETE');
    });
  });

  describe('PostHog Events', () => {
    it('should fire delete_account_modal_opened event when modal opens', () => {
      renderWithI18n(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />);

      expect(posthog.capture).toHaveBeenCalledWith('delete_account_modal_opened');
    });

    it('should not fire event when modal is closed', () => {
      renderWithI18n(<DeleteAccountDialog open={false} onOpenChange={mockOnOpenChange} />);

      expect(posthog.capture).not.toHaveBeenCalled();
    });

    it('should fire delete_account_cancelled event when cancel is clicked', async () => {
      const user = userEvent.setup();
      renderWithI18n(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />);

      await user.click(screen.getByTestId('delete-cancel-button'));

      expect(posthog.capture).toHaveBeenCalledWith('delete_account_cancelled');
    });

    it('should fire delete_account_confirmed event on successful delete', async () => {
      const user = userEvent.setup();
      const { usersAPI } = await import('@/services/usersAPI');
      vi.mocked(usersAPI.deleteAccount).mockResolvedValueOnce();
      mockLogout.mockResolvedValueOnce(undefined);

      renderWithI18n(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />);

      // Type the confirmation word
      await user.type(screen.getByTestId('delete-confirmation-input'), 'DELETE');
      await user.click(screen.getByTestId('delete-confirm-button'));

      await waitFor(() => {
        expect(posthog.capture).toHaveBeenCalledWith('delete_account_confirmed');
      });
    });
  });

  describe('Confirmation Input Validation', () => {
    it('should have confirm button disabled when input is empty', () => {
      renderWithI18n(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.getByTestId('delete-confirm-button')).toBeDisabled();
    });

    it('should have confirm button disabled when input is partial match', async () => {
      const user = userEvent.setup();
      renderWithI18n(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />);

      await user.type(screen.getByTestId('delete-confirmation-input'), 'DEL');

      expect(screen.getByTestId('delete-confirm-button')).toBeDisabled();
    });

    it('should have confirm button disabled when case does not match', async () => {
      const user = userEvent.setup();
      renderWithI18n(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />);

      await user.type(screen.getByTestId('delete-confirmation-input'), 'delete');

      expect(screen.getByTestId('delete-confirm-button')).toBeDisabled();
    });

    it('should have confirm button enabled when input matches exactly', async () => {
      const user = userEvent.setup();
      renderWithI18n(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />);

      await user.type(screen.getByTestId('delete-confirmation-input'), 'DELETE');

      expect(screen.getByTestId('delete-confirm-button')).not.toBeDisabled();
    });

    it('should have confirm button disabled when input has extra characters', async () => {
      const user = userEvent.setup();
      renderWithI18n(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />);

      await user.type(screen.getByTestId('delete-confirmation-input'), 'DELETEE');

      expect(screen.getByTestId('delete-confirm-button')).toBeDisabled();
    });
  });

  describe('API Integration', () => {
    it('should call usersAPI.deleteAccount when confirm is clicked', async () => {
      const user = userEvent.setup();
      const { usersAPI } = await import('@/services/usersAPI');
      vi.mocked(usersAPI.deleteAccount).mockResolvedValueOnce();
      mockLogout.mockResolvedValueOnce(undefined);

      renderWithI18n(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />);

      await user.type(screen.getByTestId('delete-confirmation-input'), 'DELETE');
      await user.click(screen.getByTestId('delete-confirm-button'));

      await waitFor(() => {
        expect(usersAPI.deleteAccount).toHaveBeenCalledTimes(1);
      });
    });

    it('should call logout on successful delete', async () => {
      const user = userEvent.setup();
      const { usersAPI } = await import('@/services/usersAPI');
      vi.mocked(usersAPI.deleteAccount).mockResolvedValueOnce();
      mockLogout.mockResolvedValueOnce(undefined);

      renderWithI18n(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />);

      await user.type(screen.getByTestId('delete-confirmation-input'), 'DELETE');
      await user.click(screen.getByTestId('delete-confirm-button'));

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalledTimes(1);
      });
    });

    it('should display error message on API failure', async () => {
      const user = userEvent.setup();
      const { usersAPI } = await import('@/services/usersAPI');
      vi.mocked(usersAPI.deleteAccount).mockRejectedValueOnce(new Error('API Error'));

      renderWithI18n(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />);

      await user.type(screen.getByTestId('delete-confirmation-input'), 'DELETE');
      await user.click(screen.getByTestId('delete-confirm-button'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-error')).toBeInTheDocument();
        expect(screen.getByTestId('delete-error')).toHaveTextContent('Failed to delete account');
      });
    });

    it('should not call logout on API failure', async () => {
      const user = userEvent.setup();
      const { usersAPI } = await import('@/services/usersAPI');
      vi.mocked(usersAPI.deleteAccount).mockRejectedValueOnce(new Error('API Error'));

      renderWithI18n(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />);

      await user.type(screen.getByTestId('delete-confirmation-input'), 'DELETE');
      await user.click(screen.getByTestId('delete-confirm-button'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-error')).toBeInTheDocument();
      });

      expect(mockLogout).not.toHaveBeenCalled();
    });
  });

  describe('Cancel Behavior', () => {
    it('should close modal when cancel is clicked', async () => {
      const user = userEvent.setup();
      renderWithI18n(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />);

      await user.click(screen.getByTestId('delete-cancel-button'));

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Loading State', () => {
    it('should disable buttons while deleting', async () => {
      const user = userEvent.setup();
      const { usersAPI } = await import('@/services/usersAPI');
      // Create a promise that we can control
      let resolvePromise: () => void;
      const controlledPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(usersAPI.deleteAccount).mockReturnValueOnce(controlledPromise);

      renderWithI18n(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />);

      // Type confirmation and click delete to start loading
      await user.type(screen.getByTestId('delete-confirmation-input'), 'DELETE');
      await user.click(screen.getByTestId('delete-confirm-button'));

      // Buttons should be disabled
      expect(screen.getByTestId('delete-cancel-button')).toBeDisabled();
      expect(screen.getByTestId('delete-confirm-button')).toBeDisabled();

      // Should show loading text
      expect(screen.getByText('Deleting...')).toBeInTheDocument();

      // Resolve the promise to clean up
      resolvePromise!();
    });

    it('should show loading spinner while deleting', async () => {
      const user = userEvent.setup();
      const { usersAPI } = await import('@/services/usersAPI');
      let resolvePromise: () => void;
      const controlledPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(usersAPI.deleteAccount).mockReturnValueOnce(controlledPromise);

      renderWithI18n(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />);

      await user.type(screen.getByTestId('delete-confirmation-input'), 'DELETE');
      await user.click(screen.getByTestId('delete-confirm-button'));

      // The Loader2 component should be present (it has the animate-spin class)
      const confirmButton = screen.getByTestId('delete-confirm-button');
      expect(confirmButton.querySelector('.animate-spin')).toBeInTheDocument();

      // Resolve the promise to clean up
      resolvePromise!();
    });

    it('should disable input while deleting', async () => {
      const user = userEvent.setup();
      const { usersAPI } = await import('@/services/usersAPI');
      let resolvePromise: () => void;
      const controlledPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(usersAPI.deleteAccount).mockReturnValueOnce(controlledPromise);

      renderWithI18n(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />);

      await user.type(screen.getByTestId('delete-confirmation-input'), 'DELETE');
      await user.click(screen.getByTestId('delete-confirm-button'));

      expect(screen.getByTestId('delete-confirmation-input')).toBeDisabled();

      // Resolve the promise to clean up
      resolvePromise!();
    });

    it('should re-enable buttons after error', async () => {
      const user = userEvent.setup();
      const { usersAPI } = await import('@/services/usersAPI');
      vi.mocked(usersAPI.deleteAccount).mockRejectedValueOnce(new Error('API Error'));

      renderWithI18n(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />);

      await user.type(screen.getByTestId('delete-confirmation-input'), 'DELETE');
      await user.click(screen.getByTestId('delete-confirm-button'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-error')).toBeInTheDocument();
      });

      // Buttons should be enabled again
      expect(screen.getByTestId('delete-cancel-button')).not.toBeDisabled();
      expect(screen.getByTestId('delete-confirm-button')).not.toBeDisabled();
    });
  });

  describe('Modal Close Prevention During Loading', () => {
    it('should not close modal while deleting', async () => {
      const user = userEvent.setup();
      const { usersAPI } = await import('@/services/usersAPI');
      let resolvePromise: () => void;
      const controlledPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(usersAPI.deleteAccount).mockReturnValueOnce(controlledPromise);

      renderWithI18n(<DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />);

      // Type confirmation and start the delete
      await user.type(screen.getByTestId('delete-confirmation-input'), 'DELETE');
      await user.click(screen.getByTestId('delete-confirm-button'));

      // Clear the mock to check only subsequent calls
      mockOnOpenChange.mockClear();

      // The cancel button should be disabled, preventing the click
      expect(screen.getByTestId('delete-cancel-button')).toBeDisabled();

      // Resolve the promise to clean up
      resolvePromise!();
    });
  });

  describe('Input State Reset', () => {
    it('should clear input and error when modal is reopened', async () => {
      const user = userEvent.setup();
      const { usersAPI } = await import('@/services/usersAPI');
      vi.mocked(usersAPI.deleteAccount).mockRejectedValueOnce(new Error('API Error'));

      const { rerender } = renderWithI18n(
        <DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />
      );

      // Type confirmation and trigger error
      await user.type(screen.getByTestId('delete-confirmation-input'), 'DELETE');
      await user.click(screen.getByTestId('delete-confirm-button'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-error')).toBeInTheDocument();
      });

      // Close modal via cancel
      await user.click(screen.getByTestId('delete-cancel-button'));

      // Reopen modal
      rerender(
        <I18nextProvider i18n={setupI18n()}>
          <DeleteAccountDialog open={true} onOpenChange={mockOnOpenChange} />
        </I18nextProvider>
      );

      // Input should be empty and error should not be visible
      expect(screen.getByTestId('delete-confirmation-input')).toHaveValue('');
      expect(screen.queryByTestId('delete-error')).not.toBeInTheDocument();
    });
  });
});
