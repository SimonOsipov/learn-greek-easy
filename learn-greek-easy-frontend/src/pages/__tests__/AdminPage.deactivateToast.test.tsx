/**
 * AdminPage — AllDecksList deactivate-toast tests (ADMIN2-35-02)
 *
 * TEST SPEC: deactivate_fires_success_toast
 *   Given a mounted AllDecksList with one vocabulary deck
 *   When delete is confirmed and deleteVocabularyDeck resolves
 *   Then toast is called with title = t('toast.deckDeactivated') ("Deck deactivated")
 *   And fetchDecks is re-invoked (listDecks called again after confirm)
 *
 * TEST SPEC: deactivate_failure_fires_destructive_toast
 *   Given delete confirmed
 *   When deleteVocabularyDeck rejects
 *   Then toast is called with variant:'destructive'
 *
 * Strategy: mount the full <AdminPage> at ?tab=decks (AllDecksList is an internal
 * component, not exported). Mock adminAPI + @/hooks/use-toast + all Zustand stores
 * following the pattern in AdminPage.test.tsx.
 *
 * Delete flow:
 *   1. listDecks resolves with one deck → DeckRow renders
 *   2. Click trash button (data-testid="deck-row-actions" → "Delete deck" button)
 *   3. DeckDeleteDialog opens (data-testid="deck-delete-dialog")
 *   4. Click data-testid="deck-delete-confirm"
 *   5. handleDeleteConfirm fires → deleteVocabularyDeck → toast
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';

import i18n from '@/i18n';
import AdminPage from '@/pages/AdminPage';
import { adminAPI } from '@/services/adminAPI';
import type { UnifiedDeckItem } from '@/services/adminAPI';

// ---------------------------------------------------------------------------
// Mocks — mirror AdminPage.test.tsx pattern exactly
// ---------------------------------------------------------------------------

// adminAPI — the module under test for toast wiring
vi.mock('@/services/adminAPI', () => ({
  GENERATE_WORD_ENTRY_STREAM_URL: '/api/v1/admin/word-entries/generate/stream',
  adminAPI: {
    getContentStats: vi.fn().mockResolvedValue({
      total_decks: 1,
      total_vocabulary_decks: 1,
      total_culture_decks: 0,
      total_cards: 0,
    }),
    listDecks: vi.fn(),
    getAdminTabCounts: vi.fn().mockResolvedValue({}),
    updateVocabularyDeck: vi.fn(),
    updateCultureDeck: vi.fn(),
    deleteVocabularyDeck: vi.fn(),
    deleteCultureDeck: vi.fn(),
    createVocabularyDeck: vi.fn(),
    createCultureDeck: vi.fn(),
  },
}));

// use-toast — the call under test
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

// Zustand stores — no-op stubs, same as AdminPage.test.tsx
const mockFetchCounts = vi.fn().mockResolvedValue(undefined);

vi.mock('@/stores/adminTabCountsStore', () => {
  const storeState = {
    counts: { decks: 1 },
    loading: false,
    error: null,
    fetchCounts: () => mockFetchCounts(),
  };
  const useAdminTabCountsStore = (selector?: (s: typeof storeState) => unknown) =>
    selector ? selector(storeState) : storeState;
  // Expose getState() — called imperatively in handleDeleteConfirm (AdminPage.tsx:265)
  useAdminTabCountsStore.getState = () => storeState;
  return {
    useAdminTabCountsStore,
    selectTabCount: (k: string) => (s: typeof storeState) =>
      s.counts?.[k as keyof typeof storeState.counts] ?? 0,
    refetchAdminTabCounts: vi.fn(),
  };
});

vi.mock('@/stores/adminNewsStore', () => ({
  useAdminNewsStore: (selector?: (s: unknown) => unknown) => {
    const state = { total: 0, audioCount: 0, newsItems: [], fetchNewsItems: vi.fn() };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/stores/adminSituationStore', () => ({
  useAdminSituationStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      situations: [],
      total: 0,
      draft: 0,
      ready: 0,
      exercisesGenerated: 0,
      fetchSituations: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
  selectStatsTotals: (_state: { situations: unknown[] }) => ({
    total: 0,
    draft: 0,
    ready: 0,
    exercisesGenerated: 0,
  }),
}));

vi.mock('@/stores/adminExercisesStore', () => ({
  useAdminExercisesStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      source: 'all',
      type: 'all',
      level: 'all',
      status: 'all',
      q: '',
      qDebounced: '',
      page: 1,
      mode: null,
      openEntryId: null,
      openCompose: vi.fn(),
      openEdit: vi.fn(),
      closeDrawer: vi.fn(),
      setSource: vi.fn(),
      setType: vi.fn(),
      setLevel: vi.fn(),
      setStatus: vi.fn(),
      setQ: vi.fn(),
      setPage: vi.fn(),
      resetFilters: vi.fn(),
      hydrateFromURL: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/stores/adminChangelogStore', () => ({
  useAdminChangelogStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      items: [],
      selectedEntry: null,
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
      isLoading: false,
      isSaving: false,
      isDeleting: false,
      error: null,
      openEntryId: null,
      mode: null,
      lang: 'en',
      panelMode: 'form',
      fetchList: vi.fn(),
      fetchById: vi.fn(),
      createEntry: vi.fn(),
      updateEntry: vi.fn(),
      deleteEntry: vi.fn(),
      setSelectedEntry: vi.fn(),
      setPage: vi.fn(),
      clearError: vi.fn(),
      reset: vi.fn(),
      openCompose: vi.fn(),
      openEdit: vi.fn(),
      closeDrawer: vi.fn(),
      setLang: vi.fn(),
      setPanelMode: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
  selectAdminChangelogLang: (s: { lang: string }) => s.lang,
  selectAdminChangelogPanelMode: (s: { panelMode: string }) => s.panelMode,
  selectAdminChangelogIsSaving: (s: { isSaving: boolean }) => s.isSaving,
  selectAdminChangelogItems: (s: { items: unknown[] }) => s.items,
  selectAdminChangelogSelectedEntry: (s: { selectedEntry: unknown }) => s.selectedEntry,
  selectAdminChangelogIsLoading: (s: { isLoading: boolean }) => s.isLoading,
  selectAdminChangelogIsDeleting: (s: { isDeleting: boolean }) => s.isDeleting,
  selectAdminChangelogError: (s: { error: unknown }) => s.error,
  selectAdminChangelogPage: (s: { page: number }) => s.page,
  selectAdminChangelogPageSize: (s: { pageSize: number }) => s.pageSize,
  selectAdminChangelogTotal: (s: { total: number }) => s.total,
  selectAdminChangelogTotalPages: (s: { totalPages: number }) => s.totalPages,
}));

// Stub heavy sub-views that are not the subject of these tests
vi.mock('@/components/admin/exercises/AdminExercisesSection', () => ({
  AdminExercisesSection: () => <div data-testid="admin-exercises-section" />,
}));

// DeckDrawer uses react-query internally and requires QueryClientProvider.
// These tests focus on AllDecksList's delete flow — stub the drawer out.
vi.mock('@/components/admin/decks/DeckDrawer', () => ({
  DeckDrawer: () => <div data-testid="deck-drawer-stub" />,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeVocabDeck = (overrides: Partial<UnifiedDeckItem> = {}): UnifiedDeckItem => ({
  id: 'deck-vocab-1',
  name: 'Essential A1',
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

const DECK_LIST_WITH_ONE = (deck: UnifiedDeckItem) => ({
  decks: [deck],
  total: 1,
  page: 1,
  page_size: 10,
});

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderAdminDecksTab() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/admin?tab=decks']}>
        <Routes>
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AllDecksList — deactivate toast (ADMIN2-35-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchCounts.mockResolvedValue(undefined);
  });

  // ── TEST SPEC: deactivate_fires_success_toast ─────────────────────────────
  it('deactivate_fires_success_toast: confirmed delete resolves → toast with deckDeactivated title', async () => {
    const deck = makeVocabDeck();
    (adminAPI.listDecks as Mock).mockResolvedValue(DECK_LIST_WITH_ONE(deck));
    (adminAPI.deleteVocabularyDeck as Mock).mockResolvedValue(undefined);

    renderAdminDecksTab();

    // Wait for DeckRow to appear (listDecks resolved)
    const trashBtn = await screen.findByRole('button', { name: /delete deck/i });
    fireEvent.click(trashBtn);

    // DeckDeleteDialog must open
    await screen.findByTestId('deck-delete-dialog');

    // Click confirm
    const confirmBtn = screen.getByTestId('deck-delete-confirm');
    fireEvent.click(confirmBtn);

    // toast must be called with the success title
    const expectedTitle = i18n.getFixedT('en', 'admin')('toast.deckDeactivated');
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: expectedTitle }));
    });

    // fetchDecks must be re-invoked (listDecks called at least twice: initial + after confirm)
    await waitFor(() => {
      expect(adminAPI.listDecks).toHaveBeenCalledTimes(2);
    });
  });

  // ── TEST SPEC: deactivate_failure_fires_destructive_toast ─────────────────
  it('deactivate_failure_fires_destructive_toast: confirmed delete rejects → toast with variant:destructive', async () => {
    const deck = makeVocabDeck();
    (adminAPI.listDecks as Mock).mockResolvedValue(DECK_LIST_WITH_ONE(deck));
    (adminAPI.deleteVocabularyDeck as Mock).mockRejectedValue(new Error('Server error'));

    renderAdminDecksTab();

    const trashBtn = await screen.findByRole('button', { name: /delete deck/i });
    fireEvent.click(trashBtn);

    await screen.findByTestId('deck-delete-dialog');

    const confirmBtn = screen.getByTestId('deck-delete-confirm');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
    });
  });

  // ── ADVERSARIAL: cancel path ──────────────────────────────────────────────
  // Dismissing the delete confirm (clicking Cancel) must NOT fire toast and
  // must NOT call deleteVocabularyDeck.
  it('cancel_path: clicking Cancel fires no toast and does not call deleteVocabularyDeck', async () => {
    const deck = makeVocabDeck();
    (adminAPI.listDecks as Mock).mockResolvedValue(DECK_LIST_WITH_ONE(deck));
    (adminAPI.deleteVocabularyDeck as Mock).mockResolvedValue(undefined);

    renderAdminDecksTab();

    const trashBtn = await screen.findByRole('button', { name: /delete deck/i });
    fireEvent.click(trashBtn);

    await screen.findByTestId('deck-delete-dialog');

    // Click Cancel — should close dialog without deactivating
    const cancelBtn = screen.getByTestId('deck-delete-cancel');
    fireEvent.click(cancelBtn);

    // Give async handlers time to run if any
    await new Promise((r) => setTimeout(r, 50));

    expect(mockToast).not.toHaveBeenCalled();
    expect(adminAPI.deleteVocabularyDeck).not.toHaveBeenCalled();
  });

  // ── ADVERSARIAL: culture deck ─────────────────────────────────────────────
  // A culture deck row uses deleteCultureDeck (not deleteVocabularyDeck) and
  // still fires the success toast — guards against the type-branch being broken.
  it('culture_deck_deactivate: confirmed delete of culture deck fires success toast via deleteCultureDeck', async () => {
    const deck = makeVocabDeck({ id: 'deck-culture-1', type: 'culture', name: 'Culture Deck' });
    (adminAPI.listDecks as Mock).mockResolvedValue(DECK_LIST_WITH_ONE(deck));
    (adminAPI.deleteCultureDeck as Mock).mockResolvedValue(undefined);

    renderAdminDecksTab();

    const trashBtn = await screen.findByRole('button', { name: /delete deck/i });
    fireEvent.click(trashBtn);

    await screen.findByTestId('deck-delete-dialog');

    fireEvent.click(screen.getByTestId('deck-delete-confirm'));

    const expectedTitle = i18n.getFixedT('en', 'admin')('toast.deckDeactivated');
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: expectedTitle }));
    });

    // deleteCultureDeck — not deleteVocabularyDeck — must have been called
    expect(adminAPI.deleteCultureDeck).toHaveBeenCalledWith('deck-culture-1');
    expect(adminAPI.deleteVocabularyDeck).not.toHaveBeenCalled();
  });

  // ── ADVERSARIAL: destructive toast carries a description ─────────────────
  // The catch block constructs a description from the error message so the admin
  // can see WHY it failed — assert the description field is non-empty.
  it('failure_toast_carries_description: destructive toast includes a non-empty description', async () => {
    const deck = makeVocabDeck();
    (adminAPI.listDecks as Mock).mockResolvedValue(DECK_LIST_WITH_ONE(deck));
    (adminAPI.deleteVocabularyDeck as Mock).mockRejectedValue(new Error('Internal server error'));

    renderAdminDecksTab();

    const trashBtn = await screen.findByRole('button', { name: /delete deck/i });
    fireEvent.click(trashBtn);

    await screen.findByTestId('deck-delete-dialog');
    fireEvent.click(screen.getByTestId('deck-delete-confirm'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          description: expect.stringMatching(/.+/),
        })
      );
    });
  });
});
