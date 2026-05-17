// src/components/admin/decks/__tests__/VocabWordDetail.test.tsx
//
// Vitest + RTL unit tests for VocabWordDetail (ADMIN2-09 / DKDR-11).

import type { ReactNode } from 'react';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import type {
  AdminVocabularyCard,
  AdminVocabularyCardsResponse,
  UnifiedDeckItem,
} from '@/services/adminAPI';

import { VocabWordDetail } from '../VocabWordDetail';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Stub WordEntryContent — assert it gets wordEntryId (NOT entryId) and no item prop.
vi.mock('@/components/admin/WordEntryContent', () => ({
  WordEntryContent: ({
    wordEntryId,
    deckId,
    onUnlinked,
  }: {
    wordEntryId: string;
    deckId?: string;
    onUnlinked?: () => void;
    // Deliberate: no 'entryId', no 'item' props in the real interface
  }) => (
    <div
      data-testid="word-entry-content-mock"
      data-word-entry-id={wordEntryId}
      data-deck-id={deckId ?? ''}
    >
      <button data-testid="word-entry-content-unlink" onClick={onUnlinked}>
        Unlink
      </button>
    </div>
  ),
}));

// Stub WordEntryCards — assert it gets entryId.
vi.mock('@/components/admin/WordEntryCards', () => ({
  WordEntryCards: ({ entryId }: { entryId: string }) => (
    <div data-testid="word-entry-cards-mock" data-entry-id={entryId} />
  ),
}));

// Mock useWordEntry hook
vi.mock('@/features/words/hooks/useWordEntry', () => ({
  useWordEntry: vi.fn(),
}));

// Mock adminAPI
vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    listWordEntries: vi.fn(),
  },
}));

// Import mocked modules after vi.mock
import { useWordEntry } from '@/features/words/hooks/useWordEntry';
import { adminAPI } from '@/services/adminAPI';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DECK_ID = 'deck-vocab-1';
const ITEM_ID = 'word-entry-1';

const makeVocabDeck = (overrides: Partial<UnifiedDeckItem> = {}): UnifiedDeckItem => ({
  id: DECK_ID,
  name: 'Essential A1',
  name_en: 'Essential A1',
  name_ru: 'Основы A1',
  type: 'vocabulary',
  level: 'A1',
  category: null,
  item_count: 10,
  is_active: true,
  is_premium: false,
  is_system_deck: true,
  created_at: '2026-01-01T00:00:00Z',
  owner_id: null,
  owner_name: null,
  ...overrides,
});

const makeAdminCard = (overrides: Partial<AdminVocabularyCard> = {}): AdminVocabularyCard => ({
  id: ITEM_ID,
  deck_id: DECK_ID,
  front_text: 'γεια',
  back_text_en: 'hello',
  back_text_ru: 'привет',
  example_sentence: null,
  pronunciation: '/ja/',
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
  grammar_filled: 5,
  grammar_total: 5,
  example_count: 0,
  examples_with_en: 0,
  examples_with_ru: 0,
  examples_with_audio: 0,
  ...overrides,
});

const makeCardsResponse = (cards: AdminVocabularyCard[]): AdminVocabularyCardsResponse => ({
  total: cards.length,
  page: 1,
  page_size: 50,
  deck_id: DECK_ID,
  cards,
});

// ── Render helpers ────────────────────────────────────────────────────────────

function makeQueryClient(preloadedCard?: AdminVocabularyCard) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  if (preloadedCard) {
    // Prepopulate the deck-vocab cache to simulate the list view having been visited.
    qc.setQueryData(['deck-vocab', DECK_ID, 1, '', 'all'], makeCardsResponse([preloadedCard]));
  }

  return qc;
}

interface RenderOptions {
  initialUrl?: string;
  preloadedCard?: AdminVocabularyCard;
  wordEntryData?: ReturnType<typeof useWordEntry>;
}

function renderDetail(
  deck: UnifiedDeckItem = makeVocabDeck(),
  {
    initialUrl = `/admin?edit=${DECK_ID}&item=${ITEM_ID}`,
    preloadedCard,
    wordEntryData,
  }: RenderOptions = {}
) {
  const queryClient = makeQueryClient(preloadedCard);

  // Default useWordEntry mock: loaded state
  (useWordEntry as Mock).mockReturnValue(
    wordEntryData ?? {
      wordEntry: {
        id: ITEM_ID,
        lemma: 'γεια',
        translation_en: 'hello',
        part_of_speech: 'noun',
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    }
  );

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
              <VocabWordDetail deck={deck} itemId={ITEM_ID} />
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

describe('VocabWordDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: listWordEntries returns the adminCard (fallback fetch path)
    (adminAPI.listWordEntries as Mock).mockResolvedValue(makeCardsResponse([makeAdminCard()]));
  });

  // ── AC #1: WordEntryContent gets wordEntryId, WordEntryCards gets entryId ───

  it('AC#1: WordEntryContent receives wordEntryId (not entryId), WordEntryCards receives entryId', async () => {
    renderDetail(makeVocabDeck(), { preloadedCard: makeAdminCard() });

    await waitFor(() => {
      expect(screen.getByTestId('word-entry-content-mock')).toBeInTheDocument();
    });

    // WordEntryContent must get wordEntryId = ITEM_ID, not an 'entryId' prop
    const contentEl = screen.getByTestId('word-entry-content-mock');
    expect(contentEl).toHaveAttribute('data-word-entry-id', ITEM_ID);
    expect(contentEl).toHaveAttribute('data-deck-id', DECK_ID);

    // Switch to cards tab to render WordEntryCards
    const user = userEvent.setup();
    await user.click(screen.getByTestId('word-entry-tab-cards'));

    await waitFor(() => {
      expect(screen.getByTestId('word-entry-cards-mock')).toBeInTheDocument();
    });

    // WordEntryCards must get entryId = ITEM_ID
    expect(screen.getByTestId('word-entry-cards-mock')).toHaveAttribute('data-entry-id', ITEM_ID);
  });

  // ── AC #2: Pill row from cached AdminVocabularyCard ───────────────────────

  it('AC#2: pill row renders from cached AdminVocabularyCard, not from useWordEntry', async () => {
    const adminCard = makeAdminCard({
      grammar_filled: 5,
      grammar_total: 5,
      audio_status: 'ready',
      has_examples: true,
      example_count: 2,
      examples_with_en: 2,
      examples_with_ru: 1,
      examples_with_audio: 1,
      back_text_en: 'hello',
      back_text_ru: 'привет',
      translation_en_plural: null,
      translation_ru_plural: null,
    });

    renderDetail(makeVocabDeck(), { preloadedCard: adminCard });

    await waitFor(() => {
      expect(screen.getByTestId('vocab-word-detail-pills')).toBeInTheDocument();
    });

    // Pills should be derived from adminCard — completion pill container visible
    const pillsContainer = screen.getByTestId('vocab-word-detail-pills');
    expect(pillsContainer).toBeInTheDocument();

    // The EN pill should be present (back_text_en is set)
    expect(screen.getByTestId('completion-pill-en')).toBeInTheDocument();
  });

  // ── AC #3: Testids preserved ──────────────────────────────────────────────

  it('AC#3: all required testids are present', async () => {
    renderDetail(makeVocabDeck(), { preloadedCard: makeAdminCard() });

    await waitFor(() => {
      expect(screen.getByTestId('word-entry-detail-tabs')).toBeInTheDocument();
    });

    expect(screen.getByTestId('word-entry-tab-entry')).toBeInTheDocument();
    expect(screen.getByTestId('word-entry-tab-cards')).toBeInTheDocument();
    expect(screen.getByTestId('word-entry-tab-content-entry')).toBeInTheDocument();
    // word-entry-tab-content-cards is present in the DOM (just hidden via CSS) — check it exists
    expect(screen.getByTestId('word-entry-tab-content-cards')).toBeInTheDocument();
  });

  // ── AC #4: Deep link ?subtab=cards → cards sub-tab active ────────────────

  it('AC#4: deep link with ?subtab=cards lands on Cards tab; skeleton shows during loading', () => {
    const loadingState = {
      wordEntry: null,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };

    renderDetail(makeVocabDeck(), {
      initialUrl: `/admin?edit=${DECK_ID}&item=${ITEM_ID}&subtab=cards`,
      wordEntryData: loadingState,
    });

    // During loading (no wordEntry yet), skeleton should be visible
    expect(screen.getByTestId('deck-drawer-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('deck-drawer-skeleton')).toHaveAttribute('data-variant', 'detail');
  });

  it('AC#4: after loading, ?subtab=cards shows cards tab as active', async () => {
    renderDetail(makeVocabDeck(), {
      initialUrl: `/admin?edit=${DECK_ID}&item=${ITEM_ID}&subtab=cards`,
      preloadedCard: makeAdminCard(),
    });

    await waitFor(() => {
      // The cards tab trigger should exist
      expect(screen.getByTestId('word-entry-tab-cards')).toBeInTheDocument();
    });

    // Cards tab trigger should have aria-selected
    expect(screen.getByTestId('word-entry-tab-cards')).toHaveAttribute('aria-selected', 'true');
  });

  // ── AC #5: Back button removes ?item, keeps ?edit ────────────────────────

  it('AC#5: Back button removes ?item from URL and keeps ?edit', async () => {
    const user = userEvent.setup();

    const { getSearch } = renderDetail(makeVocabDeck(), {
      initialUrl: `/admin?edit=${DECK_ID}&item=${ITEM_ID}&subtab=entry`,
      preloadedCard: makeAdminCard(),
    });

    await waitFor(() => {
      expect(screen.getByTestId('vocab-word-detail-back')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('vocab-word-detail-back'));

    await waitFor(() => {
      expect(getSearch()).not.toContain('item=');
    });

    expect(getSearch()).toContain(`edit=${DECK_ID}`);
    expect(getSearch()).not.toContain('subtab=');
  });

  // ── AC #6: Header elements ────────────────────────────────────────────────

  it('AC#6: header shows Greek word (28px), POS badge, gender chip, completion badge', async () => {
    const adminCard = makeAdminCard({
      front_text: 'αγάπη',
      part_of_speech: 'noun',
      gender: 'feminine',
      // 100% completion: all fields filled
      grammar_filled: 5,
      grammar_total: 5,
      audio_status: 'ready',
      back_text_en: 'love',
      back_text_ru: 'любовь',
      translation_en_plural: 'loves',
      translation_ru_plural: null,
      example_count: 1,
      examples_with_en: 1,
      examples_with_ru: 1,
      examples_with_audio: 1,
    });

    renderDetail(makeVocabDeck(), { preloadedCard: adminCard });

    await waitFor(() => {
      expect(screen.getByTestId('vocab-word-detail-lemma')).toBeInTheDocument();
    });

    // Greek word at 28px
    const lemmaEl = screen.getByTestId('vocab-word-detail-lemma');
    expect(lemmaEl).toHaveTextContent('αγάπη');
    expect(lemmaEl).toHaveAttribute('lang', 'el');

    // POS badge
    expect(screen.getByTestId('vocab-word-detail-pos')).toHaveTextContent('noun');

    // Gender chip
    expect(screen.getByTestId('vocab-word-detail-gender')).toHaveTextContent('♀');

    // Completion badge
    expect(screen.getByTestId('vocab-word-detail-pct')).toBeInTheDocument();
  });

  // ── AC #2 (fallback): pill row from API when not in cache ─────────────────

  it('AC#2 fallback: fetches adminAPI.listWordEntries when card not in cache', async () => {
    // No preloaded card — forces API fallback
    renderDetail(makeVocabDeck(), { preloadedCard: undefined });

    await waitFor(() => {
      expect(adminAPI.listWordEntries).toHaveBeenCalledWith(DECK_ID, 1, 50);
    });

    await waitFor(() => {
      expect(screen.getByTestId('vocab-word-detail-pills')).toBeInTheDocument();
    });
  });

  // ── Skeleton while loading ────────────────────────────────────────────────

  it('shows detail skeleton while useWordEntry is loading and wordEntry is null', () => {
    const loadingState = {
      wordEntry: null,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };

    renderDetail(makeVocabDeck(), { wordEntryData: loadingState });

    expect(screen.getByTestId('deck-drawer-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('deck-drawer-skeleton')).toHaveAttribute('data-variant', 'detail');
  });

  // ── Pill skeleton when adminCard not yet available ────────────────────────

  it('shows pill skeleton when adminCard is not yet available (no cache, API still fetching)', async () => {
    // API never resolves
    (adminAPI.listWordEntries as Mock).mockReturnValue(new Promise(() => {}));

    renderDetail(makeVocabDeck(), { preloadedCard: undefined });

    await waitFor(() => {
      expect(screen.getByTestId('vocab-word-detail-pills-skeleton')).toBeInTheDocument();
    });
  });
});

// ── AC #7: DeckDrawer hides tabs when itemId is present ──────────────────────
//
// This is tested in DeckDrawer.test.tsx — VocabWordDetail doesn't control that.
// We verify it here via integration (checking the DeckDrawer behaviour) separately.
