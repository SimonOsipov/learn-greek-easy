/**
 * CultureBadge Component Tests
 *
 * Tests for the CultureBadge component, verifying:
 * - Correct color classes for each category
 * - Localized text for each category
 * - Custom className support
 * - showLabel prop behavior
 * - Colored dot rendering
 * - getCategoryColor helper function
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CultureBadge, getCategoryColor } from '../CultureBadge';
import type { CultureCategory } from '../CultureBadge';

describe('CultureBadge', () => {
  describe('Rendering', () => {
    it('should render with data-testid', () => {
      render(<CultureBadge />);

      const badge = screen.getByTestId('culture-badge');
      expect(badge).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<CultureBadge className="custom-class" />);

      const badge = screen.getByTestId('culture-badge');
      expect(badge).toHaveClass('custom-class');
    });

    it('should render colored dot with aria-hidden', () => {
      render(<CultureBadge category="history" />);

      const badge = screen.getByTestId('culture-badge');
      const dot = badge.querySelector('[aria-hidden="true"]');
      expect(dot).toBeInTheDocument();
      expect(dot).toHaveClass('rounded-full');
    });
  });

  describe('Default badge (no category)', () => {
    it('should render with default slate colors', () => {
      render(<CultureBadge />);

      const badge = screen.getByTestId('culture-badge');
      expect(badge).toHaveClass('bg-slate-500/10');
      expect(badge).toHaveClass('border-slate-500/20');

      const dot = badge.querySelector('[aria-hidden="true"]');
      expect(dot).toHaveClass('bg-slate-400');
    });

    it('should display "Culture" text', () => {
      render(<CultureBadge />);

      const badge = screen.getByTestId('culture-badge');
      expect(badge).toHaveTextContent('Culture');
    });

    it('should have correct aria-label', () => {
      render(<CultureBadge />);

      const badge = screen.getByTestId('culture-badge');
      expect(badge).toHaveAttribute('aria-label', 'Culture');
    });
  });

  describe('showLabel prop', () => {
    it('should show text when showLabel is true (default)', () => {
      render(<CultureBadge category="history" />);

      const badge = screen.getByTestId('culture-badge');
      expect(badge).toHaveTextContent('History');
    });

    it('should hide text when showLabel is false', () => {
      render(<CultureBadge category="history" showLabel={false} />);

      const badge = screen.getByTestId('culture-badge');
      expect(badge).not.toHaveTextContent('History');
    });

    it('should still show dot when showLabel is false', () => {
      render(<CultureBadge category="history" showLabel={false} />);

      const badge = screen.getByTestId('culture-badge');
      const dot = badge.querySelector('[aria-hidden="true"]');
      expect(dot).toBeInTheDocument();
      expect(dot).toHaveClass('bg-amber-500');
    });
  });

  describe('Category colors', () => {
    const categories: Array<{
      category: CultureCategory;
      expectedDotColor: string;
      expectedBgColor: string;
      expectedBorderColor: string;
      expectedText: string;
    }> = [
      {
        category: 'politics',
        expectedDotColor: 'bg-indigo-500',
        expectedBgColor: 'bg-indigo-500/10',
        expectedBorderColor: 'border-indigo-500/20',
        expectedText: 'Politics',
      },
      {
        category: 'history',
        expectedDotColor: 'bg-amber-500',
        expectedBgColor: 'bg-amber-500/10',
        expectedBorderColor: 'border-amber-500/20',
        expectedText: 'History',
      },
      {
        category: 'traditions',
        expectedDotColor: 'bg-purple-500',
        expectedBgColor: 'bg-purple-500/10',
        expectedBorderColor: 'border-purple-500/20',
        expectedText: 'Traditions',
      },
      {
        category: 'practical',
        expectedDotColor: 'bg-purple-500',
        expectedBgColor: 'bg-purple-500/10',
        expectedBorderColor: 'border-purple-500/20',
        expectedText: 'Practical',
      },
      {
        category: 'culture',
        expectedDotColor: 'bg-emerald-500',
        expectedBgColor: 'bg-emerald-500/10',
        expectedBorderColor: 'border-emerald-500/20',
        expectedText: 'Culture',
      },
      {
        category: 'geography',
        expectedDotColor: 'bg-emerald-500',
        expectedBgColor: 'bg-emerald-500/10',
        expectedBorderColor: 'border-emerald-500/20',
        expectedText: 'Geography',
      },
    ];

    it.each(categories)(
      'should render $category with correct dot color and background',
      ({ category, expectedDotColor, expectedBgColor, expectedBorderColor, expectedText }) => {
        render(<CultureBadge category={category} />);

        const badge = screen.getByTestId('culture-badge');
        expect(badge).toHaveClass(expectedBgColor);
        expect(badge).toHaveClass(expectedBorderColor);
        expect(badge).toHaveTextContent(expectedText);

        const dot = badge.querySelector('[aria-hidden="true"]');
        expect(dot).toHaveClass(expectedDotColor);
      }
    );
  });

  describe('getCategoryColor helper', () => {
    it('should return default color for undefined', () => {
      const colors = getCategoryColor();

      expect(colors.dot).toBe('bg-slate-400');
      expect(colors.text).toContain('text-slate-600');
      expect(colors.bg).toBe('bg-slate-500/10');
      expect(colors.border).toBe('border-slate-500/20');
    });

    it('should return correct color for politics', () => {
      const colors = getCategoryColor('politics');

      expect(colors.dot).toBe('bg-indigo-500');
      expect(colors.text).toContain('text-indigo-700');
      expect(colors.bg).toBe('bg-indigo-500/10');
      expect(colors.border).toBe('border-indigo-500/20');
    });

    it('should return correct color for history', () => {
      const colors = getCategoryColor('history');

      expect(colors.dot).toBe('bg-amber-500');
      expect(colors.text).toContain('text-amber-700');
      expect(colors.bg).toBe('bg-amber-500/10');
      expect(colors.border).toBe('border-amber-500/20');
    });

    it('should return correct color for traditions', () => {
      const colors = getCategoryColor('traditions');

      expect(colors.dot).toBe('bg-purple-500');
      expect(colors.text).toContain('text-purple-700');
      expect(colors.bg).toBe('bg-purple-500/10');
      expect(colors.border).toBe('border-purple-500/20');
    });

    it('should return correct color for practical', () => {
      const colors = getCategoryColor('practical');

      expect(colors.dot).toBe('bg-purple-500');
      expect(colors.text).toContain('text-purple-700');
      expect(colors.bg).toBe('bg-purple-500/10');
      expect(colors.border).toBe('border-purple-500/20');
    });

    it('should return correct color for culture', () => {
      const colors = getCategoryColor('culture');

      expect(colors.dot).toBe('bg-emerald-500');
      expect(colors.text).toContain('text-emerald-700');
      expect(colors.bg).toBe('bg-emerald-500/10');
      expect(colors.border).toBe('border-emerald-500/20');
    });

    it('should return correct color for geography', () => {
      const colors = getCategoryColor('geography');

      expect(colors.dot).toBe('bg-emerald-500');
      expect(colors.text).toContain('text-emerald-700');
      expect(colors.bg).toBe('bg-emerald-500/10');
      expect(colors.border).toBe('border-emerald-500/20');
    });
  });
});
