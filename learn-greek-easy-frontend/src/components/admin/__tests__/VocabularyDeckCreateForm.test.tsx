/**
 * VocabularyDeckCreateForm Component Tests
 *
 * Tests for the VocabularyDeckCreateForm component, focusing on Zod schema
 * validation asymmetry and payload structure:
 * - en+ru+level succeeds with is_premium default false
 * - empty name_en fails validation (required field)
 * - is_premium toggle is reflected in the submitted payload
 * - empty name_el is OK (field is optional)
 *
 * Related feature: [PREMBDG] Admin Create Vocabulary Deck
 */

import React from 'react';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import {
  VocabularyDeckCreateForm,
  type VocabularyDeckCreateFormData,
} from '../VocabularyDeckCreateForm';
import i18n from '@/i18n';

// ============================================
// Test Utilities
// ============================================

interface RenderOptions {
  onSubmit?: ReturnType<typeof vi.fn>;
  onCancel?: ReturnType<typeof vi.fn>;
  isLoading?: boolean;
}

const renderForm = (options: RenderOptions = {}) => {
  const onSubmit = options.onSubmit ?? vi.fn();
  const onCancel = options.onCancel ?? vi.fn();

  return {
    ...render(
      <I18nextProvider i18n={i18n}>
        <VocabularyDeckCreateForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          isLoading={options.isLoading}
        />
      </I18nextProvider>
    ),
    onSubmit,
    onCancel,
  };
};

/**
 * Fill the minimum required fields (name_en, name_ru) and level (already defaults to A1).
 * Leaves name_el empty (optional).
 */
const fillMinimumRequired = async (user: ReturnType<typeof userEvent.setup>) => {
  // Fill name_en on the EN tab (default active tab)
  const nameEnInput = screen.getByTestId('deck-create-name-en');
  await user.type(nameEnInput, 'Greek Basics');

  // Switch to RU tab and fill name_ru
  await user.click(screen.getByTestId('deck-create-lang-tab-ru'));
  const nameRuInput = screen.getByTestId('deck-create-name-ru');
  await user.type(nameRuInput, 'Греческие основы');
};

// ============================================
// Tests
// ============================================

describe('VocabularyDeckCreateForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Rendering
  // ============================================

  describe('Rendering', () => {
    it('renders the form with testid', () => {
      renderForm();
      expect(screen.getByTestId('vocabulary-deck-create-form')).toBeInTheDocument();
    });

    it('renders all three language tabs', () => {
      renderForm();
      expect(screen.getByTestId('deck-create-lang-tab-en')).toBeInTheDocument();
      expect(screen.getByTestId('deck-create-lang-tab-el')).toBeInTheDocument();
      expect(screen.getByTestId('deck-create-lang-tab-ru')).toBeInTheDocument();
    });

    it('renders the is_premium switch', () => {
      renderForm();
      expect(screen.getByTestId('deck-create-is-premium')).toBeInTheDocument();
    });

    it('renders the submit button', () => {
      renderForm();
      expect(screen.getByTestId('deck-create-submit')).toBeInTheDocument();
    });

    it('renders the cancel button', () => {
      renderForm();
      expect(screen.getByTestId('deck-create-cancel')).toBeInTheDocument();
    });

    it('defaults is_premium to unchecked (false)', () => {
      renderForm();
      const premiumSwitch = screen.getByTestId('deck-create-is-premium');
      expect(premiumSwitch).toHaveAttribute('data-state', 'unchecked');
    });
  });

  // ============================================
  // Zod schema: required fields
  // ============================================

  describe('Schema validation — required fields', () => {
    it('submit button is disabled when form is empty (both name_en and name_ru are required)', () => {
      renderForm();
      // Form is invalid by default since name_en and name_ru are required but empty
      const submitBtn = screen.getByTestId('deck-create-submit');
      expect(submitBtn).toBeDisabled();
    });

    it('submit button remains disabled when only name_en is filled', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByTestId('deck-create-name-en'), 'Greek Basics');

      const submitBtn = screen.getByTestId('deck-create-submit');
      expect(submitBtn).toBeDisabled();
    });

    it('submit button remains disabled when only name_ru is filled', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByTestId('deck-create-lang-tab-ru'));
      await user.type(screen.getByTestId('deck-create-name-ru'), 'Греческие основы');

      const submitBtn = screen.getByTestId('deck-create-submit');
      expect(submitBtn).toBeDisabled();
    });

    it('submit button is enabled when name_en, name_ru, and level are all provided', async () => {
      const user = userEvent.setup();
      renderForm();

      await fillMinimumRequired(user);

      await waitFor(() => {
        expect(screen.getByTestId('deck-create-submit')).not.toBeDisabled();
      });
    });

    it('does NOT call onSubmit when name_en is empty', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderForm({ onSubmit });

      // Only fill name_ru, leave name_en empty
      await user.click(screen.getByTestId('deck-create-lang-tab-ru'));
      await user.type(screen.getByTestId('deck-create-name-ru'), 'Греческие основы');

      // Submit button is disabled, clicking has no effect
      const submitBtn = screen.getByTestId('deck-create-submit');
      expect(submitBtn).toBeDisabled();

      // Attempt submit via form directly — should not fire
      await user.click(submitBtn);
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Zod schema: name_el is optional
  // ============================================

  describe('Schema validation — name_el is optional', () => {
    it('form is valid with empty name_el (Greek name is optional)', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderForm({ onSubmit });

      // Fill only the required fields; do NOT fill name_el
      await fillMinimumRequired(user);

      await waitFor(() => {
        expect(screen.getByTestId('deck-create-submit')).not.toBeDisabled();
      });

      await user.click(screen.getByTestId('deck-create-submit'));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });

      const payload = onSubmit.mock.calls[0][0] as VocabularyDeckCreateFormData;
      // name_el is either undefined or empty string — both are valid per the schema
      expect(payload.name_el === '' || payload.name_el === undefined).toBe(true);
    });

    it('EL tab does not show a validation error indicator when name_el is left blank', async () => {
      const user = userEvent.setup();
      renderForm();

      await fillMinimumRequired(user);

      // After valid form state, check that the EL tab does not have the error indicator.
      // The tab shows a red dot span only when hasTabErrors(lang) is true.
      const elTab = screen.getByTestId('deck-create-lang-tab-el');
      const errorDot = elTab.querySelector('.bg-destructive.rounded-full');
      expect(errorDot).not.toBeInTheDocument();
    });
  });

  // ============================================
  // is_premium default and toggle
  // ============================================

  describe('is_premium field', () => {
    it('is_premium defaults to false in submitted payload', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderForm({ onSubmit });

      await fillMinimumRequired(user);

      await waitFor(() => {
        expect(screen.getByTestId('deck-create-submit')).not.toBeDisabled();
      });

      await user.click(screen.getByTestId('deck-create-submit'));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });

      const payload = onSubmit.mock.calls[0][0] as VocabularyDeckCreateFormData;
      expect(payload.is_premium).toBe(false);
    });

    it('is_premium is true in submitted payload when switch is toggled on', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderForm({ onSubmit });

      await fillMinimumRequired(user);

      // Toggle the premium switch on
      const premiumSwitch = screen.getByTestId('deck-create-is-premium');
      await user.click(premiumSwitch);

      await waitFor(() => {
        expect(premiumSwitch).toHaveAttribute('data-state', 'checked');
      });

      await waitFor(() => {
        expect(screen.getByTestId('deck-create-submit')).not.toBeDisabled();
      });

      await user.click(screen.getByTestId('deck-create-submit'));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });

      const payload = onSubmit.mock.calls[0][0] as VocabularyDeckCreateFormData;
      expect(payload.is_premium).toBe(true);
    });

    it('is_premium returns to false after toggling off', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderForm({ onSubmit });

      await fillMinimumRequired(user);

      const premiumSwitch = screen.getByTestId('deck-create-is-premium');

      // Toggle on then off
      await user.click(premiumSwitch);
      await waitFor(() => {
        expect(premiumSwitch).toHaveAttribute('data-state', 'checked');
      });

      await user.click(premiumSwitch);
      await waitFor(() => {
        expect(premiumSwitch).toHaveAttribute('data-state', 'unchecked');
      });

      await waitFor(() => {
        expect(screen.getByTestId('deck-create-submit')).not.toBeDisabled();
      });

      await user.click(screen.getByTestId('deck-create-submit'));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });

      const payload = onSubmit.mock.calls[0][0] as VocabularyDeckCreateFormData;
      expect(payload.is_premium).toBe(false);
    });
  });

  // ============================================
  // Full payload structure
  // ============================================

  describe('Payload structure on valid submission', () => {
    it('submitted payload contains all expected fields with correct types', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderForm({ onSubmit });

      // Fill required fields
      await user.type(screen.getByTestId('deck-create-name-en'), 'Greek Basics');

      await user.click(screen.getByTestId('deck-create-lang-tab-ru'));
      await user.type(screen.getByTestId('deck-create-name-ru'), 'Греческие основы');

      // Also fill the optional Greek name to verify it appears in payload
      await user.click(screen.getByTestId('deck-create-lang-tab-el'));
      await user.type(screen.getByTestId('deck-create-name-el'), 'Βασικά Ελληνικά');

      await waitFor(() => {
        expect(screen.getByTestId('deck-create-submit')).not.toBeDisabled();
      });

      await user.click(screen.getByTestId('deck-create-submit'));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });

      const payload = onSubmit.mock.calls[0][0] as VocabularyDeckCreateFormData;

      expect(payload.name_en).toBe('Greek Basics');
      expect(payload.name_ru).toBe('Греческие основы');
      expect(payload.name_el).toBe('Βασικά Ελληνικά');
      expect(payload.level).toBe('A1'); // default level
      expect(payload.is_premium).toBe(false); // default
      expect(typeof payload.is_premium).toBe('boolean');
    });
  });

  // ============================================
  // Cancel button
  // ============================================

  describe('Cancel button', () => {
    it('calls onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      renderForm({ onCancel });

      await user.click(screen.getByTestId('deck-create-cancel'));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================
  // Loading state
  // ============================================

  describe('Loading state', () => {
    it('disables submit button when isLoading is true', async () => {
      const user = userEvent.setup();
      renderForm({ isLoading: true });

      await fillMinimumRequired(user);

      // Even with a valid form, submit should be disabled during loading
      await waitFor(() => {
        expect(screen.getByTestId('deck-create-submit')).toBeDisabled();
      });
    });
  });
});
