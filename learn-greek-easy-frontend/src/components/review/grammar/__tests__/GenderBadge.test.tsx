/**
 * GenderBadge Component Tests
 *
 * Tests for the GenderBadge component, verifying:
 * - Correct color classes for each gender
 * - Localized text for each gender
 * - Custom className support
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
    it('should render with blue background', () => {
      render(<GenderBadge gender="masculine" />);

      const badge = screen.getByTestId('gender-badge');
      expect(badge).toHaveClass('bg-blue-500');
      expect(badge).toHaveClass('text-white');
    });

    it('should display localized text for masculine', () => {
      render(<GenderBadge gender="masculine" />);

      const badge = screen.getByTestId('gender-badge');
      expect(badge).toHaveTextContent('Masculine');
    });
  });

  describe('Feminine Badge', () => {
    it('should render with rose background', () => {
      render(<GenderBadge gender="feminine" />);

      const badge = screen.getByTestId('gender-badge');
      expect(badge).toHaveClass('bg-rose-500');
      expect(badge).toHaveClass('text-white');
    });

    it('should display localized text for feminine', () => {
      render(<GenderBadge gender="feminine" />);

      const badge = screen.getByTestId('gender-badge');
      expect(badge).toHaveTextContent('Feminine');
    });
  });

  describe('Neuter Badge', () => {
    it('should render with slate background', () => {
      render(<GenderBadge gender="neuter" />);

      const badge = screen.getByTestId('gender-badge');
      expect(badge).toHaveClass('bg-slate-500');
      expect(badge).toHaveClass('text-white');
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
      expectedColor: string;
      expectedText: string;
    }> = [
      { type: 'masculine', expectedColor: 'bg-blue-500', expectedText: 'Masculine' },
      { type: 'feminine', expectedColor: 'bg-rose-500', expectedText: 'Feminine' },
      { type: 'neuter', expectedColor: 'bg-slate-500', expectedText: 'Neuter' },
    ];

    it.each(genders)(
      'should render $type with correct color ($expectedColor) and text ($expectedText)',
      ({ type, expectedColor, expectedText }) => {
        render(<GenderBadge gender={type} />);

        const badge = screen.getByTestId('gender-badge');
        expect(badge).toHaveClass(expectedColor);
        expect(badge).toHaveClass('text-white');
        expect(badge).toHaveTextContent(expectedText);
      }
    );
  });
});
