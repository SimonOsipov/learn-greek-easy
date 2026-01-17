/**
 * UserDeckEditModal Component Tests
 *
 * Tests for the UserDeckEditModal component, covering:
 * - Create and edit mode rendering with correct titles
 * - Modal open/close behavior
 * - Integration with UserDeckForm component
 * - API calls for create and update
 * - Toast notifications on success/error
 * - Loading state prevents modal close
 * - onSuccess callback triggers parent refresh
 *
 * Related feature: [DECKCREAT-06] Frontend - User Deck Edit Modal
 */

import React from 'react';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import { UserDeckEditModal, type UserDeckEditModalProps } from '../UserDeckEditModal';
import { deckAPI } from '@/services/deckAPI';
import type { DeckResponse, DeckLevel } from '@/services/deckAPI';
import i18n from '@/i18n';

// Mock the deckAPI
vi.mock('@/services/deckAPI', () => ({
  deckAPI: {
    createDeck: vi.fn(),
    updateMyDeck: vi.fn(),
  },
}));

// Mock the useToast hook
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock deck response
const createMockDeckResponse = (overrides: Partial<DeckResponse> = {}): DeckResponse => ({
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Test Deck',
  description: 'A test description',
  level: 'B1' as DeckLevel,
  is_active: true,
  is_premium: false,
  owner_id: 'user-123',
  category: null,
  author: 'Test User',
  card_count: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  due_count: 0,
  mastered_count: 0,
  learning_count: 0,
  ...overrides,
});

// Mock deck for edit mode
const createMockEditDeck = (
  overrides: Partial<{
    id: string;
    name: string;
    description: string | null;
    level: DeckLevel;
  }> = {}
) => ({
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Existing Deck',
  description: 'Existing description',
  level: 'B1' as DeckLevel,
  ...overrides,
});

// Wrapper component with i18n provider
const renderWithI18n = (ui: React.ReactElement) => {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
};

describe('UserDeckEditModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Create Mode Rendering', () => {
    it('should render modal with create title when mode is create', () => {
      renderWithI18n(<UserDeckEditModal isOpen={true} onClose={mockOnClose} mode="create" />);

      expect(screen.getByTestId('user-deck-modal')).toBeInTheDocument();
      expect(screen.getByTestId('user-deck-modal-title')).toHaveTextContent('Create New Deck');
    });

    it('should render create description text', () => {
      renderWithI18n(<UserDeckEditModal isOpen={true} onClose={mockOnClose} mode="create" />);

      expect(
        screen.getByText('Create a new vocabulary deck to organize your learning')
      ).toBeInTheDocument();
    });

    it('should render UserDeckForm with empty fields in create mode', () => {
      renderWithI18n(<UserDeckEditModal isOpen={true} onClose={mockOnClose} mode="create" />);

      // The form should be rendered with empty fields
      expect(screen.getByTestId('user-deck-form')).toBeInTheDocument();
      expect(screen.getByTestId('user-deck-form-name')).toHaveValue('');
    });
  });

  describe('Edit Mode Rendering', () => {
    it('should render modal with edit title when mode is edit', () => {
      const deck = createMockEditDeck();

      renderWithI18n(
        <UserDeckEditModal isOpen={true} onClose={mockOnClose} mode="edit" deck={deck} />
      );

      expect(screen.getByTestId('user-deck-modal-title')).toHaveTextContent('Edit Deck');
    });

    it('should render edit description text', () => {
      const deck = createMockEditDeck();

      renderWithI18n(
        <UserDeckEditModal isOpen={true} onClose={mockOnClose} mode="edit" deck={deck} />
      );

      expect(
        screen.getByText("Update your deck's name, description, or level")
      ).toBeInTheDocument();
    });

    it('should pre-populate form with deck data in edit mode', () => {
      const deck = createMockEditDeck({
        name: 'My Greek Deck',
        description: 'Learning Greek vocabulary',
        level: 'A2',
      });

      renderWithI18n(
        <UserDeckEditModal isOpen={true} onClose={mockOnClose} mode="edit" deck={deck} />
      );

      expect(screen.getByTestId('user-deck-form-name')).toHaveValue('My Greek Deck');
      expect(screen.getByTestId('user-deck-form-description')).toHaveValue(
        'Learning Greek vocabulary'
      );
      expect(screen.getByTestId('user-deck-form-level')).toHaveTextContent('A2');
    });
  });

  describe('Modal Open/Close Behavior', () => {
    it('should not render modal content when isOpen is false', () => {
      renderWithI18n(<UserDeckEditModal isOpen={false} onClose={mockOnClose} mode="create" />);

      expect(screen.queryByTestId('user-deck-modal')).not.toBeInTheDocument();
    });

    it('should render modal content when isOpen is true', () => {
      renderWithI18n(<UserDeckEditModal isOpen={true} onClose={mockOnClose} mode="create" />);

      expect(screen.getByTestId('user-deck-modal')).toBeInTheDocument();
    });

    it('should call onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();

      renderWithI18n(<UserDeckEditModal isOpen={true} onClose={mockOnClose} mode="create" />);

      const cancelButton = screen.getByTestId('user-deck-form-cancel');
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Create Mode API Integration', () => {
    it('should call createDeck API on submit in create mode', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockDeckResponse({ name: 'New Test Deck' });
      vi.mocked(deckAPI.createDeck).mockResolvedValueOnce(mockResponse);

      renderWithI18n(
        <UserDeckEditModal
          isOpen={true}
          onClose={mockOnClose}
          mode="create"
          onSuccess={mockOnSuccess}
        />
      );

      // Fill in the form
      const nameInput = screen.getByTestId('user-deck-form-name');
      await user.type(nameInput, 'New Test Deck');

      // Submit the form
      const submitButton = screen.getByTestId('user-deck-form-submit');
      await user.click(submitButton);

      await waitFor(() => {
        expect(deckAPI.createDeck).toHaveBeenCalledTimes(1);
        expect(deckAPI.createDeck).toHaveBeenCalledWith({
          name: 'New Test Deck',
          level: 'A1',
        });
      });
    });

    it('should show success toast on successful create', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockDeckResponse();
      vi.mocked(deckAPI.createDeck).mockResolvedValueOnce(mockResponse);

      renderWithI18n(<UserDeckEditModal isOpen={true} onClose={mockOnClose} mode="create" />);

      const nameInput = screen.getByTestId('user-deck-form-name');
      await user.type(nameInput, 'Test Deck');

      const submitButton = screen.getByTestId('user-deck-form-submit');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Deck created successfully',
        });
      });
    });

    it('should call onSuccess callback with created deck on successful create', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockDeckResponse({ id: 'new-deck-id', name: 'Created Deck' });
      vi.mocked(deckAPI.createDeck).mockResolvedValueOnce(mockResponse);

      renderWithI18n(
        <UserDeckEditModal
          isOpen={true}
          onClose={mockOnClose}
          mode="create"
          onSuccess={mockOnSuccess}
        />
      );

      const nameInput = screen.getByTestId('user-deck-form-name');
      await user.type(nameInput, 'Created Deck');

      const submitButton = screen.getByTestId('user-deck-form-submit');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledTimes(1);
        expect(mockOnSuccess).toHaveBeenCalledWith(mockResponse);
      });
    });

    it('should close modal on successful create', async () => {
      const user = userEvent.setup();
      const mockResponse = createMockDeckResponse();
      vi.mocked(deckAPI.createDeck).mockResolvedValueOnce(mockResponse);

      renderWithI18n(<UserDeckEditModal isOpen={true} onClose={mockOnClose} mode="create" />);

      const nameInput = screen.getByTestId('user-deck-form-name');
      await user.type(nameInput, 'Test Deck');

      const submitButton = screen.getByTestId('user-deck-form-submit');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });

    it('should show error toast on create failure', async () => {
      const user = userEvent.setup();
      vi.mocked(deckAPI.createDeck).mockRejectedValueOnce(new Error('API Error'));

      renderWithI18n(<UserDeckEditModal isOpen={true} onClose={mockOnClose} mode="create" />);

      const nameInput = screen.getByTestId('user-deck-form-name');
      await user.type(nameInput, 'Test Deck');

      const submitButton = screen.getByTestId('user-deck-form-submit');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Failed to create deck',
          variant: 'destructive',
        });
      });
    });

    it('should not close modal on create failure', async () => {
      const user = userEvent.setup();
      vi.mocked(deckAPI.createDeck).mockRejectedValueOnce(new Error('API Error'));

      renderWithI18n(<UserDeckEditModal isOpen={true} onClose={mockOnClose} mode="create" />);

      const nameInput = screen.getByTestId('user-deck-form-name');
      await user.type(nameInput, 'Test Deck');

      const submitButton = screen.getByTestId('user-deck-form-submit');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled();
      });

      // Modal should still be open, onClose should not have been called
      // (checking that it was not called after the error)
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Edit Mode API Integration', () => {
    it('should call updateMyDeck API on submit in edit mode', async () => {
      const user = userEvent.setup();
      const deck = createMockEditDeck({ id: 'deck-123', name: 'Old Name' });
      const mockResponse = createMockDeckResponse({ id: 'deck-123', name: 'Updated Name' });
      vi.mocked(deckAPI.updateMyDeck).mockResolvedValueOnce(mockResponse);

      renderWithI18n(
        <UserDeckEditModal
          isOpen={true}
          onClose={mockOnClose}
          mode="edit"
          deck={deck}
          onSuccess={mockOnSuccess}
        />
      );

      // Clear and update the name
      const nameInput = screen.getByTestId('user-deck-form-name');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Name');

      const submitButton = screen.getByTestId('user-deck-form-submit');
      await user.click(submitButton);

      await waitFor(() => {
        expect(deckAPI.updateMyDeck).toHaveBeenCalledTimes(1);
        expect(deckAPI.updateMyDeck).toHaveBeenCalledWith('deck-123', {
          name: 'Updated Name',
          description: 'Existing description',
          level: 'B1',
        });
      });
    });

    it('should show success toast on successful edit', async () => {
      const user = userEvent.setup();
      const deck = createMockEditDeck();
      const mockResponse = createMockDeckResponse();
      vi.mocked(deckAPI.updateMyDeck).mockResolvedValueOnce(mockResponse);

      renderWithI18n(
        <UserDeckEditModal isOpen={true} onClose={mockOnClose} mode="edit" deck={deck} />
      );

      const submitButton = screen.getByTestId('user-deck-form-submit');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Deck updated successfully',
        });
      });
    });

    it('should call onSuccess callback with updated deck on successful edit', async () => {
      const user = userEvent.setup();
      const deck = createMockEditDeck({ id: 'deck-456' });
      const mockResponse = createMockDeckResponse({ id: 'deck-456', name: 'Updated Deck' });
      vi.mocked(deckAPI.updateMyDeck).mockResolvedValueOnce(mockResponse);

      renderWithI18n(
        <UserDeckEditModal
          isOpen={true}
          onClose={mockOnClose}
          mode="edit"
          deck={deck}
          onSuccess={mockOnSuccess}
        />
      );

      const submitButton = screen.getByTestId('user-deck-form-submit');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledTimes(1);
        expect(mockOnSuccess).toHaveBeenCalledWith(mockResponse);
      });
    });

    it('should show error toast on edit failure', async () => {
      const user = userEvent.setup();
      const deck = createMockEditDeck();
      vi.mocked(deckAPI.updateMyDeck).mockRejectedValueOnce(new Error('API Error'));

      renderWithI18n(
        <UserDeckEditModal isOpen={true} onClose={mockOnClose} mode="edit" deck={deck} />
      );

      const submitButton = screen.getByTestId('user-deck-form-submit');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Failed to update deck',
          variant: 'destructive',
        });
      });
    });

    it('should throw error if deck ID is missing in edit mode', async () => {
      const user = userEvent.setup();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Deck without id (simulating edge case)
      const deck = { name: 'Test', description: 'Desc', level: 'A1' as DeckLevel };

      renderWithI18n(
        <UserDeckEditModal isOpen={true} onClose={mockOnClose} mode="edit" deck={deck as any} />
      );

      const submitButton = screen.getByTestId('user-deck-form-submit');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Failed to update deck',
          variant: 'destructive',
        });
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Loading State', () => {
    it('should show loading text in submit button during API call', async () => {
      const user = userEvent.setup();
      // Create a promise that we can control
      let resolvePromise: (value: DeckResponse) => void;
      const pendingPromise = new Promise<DeckResponse>((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(deckAPI.createDeck).mockReturnValueOnce(pendingPromise);

      renderWithI18n(<UserDeckEditModal isOpen={true} onClose={mockOnClose} mode="create" />);

      const nameInput = screen.getByTestId('user-deck-form-name');
      await user.type(nameInput, 'Test Deck');

      const submitButton = screen.getByTestId('user-deck-form-submit');
      await user.click(submitButton);

      // Button should show loading text
      await waitFor(() => {
        expect(submitButton).toHaveTextContent('Creating...');
      });

      // Resolve the promise to clean up
      resolvePromise!(createMockDeckResponse());
    });

    it('should disable submit button during loading', async () => {
      const user = userEvent.setup();
      let resolvePromise: (value: DeckResponse) => void;
      const pendingPromise = new Promise<DeckResponse>((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(deckAPI.createDeck).mockReturnValueOnce(pendingPromise);

      renderWithI18n(<UserDeckEditModal isOpen={true} onClose={mockOnClose} mode="create" />);

      const nameInput = screen.getByTestId('user-deck-form-name');
      await user.type(nameInput, 'Test Deck');

      const submitButton = screen.getByTestId('user-deck-form-submit');
      await user.click(submitButton);

      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });

      // Resolve the promise to clean up
      resolvePromise!(createMockDeckResponse());
    });
  });

  describe('Props Interface', () => {
    it('should accept all required props', () => {
      // This test verifies TypeScript props are correct at runtime
      const props: UserDeckEditModalProps = {
        isOpen: true,
        onClose: mockOnClose,
        mode: 'create',
      };

      renderWithI18n(<UserDeckEditModal {...props} />);
      expect(screen.getByTestId('user-deck-modal')).toBeInTheDocument();
    });

    it('should accept optional deck prop for edit mode', () => {
      const props: UserDeckEditModalProps = {
        isOpen: true,
        onClose: mockOnClose,
        mode: 'edit',
        deck: createMockEditDeck(),
      };

      renderWithI18n(<UserDeckEditModal {...props} />);
      expect(screen.getByTestId('user-deck-modal')).toBeInTheDocument();
    });

    it('should accept optional onSuccess callback', () => {
      const props: UserDeckEditModalProps = {
        isOpen: true,
        onClose: mockOnClose,
        mode: 'create',
        onSuccess: mockOnSuccess,
      };

      renderWithI18n(<UserDeckEditModal {...props} />);
      expect(screen.getByTestId('user-deck-modal')).toBeInTheDocument();
    });
  });

  describe('Test IDs', () => {
    it('should have modal test ID for automation', () => {
      renderWithI18n(<UserDeckEditModal isOpen={true} onClose={mockOnClose} mode="create" />);

      expect(screen.getByTestId('user-deck-modal')).toBeInTheDocument();
    });

    it('should have modal title test ID for automation', () => {
      renderWithI18n(<UserDeckEditModal isOpen={true} onClose={mockOnClose} mode="create" />);

      expect(screen.getByTestId('user-deck-modal-title')).toBeInTheDocument();
    });
  });

  describe('Form Key Reset', () => {
    it('should use different form key for create vs edit to reset form state', () => {
      const { rerender } = renderWithI18n(
        <UserDeckEditModal isOpen={true} onClose={mockOnClose} mode="create" />
      );

      // Form should be empty in create mode
      expect(screen.getByTestId('user-deck-form-name')).toHaveValue('');

      // Switch to edit mode with deck data
      const deck = createMockEditDeck({ name: 'Edit Mode Deck' });
      rerender(
        <I18nextProvider i18n={i18n}>
          <UserDeckEditModal isOpen={true} onClose={mockOnClose} mode="edit" deck={deck} />
        </I18nextProvider>
      );

      // Form should be pre-populated in edit mode
      expect(screen.getByTestId('user-deck-form-name')).toHaveValue('Edit Mode Deck');
    });
  });
});
