// src/components/admin/decks/__tests__/DeckDrawer.test.tsx
//
// Vitest + RTL unit tests for DeckDrawer (ADMIN2-09 / DKDR-05).

import type { ReactNode } from 'react';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import type { UnifiedDeckItem } from '@/services/adminAPI';

import { DeckDrawer } from '../DeckDrawer';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    getDeck: vi.fn(),
    listDecks: vi.fn(),
    listWordEntries: vi
      .fn()
      .mockResolvedValue({ total: 0, page: 1, page_size: 20, deck_id: 'deck-vocab-1', cards: [] }),
    deleteWordEntry: vi.fn(),
    updateVocabularyDeck: vi.fn(),
    updateCultureDeck: vi.fn(),
    deleteVocabularyDeck: vi.fn(),
    deleteCultureDeck: vi.fn(),
  },
}));

// Mock VocabDrawerBody to avoid its deep dependency tree in DeckDrawer tests
vi.mock('../VocabDrawerBody', () => ({
  VocabDrawerBody: () => <div data-testid="vocab-drawer-body-mock" />,
}));

// Mock DeckDeleteDialog — stub renders both testids so delete-wiring specs can
// drive them without needing the Radix portal + i18n machinery.
const mockOnConfirm = vi.fn();
const mockOnOpenChange = vi.fn();
vi.mock('@/components/admin/DeckDeleteDialog', () => ({
  DeckDeleteDialog: ({
    open,
    onConfirm,
    onOpenChange,
  }: {
    open: boolean;
    onConfirm: () => void;
    onOpenChange: (v: boolean) => void;
  }) => {
    if (!open) return null;
    return (
      <div data-testid="deck-delete-dialog">
        <button
          data-testid="deck-delete-confirm"
          onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}
        >
          Confirm delete
        </button>
      </div>
    );
  },
}));

// Mock useAdminTabCountsStore — expose getState().fetchCounts as a spy.
const mockFetchCounts = vi.fn().mockResolvedValue(undefined);
vi.mock('@/stores/adminTabCountsStore', () => ({
  useAdminTabCountsStore: Object.assign(
    // Hook form (unused by the 4 new specs, but DeckDrawer may call it)
    vi.fn(() => ({ fetchCounts: mockFetchCounts })),
    // Static form used in the actual hoist: useAdminTabCountsStore.getState().fetchCounts()
    {
      getState: vi.fn(() => ({ fetchCounts: mockFetchCounts })),
    }
  ),
}));

// Import after vi.mock so we get the mocked version.
import { adminAPI } from '@/services/adminAPI';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeVocabDeck = (overrides: Partial<UnifiedDeckItem> = {}): UnifiedDeckItem => ({
  id: 'deck-vocab-1',
  name: 'Essential A1',
  name_en: 'Essential A1',
  name_ru: 'Основы A1',
  type: 'vocabulary',
  level: 'A1',
  category: null,
  item_count: 42,
  is_active: true,
  is_premium: false,
  is_system_deck: true,
  created_at: '2026-01-01T00:00:00Z',
  owner_id: null,
  owner_name: null,
  ...overrides,
});

const makeCultureDeck = (overrides: Partial<UnifiedDeckItem> = {}): UnifiedDeckItem => ({
  id: 'deck-culture-1',
  name: { el: 'Ελληνική κουλτούρα', en: 'Greek Culture', ru: 'Греческая культура' },
  name_en: 'Greek Culture',
  name_ru: 'Греческая культура',
  type: 'culture',
  level: null,
  category: 'culture',
  item_count: 20,
  is_active: true,
  is_premium: false,
  is_system_deck: null,
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

function renderDrawer(initialUrl: string) {
  const queryClient = makeQueryClient();

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route path="*" element={<DeckDrawer />} />
      </Routes>
    </MemoryRouter>,
    { wrapper: Wrapper }
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DeckDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Vocab deck — drawer mounts + correct 3 tabs ─────────────────────────

  it('opens for vocab deck and renders 3 tab triggers (words, settings, activity)', async () => {
    (adminAPI.getDeck as Mock).mockResolvedValue(makeVocabDeck());

    renderDrawer('/admin?tab=decks&edit=deck-vocab-1');

    // Drawer panel must be present
    expect(screen.getByTestId('deck-drawer')).toBeInTheDocument();

    // Wait for query to resolve and tabs to appear
    await waitFor(() => {
      expect(screen.getByTestId('deck-drawer-tabs')).toBeInTheDocument();
    });

    expect(screen.getByTestId('deck-drawer-tab-words')).toBeInTheDocument();
    expect(screen.getByTestId('deck-drawer-tab-settings')).toBeInTheDocument();
    expect(screen.getByTestId('deck-drawer-tab-activity')).toBeInTheDocument();
    // Questions tab must NOT be present for vocab deck
    expect(screen.queryByTestId('deck-drawer-tab-questions')).not.toBeInTheDocument();
  });

  // ── 2. Culture deck — correct 3 tabs (questions, settings, activity) ───────

  it('opens for culture deck and renders 3 tab triggers (questions, settings, activity)', async () => {
    (adminAPI.getDeck as Mock).mockResolvedValue(makeCultureDeck());

    renderDrawer('/admin?tab=decks&edit=deck-culture-1');

    expect(screen.getByTestId('deck-drawer')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('deck-drawer-tabs')).toBeInTheDocument();
    });

    expect(screen.getByTestId('deck-drawer-tab-questions')).toBeInTheDocument();
    expect(screen.getByTestId('deck-drawer-tab-settings')).toBeInTheDocument();
    expect(screen.getByTestId('deck-drawer-tab-activity')).toBeInTheDocument();
    // Words tab must NOT be present for culture deck
    expect(screen.queryByTestId('deck-drawer-tab-words')).not.toBeInTheDocument();
  });

  // ── 3. Close button strips edit/item/subtab params ─────────────────────────

  it('close button removes edit, item, and subtab from search params', async () => {
    const user = userEvent.setup();

    (adminAPI.getDeck as Mock).mockResolvedValue(makeVocabDeck());

    let currentSearch = '';

    const CaptureSearch = () => {
      // react-router's useLocation returns current URL — capture via render
      const { useLocation } = require('react-router-dom');
      const location = useLocation();
      currentSearch = location.search;
      return null;
    };

    const queryClient = makeQueryClient();
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    render(
      <MemoryRouter initialEntries={['/admin?edit=deck-vocab-1&item=word-1&subtab=words']}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <DeckDrawer />
                <CaptureSearch />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
      { wrapper: Wrapper }
    );

    // Wait for content to render
    await waitFor(() => {
      expect(screen.getByTestId('deck-drawer-tabs')).toBeInTheDocument();
    });

    // Click the SidePanel.CloseButton (aria-label="Close", inside the drawer panel).
    // There may be two "Close" buttons (SidePanel.CloseButton + Sheet's own close).
    // Use the one inside the deck-drawer panel.
    const drawerPanel = screen.getByTestId('deck-drawer');
    const closeBtn = drawerPanel.querySelector('button[aria-label="Close"]');
    if (!closeBtn) throw new Error('Close button not found inside deck-drawer');
    await user.click(closeBtn as HTMLElement);

    // URL params should be cleared
    expect(currentSearch).not.toContain('edit=');
    expect(currentSearch).not.toContain('item=');
    expect(currentSearch).not.toContain('subtab=');
  });

  // ── 4. Not-found: isError → deck-drawer-not-found, ?edit= preserved ────────

  it('shows not-found state when deck query errors and keeps ?edit= in URL', async () => {
    (adminAPI.getDeck as Mock).mockRejectedValue(new Error('Network error'));

    let capturedSearch = '';

    const CaptureSearch = () => {
      const { useLocation } = require('react-router-dom');
      const location = useLocation();
      capturedSearch = location.search;
      return null;
    };

    const queryClient = makeQueryClient();
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    render(
      <MemoryRouter initialEntries={['/admin?edit=deck-unknown']}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <DeckDrawer />
                <CaptureSearch />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(screen.getByTestId('deck-drawer-not-found')).toBeInTheDocument();
    });

    // ?edit= must still be in URL (not stripped)
    expect(capturedSearch).toContain('edit=deck-unknown');
  });

  // ── 5. Not-found: 404 from getDeck keeps ?edit= ────────────────────────────

  it('shows not-found state when deck is not found (404) and keeps ?edit= in URL', async () => {
    // getDeck throws 404 — deck does not exist
    (adminAPI.getDeck as Mock).mockRejectedValue(
      Object.assign(new Error('Not Found'), { status: 404 })
    );

    let capturedSearch = '';

    const CaptureSearch = () => {
      const { useLocation } = require('react-router-dom');
      const location = useLocation();
      capturedSearch = location.search;
      return null;
    };

    const queryClient = makeQueryClient();
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    render(
      <MemoryRouter initialEntries={['/admin?edit=deck-missing']}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <DeckDrawer />
                <CaptureSearch />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(screen.getByTestId('deck-drawer-not-found')).toBeInTheDocument();
    });

    expect(capturedSearch).toContain('edit=deck-missing');
  });

  // ── 6. Activity tab renders placeholder copy ────────────────────────────────

  it('activity tab shows activityPlaceholder text', async () => {
    const user = userEvent.setup();

    (adminAPI.getDeck as Mock).mockResolvedValue(makeVocabDeck());

    renderDrawer('/admin?edit=deck-vocab-1&subtab=words');

    await waitFor(() => {
      expect(screen.getByTestId('deck-drawer-tabs')).toBeInTheDocument();
    });

    // Click the Activity tab
    await user.click(screen.getByTestId('deck-drawer-tab-activity'));

    await waitFor(() => {
      expect(screen.getByTestId('deck-drawer-activity')).toBeInTheDocument();
    });

    expect(screen.getByTestId('deck-drawer-activity')).toHaveTextContent(
      'Recent edits, last reviewed time, and learner stats will live here.'
    );
  });

  // ── 7. Deep-link with ?item= → detail skeleton variant ─────────────────────

  it('shows detail-variant skeleton when ?item= is present during load', () => {
    // Use a never-resolving promise to stay in loading state
    (adminAPI.getDeck as Mock).mockReturnValue(new Promise(() => {}));

    renderDrawer('/admin?edit=deck-vocab-1&item=word-99');

    const skeleton = screen.getByTestId('deck-drawer-skeleton');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute('data-variant', 'detail');
  });

  // ── 8. Deep-link without ?item= → list skeleton variant ────────────────────

  it('shows list-variant skeleton when no ?item= param during load', () => {
    (adminAPI.getDeck as Mock).mockReturnValue(new Promise(() => {}));

    renderDrawer('/admin?edit=deck-vocab-1');

    const skeleton = screen.getByTestId('deck-drawer-skeleton');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute('data-variant', 'list');
  });

  // ── 9. Breadcrumb shows deck type segment ──────────────────────────────────

  it('breadcrumb contains deck type "Vocabulary" for vocab deck', async () => {
    (adminAPI.getDeck as Mock).mockResolvedValue(makeVocabDeck());

    renderDrawer('/admin?tab=decks&edit=deck-vocab-1');

    await waitFor(() => {
      expect(screen.getByTestId('deck-drawer-tabs')).toBeInTheDocument();
    });

    const breadcrumb = document.querySelector('.drawer-breadcrumb');
    expect(breadcrumb).toBeInTheDocument();
    expect(breadcrumb?.textContent).toContain('Vocabulary');
  });

  it('breadcrumb contains deck type "Culture" for culture deck', async () => {
    (adminAPI.getDeck as Mock).mockResolvedValue(makeCultureDeck());

    renderDrawer('/admin?tab=decks&edit=deck-culture-1');

    await waitFor(() => {
      expect(screen.getByTestId('deck-drawer-tabs')).toBeInTheDocument();
    });

    const breadcrumb = document.querySelector('.drawer-breadcrumb');
    expect(breadcrumb).toBeInTheDocument();
    expect(breadcrumb?.textContent).toContain('Culture');
  });

  // ── 10. Premium badge ──────────────────────────────────────────────────────

  it('renders Premium badge when deck.is_premium is true', async () => {
    (adminAPI.getDeck as Mock).mockResolvedValue(makeVocabDeck({ is_premium: true }));

    renderDrawer('/admin?tab=decks&edit=deck-vocab-1');

    await waitFor(() => {
      expect(screen.getByTestId('deck-drawer-tabs')).toBeInTheDocument();
    });

    expect(screen.getByText('Premium')).toBeInTheDocument();
  });

  it('does not render Premium badge when deck.is_premium is false', async () => {
    (adminAPI.getDeck as Mock).mockResolvedValue(makeVocabDeck({ is_premium: false }));

    renderDrawer('/admin?tab=decks&edit=deck-vocab-1');

    await waitFor(() => {
      expect(screen.getByTestId('deck-drawer-tabs')).toBeInTheDocument();
    });

    expect(screen.queryByText('Premium')).not.toBeInTheDocument();
  });

  // ── 11. Default footer on Words tab ─────────────────────────────────────────

  it('shows default footer with 3 buttons on Words tab (not Settings)', async () => {
    (adminAPI.getDeck as Mock).mockResolvedValue(makeVocabDeck());

    renderDrawer('/admin?tab=decks&edit=deck-vocab-1');

    await waitFor(() => {
      expect(screen.getByTestId('deck-drawer-tabs')).toBeInTheDocument();
    });

    const footer = screen.getByTestId('deck-drawer-footer');
    expect(footer).toBeInTheDocument();
    expect(screen.getByText('All cards complete')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Save & close')).toBeInTheDocument();
    expect(screen.getByText('Save changes')).toBeInTheDocument();
  });

  // ── 12. Footer hidden in detail view ───────────────────────────────────────

  it('hides footer when ?item= is present (detail view)', async () => {
    (adminAPI.getDeck as Mock).mockResolvedValue(makeVocabDeck());

    renderDrawer('/admin?tab=decks&edit=deck-vocab-1&item=some-word-id');

    await waitFor(() => {
      expect(screen.getByTestId('deck-drawer-tabs')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('deck-drawer-footer')).not.toBeInTheDocument();
  });

  // ── 13. Dirty-cancel → discard dialog; "Keep editing" preserves dirty state ──
  // Regression guard for PM Decision #9: dirty-cancel must show discard dialog;
  // "Keep editing" must dismiss dialog without resetting the form.

  it('dirty-cancel triggers discard dialog; Keep editing dismisses it and preserves dirty state', async () => {
    const user = userEvent.setup();

    (adminAPI.getDeck as Mock).mockResolvedValue(
      makeVocabDeck({ name_en: 'Original Name', name_ru: 'Original RU' })
    );

    // Start on settings subtab so DeckSettingsTab renders immediately
    renderDrawer('/admin?edit=deck-vocab-1&subtab=settings');

    // Wait for the settings tab content to appear
    await waitFor(() => {
      expect(screen.getByTestId('vocabulary-deck-edit-form')).toBeInTheDocument();
    });

    // Wait for footer buttons (injected by DeckSettingsTab via setFooter context)
    await waitFor(() => {
      expect(screen.getByTestId('deck-settings-footer')).toBeInTheDocument();
    });

    // Dirty the form by editing the name field
    const nameInput = screen.getByTestId('deck-edit-name-en');
    await user.clear(nameInput);
    await user.type(nameInput, 'Edited Name');

    // Verify form is now dirty (Save button should be enabled)
    await waitFor(() => {
      const saveBtn = screen.getByTestId('deck-settings-save');
      expect(saveBtn).not.toBeDisabled();
    });

    // Click Cancel — since form is dirty, discard dialog should appear
    const cancelBtn = screen.getByTestId('deck-settings-cancel');
    await user.click(cancelBtn);

    // Discard dialog must appear
    await waitFor(() => {
      expect(screen.getByTestId('deck-settings-discard-dialog')).toBeInTheDocument();
    });

    // Click "Keep editing" button (deck-settings-discard-cancel)
    await user.click(screen.getByTestId('deck-settings-discard-cancel'));

    // Dialog should be dismissed
    await waitFor(() => {
      expect(screen.queryByTestId('deck-settings-discard-dialog')).not.toBeInTheDocument();
    });

    // The field must still show the edited value (form was NOT reset)
    expect(screen.getByTestId('deck-edit-name-en')).toHaveValue('Edited Name');

    // Save button must still be enabled (form is still dirty)
    expect(screen.getByTestId('deck-settings-save')).not.toBeDisabled();
  });

  // ── 14–17. Hoisted delete-wiring specs (ADMIN2-35-04, AC #10-13) ─────────────
  // These specs are RED until the executor hoists DeckDeleteDialog + handleDeleteConfirm
  // from DeckSettingsTab into DeckDrawer and adds `deck-drawer-footer-delete`.

  // AC #10
  it('footer_delete_opens_delete_dialog: clicking deck-drawer-footer-delete shows deck-delete-dialog', async () => {
    const user = userEvent.setup();

    (adminAPI.getDeck as Mock).mockResolvedValue(makeVocabDeck());

    renderDrawer('/admin?tab=decks&edit=deck-vocab-1');

    await waitFor(() => {
      expect(screen.getByTestId('deck-drawer-tabs')).toBeInTheDocument();
    });

    // The footer-left delete button does not exist yet in DeckDrawer — this click
    // will throw "Unable to find element" once DeckDrawer is fully loaded, making
    // the spec fail on assertion (not import crash).
    const deleteBtn = screen.getByTestId('deck-drawer-footer-delete');
    await user.click(deleteBtn);

    expect(screen.getByTestId('deck-delete-dialog')).toBeInTheDocument();
  });

  // AC #11
  it('confirm_delete_calls_deactivate_for_vocab: confirming on a vocab deck calls deleteVocabularyDeck and NOT deleteCultureDeck', async () => {
    const user = userEvent.setup();

    (adminAPI.getDeck as Mock).mockResolvedValue(makeVocabDeck());
    (adminAPI.deleteVocabularyDeck as Mock).mockResolvedValue(undefined);
    (adminAPI.deleteCultureDeck as Mock).mockResolvedValue(undefined);

    renderDrawer('/admin?tab=decks&edit=deck-vocab-1');

    await waitFor(() => {
      expect(screen.getByTestId('deck-drawer-tabs')).toBeInTheDocument();
    });

    // Open the delete dialog via footer-left button (will fail here until executor builds it)
    await user.click(screen.getByTestId('deck-drawer-footer-delete'));

    await waitFor(() => {
      expect(screen.getByTestId('deck-delete-confirm')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('deck-delete-confirm'));

    await waitFor(() => {
      expect(adminAPI.deleteVocabularyDeck as Mock).toHaveBeenCalledWith('deck-vocab-1');
    });

    expect(adminAPI.deleteCultureDeck as Mock).not.toHaveBeenCalled();
  });

  // AC #12
  it('confirm_delete_calls_deactivate_for_culture: confirming on a culture deck calls deleteCultureDeck and NOT deleteVocabularyDeck', async () => {
    const user = userEvent.setup();

    (adminAPI.getDeck as Mock).mockResolvedValue(makeCultureDeck());
    (adminAPI.deleteCultureDeck as Mock).mockResolvedValue(undefined);
    (adminAPI.deleteVocabularyDeck as Mock).mockResolvedValue(undefined);

    renderDrawer('/admin?tab=decks&edit=deck-culture-1');

    await waitFor(() => {
      expect(screen.getByTestId('deck-drawer-tabs')).toBeInTheDocument();
    });

    // Open the delete dialog via footer-left button (will fail here until executor builds it)
    await user.click(screen.getByTestId('deck-drawer-footer-delete'));

    await waitFor(() => {
      expect(screen.getByTestId('deck-delete-confirm')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('deck-delete-confirm'));

    await waitFor(() => {
      expect(adminAPI.deleteCultureDeck as Mock).toHaveBeenCalledWith('deck-culture-1');
    });

    expect(adminAPI.deleteVocabularyDeck as Mock).not.toHaveBeenCalled();
  });

  // AC #13
  it('confirm_delete_closes_drawer_and_refreshes: after confirm, URL strips edit/item/subtab, invalidateQueries and fetchCounts are called', async () => {
    const user = userEvent.setup();

    (adminAPI.getDeck as Mock).mockResolvedValue(makeVocabDeck());
    (adminAPI.deleteVocabularyDeck as Mock).mockResolvedValue(undefined);

    // Need an exposed queryClient to spy on invalidateQueries.
    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    let capturedSearch = '';
    const CaptureSearch = () => {
      const { useLocation } = require('react-router-dom');
      const location = useLocation();
      capturedSearch = location.search;
      return null;
    };

    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    render(
      <MemoryRouter initialEntries={['/admin?edit=deck-vocab-1&item=some-item&subtab=settings']}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <DeckDrawer />
                <CaptureSearch />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
      { wrapper: Wrapper }
    );

    await waitFor(() => {
      expect(screen.getByTestId('deck-drawer-tabs')).toBeInTheDocument();
    });

    // Open the delete dialog via footer-left button (will fail here until executor builds it)
    await user.click(screen.getByTestId('deck-drawer-footer-delete'));

    await waitFor(() => {
      expect(screen.getByTestId('deck-delete-confirm')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('deck-delete-confirm'));

    // After delete resolves: URL params stripped (drawer closes)
    await waitFor(() => {
      expect(capturedSearch).not.toContain('edit=');
    });
    expect(capturedSearch).not.toContain('item=');
    expect(capturedSearch).not.toContain('subtab=');

    // invalidateQueries called for ['admin', 'decks']
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'decks'] });

    // fetchCounts invoked
    expect(mockFetchCounts).toHaveBeenCalled();
  });
});
