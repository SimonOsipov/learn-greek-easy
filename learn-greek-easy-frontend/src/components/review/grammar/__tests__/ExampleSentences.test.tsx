/**
 * ExampleSentences Component Tests
 *
 * Tests for the ExampleSentences component, verifying:
 * - Renders Greek text always visible (never blurred)
 * - Translations start blurred, reveal on click
 * - Shows only UI language translation (EN or RU with fallback)
 * - Handles empty state with message
 * - Handles multiple examples with numbering
 * - Handles single example without numbering
 * - Keyboard accessibility (Enter/Space to reveal)
 * - Each example reveals independently
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Example } from '@/types/grammar';

// Mock i18n with configurable language
let mockLanguage = 'en';
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'grammar.examples.noExamples': 'No examples available',
        'grammar.examples.showTranslation': 'Click to show translation',
        'grammar.examples.hideTranslation': 'Click to hide translation',
      };
      return translations[key] || key;
    },
    i18n: {
      get language() {
        return mockLanguage;
      },
    },
  }),
}));

import { ExampleSentences } from '../ExampleSentences';

// Single example
const mockSingleExample: Example[] = [
  {
    greek: 'Το σπίτι είναι μεγάλο.',
    english: 'The house is big.',
    russian: 'Дом большой.',
  },
];

// Multiple examples
const mockMultipleExamples: Example[] = [
  {
    greek: 'Γράφω ένα γράμμα.',
    english: 'I write a letter.',
    russian: 'Я пишу письмо.',
  },
  {
    greek: 'Αυτός γράφει κάθε μέρα.',
    english: 'He writes every day.',
    russian: 'Он пишет каждый день.',
  },
  {
    greek: 'Θα γράψουμε μαζί.',
    english: 'We will write together.',
    russian: 'Мы напишем вместе.',
  },
];

// Example with tense field
const mockExampleWithTense: Example[] = [
  {
    greek: 'Έγραψα το βιβλίο.',
    english: 'I wrote the book.',
    russian: 'Я написал книгу.',
    tense: 'past',
  },
];

// Example with missing translations
const mockExampleMissingTranslation: Example[] = [
  {
    greek: 'Καλημέρα.',
    english: 'Good morning.',
    russian: '',
  },
];

const mockExampleMissingEnglish: Example[] = [
  {
    greek: 'Καλησπέρα.',
    english: '',
    russian: 'Добрый вечер.',
  },
];

describe('ExampleSentences', () => {
  beforeEach(() => {
    mockLanguage = 'en';
  });

  describe('Empty State', () => {
    it('should display no examples message when examples array is empty', () => {
      render(<ExampleSentences examples={[]} />);

      expect(screen.getByText('No examples available')).toBeInTheDocument();
    });

    it('should display no examples message when examples is null', () => {
      // @ts-expect-error - Testing null case
      render(<ExampleSentences examples={null} />);

      expect(screen.getByText('No examples available')).toBeInTheDocument();
    });

    it('should display no examples message when examples is undefined', () => {
      // @ts-expect-error - Testing undefined case
      render(<ExampleSentences examples={undefined} />);

      expect(screen.getByText('No examples available')).toBeInTheDocument();
    });

    it('should render empty state with correct styling', () => {
      const { container } = render(<ExampleSentences examples={[]} />);

      // Card component wraps the empty state
      const card = container.firstChild;
      expect(card).toHaveClass('rounded-lg');
      expect(card).toHaveClass('border');
      expect(card).toHaveClass('bg-card');
    });
  });

  describe('Greek Text (Always Visible)', () => {
    it('should render Greek text prominently without blur', () => {
      render(<ExampleSentences examples={mockSingleExample} />);

      const greekText = screen.getByText('Το σπίτι είναι μεγάλο.');
      expect(greekText).toBeInTheDocument();
      expect(greekText).toHaveClass('font-medium');
      // Greek text should not be in a blurred container
      expect(greekText.parentElement).not.toHaveClass('blur-sm');
    });

    it('should render Greek with base text size and font-medium', () => {
      render(<ExampleSentences examples={mockSingleExample} />);

      const greekText = screen.getByText('Το σπίτι είναι μεγάλο.');
      expect(greekText).toHaveClass('text-base');
      expect(greekText).toHaveClass('font-medium');
    });
  });

  describe('Translation Blur/Reveal', () => {
    it('should render translation blurred initially', () => {
      render(<ExampleSentences examples={mockSingleExample} />);

      const translationButton = screen.getByRole('button', {
        name: 'Click to show translation',
      });
      expect(translationButton).toHaveClass('blur-sm');
      expect(translationButton).toHaveClass('select-none');
      expect(translationButton).toHaveClass('cursor-pointer');
    });

    it('should reveal translation on click', () => {
      render(<ExampleSentences examples={mockSingleExample} />);

      const translationButton = screen.getByRole('button', {
        name: 'Click to show translation',
      });

      // Initially blurred
      expect(translationButton).toHaveClass('blur-sm');

      // Click to reveal
      fireEvent.click(translationButton);

      // Now revealed - get by new aria-label
      const revealedButton = screen.getByRole('button', {
        name: 'Click to hide translation',
      });
      expect(revealedButton).not.toHaveClass('blur-sm');
    });

    it('should hide translation on second click', () => {
      render(<ExampleSentences examples={mockSingleExample} />);

      const translationButton = screen.getByRole('button', {
        name: 'Click to show translation',
      });

      // First click - reveal
      fireEvent.click(translationButton);
      const revealedButton = screen.getByRole('button', {
        name: 'Click to hide translation',
      });
      expect(revealedButton).not.toHaveClass('blur-sm');

      // Second click - hide again
      fireEvent.click(revealedButton);
      const hiddenButton = screen.getByRole('button', {
        name: 'Click to show translation',
      });
      expect(hiddenButton).toHaveClass('blur-sm');
    });

    it('should have transition classes for smooth blur animation', () => {
      render(<ExampleSentences examples={mockSingleExample} />);

      const translationButton = screen.getByRole('button', {
        name: 'Click to show translation',
      });
      expect(translationButton).toHaveClass('transition-[filter]');
      expect(translationButton).toHaveClass('duration-200');
    });
  });

  describe('Keyboard Accessibility', () => {
    it('should reveal translation on Enter key', () => {
      render(<ExampleSentences examples={mockSingleExample} />);

      const translationButton = screen.getByRole('button', {
        name: 'Click to show translation',
      });

      // Press Enter
      fireEvent.keyDown(translationButton, { key: 'Enter' });

      const revealedButton = screen.getByRole('button', {
        name: 'Click to hide translation',
      });
      expect(revealedButton).not.toHaveClass('blur-sm');
    });

    it('should reveal translation on Space key', () => {
      render(<ExampleSentences examples={mockSingleExample} />);

      const translationButton = screen.getByRole('button', {
        name: 'Click to show translation',
      });

      // Press Space
      fireEvent.keyDown(translationButton, { key: ' ' });

      const revealedButton = screen.getByRole('button', {
        name: 'Click to hide translation',
      });
      expect(revealedButton).not.toHaveClass('blur-sm');
    });

    it('should have tabIndex for keyboard navigation', () => {
      render(<ExampleSentences examples={mockSingleExample} />);

      const translationButton = screen.getByRole('button', {
        name: 'Click to show translation',
      });
      expect(translationButton).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('Language-Based Display', () => {
    it('should show English translation when UI language is English', () => {
      mockLanguage = 'en';
      render(<ExampleSentences examples={mockSingleExample} />);

      expect(screen.getByText('The house is big.')).toBeInTheDocument();
      // Russian should not be displayed as separate element
      expect(screen.queryByText('Дом большой.')).not.toBeInTheDocument();
    });

    it('should show Russian translation when UI language is Russian', () => {
      mockLanguage = 'ru';
      render(<ExampleSentences examples={mockSingleExample} />);

      expect(screen.getByText('Дом большой.')).toBeInTheDocument();
      // English should not be displayed as separate element
      expect(screen.queryByText('The house is big.')).not.toBeInTheDocument();
    });

    it('should fallback to English when Russian translation is empty', () => {
      mockLanguage = 'ru';
      render(<ExampleSentences examples={mockExampleMissingTranslation} />);

      // Should show English as fallback
      expect(screen.getByText('Good morning.')).toBeInTheDocument();
    });

    it('should fallback to Russian when English translation is empty', () => {
      mockLanguage = 'en';
      render(<ExampleSentences examples={mockExampleMissingEnglish} />);

      // Should show Russian as fallback
      expect(screen.getByText('Добрый вечер.')).toBeInTheDocument();
    });
  });

  describe('Independent Reveal State', () => {
    it('should reveal examples independently', () => {
      render(<ExampleSentences examples={mockMultipleExamples} />);

      const buttons = screen.getAllByRole('button', {
        name: 'Click to show translation',
      });
      expect(buttons).toHaveLength(3);

      // Reveal only the second example
      fireEvent.click(buttons[1]);

      // First and third should still be blurred
      const blurredButtons = screen.getAllByRole('button', {
        name: 'Click to show translation',
      });
      expect(blurredButtons).toHaveLength(2);
      expect(blurredButtons[0]).toHaveClass('blur-sm');
      expect(blurredButtons[1]).toHaveClass('blur-sm');

      // Second should be revealed
      const revealedButton = screen.getByRole('button', {
        name: 'Click to hide translation',
      });
      expect(revealedButton).not.toHaveClass('blur-sm');
    });
  });

  describe('Single Example', () => {
    it('should NOT display numbering for single example', () => {
      render(<ExampleSentences examples={mockSingleExample} />);

      // Should not find "1." text for single example
      expect(screen.queryByText('1.')).not.toBeInTheDocument();
    });
  });

  describe('Multiple Examples', () => {
    it('should render all examples', () => {
      render(<ExampleSentences examples={mockMultipleExamples} />);

      expect(screen.getByText('Γράφω ένα γράμμα.')).toBeInTheDocument();
      expect(screen.getByText('Αυτός γράφει κάθε μέρα.')).toBeInTheDocument();
      expect(screen.getByText('Θα γράψουμε μαζί.')).toBeInTheDocument();
    });

    it('should display numbering for multiple examples', () => {
      render(<ExampleSentences examples={mockMultipleExamples} />);

      expect(screen.getByText('1.')).toBeInTheDocument();
      expect(screen.getByText('2.')).toBeInTheDocument();
      expect(screen.getByText('3.')).toBeInTheDocument();
    });

    it('should show only one translation per example (not both EN and RU)', () => {
      mockLanguage = 'en';
      render(<ExampleSentences examples={mockMultipleExamples} />);

      // English translations should be present
      expect(screen.getByText('I write a letter.')).toBeInTheDocument();
      expect(screen.getByText('He writes every day.')).toBeInTheDocument();
      expect(screen.getByText('We will write together.')).toBeInTheDocument();

      // Russian translations should NOT be present
      expect(screen.queryByText('Я пишу письмо.')).not.toBeInTheDocument();
      expect(screen.queryByText('Он пишет каждый день.')).not.toBeInTheDocument();
      expect(screen.queryByText('Мы напишем вместе.')).not.toBeInTheDocument();
    });
  });

  describe('Example with Tense', () => {
    it('should render example with tense field', () => {
      render(<ExampleSentences examples={mockExampleWithTense} />);

      expect(screen.getByText('Έγραψα το βιβλίο.')).toBeInTheDocument();
      expect(screen.getByText('I wrote the book.')).toBeInTheDocument();
    });
  });

  describe('Text Styling', () => {
    it('should render translation with muted foreground color', () => {
      render(<ExampleSentences examples={mockSingleExample} />);

      const englishText = screen.getByText('The house is big.');
      expect(englishText).toHaveClass('text-muted-foreground');
    });
  });

  describe('Container Structure', () => {
    it('should have space-y-4 container for multiple examples', () => {
      const { container } = render(<ExampleSentences examples={mockMultipleExamples} />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('space-y-4');
    });

    it('should render each example in a card with border', () => {
      const { container } = render(<ExampleSentences examples={mockMultipleExamples} />);

      const cards = container.querySelectorAll('.rounded-lg.border');
      expect(cards.length).toBe(3);
    });

    it('should have padding on example cards content', () => {
      const { container } = render(<ExampleSentences examples={mockSingleExample} />);

      // CardContent has p-4 padding
      const cardContent = container.querySelector('.p-4');
      expect(cardContent).toBeInTheDocument();
    });
  });

  describe('Number Styling', () => {
    it('should render numbers with muted foreground and font-medium', () => {
      render(<ExampleSentences examples={mockMultipleExamples} />);

      const number = screen.getByText('1.');
      expect(number).toHaveClass('text-muted-foreground');
      expect(number).toHaveClass('font-medium');
    });
  });
});
