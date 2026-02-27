/**
 * ExampleSentences Component Tests
 *
 * Tests for the ExampleSentences component, verifying:
 * - Renders Greek text always visible (never blurred)
 * - Translations are blurred when isFlipped=false, visible when isFlipped=true
 * - Shows only UI language translation (EN or RU with fallback)
 * - Handles empty state with message
 * - isFlipped prop controls all translation visibility
 */

import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { trackExampleAudioPlayed, trackWordAudioFailed } from '@/lib/analytics';
import type { Example } from '@/types/grammar';

// Mock SpeakerButton for audio tests
vi.mock('@/components/ui/SpeakerButton', () => ({
  SpeakerButton: ({
    audioUrl,
    onPlay,
    onError,
  }: {
    audioUrl: string | null | undefined;
    size?: string;
    onPlay?: () => void;
    onError?: (error: string) => void;
  }) => {
    if (!audioUrl) return null;
    return (
      <>
        <button data-testid="speaker-button" onClick={() => onPlay?.()}>
          Speaker
        </button>
        <button data-testid="speaker-error-trigger" onClick={() => onError?.('play error')}>
          Error
        </button>
      </>
    );
  },
}));

// Mock analytics for audio tests
vi.mock('@/lib/analytics', () => ({
  trackExampleAudioPlayed: vi.fn(),
  trackWordAudioFailed: vi.fn(),
}));

// Mock i18n with configurable language
let mockLanguage = 'en';
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'grammar.examples.noExamples': 'No examples available',
        'grammar.verbConjugation.tenses.past': 'Past',
        'grammar.verbConjugation.tenses.present': 'Present',
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

// Example WITHOUT tense field (for comparison testing)
const mockExampleWithoutTense: Example[] = [
  {
    greek: 'Γράφω ένα γράμμα.',
    english: 'I write a letter.',
    russian: 'Я пишу письмо.',
  },
];

// Example with null tense (edge case)
const mockExampleWithNullTense: Example[] = [
  {
    greek: 'Διαβάζω ένα βιβλίο.',
    english: 'I read a book.',
    russian: 'Я читаю книгу.',
    tense: null,
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

  describe('isFlipped Prop Behavior', () => {
    it('should render translations visible when isFlipped is true (default)', () => {
      render(<ExampleSentences examples={mockSingleExample} />);

      const translationText = screen.getByText('The house is big.');
      const translationContainer = translationText.parentElement;
      expect(translationContainer).not.toHaveClass('blur-sm');
    });

    it('should render translations visible when isFlipped is explicitly true', () => {
      render(<ExampleSentences examples={mockSingleExample} isFlipped={true} />);

      const translationText = screen.getByText('The house is big.');
      const translationContainer = translationText.parentElement;
      expect(translationContainer).not.toHaveClass('blur-sm');
    });

    it('should render translations blurred when isFlipped is false', () => {
      render(<ExampleSentences examples={mockSingleExample} isFlipped={false} />);

      const translationText = screen.getByText('The house is big.');
      const translationContainer = translationText.parentElement;
      expect(translationContainer).toHaveClass('blur-sm');
      expect(translationContainer).toHaveClass('select-none');
    });

    it('should blur all translations when isFlipped is false', () => {
      const { container } = render(
        <ExampleSentences examples={mockMultipleExamples} isFlipped={false} />
      );

      // All translation containers should be blurred
      const blurredElements = container.querySelectorAll('.blur-sm');
      expect(blurredElements.length).toBe(3);
    });

    it('should reveal all translations when isFlipped is true', () => {
      const { container } = render(
        <ExampleSentences examples={mockMultipleExamples} isFlipped={true} />
      );

      // No translation containers should be blurred
      const blurredElements = container.querySelectorAll('.blur-sm');
      expect(blurredElements.length).toBe(0);
    });

    it('should have transition classes for smooth blur animation', () => {
      const { container } = render(
        <ExampleSentences examples={mockSingleExample} isFlipped={false} />
      );

      const translationContainer = container.querySelector('.blur-sm');
      expect(translationContainer).toHaveClass('transition-[filter]');
      expect(translationContainer).toHaveClass('duration-200');
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

  describe('Multiple Examples', () => {
    it('should render all examples', () => {
      render(<ExampleSentences examples={mockMultipleExamples} />);

      expect(screen.getByText('Γράφω ένα γράμμα.')).toBeInTheDocument();
      expect(screen.getByText('Αυτός γράφει κάθε μέρα.')).toBeInTheDocument();
      expect(screen.getByText('Θα γράψουμε μαζί.')).toBeInTheDocument();
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

    it('should render TenseBadge when tense is present', () => {
      render(<ExampleSentences examples={mockExampleWithTense} />);
      expect(screen.getByTestId('tense-badge')).toBeInTheDocument();
    });

    it('should display translated tense label', () => {
      render(<ExampleSentences examples={mockExampleWithTense} />);
      expect(screen.getByText('Past')).toBeInTheDocument();
    });

    it('should NOT render TenseBadge when tense is absent', () => {
      render(<ExampleSentences examples={mockExampleWithoutTense} />);
      expect(screen.queryByTestId('tense-badge')).not.toBeInTheDocument();
    });

    it('should NOT render TenseBadge when tense is null', () => {
      render(<ExampleSentences examples={mockExampleWithNullTense} />);
      expect(screen.queryByTestId('tense-badge')).not.toBeInTheDocument();
    });

    it('should position TenseBadge in flex container with Greek text', () => {
      const { container } = render(<ExampleSentences examples={mockExampleWithTense} />);
      const flexContainer = container.querySelector('.flex.items-baseline.gap-2');
      expect(flexContainer).toBeInTheDocument();
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

  describe('Accessibility', () => {
    it('should not have button role on translation (no longer interactive)', () => {
      render(<ExampleSentences examples={mockSingleExample} />);

      // Translations should not be buttons since they are no longer interactive
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });
});

// ============================================================================
// Audio SpeakerButton Integration Tests
// ============================================================================

const mockExampleWithAudio: Example[] = [
  {
    greek: 'Γράφω ένα γράμμα.',
    english: 'I write a letter.',
    russian: 'Я пишу письмо.',
    id: 'ex-001',
    audio_url: 'https://example.com/ex1.mp3',
  },
];

const mockMixedExamples: Example[] = [
  {
    greek: 'Γράφω ένα γράμμα.',
    english: 'I write a letter.',
    russian: 'Я пишу письмо.',
    id: 'ex-001',
    audio_url: 'https://example.com/ex1.mp3',
  },
  {
    greek: 'Αυτός γράφει κάθε μέρα.',
    english: 'He writes every day.',
    russian: 'Он пишет каждый день.',
    // no audio_url
  },
];

const mockExampleWithAudioAndTense: Example[] = [
  {
    greek: 'Έγραψα το βιβλίο.',
    english: 'I wrote the book.',
    russian: 'Я написал книгу.',
    tense: 'past',
    id: 'ex-tense',
    audio_url: 'https://example.com/tense.mp3',
  },
];

describe('ExampleSentences — Audio SpeakerButton integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('10. renders SpeakerButtons for examples with audio_url when isFlipped=true', () => {
    render(
      <ExampleSentences
        examples={mockExampleWithAudio}
        isFlipped={true}
        wordEntryId="we-123"
        deckId="deck-456"
      />
    );
    expect(screen.getByTestId('speaker-button')).toBeInTheDocument();
  });

  it('11. NO SpeakerButtons when isFlipped=false, even if examples have audio_url', () => {
    render(
      <ExampleSentences
        examples={mockExampleWithAudio}
        isFlipped={false}
        wordEntryId="we-123"
        deckId="deck-456"
      />
    );
    expect(screen.queryByTestId('speaker-button')).not.toBeInTheDocument();
  });

  it('12. mixed examples — only examples with audio_url show the button', () => {
    render(
      <ExampleSentences
        examples={mockMixedExamples}
        isFlipped={true}
        wordEntryId="we-123"
        deckId="deck-456"
      />
    );
    // Only one of two examples has audio_url
    expect(screen.getAllByTestId('speaker-button')).toHaveLength(1);
  });

  it('13. each SpeakerButton receives its own example audio_url (not word audio)', async () => {
    const user = userEvent.setup();
    render(
      <ExampleSentences
        examples={mockExampleWithAudio}
        isFlipped={true}
        wordEntryId="we-123"
        deckId="deck-456"
      />
    );
    await user.click(screen.getByTestId('speaker-button'));

    expect(trackExampleAudioPlayed).toHaveBeenCalledWith({
      word_entry_id: 'we-123',
      example_id: 'ex-001',
      context: 'review',
      deck_id: 'deck-456',
      playback_speed: 1,
    });
  });

  it('14. TenseBadge remains properly positioned when speaker button is present', () => {
    render(
      <ExampleSentences
        examples={mockExampleWithAudioAndTense}
        isFlipped={true}
        wordEntryId="we-123"
        deckId="deck-456"
      />
    );
    expect(screen.getByTestId('tense-badge')).toBeInTheDocument();
    expect(screen.getByTestId('speaker-button')).toBeInTheDocument();
  });

  it('trackWordAudioFailed called with audio_type: example on error', async () => {
    const user = userEvent.setup();
    render(
      <ExampleSentences
        examples={mockExampleWithAudio}
        isFlipped={true}
        wordEntryId="we-123"
        deckId="deck-456"
      />
    );
    await user.click(screen.getByTestId('speaker-error-trigger'));

    expect(trackWordAudioFailed).toHaveBeenCalledWith({
      word_entry_id: 'we-123',
      error: 'play error',
      audio_type: 'example',
      context: 'review',
    });
  });
});
