/**
 * DeckFilters Component Tests
 *
 * Tests for the DeckFilters component, focusing on:
 * - dx-chip classes applied to filter buttons
 * - aria-pressed toggles correctly (both level and status chips)
 * - Separator element (.dx-chip-sep) is present between level and status chips
 * - Multi-select behavior is intact (level + status)
 * - Active chip inverts: aria-pressed="true"
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

  describe('Accessibility — aria-pressed', () => {
    it('level buttons have aria-pressed="true" when active', () => {
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

    it('status buttons have aria-pressed="true" when active', () => {
      const propsWithStatus: DeckFiltersProps = {
        ...defaultProps,
        filters: {
          ...defaultProps.filters,
          status: ['in-progress'],
        },
      };

      renderWithI18n(<DeckFilters {...propsWithStatus} />);

      // 'In Progress' button should be pressed
      const inProgressBtn = screen.getByRole('button', { name: /in progress/i });
      expect(inProgressBtn).toHaveAttribute('aria-pressed', 'true');

      // 'Not Started' button should not be pressed
      const notStartedBtn = screen.getByRole('button', { name: /not started/i });
      expect(notStartedBtn).toHaveAttribute('aria-pressed', 'false');
    });

    it('toggling status chip updates aria-pressed', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      renderWithI18n(<DeckFilters {...defaultProps} onChange={onChange} />);

      const completedBtn = screen.getByRole('button', { name: /completed/i });
      expect(completedBtn).toHaveAttribute('aria-pressed', 'false');

      await user.click(completedBtn);
      expect(onChange).toHaveBeenCalledWith({ status: ['completed'] });
    });
  });

  describe('dx-chip classes and separator', () => {
    it('chip buttons carry the dx-chip class', () => {
      renderWithI18n(<DeckFilters {...defaultProps} />);

      const a1Button = screen.getByRole('button', { name: /^A1$/i });
      expect(a1Button).toHaveClass('dx-chip');
    });

    it('separator element is present between level and status chips', () => {
      renderWithI18n(<DeckFilters {...defaultProps} />);

      const sep = screen.getByTestId('chip-separator');
      expect(sep).toBeInTheDocument();
      expect(sep).toHaveClass('dx-chip-sep');
    });
  });

  describe('Multi-select intact', () => {
    it('can select multiple status chips simultaneously', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      const propsWithStatus: DeckFiltersProps = {
        ...defaultProps,
        filters: {
          ...defaultProps.filters,
          status: ['not-started'],
        },
        onChange,
      };

      renderWithI18n(<DeckFilters {...propsWithStatus} />);

      const inProgressBtn = screen.getByRole('button', { name: /in progress/i });
      await user.click(inProgressBtn);

      expect(onChange).toHaveBeenCalledWith({ status: ['not-started', 'in-progress'] });
    });
  });
});
