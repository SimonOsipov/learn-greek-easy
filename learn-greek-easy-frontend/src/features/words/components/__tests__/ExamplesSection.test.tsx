/**
 * ExamplesSection Component Tests
 *
 * Updated for DX-10:
 * - Component re-skinned to .dx-section card
 * - Each example has a .dx-example-tag + R5 amber UnwiredDot
 * - mapContextToTag logic tested (derived vs placeholder)
 * - Original bindings (example.context, example.audio_url) preserved
 */

import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WordEntryExampleSentence } from '@/services/wordEntryAPI';

import { ExamplesSection, mapContextToTag } from '../ExamplesSection';

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

// Mock UnwiredDot — renders marker span for assertions
vi.mock('@/features/decks/dx', () => ({
  UnwiredDot: ({ tone, 'aria-label': ariaLabel }: { tone?: string; 'aria-label'?: string }) => (
    <span data-testid="unwired-dot" data-tone={tone} aria-label={ariaLabel} />
  ),
}));

// Mock analytics module
vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}));

// Mock example data
const mockExamples: WordEntryExampleSentence[] = [
  {
    id: 'ex-1',
    greek: 'Το σπίτι μου είναι μικρό.',
    english: 'My house is small.',
    russian: 'Мой дом маленький.',
    context: 'daily life',
  },
  {
    id: 'ex-2',
    greek: 'Μένω σε ένα μεγάλο σπίτι.',
    english: 'I live in a big house.',
    russian: 'Я живу в большом доме.',
    context: null,
  },
];

// Example without Russian translation
const exampleWithoutRussian: WordEntryExampleSentence[] = [
  {
    id: 'ex-3',
    greek: 'Καλημέρα!',
    english: 'Good morning!',
  },
];

// Example without English translation
const exampleWithoutEnglish: WordEntryExampleSentence[] = [
  {
    id: 'ex-4',
    greek: 'Γεια σου!',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================
// mapContextToTag unit tests
// ============================================

describe('mapContextToTag', () => {
  it('returns simple/derived=false when context is null', () => {
    expect(mapContextToTag(null)).toEqual({ tag: 'simple', derived: false });
  });

  it('returns simple/derived=false when context is undefined', () => {
    expect(mapContextToTag(undefined)).toEqual({ tag: 'simple', derived: false });
  });

  it('returns simple/derived=false for non-matching context', () => {
    expect(mapContextToTag('daily life')).toEqual({ tag: 'simple', derived: false });
  });

  it('returns comparative/derived=true when context contains "comparative"', () => {
    expect(mapContextToTag('comparative adjective')).toEqual({ tag: 'comparative', derived: true });
  });

  it('returns comparative/derived=true when context contains "comparison"', () => {
    expect(mapContextToTag('for comparison purposes')).toEqual({
      tag: 'comparative',
      derived: true,
    });
  });

  it('returns locative/derived=true when context contains "locative"', () => {
    expect(mapContextToTag('locative case')).toEqual({ tag: 'locative', derived: true });
  });

  it('returns locative/derived=true when context contains "location"', () => {
    expect(mapContextToTag('describes a location')).toEqual({ tag: 'locative', derived: true });
  });

  it('returns locative/derived=true when context contains "place"', () => {
    expect(mapContextToTag('talking about a place')).toEqual({ tag: 'locative', derived: true });
  });
});

// ============================================
// ExamplesSection rendering tests
// ============================================

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
      expect(screen.getByText('My house is small.')).toBeInTheDocument();
      expect(screen.queryByText('Мой дом маленький.')).not.toBeInTheDocument();
    });

    it('renders a .dx-example-tag for each example', () => {
      render(<ExamplesSection examples={mockExamples} />);
      const tags = screen.getAllByTestId('example-tag');
      expect(tags).toHaveLength(2);
    });

    it('renders an amber UnwiredDot (R5) for each example', () => {
      render(<ExamplesSection examples={mockExamples} />);
      const dots = screen.getAllByTestId('unwired-dot');
      expect(dots.length).toBeGreaterThanOrEqual(2);
      // all per-example dots are amber
      dots.forEach((dot) => {
        expect(dot).toHaveAttribute('data-tone', 'amber');
      });
    });

    it('example tag shows "simple" when context is null (placeholder)', () => {
      render(<ExamplesSection examples={mockExamples} />);
      // both examples map to 'simple' (context='daily life' → simple; context=null → simple)
      const tags = screen.getAllByTestId('example-tag');
      tags.forEach((tag) => {
        expect(tag).toHaveTextContent('simple');
      });
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
      expect(screen.queryByText(/Доброе утро/)).not.toBeInTheDocument();
    });

    it('does not render English translation when missing', () => {
      render(<ExamplesSection examples={exampleWithoutEnglish} />);
      expect(screen.getByText('Γεια σου!')).toBeInTheDocument();
    });

    it('Greek sentence carries lang="el"', () => {
      render(<ExamplesSection examples={exampleWithoutRussian} />);
      const greekEl = screen.getByText('Καλημέρα!');
      expect(greekEl).toHaveAttribute('lang', 'el');
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

  describe('Section Structure (DX-10)', () => {
    it('renders as .dx-section element', () => {
      render(<ExamplesSection examples={mockExamples} />);
      const section = screen.getByTestId('examples-section');
      expect(section).toHaveClass('dx-section');
    });
  });

  describe('Locale-Aware Translation', () => {
    it('displays Russian translation when locale is "ru"', async () => {
      await i18n.changeLanguage('ru');
      render(<ExamplesSection examples={mockExamples} />);
      expect(screen.getByText('Мой дом маленький.')).toBeInTheDocument();
      expect(screen.queryByText('My house is small.')).not.toBeInTheDocument();
      await i18n.changeLanguage('en'); // cleanup
    });

    it('falls back to English when Russian is missing and locale is "ru"', async () => {
      await i18n.changeLanguage('ru');
      const examplesWithoutRu = [
        {
          id: 'ex-fallback',
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

  it('4. context field still bound — audio buttons visible alongside example tags', () => {
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
    // tag is rendered (context 'formal' → 'simple' placeholder)
    expect(screen.getByTestId('example-tag')).toBeInTheDocument();
    // audio button is rendered
    expect(screen.getByTestId('speaker-button')).toBeInTheDocument();
  });

  it('5. track("example_audio_played") called with context: reference on play', async () => {
    const { track } = await import('@/lib/analytics');
    const user = userEvent.setup();

    render(
      <ExamplesSection examples={[examplesWithAudio[0]]} wordEntryId="we-abc" deckId="deck-xyz" />
    );

    await user.click(screen.getByTestId('speaker-button'));

    expect(track).toHaveBeenCalledWith('example_audio_played', {
      word_entry_id: 'we-abc',
      example_id: 'ex-1',
      context: 'reference',
      deck_id: 'deck-xyz',
      playback_speed: 1,
    });
  });
});
