/**
 * TenseBadge Component Tests
 *
 * Tests for the TenseBadge component, verifying:
 * - Correct color classes for each known tense
 * - Smaller/more muted styling compared to other badges
 * - Localized text for each tense
 * - Custom className support
 * - Fallback behavior for unknown tenses
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TenseBadge } from '../TenseBadge';

describe('TenseBadge', () => {
  describe('Rendering', () => {
    it('should render with data-testid', () => {
      render(<TenseBadge tense="present" />);

      const badge = screen.getByTestId('tense-badge');
      expect(badge).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<TenseBadge tense="present" className="custom-class" />);

      const badge = screen.getByTestId('tense-badge');
      expect(badge).toHaveClass('custom-class');
    });
  });

  describe('Smaller/Muted Styling', () => {
    it('should have smaller padding than other badges (px-1.5 vs px-2.5)', () => {
      render(<TenseBadge tense="present" />);

      const badge = screen.getByTestId('tense-badge');
      expect(badge).toHaveClass('px-1.5');
      expect(badge).toHaveClass('py-0.5');
    });

    it('should have smaller font size (text-[10px])', () => {
      render(<TenseBadge tense="present" />);

      const badge = screen.getByTestId('tense-badge');
      expect(badge).toHaveClass('text-[10px]');
    });

    it('should have medium font weight (font-medium vs font-semibold)', () => {
      render(<TenseBadge tense="present" />);

      const badge = screen.getByTestId('tense-badge');
      expect(badge).toHaveClass('font-medium');
    });
  });

  describe('Present Tense', () => {
    it('should render with tense-1 background', () => {
      render(<TenseBadge tense="present" />);

      const badge = screen.getByTestId('tense-badge');
      expect(badge).toHaveClass('bg-tense-1/15');
      expect(badge).toHaveClass('text-tense-1');
    });

    it('should display localized text for present', () => {
      render(<TenseBadge tense="present" />);

      const badge = screen.getByTestId('tense-badge');
      expect(badge).toHaveTextContent('Present');
    });
  });

  describe('Imperfect Tense', () => {
    it('should render with tense-2 background', () => {
      render(<TenseBadge tense="imperfect" />);

      const badge = screen.getByTestId('tense-badge');
      expect(badge).toHaveClass('bg-tense-2/15');
      expect(badge).toHaveClass('text-tense-2');
    });

    it('should display localized text for imperfect', () => {
      render(<TenseBadge tense="imperfect" />);

      const badge = screen.getByTestId('tense-badge');
      expect(badge).toHaveTextContent('Imperfect');
    });
  });

  describe('Past Tense', () => {
    it('should render with tense-3 background', () => {
      render(<TenseBadge tense="past" />);

      const badge = screen.getByTestId('tense-badge');
      expect(badge).toHaveClass('bg-tense-3/15');
      expect(badge).toHaveClass('text-tense-3');
    });

    it('should display localized text for past', () => {
      render(<TenseBadge tense="past" />);

      const badge = screen.getByTestId('tense-badge');
      expect(badge).toHaveTextContent('Past');
    });
  });

  describe('Future Tense', () => {
    it('should render with tense-4 background', () => {
      render(<TenseBadge tense="future" />);

      const badge = screen.getByTestId('tense-badge');
      expect(badge).toHaveClass('bg-tense-4/15');
      expect(badge).toHaveClass('text-tense-4');
    });

    it('should display localized text for future', () => {
      render(<TenseBadge tense="future" />);

      const badge = screen.getByTestId('tense-badge');
      expect(badge).toHaveTextContent('Future');
    });
  });

  describe('Perfect Tense', () => {
    it('should render with tense-5 background', () => {
      render(<TenseBadge tense="perfect" />);

      const badge = screen.getByTestId('tense-badge');
      expect(badge).toHaveClass('bg-tense-5/15');
      expect(badge).toHaveClass('text-tense-5');
    });

    it('should display localized text for perfect', () => {
      render(<TenseBadge tense="perfect" />);

      const badge = screen.getByTestId('tense-badge');
      expect(badge).toHaveTextContent('Perfect');
    });
  });

  describe('Imperative Tense', () => {
    it('should render with tense-6 background', () => {
      render(<TenseBadge tense="imperative" />);

      const badge = screen.getByTestId('tense-badge');
      expect(badge).toHaveClass('bg-tense-6/15');
      expect(badge).toHaveClass('text-tense-6');
    });

    it('should display localized text for imperative', () => {
      render(<TenseBadge tense="imperative" />);

      const badge = screen.getByTestId('tense-badge');
      expect(badge).toHaveTextContent('Imperative');
    });
  });

  describe('Unknown Tense (Fallback)', () => {
    it('should render with gray background for unknown tenses', () => {
      render(<TenseBadge tense="subjunctive" />);

      const badge = screen.getByTestId('tense-badge');
      expect(badge).toHaveClass('bg-muted');
      expect(badge).toHaveClass('text-muted-foreground');
    });

    it('should display raw tense value for unknown tenses', () => {
      render(<TenseBadge tense="subjunctive" />);

      const badge = screen.getByTestId('tense-badge');
      expect(badge).toHaveTextContent('subjunctive');
    });
  });

  describe('All Known Tenses', () => {
    const tenses = [
      {
        tense: 'present',
        bgColor: 'bg-tense-1/15',
        textColor: 'text-tense-1',
        expectedText: 'Present',
      },
      {
        tense: 'imperfect',
        bgColor: 'bg-tense-2/15',
        textColor: 'text-tense-2',
        expectedText: 'Imperfect',
      },
      { tense: 'past', bgColor: 'bg-tense-3/15', textColor: 'text-tense-3', expectedText: 'Past' },
      {
        tense: 'future',
        bgColor: 'bg-tense-4/15',
        textColor: 'text-tense-4',
        expectedText: 'Future',
      },
      {
        tense: 'perfect',
        bgColor: 'bg-tense-5/15',
        textColor: 'text-tense-5',
        expectedText: 'Perfect',
      },
      {
        tense: 'imperative',
        bgColor: 'bg-tense-6/15',
        textColor: 'text-tense-6',
        expectedText: 'Imperative',
      },
    ];

    it.each(tenses)(
      'should render $tense with correct colors ($bgColor, $textColor) and text ($expectedText)',
      ({ tense, bgColor, textColor, expectedText }) => {
        render(<TenseBadge tense={tense} />);

        const badge = screen.getByTestId('tense-badge');
        expect(badge).toHaveClass(bgColor);
        expect(badge).toHaveClass(textColor);
        expect(badge).toHaveTextContent(expectedText);
      }
    );
  });
});
