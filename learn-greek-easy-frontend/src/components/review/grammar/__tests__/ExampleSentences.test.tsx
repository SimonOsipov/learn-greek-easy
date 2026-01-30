/**
 * ExampleSentences Component Tests
 *
 * Tests for the ExampleSentences component, verifying:
 * - Renders trilingual examples (Greek, English, Russian)
 * - Handles empty state with message
 * - Handles multiple examples with numbering
 * - Handles single example without numbering
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ExampleSentences } from '../ExampleSentences';
import type { Example } from '@/types/grammar';

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

describe('ExampleSentences', () => {
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

  describe('Single Example', () => {
    it('should render Greek text prominently', () => {
      render(<ExampleSentences examples={mockSingleExample} />);

      const greekText = screen.getByText('Το σπίτι είναι μεγάλο.');
      expect(greekText).toBeInTheDocument();
      expect(greekText).toHaveClass('font-medium');
    });

    it('should render English translation', () => {
      render(<ExampleSentences examples={mockSingleExample} />);

      expect(screen.getByText('The house is big.')).toBeInTheDocument();
    });

    it('should render Russian translation', () => {
      render(<ExampleSentences examples={mockSingleExample} />);

      expect(screen.getByText('Дом большой.')).toBeInTheDocument();
    });

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

    it('should render all trilingual translations', () => {
      render(<ExampleSentences examples={mockMultipleExamples} />);

      // First example
      expect(screen.getByText('I write a letter.')).toBeInTheDocument();
      expect(screen.getByText('Я пишу письмо.')).toBeInTheDocument();

      // Second example
      expect(screen.getByText('He writes every day.')).toBeInTheDocument();
      expect(screen.getByText('Он пишет каждый день.')).toBeInTheDocument();

      // Third example
      expect(screen.getByText('We will write together.')).toBeInTheDocument();
      expect(screen.getByText('Мы напишем вместе.')).toBeInTheDocument();
    });
  });

  describe('Example with Tense', () => {
    it('should render example with tense field', () => {
      render(<ExampleSentences examples={mockExampleWithTense} />);

      expect(screen.getByText('Έγραψα το βιβλίο.')).toBeInTheDocument();
      expect(screen.getByText('I wrote the book.')).toBeInTheDocument();
      expect(screen.getByText('Я написал книгу.')).toBeInTheDocument();
    });
  });

  describe('Text Styling', () => {
    it('should render Greek with base text size and font-medium', () => {
      render(<ExampleSentences examples={mockSingleExample} />);

      const greekText = screen.getByText('Το σπίτι είναι μεγάλο.');
      expect(greekText).toHaveClass('text-base');
      expect(greekText).toHaveClass('font-medium');
    });

    it('should render English with muted foreground color', () => {
      render(<ExampleSentences examples={mockSingleExample} />);

      const englishText = screen.getByText('The house is big.');
      expect(englishText).toHaveClass('text-muted-foreground');
    });

    it('should render Russian with muted foreground color', () => {
      render(<ExampleSentences examples={mockSingleExample} />);

      const russianText = screen.getByText('Дом большой.');
      expect(russianText).toHaveClass('text-muted-foreground');
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
