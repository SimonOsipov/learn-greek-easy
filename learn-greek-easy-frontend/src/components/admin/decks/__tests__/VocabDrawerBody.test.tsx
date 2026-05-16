// src/components/admin/decks/__tests__/VocabDrawerBody.test.tsx
//
// Vitest + RTL unit tests for VocabDrawerBody (ADMIN2-09 / DKDR-10).

import type { ReactNode } from 'react';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import type {
  AdminVocabularyCard,
  AdminVocabularyCardsResponse,
  UnifiedDeckItem,
} from '@/services/adminAPI';

import { VocabDrawerBody } from '../VocabDrawerBody';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    listWordEntries: vi.fn(),
    deleteWordEntry: vi.fn(),
  },
}));

vi.mock('@/components/admin/CardDeleteDialog', () => ({
  CardDeleteDialog: ({
    open,
    onConfirm,
  }: {
    open: boolean;
    onConfirm: () => void;
    onOpenChange: (v: boolean) => void;
    itemPreview: string;
    itemType: string;
    isDeleting: boolean;
  }) =>
    open ? (
      <div data-testid="card-delete-dialog">
        <button data-testid="card-delete-confirm" onClick={onConfirm}>
          Confirm
        </button>
      </div>
    ) : null,
}));

vi.mock('@/components/admin/GenerateNounDialog', () => ({
  GenerateNounDialog: ({
    open,
  }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    deckId: string;
    deckName: string;
  }) => (open ? <div data-testid="generate-noun-dialog" /> : null),
}));

// Import after vi.mock so we get the mocked version.
import { adminAPI } from '@/services/adminAPI';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeCard = (overrides: Partial<AdminVocabularyCard> = {}): AdminVocabularyCard => ({
  id: 'card-1',
  deck_id: 'deck-vocab-1',
  front_text: 'καλημέρα',
  back_text_en: 'good morning',
  back_text_ru: 'доброе утро',
  example_sentence: null,
  pronunciation: '/kaˈliˌmera/',
  part_of_speech: 'noun',
  level: 'A1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  gender: 'feminine',
  has_examples: false,
  has_audio: true,
  has_grammar: true,
  translation_en_plural: null,
  translation_ru_plural: null,
  audio_status: 'ready',
  grammar_filled: 3,
  grammar_total: 5,
  example_count: 0,
  examples_with_en: 0,
  examples_with_ru: 0,
  examples_with_audio: 0,
  ...overrides,
});

const makeResponse = (
  cards: AdminVocabularyCard[],
  total = cards.length
): AdminVocabularyCardsResponse => ({
  total,
  page: 1,
  page_size: 20,
  deck_id: 'deck-vocab-1',
  cards,
});

const makeVocabDeck = (overrides: Partial<UnifiedDeckItem> = {}): UnifiedDeckItem => ({
  id: 'deck-vocab-1',
  name: 'Essential A1',
  name_en: 'Essential A1',
  name_ru: 'Основы A1',
  type: 'vocabulary',
  level: 'A1',
  category: null,
  item_count: 5,
  is_active: true,
  is_premium: false,
  is_system_deck: true,
  created_at: '2026-01-01T00:00:00Z',
  owner_id: null,
  owner_name: null,
  ...overrides,
});

// ── Render helpers ────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

interface RenderOptions {
  initialUrl?: string;
}

function renderBody(
  deck: UnifiedDeckItem = makeVocabDeck(),
  { initialUrl = '/admin?edit=deck-vocab-1' }: RenderOptions = {}
) {
  const queryClient = makeQueryClient();

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  let currentSearch = '';

  const CaptureSearch = () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useLocation } = require('react-router-dom');
    const location = useLocation();
    currentSearch = location.search;
    return null;
  };

  const result = render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <VocabDrawerBody deck={deck} />
              <CaptureSearch />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
    { wrapper: Wrapper }
  );

  return { ...result, queryClient, getSearch: () => currentSearch };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('VocabDrawerBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Calls listWordEntries on mount ──────────────────────────────────────

  it('calls adminAPI.listWordEntries with correct params on mount', async () => {
    (adminAPI.listWordEntries as Mock).mockResolvedValue(makeResponse([]));

    renderBody();

    await waitFor(() => {
      expect(adminAPI.listWordEntries).toHaveBeenCalledWith('deck-vocab-1', 1, 20, {
        search: undefined,
        partOfSpeech: undefined,
      });
    });
  });

  // ── 2. POS filter has exactly 5 options, no 'phrase' ──────────────────────

  it('POS filter renders exactly 5 options and phrase is NOT among them', async () => {
    (adminAPI.listWordEntries as Mock).mockResolvedValue(makeResponse([]));

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('word-list-toolbar')).toBeInTheDocument();
    });

    const toolbar = screen.getByTestId('word-list-toolbar');
    // SegControl renders buttons inside news-seg-btns div
    const filterButtons = within(toolbar).getAllByRole('button', { hidden: false });
    // Filter to seg-control buttons (excluding search, sort, add-word)
    const segButtons = filterButtons.filter((btn) => {
      const text = btn.textContent?.trim() ?? '';
      return ['All', 'Noun', 'Verb', 'Adjective', 'Adverb', 'Phrase'].includes(text);
    });

    expect(segButtons).toHaveLength(5);
    const labels = segButtons.map((btn) => btn.textContent?.trim());
    expect(labels).toContain('All');
    expect(labels).toContain('Noun');
    expect(labels).toContain('Verb');
    expect(labels).toContain('Adjective');
    expect(labels).toContain('Adverb');
    expect(labels).not.toContain('Phrase');
  });

  // ── 3. Switching POS filter re-fetches with partOfSpeech ──────────────────

  it('switching POS filter to noun re-fetches with partOfSpeech: noun', async () => {
    const user = userEvent.setup();
    (adminAPI.listWordEntries as Mock).mockResolvedValue(makeResponse([]));

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('word-list-toolbar')).toBeInTheDocument();
    });

    // Click the "Noun" button in the SegControl
    const nounBtn = screen.getByRole('button', { name: 'Noun' });
    await user.click(nounBtn);

    await waitFor(() => {
      expect(adminAPI.listWordEntries).toHaveBeenCalledWith('deck-vocab-1', 1, 20, {
        search: undefined,
        partOfSpeech: 'noun',
      });
    });
  });

  // ── 4. Gram pill hidden when grammar_total === 0 ───────────────────────────

  it('hides the Gram completion pill when grammar_total is 0', async () => {
    const cardNoGrammar = makeCard({
      id: 'card-no-gram',
      grammar_filled: 0,
      grammar_total: 0,
      part_of_speech: 'adverb',
      gender: null,
    });
    (adminAPI.listWordEntries as Mock).mockResolvedValue(makeResponse([cardNoGrammar]));

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('word-row')).toBeInTheDocument();
    });

    // The gram pill should NOT be present
    expect(screen.queryByTestId('completion-pill-gram')).not.toBeInTheDocument();
  });

  // ── 5. Gender chip hidden when POS is not noun or gender is null ───────────

  it('hides gender chip when card is not a noun', async () => {
    const verbCard = makeCard({ part_of_speech: 'verb', gender: null });
    (adminAPI.listWordEntries as Mock).mockResolvedValue(makeResponse([verbCard]));

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('word-row')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('word-row-gender')).not.toBeInTheDocument();
  });

  it('hides gender chip when noun has null gender', async () => {
    const nounNoGender = makeCard({ part_of_speech: 'noun', gender: null });
    (adminAPI.listWordEntries as Mock).mockResolvedValue(makeResponse([nounNoGender]));

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('word-row')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('word-row-gender')).not.toBeInTheDocument();
  });

  it('shows gender chip with correct symbol for feminine noun', async () => {
    const feminineNoun = makeCard({ part_of_speech: 'noun', gender: 'feminine' });
    (adminAPI.listWordEntries as Mock).mockResolvedValue(makeResponse([feminineNoun]));

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('word-row-gender')).toBeInTheDocument();
    });

    expect(screen.getByTestId('word-row-gender')).toHaveTextContent('♀');
  });

  // ── 6. Row click pushes ?item=<wordId> to URL ──────────────────────────────

  it('clicking a word row pushes ?item=<cardId> to the URL', async () => {
    const user = userEvent.setup();
    const card = makeCard({ id: 'card-abc' });
    (adminAPI.listWordEntries as Mock).mockResolvedValue(makeResponse([card]));

    const { getSearch } = renderBody(makeVocabDeck(), { initialUrl: '/admin?edit=deck-vocab-1' });

    await waitFor(() => {
      expect(screen.getByTestId('word-row')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('word-row'));

    await waitFor(() => {
      expect(getSearch()).toContain('item=card-abc');
    });
  });

  // ── 7. Pencil button pushes ?item=<wordId> to URL ─────────────────────────

  it('clicking the pencil button pushes ?item=<cardId> to the URL', async () => {
    const user = userEvent.setup();
    const card = makeCard({ id: 'card-xyz' });
    (adminAPI.listWordEntries as Mock).mockResolvedValue(makeResponse([card]));

    const { getSearch } = renderBody(makeVocabDeck(), { initialUrl: '/admin?edit=deck-vocab-1' });

    await waitFor(() => {
      expect(screen.getByTestId('word-row-edit')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('word-row-edit'));

    await waitFor(() => {
      expect(getSearch()).toContain('item=card-xyz');
    });
  });

  // ── 8. Trash button opens CardDeleteDialog (not URL change) ───────────────

  it('clicking trash opens CardDeleteDialog without changing URL', async () => {
    const user = userEvent.setup();
    const card = makeCard({ id: 'card-del' });
    (adminAPI.listWordEntries as Mock).mockResolvedValue(makeResponse([card]));

    const { getSearch } = renderBody(makeVocabDeck(), { initialUrl: '/admin?edit=deck-vocab-1' });

    await waitFor(() => {
      expect(screen.getByTestId('word-row-delete')).toBeInTheDocument();
    });

    const searchBefore = getSearch();
    await user.click(screen.getByTestId('word-row-delete'));

    await waitFor(() => {
      expect(screen.getByTestId('card-delete-dialog')).toBeInTheDocument();
    });

    // URL should NOT have changed to include ?item=
    expect(getSearch()).toBe(searchBefore);
    expect(getSearch()).not.toContain('item=card-del');
  });

  // ── 9. Empty filtered state shows correct copy ─────────────────────────────

  it('shows emptyWordsFilter copy when results are empty and filter is set', async () => {
    const user = userEvent.setup();
    (adminAPI.listWordEntries as Mock).mockResolvedValue(makeResponse([]));

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('word-list-toolbar')).toBeInTheDocument();
    });

    // Type something in search to set filter
    const searchInput = screen.getByTestId('word-list-search');
    await user.type(searchInput, 'xyz');

    await waitFor(() => {
      expect(screen.getByTestId('word-list-empty')).toBeInTheDocument();
    });

    expect(screen.getByTestId('word-list-empty')).toHaveTextContent('No words match your filters.');
  });

  // ── 10. "Add word" button opens GenerateNounDialog ─────────────────────────

  it('"Add word" button opens GenerateNounDialog', async () => {
    const user = userEvent.setup();
    (adminAPI.listWordEntries as Mock).mockResolvedValue(makeResponse([]));

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('word-list-add-word')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('generate-noun-dialog')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('word-list-add-word'));

    await waitFor(() => {
      expect(screen.getByTestId('generate-noun-dialog')).toBeInTheDocument();
    });
  });

  // ── 11. testids present ────────────────────────────────────────────────────

  it('stable testids are rendered: word-list-toolbar, word-list-search, word-row', async () => {
    const card = makeCard();
    (adminAPI.listWordEntries as Mock).mockResolvedValue(makeResponse([card]));

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('word-list-toolbar')).toBeInTheDocument();
      expect(screen.getByTestId('word-list-search')).toBeInTheDocument();
      expect(screen.getByTestId('word-row')).toBeInTheDocument();
    });
  });

  // ── 12. Greek word renders with lang="el" ──────────────────────────────────

  it('renders Greek word with lang="el"', async () => {
    const card = makeCard({ front_text: 'αγάπη' });
    (adminAPI.listWordEntries as Mock).mockResolvedValue(makeResponse([card]));

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('word-row')).toBeInTheDocument();
    });

    const row = screen.getByTestId('word-row');
    const greekSpan = within(row).getByText('αγάπη');
    expect(greekSpan).toHaveAttribute('lang', 'el');
  });
});
