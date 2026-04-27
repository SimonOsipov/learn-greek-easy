/**
 * PartOfSpeechBadge Component Tests
 *
 * Tests for the PartOfSpeechBadge component, verifying:
 * - Correct badge variant class for each part of speech
 * - Localized text for each part of speech
 * - Custom className support
 *
 * REBASELINE (RESKIN-01-06): color assertions updated from raw Tailwind palette
 * (bg-amber-700, bg-green-500, bg-purple-500, bg-orange-500) to v2.4 badge
 * utility classes (badge b-amber, badge b-green, badge b-violet, badge b-blue).
 * Semantic mapping is preserved — noun=amber, verb=green, adjective=violet, adverb=blue.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PartOfSpeechBadge } from '../PartOfSpeechBadge';
import type { PartOfSpeech } from '@/types/grammar';

describe('PartOfSpeechBadge', () => {
  describe('Rendering', () => {
    it('should render with data-testid', () => {
      render(<PartOfSpeechBadge partOfSpeech="noun" />);

      const badge = screen.getByTestId('part-of-speech-badge');
      expect(badge).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<PartOfSpeechBadge partOfSpeech="noun" className="custom-class" />);

      const badge = screen.getByTestId('part-of-speech-badge');
      expect(badge).toHaveClass('custom-class');
    });
  });

  describe('Noun Badge', () => {
    it('should render with amber badge variant', () => {
      render(<PartOfSpeechBadge partOfSpeech="noun" />);

      const badge = screen.getByTestId('part-of-speech-badge');
      expect(badge).toHaveClass('badge');
      expect(badge).toHaveClass('b-amber');
    });

    it('should display localized text for noun', () => {
      render(<PartOfSpeechBadge partOfSpeech="noun" />);

      const badge = screen.getByTestId('part-of-speech-badge');
      expect(badge).toHaveTextContent('Noun');
    });
  });

  describe('Verb Badge', () => {
    it('should render with green badge variant', () => {
      render(<PartOfSpeechBadge partOfSpeech="verb" />);

      const badge = screen.getByTestId('part-of-speech-badge');
      expect(badge).toHaveClass('badge');
      expect(badge).toHaveClass('b-green');
    });

    it('should display localized text for verb', () => {
      render(<PartOfSpeechBadge partOfSpeech="verb" />);

      const badge = screen.getByTestId('part-of-speech-badge');
      expect(badge).toHaveTextContent('Verb');
    });
  });

  describe('Adjective Badge', () => {
    it('should render with violet badge variant', () => {
      render(<PartOfSpeechBadge partOfSpeech="adjective" />);

      const badge = screen.getByTestId('part-of-speech-badge');
      expect(badge).toHaveClass('badge');
      expect(badge).toHaveClass('b-violet');
    });

    it('should display localized text for adjective', () => {
      render(<PartOfSpeechBadge partOfSpeech="adjective" />);

      const badge = screen.getByTestId('part-of-speech-badge');
      expect(badge).toHaveTextContent('Adjective');
    });
  });

  describe('Adverb Badge', () => {
    it('should render with blue badge variant', () => {
      render(<PartOfSpeechBadge partOfSpeech="adverb" />);

      const badge = screen.getByTestId('part-of-speech-badge');
      expect(badge).toHaveClass('badge');
      expect(badge).toHaveClass('b-blue');
    });

    it('should display localized text for adverb', () => {
      render(<PartOfSpeechBadge partOfSpeech="adverb" />);

      const badge = screen.getByTestId('part-of-speech-badge');
      expect(badge).toHaveTextContent('Adverb');
    });
  });

  describe('All Parts of Speech', () => {
    const partsOfSpeech: Array<{
      type: PartOfSpeech;
      expectedVariant: string;
      expectedText: string;
    }> = [
      { type: 'noun', expectedVariant: 'b-amber', expectedText: 'Noun' },
      { type: 'verb', expectedVariant: 'b-green', expectedText: 'Verb' },
      { type: 'adjective', expectedVariant: 'b-violet', expectedText: 'Adjective' },
      { type: 'adverb', expectedVariant: 'b-blue', expectedText: 'Adverb' },
    ];

    it.each(partsOfSpeech)(
      'should render $type with correct badge variant ($expectedVariant) and text ($expectedText)',
      ({ type, expectedVariant, expectedText }) => {
        render(<PartOfSpeechBadge partOfSpeech={type} />);

        const badge = screen.getByTestId('part-of-speech-badge');
        expect(badge).toHaveClass('badge');
        expect(badge).toHaveClass(expectedVariant);
        expect(badge).toHaveTextContent(expectedText);
      }
    );
  });
});
