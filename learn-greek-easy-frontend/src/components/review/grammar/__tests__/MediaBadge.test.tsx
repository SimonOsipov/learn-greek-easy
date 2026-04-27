/**
 * MediaBadge Component Tests
 *
 * Tests for the MediaBadge component, verifying:
 * - Correct color classes for each card type
 * - Localized text labels for each media type
 * - Custom className support
 * - data-testid attribute
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MediaBadge } from '../MediaBadge';
import type { CardRecordType } from '@/services/wordEntryAPI';

describe('MediaBadge', () => {
  describe('Rendering', () => {
    it('should render with data-testid', () => {
      render(<MediaBadge cardType="meaning_el_to_en" />);

      const badge = screen.getByTestId('media-badge');
      expect(badge).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<MediaBadge cardType="meaning_el_to_en" className="custom-class" />);

      const badge = screen.getByTestId('media-badge');
      expect(badge).toHaveClass('custom-class');
    });
  });

  describe('Vocabulary Badge', () => {
    it('should render with tense-4 background for meaning_el_to_en', () => {
      render(<MediaBadge cardType="meaning_el_to_en" />);

      const badge = screen.getByTestId('media-badge');
      expect(badge).toHaveClass('bg-tense-4');
      expect(badge).toHaveClass('text-white');
    });

    it('should render with tense-4 background for meaning_en_to_el', () => {
      render(<MediaBadge cardType="meaning_en_to_el" />);

      const badge = screen.getByTestId('media-badge');
      expect(badge).toHaveClass('bg-tense-4');
      expect(badge).toHaveClass('text-white');
    });

    it('should display "Translation" text', () => {
      render(<MediaBadge cardType="meaning_el_to_en" />);

      const badge = screen.getByTestId('media-badge');
      expect(badge).toHaveTextContent('Translation');
    });
  });

  describe('Sentence Badge', () => {
    it('should render with tense-1 background', () => {
      render(<MediaBadge cardType="sentence_translation" />);

      const badge = screen.getByTestId('media-badge');
      expect(badge).toHaveClass('bg-tense-1');
      expect(badge).toHaveClass('text-white');
    });

    it('should display "Sentence" text', () => {
      render(<MediaBadge cardType="sentence_translation" />);

      const badge = screen.getByTestId('media-badge');
      expect(badge).toHaveTextContent('Sentence');
    });
  });

  describe('Plural Badge', () => {
    it('should render with tense-5 background', () => {
      render(<MediaBadge cardType="plural_form" />);

      const badge = screen.getByTestId('media-badge');
      expect(badge).toHaveClass('bg-tense-5');
      expect(badge).toHaveClass('text-white');
    });

    it('should display "Plural Form" text', () => {
      render(<MediaBadge cardType="plural_form" />);

      const badge = screen.getByTestId('media-badge');
      expect(badge).toHaveTextContent('Plural Form');
    });
  });

  describe('Article Badge', () => {
    it('should render with tense-2 background', () => {
      render(<MediaBadge cardType="article" />);

      const badge = screen.getByTestId('media-badge');
      expect(badge).toHaveClass('bg-tense-2');
      expect(badge).toHaveClass('text-white');
    });

    it('should display "Article" text', () => {
      render(<MediaBadge cardType="article" />);

      const badge = screen.getByTestId('media-badge');
      expect(badge).toHaveTextContent('Article');
    });
  });

  describe('Grammar Badge', () => {
    it('should render with tense-1 background for conjugation', () => {
      render(<MediaBadge cardType="conjugation" />);

      const badge = screen.getByTestId('media-badge');
      expect(badge).toHaveClass('bg-tense-1');
      expect(badge).toHaveClass('text-white');
    });

    it('should render with tense-1 background for declension', () => {
      render(<MediaBadge cardType="declension" />);

      const badge = screen.getByTestId('media-badge');
      expect(badge).toHaveClass('bg-tense-1');
      expect(badge).toHaveClass('text-white');
    });

    it('should render with tense-1 background for cloze', () => {
      render(<MediaBadge cardType="cloze" />);

      const badge = screen.getByTestId('media-badge');
      expect(badge).toHaveClass('bg-tense-1');
      expect(badge).toHaveClass('text-white');
    });

    it('should display "Grammar" text', () => {
      render(<MediaBadge cardType="conjugation" />);

      const badge = screen.getByTestId('media-badge');
      expect(badge).toHaveTextContent('Grammar');
    });
  });

  describe('All Card Types', () => {
    const cardTypes: Array<{
      type: CardRecordType;
      expectedColor: string;
      expectedText: string;
    }> = [
      { type: 'meaning_el_to_en', expectedColor: 'bg-tense-4', expectedText: 'Translation' },
      { type: 'meaning_en_to_el', expectedColor: 'bg-tense-4', expectedText: 'Translation' },
      { type: 'sentence_translation', expectedColor: 'bg-tense-1', expectedText: 'Sentence' },
      { type: 'plural_form', expectedColor: 'bg-tense-5', expectedText: 'Plural Form' },
      { type: 'article', expectedColor: 'bg-tense-2', expectedText: 'Article' },
      { type: 'conjugation', expectedColor: 'bg-tense-1', expectedText: 'Grammar' },
      { type: 'declension', expectedColor: 'bg-tense-1', expectedText: 'Grammar' },
      { type: 'cloze', expectedColor: 'bg-tense-1', expectedText: 'Grammar' },
    ];

    it.each(cardTypes)(
      'should render $type with correct color ($expectedColor) and text ($expectedText)',
      ({ type, expectedColor, expectedText }) => {
        render(<MediaBadge cardType={type} />);

        const badge = screen.getByTestId('media-badge');
        expect(badge).toHaveClass(expectedColor);
        expect(badge).toHaveClass('text-white');
        expect(badge).toHaveTextContent(expectedText);
      }
    );
  });
});
