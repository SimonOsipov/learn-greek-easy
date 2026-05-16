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
    (adminAPI.listDecks as Mock).mockResolvedValue({
      decks: [makeVocabDeck()],
      total: 1,
      page: 1,
      page_size: 200,
    });

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
    (adminAPI.listDecks as Mock).mockResolvedValue({
      decks: [makeCultureDeck()],
      total: 1,
      page: 1,
      page_size: 200,
    });

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

    (adminAPI.listDecks as Mock).mockResolvedValue({
      decks: [makeVocabDeck()],
      total: 1,
      page: 1,
      page_size: 200,
    });

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
    (adminAPI.listDecks as Mock).mockRejectedValue(new Error('Network error'));

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

  // ── 5. Not-found: null data (deck not in list) keeps ?edit= ────────────────

  it('shows not-found state when deck is not in list result', async () => {
    // listDecks returns empty — no match for the given ID
    (adminAPI.listDecks as Mock).mockResolvedValue({
      decks: [],
      total: 0,
      page: 1,
      page_size: 200,
    });

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

    (adminAPI.listDecks as Mock).mockResolvedValue({
      decks: [makeVocabDeck()],
      total: 1,
      page: 1,
      page_size: 200,
    });

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
    (adminAPI.listDecks as Mock).mockReturnValue(new Promise(() => {}));

    renderDrawer('/admin?edit=deck-vocab-1&item=word-99');

    const skeleton = screen.getByTestId('deck-drawer-skeleton');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute('data-variant', 'detail');
  });

  // ── 8. Deep-link without ?item= → list skeleton variant ────────────────────

  it('shows list-variant skeleton when no ?item= param during load', () => {
    (adminAPI.listDecks as Mock).mockReturnValue(new Promise(() => {}));

    renderDrawer('/admin?edit=deck-vocab-1');

    const skeleton = screen.getByTestId('deck-drawer-skeleton');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute('data-variant', 'list');
  });

  // ── 9. Dirty-cancel → discard dialog; "Keep editing" preserves dirty state ──
  // Regression guard for PM Decision #9: dirty-cancel must show discard dialog;
  // "Keep editing" must dismiss dialog without resetting the form.

  it('dirty-cancel triggers discard dialog; Keep editing dismisses it and preserves dirty state', async () => {
    const user = userEvent.setup();

    (adminAPI.listDecks as Mock).mockResolvedValue({
      decks: [makeVocabDeck({ name_en: 'Original Name', name_ru: 'Original RU' })],
      total: 1,
      page: 1,
      page_size: 200,
    });

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
});
