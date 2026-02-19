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

import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WordEntryExampleSentence } from '@/services/wordEntryAPI';

import { ExamplesSection } from '../ExamplesSection';

// Mock SpeakerButton — captures callbacks and exposes via test buttons
vi.mock('@/components/ui/SpeakerButton', () => ({
  SpeakerButton: ({
    audioUrl,
    onPlay,
    onError,
  }: {
    audioUrl: string | null | undefined;
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
          Trigger Error
        </button>
      </>
    );
  },
}));

// Mock analytics module
vi.mock('@/lib/analytics', () => ({
  trackExampleAudioPlayed: vi.fn(),
  trackWordAudioFailed: vi.fn(),
}));

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

beforeEach(() => {
  vi.clearAllMocks();
});

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

// ============================================
// Audio SpeakerButton Integration Tests
// ============================================

describe('ExamplesSection — Audio SpeakerButton integration (reference)', () => {
  const examplesWithAudio: WordEntryExampleSentence[] = [
    {
      id: 'ex-1',
      greek: 'Η γάτα κοιμάται.',
      english: 'The cat sleeps.',
      audio_url: 'https://cdn.example.com/ex1.mp3',
    },
    {
      id: 'ex-2',
      greek: 'Το σκυλί τρέχει.',
      english: 'The dog runs.',
      audio_url: 'https://cdn.example.com/ex2.mp3',
    },
  ];

  const examplesMixed: WordEntryExampleSentence[] = [
    {
      id: 'ex-a',
      greek: 'Με ήχο.',
      english: 'With audio.',
      audio_url: 'https://cdn.example.com/exa.mp3',
    },
    {
      id: 'ex-b',
      greek: 'Χωρίς ήχο.',
      english: 'Without audio.',
      audio_url: null,
    },
  ];

  it('1. renders SpeakerButtons for examples with audio_url', () => {
    render(<ExamplesSection examples={examplesWithAudio} wordEntryId="we-1" deckId="deck-1" />);

    const buttons = screen.getAllByTestId('speaker-button');
    expect(buttons).toHaveLength(2);
  });

  it('2. no SpeakerButtons when examples have no audio_url', () => {
    render(<ExamplesSection examples={mockExamples} />);

    expect(screen.queryByTestId('speaker-button')).not.toBeInTheDocument();
  });

  it('3. mixed examples — only examples with audio_url show button', () => {
    render(<ExamplesSection examples={examplesMixed} wordEntryId="we-1" deckId="deck-1" />);

    const buttons = screen.getAllByTestId('speaker-button');
    expect(buttons).toHaveLength(1);
  });

  it('4. context badges remain visible alongside speaker buttons', () => {
    const examplesWithContext: WordEntryExampleSentence[] = [
      {
        id: 'ex-c',
        greek: 'Παράδειγμα.',
        english: 'Example.',
        context: 'formal',
        audio_url: 'https://cdn.example.com/exc.mp3',
      },
    ];
    render(<ExamplesSection examples={examplesWithContext} />);

    expect(screen.getByText('formal')).toBeInTheDocument();
    expect(screen.getByTestId('speaker-button')).toBeInTheDocument();
  });

  it('5. trackExampleAudioPlayed called with context: reference on play', async () => {
    const { trackExampleAudioPlayed } = await import('@/lib/analytics');
    const user = userEvent.setup();

    render(
      <ExamplesSection examples={[examplesWithAudio[0]]} wordEntryId="we-abc" deckId="deck-xyz" />
    );

    await user.click(screen.getByTestId('speaker-button'));

    expect(trackExampleAudioPlayed).toHaveBeenCalledWith({
      word_entry_id: 'we-abc',
      example_id: 'ex-1',
      context: 'reference',
      deck_id: 'deck-xyz',
    });
  });

  it('6. trackWordAudioFailed called with audio_type: example on error', async () => {
    const { trackWordAudioFailed } = await import('@/lib/analytics');
    const user = userEvent.setup();

    render(
      <ExamplesSection examples={[examplesWithAudio[0]]} wordEntryId="we-abc" deckId="deck-xyz" />
    );

    await user.click(screen.getByTestId('speaker-error-trigger'));

    expect(trackWordAudioFailed).toHaveBeenCalledWith({
      word_entry_id: 'we-abc',
      error: 'play error',
      audio_type: 'example',
      context: 'reference',
    });
  });
});
