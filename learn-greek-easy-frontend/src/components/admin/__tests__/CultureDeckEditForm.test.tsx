/**
 * CultureDeckEditForm Component Tests
 *
 * Tests for the CultureDeckEditForm component, focusing on:
 * - Premium toggle rendering below active toggle
 * - Premium toggle reflects initial is_premium value
 * - Toggling premium updates form state
 * - Form submission includes is_premium in payload
 *
 * Related feature: [PREMBDG] Premium Badge for Decks
 */

import React from 'react';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import { CultureDeckEditForm, type CultureDeckFormData } from '../CultureDeckEditForm';
import type { UnifiedDeckItem } from '@/services/adminAPI';
import i18n from '@/i18n';

// Extended deck type with trilingual fields for testing
interface TrilingualMockDeck extends UnifiedDeckItem {
  name_el?: string;
  name_en?: string;
  name_ru?: string;
  description_el?: string;
  description_en?: string;
  description_ru?: string;
}

// Mock deck for testing with trilingual support
const createMockDeck = (overrides: Partial<TrilingualMockDeck> = {}): TrilingualMockDeck => ({
  id: 'test-culture-deck-1',
  name: 'Test Culture Deck',
  type: 'culture',
  level: null,
  category: 'history',
  item_count: 30,
  is_active: true,
  is_premium: false,
  created_at: '2026-01-01T00:00:00Z',
  owner_id: null,
  owner_name: null,
  // Trilingual name fields for form
  name_el: 'Test Culture Deck EL',
  name_en: 'Test Culture Deck',
  name_ru: 'Test Culture Deck RU',
  description_el: '',
  description_en: '',
  description_ru: '',
  ...overrides,
});

// Wrapper component with i18n provider
const renderWithI18n = (ui: React.ReactElement) => {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
};

describe('CultureDeckEditForm', () => {
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Premium Toggle Rendering', () => {
    it('should render premium toggle below active toggle', () => {
      const deck = createMockDeck();

      renderWithI18n(
        <CultureDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      // Find both toggle switches by their test IDs
      const activeSwitch = screen.getByTestId('deck-edit-is-active');
      const premiumSwitch = screen.getByTestId('deck-edit-is-premium');

      expect(activeSwitch).toBeInTheDocument();
      expect(premiumSwitch).toBeInTheDocument();

      // Verify premium toggle appears after active toggle in DOM order
      const form = screen.getByTestId('culture-deck-edit-form');
      const switches = form.querySelectorAll('[data-testid^="deck-edit-is-"]');

      // Active should come first, then premium
      expect(switches[0]).toHaveAttribute('data-testid', 'deck-edit-is-active');
      expect(switches[1]).toHaveAttribute('data-testid', 'deck-edit-is-premium');
    });

    it('should display premium toggle label and description', () => {
      const deck = createMockDeck();

      renderWithI18n(
        <CultureDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      // Premium toggle should be within a form item with proper structure
      const premiumSwitch = screen.getByTestId('deck-edit-is-premium');
      const premiumFormItem = premiumSwitch.closest('.flex.flex-row');

      expect(premiumFormItem).toBeInTheDocument();
    });
  });

  describe('Initial Value Reflection', () => {
    it('should reflect is_premium: false as unchecked', () => {
      const deck = createMockDeck({ is_premium: false });

      renderWithI18n(
        <CultureDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const premiumSwitch = screen.getByTestId('deck-edit-is-premium');
      expect(premiumSwitch).toHaveAttribute('data-state', 'unchecked');
    });

    it('should reflect is_premium: true as checked', () => {
      const deck = createMockDeck({ is_premium: true });

      renderWithI18n(
        <CultureDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const premiumSwitch = screen.getByTestId('deck-edit-is-premium');
      expect(premiumSwitch).toHaveAttribute('data-state', 'checked');
    });

    it('should handle undefined is_premium as false', () => {
      // Create deck without is_premium (simulating older data)
      const deck = createMockDeck();
      // @ts-expect-error - Testing undefined case
      delete deck.is_premium;

      renderWithI18n(
        <CultureDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const premiumSwitch = screen.getByTestId('deck-edit-is-premium');
      expect(premiumSwitch).toHaveAttribute('data-state', 'unchecked');
    });
  });

  describe('Toggle Interaction', () => {
    it('should toggle premium from off to on', async () => {
      const user = userEvent.setup();
      const deck = createMockDeck({ is_premium: false });

      renderWithI18n(
        <CultureDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const premiumSwitch = screen.getByTestId('deck-edit-is-premium');
      expect(premiumSwitch).toHaveAttribute('data-state', 'unchecked');

      await user.click(premiumSwitch);

      expect(premiumSwitch).toHaveAttribute('data-state', 'checked');
    });

    it('should toggle premium from on to off', async () => {
      const user = userEvent.setup();
      const deck = createMockDeck({ is_premium: true });

      renderWithI18n(
        <CultureDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const premiumSwitch = screen.getByTestId('deck-edit-is-premium');
      expect(premiumSwitch).toHaveAttribute('data-state', 'checked');

      await user.click(premiumSwitch);

      expect(premiumSwitch).toHaveAttribute('data-state', 'unchecked');
    });
  });

  describe('Form Submission', () => {
    it('should include is_premium: true in payload when enabled', async () => {
      const user = userEvent.setup();
      const deck = createMockDeck({ is_premium: true });

      renderWithI18n(
        <CultureDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      // Submit the form
      const saveButton = screen.getByTestId('deck-edit-save');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledTimes(1);
      });

      const savedData = mockOnSave.mock.calls[0][0] as CultureDeckFormData;
      expect(savedData.is_premium).toBe(true);
    });

    it('should include is_premium: false in payload when disabled', async () => {
      const user = userEvent.setup();
      const deck = createMockDeck({ is_premium: false });

      renderWithI18n(
        <CultureDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      // Submit the form
      const saveButton = screen.getByTestId('deck-edit-save');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledTimes(1);
      });

      const savedData = mockOnSave.mock.calls[0][0] as CultureDeckFormData;
      expect(savedData.is_premium).toBe(false);
    });

    it('should include toggled is_premium value in payload', async () => {
      const user = userEvent.setup();
      const deck = createMockDeck({ is_premium: false });

      renderWithI18n(
        <CultureDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      // Toggle premium on
      const premiumSwitch = screen.getByTestId('deck-edit-is-premium');
      await user.click(premiumSwitch);

      // Submit the form
      const saveButton = screen.getByTestId('deck-edit-save');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledTimes(1);
      });

      const savedData = mockOnSave.mock.calls[0][0] as CultureDeckFormData;
      expect(savedData.is_premium).toBe(true);
    });
  });

  describe('Premium and Active Independence', () => {
    it('should allow premium toggle on inactive deck', async () => {
      const user = userEvent.setup();
      const deck = createMockDeck({ is_active: false, is_premium: false });

      renderWithI18n(
        <CultureDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      // Verify deck is inactive
      const activeSwitch = screen.getByTestId('deck-edit-is-active');
      expect(activeSwitch).toHaveAttribute('data-state', 'unchecked');

      // Toggle premium on
      const premiumSwitch = screen.getByTestId('deck-edit-is-premium');
      await user.click(premiumSwitch);

      // Premium should be checked independently
      expect(premiumSwitch).toHaveAttribute('data-state', 'checked');
      // Active should still be unchecked
      expect(activeSwitch).toHaveAttribute('data-state', 'unchecked');
    });

    it('should submit correct values when both flags are changed', async () => {
      const user = userEvent.setup();
      const deck = createMockDeck({ is_active: false, is_premium: false });

      renderWithI18n(
        <CultureDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const activeSwitch = screen.getByTestId('deck-edit-is-active');
      const premiumSwitch = screen.getByTestId('deck-edit-is-premium');

      // Toggle both on
      await user.click(activeSwitch); // Activate deck
      await user.click(premiumSwitch); // Make premium

      // Submit the form
      const saveButton = screen.getByTestId('deck-edit-save');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledTimes(1);
      });

      const savedData = mockOnSave.mock.calls[0][0] as CultureDeckFormData;
      expect(savedData.is_active).toBe(true);
      expect(savedData.is_premium).toBe(true);
    });
  });

  describe('Form Data Completeness', () => {
    it('should include all required fields in submission', async () => {
      const user = userEvent.setup();
      const deck = createMockDeck({
        name: 'Complete Culture Deck',
        name_el: 'Complete Culture Deck EL',
        name_en: 'Complete Culture Deck EN',
        name_ru: 'Complete Culture Deck RU',
        category: 'traditions',
        is_active: true,
        is_premium: true,
      });

      renderWithI18n(
        <CultureDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const saveButton = screen.getByTestId('deck-edit-save');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledTimes(1);
      });

      const savedData = mockOnSave.mock.calls[0][0] as CultureDeckFormData;

      // Verify all trilingual fields are present
      expect(savedData).toHaveProperty('name_el');
      expect(savedData).toHaveProperty('name_en');
      expect(savedData).toHaveProperty('name_ru');
      expect(savedData).toHaveProperty('description_el');
      expect(savedData).toHaveProperty('description_en');
      expect(savedData).toHaveProperty('description_ru');
      expect(savedData).toHaveProperty('category');
      expect(savedData).toHaveProperty('is_active');
      expect(savedData).toHaveProperty('is_premium');

      // Verify values
      expect(savedData.name_en).toBe('Complete Culture Deck EN');
      expect(savedData.category).toBe('traditions');
      expect(savedData.is_active).toBe(true);
      expect(savedData.is_premium).toBe(true);
    });
  });

  describe('Culture-Specific Fields', () => {
    it('should use category instead of level for culture decks', async () => {
      const user = userEvent.setup();
      const deck = createMockDeck({ category: 'geography' });

      renderWithI18n(
        <CultureDeckEditForm deck={deck} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      // Submit the form
      const saveButton = screen.getByTestId('deck-edit-save');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledTimes(1);
      });

      const savedData = mockOnSave.mock.calls[0][0] as CultureDeckFormData;

      // Culture decks should have category, not level
      expect(savedData).toHaveProperty('category');
      expect(savedData).not.toHaveProperty('level');
      expect(savedData.category).toBe('geography');
    });
  });
});
