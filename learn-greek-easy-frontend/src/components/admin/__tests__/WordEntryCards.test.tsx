/**
 * Tests for WordEntryCards component (WDET06-03)
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';

import { WordEntryCards } from '../WordEntryCards';
import { useWordEntryCards } from '@/features/words/hooks/useWordEntryCards';
import { useWordEntry } from '@/features/words/hooks/useWordEntry';
import type { WordEntryResponse } from '@/services/wordEntryAPI';
import i18n from '@/i18n';

// ============================================
// Mocks
// ============================================

vi.mock('@/features/words/hooks/useWordEntryCards', () => ({
  useWordEntryCards: vi.fn(),
}));

vi.mock('@/features/words/hooks/useWordEntry', () => ({
  useWordEntry: vi.fn(),
}));

// ============================================
// Factory Functions
// ============================================

const createMockCard = (overrides = {}) => ({
  id: 'card-1',
  word_entry_id: 'entry-1',
  deck_id: 'deck-1',
  card_type: 'meaning_el_to_en' as const,
  tier: 1,
  variant_key: 'meaning_el_to_en_t1',
  front_content: {
    card_type: 'meaning_el_to_en',
    prompt: 'What does this mean?',
    main: 'σπίτι',
    badge: 'A1',
  },
  back_content: {
    card_type: 'meaning_el_to_en',
    answer: 'house, home',
    answer_sub: 'noun',
  },
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

// ============================================
// Test Setup
// ============================================

beforeEach(() => {
  vi.clearAllMocks();
  (useWordEntryCards as Mock).mockReturnValue({
    cards: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  (useWordEntry as Mock).mockReturnValue({
    wordEntry: null,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  });
});

function renderComponent(entryId = 'entry-1') {
  return render(
    <I18nextProvider i18n={i18n}>
      <WordEntryCards entryId={entryId} />
    </I18nextProvider>
  );
}

// ============================================
// Tests
// ============================================

describe('WordEntryCards', () => {
  // ============================================
  // Loading State
  // ============================================

  describe('loading state', () => {
    it('renders loading skeletons when isLoading is true', () => {
      (useWordEntryCards as Mock).mockReturnValue({
        cards: [],
        isLoading: true,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.getByTestId('cards-tab-loading')).toBeInTheDocument();
    });

    it('renders 3 skeleton items during loading', () => {
      (useWordEntryCards as Mock).mockReturnValue({
        cards: [],
        isLoading: true,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      const loading = screen.getByTestId('cards-tab-loading');
      expect(loading.children).toHaveLength(3);
    });

    it('does not render error or empty state when loading', () => {
      (useWordEntryCards as Mock).mockReturnValue({
        cards: [],
        isLoading: true,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.queryByTestId('cards-tab-error')).not.toBeInTheDocument();
      expect(screen.queryByTestId('cards-tab-empty')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Error State
  // ============================================

  describe('error state', () => {
    it('renders error container when isError is true', () => {
      (useWordEntryCards as Mock).mockReturnValue({
        cards: [],
        isLoading: false,
        isError: true,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.getByTestId('cards-tab-error')).toBeInTheDocument();
    });

    it('renders retry button in error state', () => {
      const refetch = vi.fn();
      (useWordEntryCards as Mock).mockReturnValue({
        cards: [],
        isLoading: false,
        isError: true,
        refetch,
      });
      renderComponent();
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('calls refetch when retry button is clicked', () => {
      const refetch = vi.fn();
      (useWordEntryCards as Mock).mockReturnValue({
        cards: [],
        isLoading: false,
        isError: true,
        refetch,
      });
      renderComponent();
      fireEvent.click(screen.getByRole('button'));
      expect(refetch).toHaveBeenCalledOnce();
    });

    it('does not render loading or empty state when in error', () => {
      (useWordEntryCards as Mock).mockReturnValue({
        cards: [],
        isLoading: false,
        isError: true,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.queryByTestId('cards-tab-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('cards-tab-empty')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Empty State
  // ============================================

  describe('empty state', () => {
    it('renders empty state when cards array is empty', () => {
      renderComponent();
      expect(screen.getByTestId('cards-tab-empty')).toBeInTheDocument();
    });

    it('renders empty state when cards is null/undefined treated as empty', () => {
      (useWordEntryCards as Mock).mockReturnValue({
        cards: null,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.getByTestId('cards-tab-empty')).toBeInTheDocument();
    });

    it('does not render summary or type groups in empty state', () => {
      renderComponent();
      expect(screen.queryByTestId('cards-tab-summary')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Summary Line
  // ============================================

  describe('summary line', () => {
    it('renders summary with singular type form when only 1 type', () => {
      (useWordEntryCards as Mock).mockReturnValue({
        cards: [
          createMockCard({ id: 'c1', card_type: 'meaning_el_to_en' }),
          createMockCard({ id: 'c2', card_type: 'meaning_el_to_en' }),
        ],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      const summary = screen.getByTestId('cards-tab-summary');
      expect(summary).toBeInTheDocument();
      // singular type: "2 cards across 1 type"
      expect(summary.textContent).toContain('1 type');
      expect(summary.textContent).toContain('2');
    });

    it('renders summary with plural types form when multiple types', () => {
      (useWordEntryCards as Mock).mockReturnValue({
        cards: [
          createMockCard({ id: 'c1', card_type: 'meaning_el_to_en' }),
          createMockCard({
            id: 'c2',
            card_type: 'meaning_en_to_el',
            variant_key: 'meaning_en_to_el_t1',
          }),
        ],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      const summary = screen.getByTestId('cards-tab-summary');
      expect(summary.textContent).toContain('2');
      expect(summary.textContent).toContain('2');
    });
  });

  // ============================================
  // Grouping by Type
  // ============================================

  describe('cards grouped by type', () => {
    it('renders a group container for each card type present', () => {
      (useWordEntryCards as Mock).mockReturnValue({
        cards: [
          createMockCard({ id: 'c1', card_type: 'meaning_el_to_en' }),
          createMockCard({ id: 'c2', card_type: 'article', variant_key: 'article_t1' }),
        ],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.getByTestId('card-type-group-meaning_el_to_en')).toBeInTheDocument();
      expect(screen.getByTestId('card-type-group-article')).toBeInTheDocument();
    });

    it('does not render group containers for types with no cards', () => {
      (useWordEntryCards as Mock).mockReturnValue({
        cards: [createMockCard({ id: 'c1', card_type: 'meaning_el_to_en' })],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.queryByTestId('card-type-group-article')).not.toBeInTheDocument();
      expect(screen.queryByTestId('card-type-group-conjugation')).not.toBeInTheDocument();
    });

    it('renders groups in fixed display order (meaning_el_to_en before meaning_en_to_el)', () => {
      (useWordEntryCards as Mock).mockReturnValue({
        cards: [
          createMockCard({
            id: 'c1',
            card_type: 'meaning_en_to_el',
            variant_key: 'meaning_en_to_el_t1',
          }),
          createMockCard({ id: 'c2', card_type: 'meaning_el_to_en' }),
        ],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      const groups = screen.getAllByTestId(/^card-type-group-meaning/);
      expect(groups[0]).toHaveAttribute('data-testid', 'card-type-group-meaning_el_to_en');
      expect(groups[1]).toHaveAttribute('data-testid', 'card-type-group-meaning_en_to_el');
    });
  });

  // ============================================
  // Group Headers
  // ============================================

  describe('group headers', () => {
    it('renders header for each group', () => {
      (useWordEntryCards as Mock).mockReturnValue({
        cards: [createMockCard({ id: 'c1', card_type: 'meaning_el_to_en' })],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.getByTestId('card-type-group-header-meaning_el_to_en')).toBeInTheDocument();
    });

    it('shows count of cards in group header', () => {
      (useWordEntryCards as Mock).mockReturnValue({
        cards: [
          createMockCard({ id: 'c1', card_type: 'meaning_el_to_en' }),
          createMockCard({ id: 'c2', card_type: 'meaning_el_to_en' }),
        ],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      const header = screen.getByTestId('card-type-group-header-meaning_el_to_en');
      expect(header.textContent).toContain('2');
    });

    it('shows localized type label in group header', () => {
      (useWordEntryCards as Mock).mockReturnValue({
        cards: [createMockCard({ id: 'c1', card_type: 'meaning_el_to_en' })],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      const header = screen.getByTestId('card-type-group-header-meaning_el_to_en');
      // The header shows the translated label "Greek → English"
      expect(header.textContent).toContain('Greek');
    });
  });

  // ============================================
  // Card Record Fields
  // ============================================

  describe('card record rendering', () => {
    it('renders card record container with correct testid', () => {
      (useWordEntryCards as Mock).mockReturnValue({
        cards: [createMockCard({ id: 'card-abc' })],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.getByTestId('card-record-card-abc')).toBeInTheDocument();
    });

    it('renders front_content.main', () => {
      (useWordEntryCards as Mock).mockReturnValue({
        cards: [createMockCard()],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.getByText('σπίτι')).toBeInTheDocument();
    });

    it('renders front_content.prompt', () => {
      (useWordEntryCards as Mock).mockReturnValue({
        cards: [createMockCard()],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.getByText('What does this mean?')).toBeInTheDocument();
    });

    it('renders back_content.answer', () => {
      (useWordEntryCards as Mock).mockReturnValue({
        cards: [createMockCard()],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.getByText('house, home')).toBeInTheDocument();
    });

    it('renders back_content.answer_sub when present', () => {
      (useWordEntryCards as Mock).mockReturnValue({
        cards: [createMockCard()],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.getByText('noun')).toBeInTheDocument();
    });

    it('does not render answer_sub when missing', () => {
      (useWordEntryCards as Mock).mockReturnValue({
        cards: [
          createMockCard({
            back_content: {
              card_type: 'meaning_el_to_en',
              answer: 'house, home',
            },
          }),
        ],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      const record = screen.getByTestId('card-record-card-1');
      // only answer shown, no sub element
      expect(record.textContent).toContain('house, home');
      expect(record.textContent).not.toContain('noun');
    });

    it('renders tier when tier is not null', () => {
      (useWordEntryCards as Mock).mockReturnValue({
        cards: [createMockCard({ tier: 2 })],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      const record = screen.getByTestId('card-record-card-1');
      expect(record.textContent).toContain('2');
    });

    it('does not render tier label when tier is null', () => {
      (useWordEntryCards as Mock).mockReturnValue({
        cards: [createMockCard({ tier: null })],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      const record = screen.getByTestId('card-record-card-1');
      expect(record.textContent).not.toContain('Tier');
    });

    it('renders human-readable label for variant_key', () => {
      (useWordEntryCards as Mock).mockReturnValue({
        cards: [createMockCard({ variant_key: 'meaning_el_to_en_t1' })],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      // Human-readable fallback label (title-cased)
      expect(screen.getByText('Meaning El To En T1')).toBeInTheDocument();
      // Raw key shown as secondary text
      expect(screen.getByText('meaning_el_to_en_t1')).toBeInTheDocument();
    });

    it('card records have no interactive elements (no buttons)', () => {
      (useWordEntryCards as Mock).mockReturnValue({
        cards: [createMockCard()],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      const record = screen.getByTestId('card-record-card-1');
      expect(record.querySelectorAll('button')).toHaveLength(0);
    });
  });

  // ============================================
  // Hook Integration
  // ============================================

  describe('hook integration', () => {
    it('passes entryId to useWordEntryCards hook', () => {
      renderComponent('my-entry-id');
      expect(useWordEntryCards).toHaveBeenCalledWith({ wordEntryId: 'my-entry-id' });
    });
  });
});

// ============================================
// Audio Status Badge Factory Helpers
// ============================================

const createMockWordEntry = (overrides?: Partial<WordEntryResponse>): WordEntryResponse => ({
  id: 'entry-1',
  deck_id: 'deck-1',
  lemma: 'σπίτι',
  part_of_speech: 'noun',
  translation_en: 'house',
  translation_en_plural: null,
  translation_ru: null,
  translation_ru_plural: null,
  pronunciation: '/ˈspiti/',
  grammar_data: null,
  examples: [
    {
      id: 'ex1',
      greek: 'Το σπίτι.',
      english: 'The house.',
      audio_key: null,
      audio_url: null,
      audio_status: 'ready',
    },
    {
      id: 'ex2',
      greek: 'Μένω εδώ.',
      english: 'I live here.',
      audio_key: null,
      audio_url: null,
      audio_status: 'missing',
    },
  ],
  audio_key: null,
  audio_url: null,
  audio_status: 'ready',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

function setupAudioMocks(options: {
  cards: ReturnType<typeof createMockCard>[];
  wordEntry?: WordEntryResponse | null;
}) {
  (useWordEntryCards as Mock).mockReturnValue({
    cards: options.cards,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  (useWordEntry as Mock).mockReturnValue({
    wordEntry: options.wordEntry !== undefined ? options.wordEntry : createMockWordEntry(),
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  });
}

// ============================================
// Audio Status Badges Tests
// ============================================

describe('Audio Status Badges', () => {
  // ============================================
  // Group 1: Badge visibility by card type
  // ============================================

  describe('badge visibility by card type', () => {
    it('renders badge for meaning_el_to_en card', () => {
      setupAudioMocks({
        cards: [createMockCard({ id: 'c1', card_type: 'meaning_el_to_en' })],
      });
      renderComponent();
      expect(screen.getByTestId('card-audio-badge-c1')).toBeInTheDocument();
    });

    it('renders badge for meaning_en_to_el card', () => {
      setupAudioMocks({
        cards: [
          createMockCard({
            id: 'c2',
            card_type: 'meaning_en_to_el',
            variant_key: 'meaning_en_to_el_t1',
          }),
        ],
      });
      renderComponent();
      expect(screen.getByTestId('card-audio-badge-c2')).toBeInTheDocument();
    });

    it('renders badge for sentence_translation card with matching example_id', () => {
      setupAudioMocks({
        cards: [
          createMockCard({
            id: 'c3',
            card_type: 'sentence_translation',
            variant_key: 'sentence_translation_t1',
            front_content: { example_id: 'ex1', prompt: 'Translate', main: 'Το σπίτι.' },
            back_content: { answer: 'The house.' },
          }),
        ],
      });
      renderComponent();
      expect(screen.getByTestId('card-audio-badge-c3')).toBeInTheDocument();
    });

    it('does not render badge for conjugation card', () => {
      setupAudioMocks({
        cards: [
          createMockCard({
            id: 'c4',
            card_type: 'conjugation',
            variant_key: 'conjugation_t1',
          }),
        ],
      });
      renderComponent();
      expect(screen.queryByTestId('card-audio-badge-c4')).not.toBeInTheDocument();
    });

    it('does not render badge for declension card', () => {
      setupAudioMocks({
        cards: [
          createMockCard({
            id: 'c5',
            card_type: 'declension',
            variant_key: 'declension_t1',
          }),
        ],
      });
      renderComponent();
      expect(screen.queryByTestId('card-audio-badge-c5')).not.toBeInTheDocument();
    });

    it('does not render badge for cloze card', () => {
      setupAudioMocks({
        cards: [
          createMockCard({
            id: 'c6',
            card_type: 'cloze',
            variant_key: 'cloze_t1',
          }),
        ],
      });
      renderComponent();
      expect(screen.queryByTestId('card-audio-badge-c6')).not.toBeInTheDocument();
    });

    it('does not render badge for plural_form card', () => {
      setupAudioMocks({
        cards: [
          createMockCard({
            id: 'c7',
            card_type: 'plural_form',
            variant_key: 'plural_form_t1',
          }),
        ],
      });
      renderComponent();
      expect(screen.queryByTestId('card-audio-badge-c7')).not.toBeInTheDocument();
    });

    it('does not render badge for article card', () => {
      setupAudioMocks({
        cards: [
          createMockCard({
            id: 'c8',
            card_type: 'article',
            variant_key: 'article_t1',
          }),
        ],
      });
      renderComponent();
      expect(screen.queryByTestId('card-audio-badge-c8')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Group 2: Lemma status derivation
  // ============================================

  describe('lemma audio status derivation', () => {
    it('shows ready status on meaning card when lemma audio_status is ready', () => {
      setupAudioMocks({
        cards: [createMockCard({ id: 'c1', card_type: 'meaning_el_to_en' })],
        wordEntry: createMockWordEntry({ audio_status: 'ready' }),
      });
      renderComponent();
      const badge = screen.getByTestId('card-audio-badge-c1');
      expect(badge.textContent).toContain('Ready');
    });

    it('shows missing status on meaning card when lemma audio_status is missing', () => {
      setupAudioMocks({
        cards: [createMockCard({ id: 'c1', card_type: 'meaning_el_to_en' })],
        wordEntry: createMockWordEntry({ audio_status: 'missing' }),
      });
      renderComponent();
      const badge = screen.getByTestId('card-audio-badge-c1');
      expect(badge.textContent).toContain('Missing');
    });
  });

  // ============================================
  // Group 3: Example status derivation
  // ============================================

  describe('example audio status derivation', () => {
    it('shows ready status for sentence_translation card matching example with ready audio', () => {
      setupAudioMocks({
        cards: [
          createMockCard({
            id: 'c1',
            card_type: 'sentence_translation',
            variant_key: 'sentence_translation_t1',
            front_content: { example_id: 'ex1', prompt: 'Translate', main: 'Το σπίτι.' },
            back_content: { answer: 'The house.' },
          }),
        ],
      });
      renderComponent();
      const badge = screen.getByTestId('card-audio-badge-c1');
      expect(badge.textContent).toContain('Ready');
    });

    it('shows missing status for sentence_translation card matching example with missing audio', () => {
      setupAudioMocks({
        cards: [
          createMockCard({
            id: 'c1',
            card_type: 'sentence_translation',
            variant_key: 'sentence_translation_t1',
            front_content: { example_id: 'ex2', prompt: 'Translate', main: 'Μένω εδώ.' },
            back_content: { answer: 'I live here.' },
          }),
        ],
      });
      renderComponent();
      const badge = screen.getByTestId('card-audio-badge-c1');
      expect(badge.textContent).toContain('Missing');
    });

    it('shows missing status for sentence_translation card with unmatched example_id', () => {
      setupAudioMocks({
        cards: [
          createMockCard({
            id: 'c1',
            card_type: 'sentence_translation',
            variant_key: 'sentence_translation_t1',
            front_content: { example_id: 'no-such-example', prompt: 'Translate', main: 'X' },
            back_content: { answer: 'Y' },
          }),
        ],
      });
      renderComponent();
      const badge = screen.getByTestId('card-audio-badge-c1');
      expect(badge.textContent).toContain('Missing');
    });
  });

  // ============================================
  // Group 4: Multiple cards share lemma status
  // ============================================

  describe('multiple cards share lemma audio status', () => {
    it('both meaning_el_to_en and meaning_en_to_el cards show the same lemma audio status', () => {
      setupAudioMocks({
        cards: [
          createMockCard({ id: 'c1', card_type: 'meaning_el_to_en' }),
          createMockCard({
            id: 'c2',
            card_type: 'meaning_en_to_el',
            variant_key: 'meaning_en_to_el_t1',
          }),
        ],
        wordEntry: createMockWordEntry({ audio_status: 'ready' }),
      });
      renderComponent();
      const badge1 = screen.getByTestId('card-audio-badge-c1');
      const badge2 = screen.getByTestId('card-audio-badge-c2');
      expect(badge1.textContent).toContain('Ready');
      expect(badge2.textContent).toContain('Ready');
    });
  });

  // ============================================
  // Group 5: Null wordEntry
  // ============================================

  describe('null wordEntry', () => {
    it('does not render any audio badges when wordEntry is null', () => {
      setupAudioMocks({
        cards: [
          createMockCard({ id: 'c1', card_type: 'meaning_el_to_en' }),
          createMockCard({
            id: 'c2',
            card_type: 'meaning_en_to_el',
            variant_key: 'meaning_en_to_el_t1',
          }),
        ],
        wordEntry: null,
      });
      renderComponent();
      expect(screen.queryByTestId('card-audio-badge-c1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('card-audio-badge-c2')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Group 6: Data testids
  // ============================================

  describe('data-testid attributes', () => {
    it('audio-relevant cards have card-audio-badge-{id} testid', () => {
      setupAudioMocks({
        cards: [createMockCard({ id: 'meaning-card-id', card_type: 'meaning_el_to_en' })],
      });
      renderComponent();
      expect(screen.getByTestId('card-audio-badge-meaning-card-id')).toBeInTheDocument();
    });

    it('non-audio cards do not have any card-audio-badge-* testid', () => {
      setupAudioMocks({
        cards: [
          createMockCard({ id: 'conj-card-id', card_type: 'conjugation', variant_key: 'conj_t1' }),
        ],
      });
      renderComponent();
      expect(screen.queryByTestId('card-audio-badge-conj-card-id')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Group 7: Hook call
  // ============================================

  describe('hook call', () => {
    it('calls useWordEntry with the entryId passed to the component', () => {
      setupAudioMocks({ cards: [] });
      renderComponent('entry-1');
      expect(useWordEntry).toHaveBeenCalledWith({ wordId: 'entry-1' });
    });
  });
});
