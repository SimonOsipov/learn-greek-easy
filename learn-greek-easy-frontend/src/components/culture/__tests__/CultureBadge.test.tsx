/**
 * CultureBadge Component Tests
 *
 * Tests for the CultureBadge component, verifying:
 * - Correct .b-* modifier classes for each category (v2.4 badge system)
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

    it('should have badge base class', () => {
      render(<CultureBadge />);

      const badge = screen.getByTestId('culture-badge');
      expect(badge).toHaveClass('badge');
    });
  });

  describe('Default badge (no category)', () => {
    it('should render with b-gray modifier', () => {
      render(<CultureBadge />);

      const badge = screen.getByTestId('culture-badge');
      expect(badge).toHaveClass('b-gray');
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
    });
  });

  describe('Category badge modifier classes (v2.4 badge system)', () => {
    const categories: Array<{
      category: CultureCategory;
      expectedModifier: string;
      expectedText: string;
    }> = [
      {
        category: 'politics',
        expectedModifier: 'b-blue',
        expectedText: 'Politics',
      },
      {
        category: 'history',
        expectedModifier: 'b-amber',
        expectedText: 'History',
      },
      {
        category: 'traditions',
        expectedModifier: 'b-violet',
        expectedText: 'Traditions',
      },
      {
        category: 'practical',
        expectedModifier: 'b-red',
        expectedText: 'Practical',
      },
      {
        category: 'culture',
        expectedModifier: 'b-violet',
        expectedText: 'Culture',
      },
      {
        category: 'geography',
        expectedModifier: 'b-green',
        expectedText: 'Geography',
      },
    ];

    it.each(categories)(
      'should render $category with $expectedModifier modifier and correct text',
      ({ category, expectedModifier, expectedText }) => {
        render(<CultureBadge category={category} />);

        const badge = screen.getByTestId('culture-badge');
        expect(badge).toHaveClass('badge');
        expect(badge).toHaveClass(expectedModifier);
        expect(badge).toHaveTextContent(expectedText);
      }
    );
  });

  describe('getCategoryColor helper', () => {
    it('should return default color for undefined', () => {
      const colors = getCategoryColor();

      expect(colors.modifier).toBe('b-gray');
      expect(colors.dot).toBe('bg-fg3');
    });

    it('should return correct modifier for politics', () => {
      const colors = getCategoryColor('politics');

      expect(colors.modifier).toBe('b-blue');
    });

    it('should return correct modifier for history', () => {
      const colors = getCategoryColor('history');

      expect(colors.modifier).toBe('b-amber');
    });

    it('should return correct modifier for traditions', () => {
      const colors = getCategoryColor('traditions');

      expect(colors.modifier).toBe('b-violet');
    });

    it('should return correct modifier for practical', () => {
      const colors = getCategoryColor('practical');

      expect(colors.modifier).toBe('b-red');
    });

    it('should return correct modifier for culture', () => {
      const colors = getCategoryColor('culture');

      expect(colors.modifier).toBe('b-violet');
    });

    it('should return correct modifier for geography', () => {
      const colors = getCategoryColor('geography');

      expect(colors.modifier).toBe('b-green');
    });

    it('should expose token-based dot and modifier classes', () => {
      const colors = getCategoryColor('history');

      // Named utilities, not arbitrary hsl(var(--…)) values
      expect(colors.dot).toBe('bg-warning');
      expect(colors.modifier).toBe('b-amber');
    });
  });
});
