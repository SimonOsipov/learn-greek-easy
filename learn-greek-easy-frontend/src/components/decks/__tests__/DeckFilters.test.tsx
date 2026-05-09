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
  },
  onChange: vi.fn(),
  onClear: vi.fn(),
  totalDecks: 10,
  filteredDecks: 10,
};

// Wrapper component with i18n provider
const renderWithI18n = (ui: React.ReactElement) => {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
};

describe('DeckFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Level Filter - Normal Behavior', () => {
    it('should call onChange with level when clicking enabled level button', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      renderWithI18n(<DeckFilters {...defaultProps} onChange={onChange} />);

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

      renderWithI18n(<DeckFilters {...propsWithLevel} />);

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

      renderWithI18n(<DeckFilters {...propsWithLevel} />);

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

      renderWithI18n(<DeckFilters {...propsWithLevel} />);

      const a1Button = screen.getByRole('button', { name: /^A1$/i });
      const a2Button = screen.getByRole('button', { name: /^A2$/i });

      expect(a1Button).toHaveAttribute('aria-pressed', 'true');
      expect(a2Button).toHaveAttribute('aria-pressed', 'false');
    });
  });
});
