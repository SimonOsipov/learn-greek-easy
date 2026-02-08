/**
 * PartOfSpeechBadge Component Tests
 *
 * Tests for the PartOfSpeechBadge component, verifying:
 * - Correct color classes for each part of speech
 * - Localized text for each part of speech
 * - Custom className support
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
    it('should render with brown background', () => {
      render(<PartOfSpeechBadge partOfSpeech="noun" />);

      const badge = screen.getByTestId('part-of-speech-badge');
      expect(badge).toHaveClass('bg-amber-700');
      expect(badge).toHaveClass('text-white');
    });

    it('should display localized text for noun', () => {
      render(<PartOfSpeechBadge partOfSpeech="noun" />);

      const badge = screen.getByTestId('part-of-speech-badge');
      expect(badge).toHaveTextContent('Noun');
    });
  });

  describe('Verb Badge', () => {
    it('should render with green background', () => {
      render(<PartOfSpeechBadge partOfSpeech="verb" />);

      const badge = screen.getByTestId('part-of-speech-badge');
      expect(badge).toHaveClass('bg-green-500');
      expect(badge).toHaveClass('text-white');
    });

    it('should display localized text for verb', () => {
      render(<PartOfSpeechBadge partOfSpeech="verb" />);

      const badge = screen.getByTestId('part-of-speech-badge');
      expect(badge).toHaveTextContent('Verb');
    });
  });

  describe('Adjective Badge', () => {
    it('should render with purple background', () => {
      render(<PartOfSpeechBadge partOfSpeech="adjective" />);

      const badge = screen.getByTestId('part-of-speech-badge');
      expect(badge).toHaveClass('bg-purple-500');
      expect(badge).toHaveClass('text-white');
    });

    it('should display localized text for adjective', () => {
      render(<PartOfSpeechBadge partOfSpeech="adjective" />);

      const badge = screen.getByTestId('part-of-speech-badge');
      expect(badge).toHaveTextContent('Adjective');
    });
  });

  describe('Adverb Badge', () => {
    it('should render with orange background', () => {
      render(<PartOfSpeechBadge partOfSpeech="adverb" />);

      const badge = screen.getByTestId('part-of-speech-badge');
      expect(badge).toHaveClass('bg-orange-500');
      expect(badge).toHaveClass('text-white');
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
      expectedColor: string;
      expectedText: string;
    }> = [
      { type: 'noun', expectedColor: 'bg-amber-700', expectedText: 'Noun' },
      { type: 'verb', expectedColor: 'bg-green-500', expectedText: 'Verb' },
      { type: 'adjective', expectedColor: 'bg-purple-500', expectedText: 'Adjective' },
      { type: 'adverb', expectedColor: 'bg-orange-500', expectedText: 'Adverb' },
    ];

    it.each(partsOfSpeech)(
      'should render $type with correct color ($expectedColor) and text ($expectedText)',
      ({ type, expectedColor, expectedText }) => {
        render(<PartOfSpeechBadge partOfSpeech={type} />);

        const badge = screen.getByTestId('part-of-speech-badge');
        expect(badge).toHaveClass(expectedColor);
        expect(badge).toHaveTextContent(expectedText);
      }
    );
  });
});
