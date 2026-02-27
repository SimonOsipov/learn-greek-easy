/**
 * DeckFilters Component Tests
 *
 * Tests for the DeckFilters component, focusing on:
 * - Level filter disabled state when culture deck type is selected
 * - Visual feedback for disabled state (dimmed label)
 * - Tooltip/title attributes for accessibility
 *
 * Related bug: Level filter remains enabled when Culture filter is selected
 */

import React from 'react';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import { DeckFilters, type DeckFiltersProps } from '../DeckFilters';
import i18n from '@/i18n';

// Default props for the component
const defaultProps: DeckFiltersProps = {
  filters: {
    search: '',
    levels: [],
    categories: [],
    status: [],
    showPremiumOnly: false,
  },
  onChange: vi.fn(),
  onClear: vi.fn(),
  totalDecks: 10,
  filteredDecks: 10,
  deckType: 'all',
  onDeckTypeChange: vi.fn(),
};

// Wrapper component with i18n provider
const renderWithI18n = (ui: React.ReactElement) => {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
};

describe('DeckFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Level Filter - Disabled State for Culture Decks', () => {
    it('should enable level buttons when deckType is "all"', () => {
      renderWithI18n(<DeckFilters {...defaultProps} deckType="all" />);

      // Find all level buttons (A1, A2, B1, B2)
      const a1Button = screen.getByRole('button', { name: /^A1$/i });
      const a2Button = screen.getByRole('button', { name: /^A2$/i });
      const b1Button = screen.getByRole('button', { name: /^B1$/i });
      const b2Button = screen.getByRole('button', { name: /^B2$/i });

      // All buttons should be enabled
      expect(a1Button).not.toBeDisabled();
      expect(a2Button).not.toBeDisabled();
      expect(b1Button).not.toBeDisabled();
      expect(b2Button).not.toBeDisabled();
    });

    it('should enable level buttons when deckType is "vocabulary"', () => {
      renderWithI18n(<DeckFilters {...defaultProps} deckType="vocabulary" />);

      const a1Button = screen.getByRole('button', { name: /^A1$/i });
      const a2Button = screen.getByRole('button', { name: /^A2$/i });
      const b1Button = screen.getByRole('button', { name: /^B1$/i });
      const b2Button = screen.getByRole('button', { name: /^B2$/i });

      // All buttons should be enabled for vocabulary
      expect(a1Button).not.toBeDisabled();
      expect(a2Button).not.toBeDisabled();
      expect(b1Button).not.toBeDisabled();
      expect(b2Button).not.toBeDisabled();
    });

    it('should disable level buttons when deckType is "culture"', () => {
      renderWithI18n(<DeckFilters {...defaultProps} deckType="culture" />);

      const a1Button = screen.getByRole('button', { name: /^A1$/i });
      const a2Button = screen.getByRole('button', { name: /^A2$/i });
      const b1Button = screen.getByRole('button', { name: /^B1$/i });
      const b2Button = screen.getByRole('button', { name: /^B2$/i });

      // All buttons should be disabled for culture
      expect(a1Button).toBeDisabled();
      expect(a2Button).toBeDisabled();
      expect(b1Button).toBeDisabled();
      expect(b2Button).toBeDisabled();
    });

    it('should not call onChange when clicking disabled level button', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      renderWithI18n(<DeckFilters {...defaultProps} deckType="culture" onChange={onChange} />);

      const a1Button = screen.getByRole('button', { name: /^A1$/i });

      // Try to click the disabled button
      await user.click(a1Button);

      // onChange should not be called because button is disabled
      expect(onChange).not.toHaveBeenCalled();
    });

    it('should show tooltip on level buttons when disabled', () => {
      renderWithI18n(<DeckFilters {...defaultProps} deckType="culture" />);

      const a1Button = screen.getByRole('button', { name: /^A1$/i });

      // Button should have a title attribute explaining why it's disabled
      expect(a1Button).toHaveAttribute('title');
      expect(a1Button.getAttribute('title')).toContain('Culture');
    });

    it('should not show tooltip when deckType is not "culture"', () => {
      renderWithI18n(<DeckFilters {...defaultProps} deckType="all" />);

      const a1Button = screen.getByRole('button', { name: /^A1$/i });

      // Button should not have a title attribute
      expect(a1Button).not.toHaveAttribute('title');
    });
  });

  describe('Level Filter - Normal Behavior', () => {
    it('should call onChange with level when clicking enabled level button', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      renderWithI18n(<DeckFilters {...defaultProps} deckType="all" onChange={onChange} />);

      const a1Button = screen.getByRole('button', { name: /^A1$/i });
      await user.click(a1Button);

      expect(onChange).toHaveBeenCalledWith({ levels: ['A1'] });
    });

    it('should toggle level off when clicking already selected level', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      const propsWithLevel: DeckFiltersProps = {
        ...defaultProps,
        filters: {
          ...defaultProps.filters,
          levels: ['A1'],
        },
        onChange,
      };

      renderWithI18n(<DeckFilters {...propsWithLevel} deckType="all" />);

      const a1Button = screen.getByRole('button', { name: /^A1$/i });
      await user.click(a1Button);

      expect(onChange).toHaveBeenCalledWith({ levels: [] });
    });

    it('should allow multiple level selections', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      const propsWithLevel: DeckFiltersProps = {
        ...defaultProps,
        filters: {
          ...defaultProps.filters,
          levels: ['A1'],
        },
        onChange,
      };

      renderWithI18n(<DeckFilters {...propsWithLevel} deckType="all" />);

      const a2Button = screen.getByRole('button', { name: /^A2$/i });
      await user.click(a2Button);

      expect(onChange).toHaveBeenCalledWith({ levels: ['A1', 'A2'] });
    });
  });

  describe('Accessibility', () => {
    it('should have aria-pressed attribute on level buttons', () => {
      const propsWithLevel: DeckFiltersProps = {
        ...defaultProps,
        filters: {
          ...defaultProps.filters,
          levels: ['A1'],
        },
      };

      renderWithI18n(<DeckFilters {...propsWithLevel} deckType="all" />);

      const a1Button = screen.getByRole('button', { name: /^A1$/i });
      const a2Button = screen.getByRole('button', { name: /^A2$/i });

      expect(a1Button).toHaveAttribute('aria-pressed', 'true');
      expect(a2Button).toHaveAttribute('aria-pressed', 'false');
    });

    it('should retain aria-pressed on disabled buttons', () => {
      renderWithI18n(<DeckFilters {...defaultProps} deckType="culture" />);

      const a1Button = screen.getByRole('button', { name: /^A1$/i });

      // Even when disabled, aria-pressed should be set
      expect(a1Button).toHaveAttribute('aria-pressed', 'false');
    });
  });
});
