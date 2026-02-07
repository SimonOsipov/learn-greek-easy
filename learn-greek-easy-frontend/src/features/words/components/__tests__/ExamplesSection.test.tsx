/**
 * ExamplesSection Component Tests
 *
 * Tests for the ExamplesSection component, covering:
 * - Display of example sentences
 * - Greek, English, and Russian translations
 * - Context badge rendering
 * - Empty state handling (null, empty array)
 * - Multiple examples rendering
 */

import { render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { describe, it, expect } from 'vitest';

import type { WordEntryExampleSentence } from '@/services/wordEntryAPI';

import { ExamplesSection } from '../ExamplesSection';

// Mock example data
const mockExamples: WordEntryExampleSentence[] = [
  {
    greek: 'Το σπίτι μου είναι μικρό.',
    english: 'My house is small.',
    russian: 'Мой дом маленький.',
    context: 'daily life',
  },
  {
    greek: 'Μένω σε ένα μεγάλο σπίτι.',
    english: 'I live in a big house.',
    russian: 'Я живу в большом доме.',
    context: null,
  },
];

// Example without Russian translation
const exampleWithoutRussian: WordEntryExampleSentence[] = [
  {
    greek: 'Καλημέρα!',
    english: 'Good morning!',
  },
];

// Example without English translation
const exampleWithoutEnglish: WordEntryExampleSentence[] = [
  {
    greek: 'Γεια σου!',
  },
];

describe('ExamplesSection', () => {
  describe('Section Header', () => {
    it('renders examples section title', () => {
      render(<ExamplesSection examples={mockExamples} />);

      expect(screen.getByText('Examples')).toBeInTheDocument();
    });
  });

  describe('Example Display', () => {
    it('displays Greek sentence', () => {
      render(<ExamplesSection examples={mockExamples} />);

      expect(screen.getByText('Το σπίτι μου είναι μικρό.')).toBeInTheDocument();
    });

    it('displays English translation', () => {
      render(<ExamplesSection examples={mockExamples} />);

      expect(screen.getByText('My house is small.')).toBeInTheDocument();
    });

    it('displays locale-appropriate translation (English in en locale)', () => {
      render(<ExamplesSection examples={mockExamples} />);
      // English locale: should show English translation
      expect(screen.getByText('My house is small.')).toBeInTheDocument();
      // Russian should NOT be rendered
      expect(screen.queryByText('Мой дом маленький.')).not.toBeInTheDocument();
    });

    it('displays context badge when available', () => {
      render(<ExamplesSection examples={mockExamples} />);

      expect(screen.getByText('daily life')).toBeInTheDocument();
    });

    it('does not display context badge when null', () => {
      render(<ExamplesSection examples={mockExamples} />);

      // Second example has context: null, so only one context badge
      const badges = screen.getAllByText('daily life');
      expect(badges.length).toBe(1);
    });
  });

  describe('Multiple Examples', () => {
    it('renders all examples', () => {
      render(<ExamplesSection examples={mockExamples} />);

      expect(screen.getByText('Το σπίτι μου είναι μικρό.')).toBeInTheDocument();
      expect(screen.getByText('Μένω σε ένα μεγάλο σπίτι.')).toBeInTheDocument();
    });
  });

  describe('Optional Fields', () => {
    it('does not render Russian translation when missing', () => {
      render(<ExamplesSection examples={exampleWithoutRussian} />);

      expect(screen.getByText('Good morning!')).toBeInTheDocument();
      // Russian should not be present
      expect(screen.queryByText(/Доброе утро/)).not.toBeInTheDocument();
    });

    it('does not render English translation when missing', () => {
      render(<ExamplesSection examples={exampleWithoutEnglish} />);

      expect(screen.getByText('Γεια σου!')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('displays empty message when examples is null', () => {
      render(<ExamplesSection examples={null} />);

      expect(screen.getByText('No examples available')).toBeInTheDocument();
    });

    it('displays empty message when examples array is empty', () => {
      render(<ExamplesSection examples={[]} />);

      expect(screen.getByText('No examples available')).toBeInTheDocument();
    });

    it('still renders section title in empty state', () => {
      render(<ExamplesSection examples={null} />);

      expect(screen.getByText('Examples')).toBeInTheDocument();
    });
  });

  describe('Card Structure', () => {
    it('renders within a Card component', () => {
      render(<ExamplesSection examples={mockExamples} />);

      // The examples section should be inside a Card
      const card = screen.getByText('Examples').closest('[class*="card"]');
      expect(card).toBeInTheDocument();
    });
  });

  describe('Locale-Aware Translation', () => {
    it('displays Russian translation when locale is "ru"', async () => {
      await i18n.changeLanguage('ru');
      render(<ExamplesSection examples={mockExamples} />);
      expect(screen.getByText('Мой дом маленький.')).toBeInTheDocument();
      // English should NOT be rendered
      expect(screen.queryByText('My house is small.')).not.toBeInTheDocument();
      await i18n.changeLanguage('en'); // cleanup
    });

    it('falls back to English when Russian is missing and locale is "ru"', async () => {
      await i18n.changeLanguage('ru');
      const examplesWithoutRu = [
        {
          greek: 'Γεια σου!',
          english: 'Hello!',
          russian: undefined,
        },
      ];
      render(<ExamplesSection examples={examplesWithoutRu} />);
      expect(screen.getByText('Hello!')).toBeInTheDocument();
      await i18n.changeLanguage('en'); // cleanup
    });
  });
});
