/**
 * UserDeckForm Component Tests
 *
 * Tests for the UserDeckForm component, covering:
 * - Create and edit mode rendering
 * - Field validation (name required, max lengths)
 * - Level selection with A1 default
 * - No is_active or is_premium toggles (user decks only)
 * - Form submission with correct payload
 * - Cancel functionality
 * - Loading state handling
 * - Translation usage for labels and validation
 *
 * Related feature: [DECKCREAT-05] Frontend - User Deck Form Component
 */

import React from 'react';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import { UserDeckForm, type UserDeckFormProps } from '../UserDeckForm';
import type { CreateDeckInput, DeckLevel } from '@/services/deckAPI';
import i18n from '@/i18n';

// Mock deck for edit mode testing
const createMockDeck = (
  overrides: Partial<{ name: string; description: string | null; level: DeckLevel }> = {}
) => ({
  name: 'Test User Deck',
  description: 'A test description',
  level: 'B1' as DeckLevel,
  ...overrides,
});

// Wrapper component with i18n provider
const renderWithI18n = (ui: React.ReactElement) => {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
};

describe('UserDeckForm', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Create Mode Rendering', () => {
    it('should render empty form in create mode', () => {
      renderWithI18n(
        <UserDeckForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      // Check form exists
      expect(screen.getByTestId('user-deck-form')).toBeInTheDocument();

      // Name field should be empty
      const nameInput = screen.getByTestId('user-deck-form-name');
      expect(nameInput).toHaveValue('');

      // Description field should be empty
      const descInput = screen.getByTestId('user-deck-form-description');
      expect(descInput).toHaveValue('');

      // Level should default to A1
      const levelTrigger = screen.getByTestId('user-deck-form-level');
      expect(levelTrigger).toHaveTextContent('A1');
    });

    it('should render Create Deck button text in create mode', () => {
      renderWithI18n(
        <UserDeckForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      const submitButton = screen.getByTestId('user-deck-form-submit');
      expect(submitButton).toHaveTextContent('Create Deck');
    });

    it('should render Cancel button', () => {
      renderWithI18n(
        <UserDeckForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      const cancelButton = screen.getByTestId('user-deck-form-cancel');
      expect(cancelButton).toHaveTextContent('Cancel');
    });
  });

  describe('Edit Mode Rendering', () => {
    it('should pre-populate fields in edit mode', () => {
      const deck = createMockDeck();

      renderWithI18n(
        <UserDeckForm mode="edit" deck={deck} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      // Name should be pre-filled
      const nameInput = screen.getByTestId('user-deck-form-name');
      expect(nameInput).toHaveValue('Test User Deck');

      // Description should be pre-filled
      const descInput = screen.getByTestId('user-deck-form-description');
      expect(descInput).toHaveValue('A test description');

      // Level should show B1
      const levelTrigger = screen.getByTestId('user-deck-form-level');
      expect(levelTrigger).toHaveTextContent('B1');
    });

    it('should render Save Changes button text in edit mode', () => {
      const deck = createMockDeck();

      renderWithI18n(
        <UserDeckForm mode="edit" deck={deck} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      const submitButton = screen.getByTestId('user-deck-form-submit');
      expect(submitButton).toHaveTextContent('Save Changes');
    });

    it('should handle null description in edit mode', () => {
      const deck = createMockDeck({ description: null });

      renderWithI18n(
        <UserDeckForm mode="edit" deck={deck} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      const descInput = screen.getByTestId('user-deck-form-description');
      expect(descInput).toHaveValue('');
    });
  });

  describe('No Admin Fields', () => {
    it('should not render is_active toggle', () => {
      renderWithI18n(
        <UserDeckForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      // Check that no active toggle exists
      expect(screen.queryByTestId('deck-edit-is-active')).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/active/i)).not.toBeInTheDocument();
    });

    it('should not render is_premium toggle', () => {
      renderWithI18n(
        <UserDeckForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      // Check that no premium toggle exists
      expect(screen.queryByTestId('deck-edit-is-premium')).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/premium/i)).not.toBeInTheDocument();
    });
  });

  describe('Field Validation', () => {
    it('should disable submit button when name is empty', async () => {
      renderWithI18n(
        <UserDeckForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      const submitButton = screen.getByTestId('user-deck-form-submit');
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when name is provided', async () => {
      const user = userEvent.setup();

      renderWithI18n(
        <UserDeckForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      const nameInput = screen.getByTestId('user-deck-form-name');
      await user.type(nameInput, 'My New Deck');

      const submitButton = screen.getByTestId('user-deck-form-submit');
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });

    it('should show error when name exceeds 255 characters', async () => {
      const user = userEvent.setup();

      renderWithI18n(
        <UserDeckForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      const nameInput = screen.getByTestId('user-deck-form-name');
      const longName = 'a'.repeat(256);
      await user.type(nameInput, longName);

      // Wait for validation to trigger and error to show
      // FormMessage component uses error.message which contains the translated text
      await waitFor(() => {
        // The error message should be displayed - either translated or as key
        const form = screen.getByTestId('user-deck-form');
        expect(form.textContent).toMatch(/255|nameMaxLength/);
      });

      // Submit should be disabled due to validation error
      const submitButton = screen.getByTestId('user-deck-form-submit');
      expect(submitButton).toBeDisabled();
    }, 10000);

    it('should show error when description exceeds 1000 characters', async () => {
      const user = userEvent.setup();

      renderWithI18n(
        <UserDeckForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      // First provide a valid name
      const nameInput = screen.getByTestId('user-deck-form-name');
      await user.type(nameInput, 'Valid Name');

      // Then type a very long description
      const descInput = screen.getByTestId('user-deck-form-description');
      const longDesc = 'a'.repeat(1001);
      await user.type(descInput, longDesc);

      // Wait for validation to trigger and error to show
      await waitFor(() => {
        const form = screen.getByTestId('user-deck-form');
        expect(form.textContent).toMatch(/1000|descriptionMaxLength/);
      });
    }, 15000);
  });

  describe('Level Selection', () => {
    it('should render level select with default A1 value', () => {
      renderWithI18n(
        <UserDeckForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      // Level trigger should show default A1
      const levelTrigger = screen.getByTestId('user-deck-form-level');
      expect(levelTrigger).toBeInTheDocument();
      expect(levelTrigger).toHaveTextContent('A1');
    });

    it('should have level field configured in the form', () => {
      renderWithI18n(
        <UserDeckForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      // The level select should be a combobox (Radix Select pattern)
      const levelTrigger = screen.getByTestId('user-deck-form-level');
      expect(levelTrigger).toHaveAttribute('role', 'combobox');
    });

    it('should show different level when deck has different level in edit mode', () => {
      const deck = createMockDeck({ level: 'C2' });

      renderWithI18n(
        <UserDeckForm mode="edit" deck={deck} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      const levelTrigger = screen.getByTestId('user-deck-form-level');
      expect(levelTrigger).toHaveTextContent('C2');
    });
  });

  describe('Form Submission', () => {
    it('should call onSubmit with correct data in create mode', async () => {
      const user = userEvent.setup();

      renderWithI18n(
        <UserDeckForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      // Fill in the form (level will use default A1 due to Radix Select test limitations)
      const nameInput = screen.getByTestId('user-deck-form-name');
      await user.type(nameInput, 'My Greek Vocabulary');

      const descInput = screen.getByTestId('user-deck-form-description');
      await user.type(descInput, 'Basic words for beginners');

      // Submit the form
      const submitButton = screen.getByTestId('user-deck-form-submit');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      });

      const submittedData = mockOnSubmit.mock.calls[0][0] as CreateDeckInput;
      expect(submittedData.name).toBe('My Greek Vocabulary');
      expect(submittedData.description).toBe('Basic words for beginners');
      expect(submittedData.level).toBe('A1'); // Default level
    });

    it('should not include description if empty', async () => {
      const user = userEvent.setup();

      renderWithI18n(
        <UserDeckForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      // Only fill name, leave description empty
      const nameInput = screen.getByTestId('user-deck-form-name');
      await user.type(nameInput, 'Name Only Deck');

      // Submit the form
      const submitButton = screen.getByTestId('user-deck-form-submit');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      });

      const submittedData = mockOnSubmit.mock.calls[0][0] as CreateDeckInput;
      expect(submittedData.name).toBe('Name Only Deck');
      expect(submittedData.description).toBeUndefined();
      expect(submittedData.level).toBe('A1'); // Default
    });

    it('should trim whitespace from description', async () => {
      const user = userEvent.setup();

      renderWithI18n(
        <UserDeckForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      const nameInput = screen.getByTestId('user-deck-form-name');
      await user.type(nameInput, 'Deck Name');

      const descInput = screen.getByTestId('user-deck-form-description');
      await user.type(descInput, '  Trimmed description  ');

      const submitButton = screen.getByTestId('user-deck-form-submit');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      });

      const submittedData = mockOnSubmit.mock.calls[0][0] as CreateDeckInput;
      expect(submittedData.description).toBe('Trimmed description');
    });

    it('should not include description if only whitespace', async () => {
      const user = userEvent.setup();

      renderWithI18n(
        <UserDeckForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      const nameInput = screen.getByTestId('user-deck-form-name');
      await user.type(nameInput, 'Deck Name');

      const descInput = screen.getByTestId('user-deck-form-description');
      await user.type(descInput, '   ');

      const submitButton = screen.getByTestId('user-deck-form-submit');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      });

      const submittedData = mockOnSubmit.mock.calls[0][0] as CreateDeckInput;
      expect(submittedData.description).toBeUndefined();
    });
  });

  describe('Cancel Functionality', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();

      renderWithI18n(
        <UserDeckForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      const cancelButton = screen.getByTestId('user-deck-form-cancel');
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('should disable submit button when loading', () => {
      renderWithI18n(
        <UserDeckForm
          mode="edit"
          deck={createMockDeck()}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isLoading={true}
        />
      );

      const submitButton = screen.getByTestId('user-deck-form-submit');
      expect(submitButton).toBeDisabled();
    });

    it('should show Creating... text when loading in create mode', () => {
      renderWithI18n(
        <UserDeckForm
          mode="create"
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isLoading={true}
        />
      );

      const submitButton = screen.getByTestId('user-deck-form-submit');
      expect(submitButton).toHaveTextContent('Creating...');
    });

    it('should show Saving... text when loading in edit mode', () => {
      renderWithI18n(
        <UserDeckForm
          mode="edit"
          deck={createMockDeck()}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isLoading={true}
        />
      );

      const submitButton = screen.getByTestId('user-deck-form-submit');
      expect(submitButton).toHaveTextContent('Saving...');
    });
  });

  describe('Form Labels and Placeholders', () => {
    it('should display correct labels from translations', () => {
      renderWithI18n(
        <UserDeckForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      // Labels should be visible
      expect(screen.getByText('Deck Name')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Level')).toBeInTheDocument();
    });

    it('should display correct placeholders from translations', () => {
      renderWithI18n(
        <UserDeckForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      const nameInput = screen.getByTestId('user-deck-form-name');
      expect(nameInput).toHaveAttribute('placeholder', 'Enter deck name...');

      const descInput = screen.getByTestId('user-deck-form-description');
      expect(descInput).toHaveAttribute(
        'placeholder',
        'Enter a description for your deck (optional)...'
      );
    });
  });

  describe('Test ID Attributes', () => {
    it('should have all required test IDs for automation', () => {
      renderWithI18n(
        <UserDeckForm mode="create" onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      expect(screen.getByTestId('user-deck-form')).toBeInTheDocument();
      expect(screen.getByTestId('user-deck-form-name')).toBeInTheDocument();
      expect(screen.getByTestId('user-deck-form-description')).toBeInTheDocument();
      expect(screen.getByTestId('user-deck-form-level')).toBeInTheDocument();
      expect(screen.getByTestId('user-deck-form-cancel')).toBeInTheDocument();
      expect(screen.getByTestId('user-deck-form-submit')).toBeInTheDocument();
    });
  });
});
