/**
 * GenderBadge Component Tests
 *
 * Tests for the GenderBadge component, verifying:
 * - Correct badge variant class for each gender
 * - Localized text for each gender
 * - Custom className support
 *
 * REBASELINE (RESKIN-01-06): color assertions updated from raw Tailwind palette
 * (bg-blue-500, bg-rose-500, bg-slate-500) to v2.4 badge utility classes
 * (badge b-blue, badge b-red, badge b-gray).
 * Semantic mapping is preserved — masculine=blue, feminine=red, neuter=gray.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GenderBadge } from '../GenderBadge';
import type { NounGender } from '@/types/grammar';

describe('GenderBadge', () => {
  describe('Rendering', () => {
    it('should render with data-testid', () => {
      render(<GenderBadge gender="masculine" />);

      const badge = screen.getByTestId('gender-badge');
      expect(badge).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<GenderBadge gender="masculine" className="custom-class" />);

      const badge = screen.getByTestId('gender-badge');
      expect(badge).toHaveClass('custom-class');
    });
  });

  describe('Masculine Badge', () => {
    it('should render with blue badge variant', () => {
      render(<GenderBadge gender="masculine" />);

      const badge = screen.getByTestId('gender-badge');
      expect(badge).toHaveClass('badge');
      expect(badge).toHaveClass('b-blue');
    });

    it('should display localized text for masculine', () => {
      render(<GenderBadge gender="masculine" />);

      const badge = screen.getByTestId('gender-badge');
      expect(badge).toHaveTextContent('Masculine');
    });
  });

  describe('Feminine Badge', () => {
    it('should render with red badge variant', () => {
      render(<GenderBadge gender="feminine" />);

      const badge = screen.getByTestId('gender-badge');
      expect(badge).toHaveClass('badge');
      expect(badge).toHaveClass('b-red');
    });

    it('should display localized text for feminine', () => {
      render(<GenderBadge gender="feminine" />);

      const badge = screen.getByTestId('gender-badge');
      expect(badge).toHaveTextContent('Feminine');
    });
  });

  describe('Neuter Badge', () => {
    it('should render with gray badge variant', () => {
      render(<GenderBadge gender="neuter" />);

      const badge = screen.getByTestId('gender-badge');
      expect(badge).toHaveClass('badge');
      expect(badge).toHaveClass('b-gray');
    });

    it('should display localized text for neuter', () => {
      render(<GenderBadge gender="neuter" />);

      const badge = screen.getByTestId('gender-badge');
      expect(badge).toHaveTextContent('Neuter');
    });
  });

  describe('All Genders', () => {
    const genders: Array<{
      type: NounGender;
      expectedVariant: string;
      expectedText: string;
    }> = [
      { type: 'masculine', expectedVariant: 'b-blue', expectedText: 'Masculine' },
      { type: 'feminine', expectedVariant: 'b-red', expectedText: 'Feminine' },
      { type: 'neuter', expectedVariant: 'b-gray', expectedText: 'Neuter' },
    ];

    it.each(genders)(
      'should render $type with correct badge variant ($expectedVariant) and text ($expectedText)',
      ({ type, expectedVariant, expectedText }) => {
        render(<GenderBadge gender={type} />);

        const badge = screen.getByTestId('gender-badge');
        expect(badge).toHaveClass('badge');
        expect(badge).toHaveClass(expectedVariant);
        expect(badge).toHaveTextContent(expectedText);
      }
    );
  });
});
