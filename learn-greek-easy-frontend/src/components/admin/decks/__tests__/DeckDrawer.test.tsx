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

// Mock use-toast so destructive toast calls are assertable.
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (args: unknown) => mockToast(args),
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

  // ── 11. Standard footer on Words tab ────────────────────────────────────────
  // ADMIN2-35-04: one stable footer (Delete deck · Cancel + Save changes) across
  // all tabs. No "All cards complete", no "Save & close".

  it('shows the standard footer (delete / cancel / save) on the Words tab', async () => {
    (adminAPI.getDeck as Mock).mockResolvedValue(makeVocabDeck());

    renderDrawer('/admin?tab=decks&edit=deck-vocab-1');

    await waitFor(() => {
      expect(screen.getByTestId('deck-drawer-tabs')).toBeInTheDocument();
    });

    const footer = screen.getByTestId('deck-drawer-footer');
    expect(footer).toBeInTheDocument();

    // The three standard footer buttons carry explicit testids.
    expect(screen.getByTestId('deck-drawer-footer-delete')).toBeInTheDocument();
    expect(screen.getByTestId('deck-drawer-footer-cancel')).toBeInTheDocument();
    expect(screen.getByTestId('deck-drawer-footer-save')).toBeInTheDocument();

    // Save is disabled on a non-Settings tab (Words here).
    expect(screen.getByTestId('deck-drawer-footer-save')).toBeDisabled();

    // The destroyed legacy footer copy must be gone.
    expect(screen.queryByText('All cards complete')).not.toBeInTheDocument();
    expect(screen.queryByText('Save & close')).not.toBeInTheDocument();

    // The standard labels are present.
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
  //
  // ADMIN2-35-04: the footer Cancel is now the drawer-owned
  // `deck-drawer-footer-cancel`, which routes through closeWithGuard → the dirty
  // close-guard registered by DeckSettingsTab (the old `deck-settings-cancel` id
  // is gone). The Save button is the drawer-owned `deck-drawer-footer-save`,
  // enabled because we're on the Settings tab.

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

    // The drawer-owned footer Save is enabled on the Settings tab.
    expect(screen.getByTestId('deck-drawer-footer-save')).not.toBeDisabled();

    // Dirty the form by editing the name field
    const nameInput = screen.getByTestId('deck-edit-name-en');
    await user.clear(nameInput);
    await user.type(nameInput, 'Edited Name');

    expect(screen.getByTestId('deck-edit-name-en')).toHaveValue('Edited Name');

    // Click the drawer footer Cancel — since the form is dirty, the close guard
    // blocks the close and the discard dialog should appear.
    await user.click(screen.getByTestId('deck-drawer-footer-cancel'));

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

    // The drawer-owned Save remains enabled (form is still dirty + on Settings tab)
    expect(screen.getByTestId('deck-drawer-footer-save')).not.toBeDisabled();
  });

  // ── 13b. Save is enabled on a CLEAN Settings tab (FeedbackDrawer standard) ───
  // The footer Save disables ONLY off the Settings tab — never by dirty state.
  // Locks the new contract: enabled-when-clean on Settings (the redundant-PATCH
  // guard lives in DeckSettingsTab.handleSave, not on the button).

  it('footer Save is enabled on the Settings tab even when the form is not dirty', async () => {
    (adminAPI.getDeck as Mock).mockResolvedValue(makeVocabDeck());

    renderDrawer('/admin?edit=deck-vocab-1&subtab=settings');

    await waitFor(() => {
      expect(screen.getByTestId('vocabulary-deck-edit-form')).toBeInTheDocument();
    });

    // No edits made — Save must still be enabled on the Settings tab.
    expect(screen.getByTestId('deck-drawer-footer-save')).not.toBeDisabled();
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
  // NOTE: the footer-delete button is hidden in the ?item= detail view (AC #1),
  // so this spec opens the drawer WITHOUT ?item= (the other delete-wiring specs
  // already omit it). We still prove the close strips the close-target params by
  // seeding edit + subtab and asserting BOTH are cleared after delete — the
  // unconditional strip (which also clears item) ran, not a no-op.
  it('confirm_delete_closes_drawer_and_refreshes: after confirm, URL strips edit/subtab, invalidateQueries and fetchCounts are called', async () => {
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
      <MemoryRouter initialEntries={['/admin?edit=deck-vocab-1&subtab=settings']}>
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

    // Open the delete dialog via footer-left button
    await user.click(screen.getByTestId('deck-drawer-footer-delete'));

    await waitFor(() => {
      expect(screen.getByTestId('deck-delete-confirm')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('deck-delete-confirm'));

    // After delete resolves: both close-target params stripped (drawer closes).
    await waitFor(() => {
      expect(capturedSearch).not.toContain('edit=');
    });
    expect(capturedSearch).not.toContain('subtab=');
    expect(capturedSearch).not.toContain('item=');

    // invalidateQueries called for ['admin', 'decks']
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'decks'] });

    // fetchCounts invoked
    expect(mockFetchCounts).toHaveBeenCalled();
  });

  // ── ADVERSARIAL (ADMIN2-35-04 QA Mode B) ────────────────────────────────────
  // Added in the QA verify pass: footer stability across tabs (incl. the
  // settings↔non-settings disabled toggle within ONE render + the item= strip
  // when it IS present), the delete failure path (no silent close / no refresh
  // on rejection), and the dirty close-guard via the drawer-owned cancel.

  // A1. Footer is the SAME stable element across tabs; Save toggles by tab only.
  // #11 proves disabled-on-Words and 13b proves enabled-on-clean-Settings, but
  // each in its own render. This drives a real in-session tab switch (Words →
  // Settings → Activity) and asserts the 3 footer testids persist throughout
  // while Save flips disabled→enabled→disabled purely by the active tab.
  it('footer (delete/cancel/save) is stable across tab switches; Save disabled toggles by tab, not dirtiness', async () => {
    const user = userEvent.setup();

    (adminAPI.getDeck as Mock).mockResolvedValue(makeVocabDeck());

    // Start on the Words tab.
    renderDrawer('/admin?tab=decks&edit=deck-vocab-1&subtab=words');

    await waitFor(() => {
      expect(screen.getByTestId('deck-drawer-tabs')).toBeInTheDocument();
    });

    // Footer + its 3 buttons present on Words; Save disabled (non-Settings).
    expect(screen.getByTestId('deck-drawer-footer')).toBeInTheDocument();
    expect(screen.getByTestId('deck-drawer-footer-delete')).toBeInTheDocument();
    expect(screen.getByTestId('deck-drawer-footer-cancel')).toBeInTheDocument();
    expect(screen.getByTestId('deck-drawer-footer-save')).toBeDisabled();

    // Switch to Settings → Save enabled (form is clean, but tab gates it on).
    await user.click(screen.getByTestId('deck-drawer-tab-settings'));
    await waitFor(() => {
      expect(screen.getByTestId('deck-drawer-footer-save')).not.toBeDisabled();
    });
    // Same stable footer element still carries all three testids.
    expect(screen.getByTestId('deck-drawer-footer')).toBeInTheDocument();
    expect(screen.getByTestId('deck-drawer-footer-delete')).toBeInTheDocument();
    expect(screen.getByTestId('deck-drawer-footer-cancel')).toBeInTheDocument();

    // Switch to Activity → Save disabled again (back off Settings).
    await user.click(screen.getByTestId('deck-drawer-tab-activity'));
    await waitFor(() => {
      expect(screen.getByTestId('deck-drawer-footer-save')).toBeDisabled();
    });
    expect(screen.getByTestId('deck-drawer-footer-delete')).toBeInTheDocument();
    expect(screen.getByTestId('deck-drawer-footer-cancel')).toBeInTheDocument();
  });

  // A2. Delete FAILURE path: when deleteVocabularyDeck rejects, the drawer must
  // NOT silently close (URL params kept) and must NOT refresh the list/counts
  // (no invalidateQueries / no fetchCounts). The dialog itself closes (finally).
  // A destructive toast MUST be fired (matching the row-delete path in AdminPage).
  // Guards against the strip+refresh accidentally moving above/outside the await,
  // and against the catch being removed (toast assertion would fail).
  it('delete failure fires a destructive toast, does NOT close the drawer, and does NOT refresh the list', async () => {
    const user = userEvent.setup();

    (adminAPI.getDeck as Mock).mockResolvedValue(makeVocabDeck());
    (adminAPI.deleteVocabularyDeck as Mock).mockRejectedValue(new Error('deactivate failed'));

    const queryClient = makeQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    let capturedSearch = '';
    const CaptureSearch = () => {
      const { useLocation } = require('react-router-dom');
      capturedSearch = useLocation().search;
      return null;
    };

    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    render(
      <MemoryRouter initialEntries={['/admin?edit=deck-vocab-1&subtab=settings']}>
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

    await user.click(screen.getByTestId('deck-drawer-footer-delete'));
    await waitFor(() => {
      expect(screen.getByTestId('deck-delete-confirm')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('deck-delete-confirm'));

    // The deactivate call was attempted…
    await waitFor(() => {
      expect(adminAPI.deleteVocabularyDeck as Mock).toHaveBeenCalledWith('deck-vocab-1');
    });
    // …and the dialog closes (finally block), but nothing downstream of the
    // (rejected) await runs.
    await waitFor(() => {
      expect(screen.queryByTestId('deck-delete-dialog')).not.toBeInTheDocument();
    });

    // Drawer did NOT close: edit + subtab still in the URL.
    expect(capturedSearch).toContain('edit=deck-vocab-1');
    expect(capturedSearch).toContain('subtab=settings');

    // No refresh side effects on failure.
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['admin', 'decks'] });
    expect(mockFetchCounts).not.toHaveBeenCalled();

    // A destructive toast IS fired — matches the row-delete catch in AdminPage
    // (errors.saveFailed key, variant: 'destructive'). This would fail if the
    // catch were removed, making the test a meaningful regression guard.
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
    });
  });

  // (item= stripping on close is already covered by test #3, which seeds
  // ?item=word-1 and asserts it is purged via the same stripCloseParams helper
  // the delete path calls — so no separate delete-with-item= spec is needed, and
  // the footer-delete button is unreachable with ?item= present anyway, AC #1.)

  // A3. Dirty close-guard fires through the drawer-owned footer Cancel (PM
  // Decision #9 regression). #13 covers Keep-editing; this asserts the guard
  // BLOCKS the close on a dirty form (drawer stays open, edit= retained) when
  // Cancel is clicked — independent of the discard dialog's own buttons.
  it('drawer footer Cancel on a dirty Settings form blocks the close (guard fires) and keeps the drawer open', async () => {
    const user = userEvent.setup();

    (adminAPI.getDeck as Mock).mockResolvedValue(
      makeVocabDeck({ name_en: 'Original Name', name_ru: 'Original RU' })
    );

    let capturedSearch = '';
    const CaptureSearch = () => {
      const { useLocation } = require('react-router-dom');
      capturedSearch = useLocation().search;
      return null;
    };

    const queryClient = makeQueryClient();
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    render(
      <MemoryRouter initialEntries={['/admin?edit=deck-vocab-1&subtab=settings']}>
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
      expect(screen.getByTestId('vocabulary-deck-edit-form')).toBeInTheDocument();
    });

    // Dirty the form.
    const nameInput = screen.getByTestId('deck-edit-name-en');
    await user.clear(nameInput);
    await user.type(nameInput, 'Edited Name');

    // Cancel → close guard blocks the close, discard dialog appears.
    await user.click(screen.getByTestId('deck-drawer-footer-cancel'));

    await waitFor(() => {
      expect(screen.getByTestId('deck-settings-discard-dialog')).toBeInTheDocument();
    });

    // The drawer did NOT close — edit= is still in the URL (guard blocked it).
    expect(capturedSearch).toContain('edit=deck-vocab-1');
  });
});
