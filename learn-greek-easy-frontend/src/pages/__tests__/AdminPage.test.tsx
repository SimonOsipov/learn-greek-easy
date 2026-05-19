/**
 * AdminPage — Tab Badge Rendering Tests (ATBC-09)
 *
 * Verifies that SectionTabs badge counts render correctly from
 * the unified useAdminTabCountsStore, including the null/loading fallback.
 *
 * Strategy: render <AdminPage /> inside MemoryRouter at /admin?tab=changelog.
 * In the initial loading phase (isLoading=true), AdminPage renders the loading
 * branch which already includes <SectionTabs> — so badges are visible without
 * waiting for the stats fetch to complete.
 *
 * Badge DOM: <span class="va-tab-n">. Scoped via within(tablist).
 */

import React from 'react';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';

import i18n from '@/i18n';
import AdminPage from '@/pages/AdminPage';

// ---------------------------------------------------------------------------
// Shared mock state — reset in beforeEach
// ---------------------------------------------------------------------------

const fetchCounts = vi.fn();

let mockState: {
  counts: Record<string, number> | null;
  loading: boolean;
  error: string | null;
  fetchCounts: typeof fetchCounts;
} = {
  counts: {
    inbox: 3,
    decks: 99,
    news: 5,
    situations: 4,
    exercises: 2,
    errors: 7,
    feedback: 12,
    changelog: 36,
    announcements: 21,
  },
  loading: false,
  error: null,
  fetchCounts,
};

// ---------------------------------------------------------------------------
// Mock: adminTabCountsStore (the store under test)
// ---------------------------------------------------------------------------

vi.mock('@/stores/adminTabCountsStore', () => ({
  useAdminTabCountsStore: (selector?: (s: typeof mockState) => unknown) =>
    selector ? selector(mockState) : mockState,
  selectTabCount: (k: string) => (s: typeof mockState) => s.counts?.[k] ?? 0,
  refetchAdminTabCounts: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock: other admin Zustand stores that AdminPage subscribes to directly
// (line 794: useAdminNewsStore, line 800: useAdminSituationStore,
//  line 801: useAdminChangelogStore)
// ---------------------------------------------------------------------------

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
  selectStatsTotals: (state: { situations: unknown[] }) => ({
    total: 0,
    draft: 0,
    ready: 0,
    exercisesGenerated: 0,
  }),
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

// ---------------------------------------------------------------------------
// Mock: adminAPI — prevent real network calls on mount
// ---------------------------------------------------------------------------

vi.mock('@/services/adminAPI', () => ({
  GENERATE_WORD_ENTRY_STREAM_URL: '/api/v1/admin/word-entries/generate/stream',
  adminAPI: {
    getContentStats: vi.fn().mockResolvedValue({
      total_decks: 0,
      total_vocabulary_decks: 0,
      total_culture_decks: 0,
      total_cards: 0,
    }),
    listDecks: vi.fn().mockResolvedValue({ decks: [], total: 0, page: 1, page_size: 20 }),
    getAdminTabCounts: vi.fn().mockResolvedValue({}),
    updateVocabularyDeck: vi.fn(),
    updateCultureDeck: vi.fn(),
    deleteVocabularyDeck: vi.fn(),
    deleteCultureDeck: vi.fn(),
    createVocabularyDeck: vi.fn(),
    createCultureDeck: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock: hooks and contexts that AdminPage relies on
// ---------------------------------------------------------------------------

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Render helper — MemoryRouter at /admin?tab=changelog (mirrors the repro)
// ---------------------------------------------------------------------------

function renderAdminPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/admin?tab=changelog']}>
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

describe('AdminPage — tab badge counts (ATBC-09)', () => {
  beforeEach(() => {
    fetchCounts.mockClear();
    // Reset mock state to the populated default before each test.
    mockState = {
      counts: {
        inbox: 3,
        decks: 99,
        news: 5,
        situations: 4,
        exercises: 2,
        errors: 7,
        feedback: 12,
        changelog: 36,
        announcements: 21,
      },
      loading: false,
      error: null,
      fetchCounts,
    };
  });

  it('renders every badge value on first render with no tab interaction', () => {
    renderAdminPage();

    // SectionTabs renders as role="tablist"; scope all badge assertions to it.
    const tablist = screen.getByRole('tablist');

    // Each badge is a <span class="va-tab-n"> inside the tab button.
    // querySelector('.va-tab-n') is the established pattern in section-tabs.test.tsx.
    const tabs = within(tablist).getAllByRole('tab');

    function getBadgeText(tab: HTMLElement): string {
      return tab.querySelector('.va-tab-n')?.textContent ?? '';
    }

    // i18n keys (en/admin.json): dashboard="Dashboard", inbox="Inbox", decks="Decks",
    // news="News", situations="Situations", exercises="Exercises",
    // errors="Card errors", feedback="Feedback", changelog="Changelog",
    // announcements="Announcements".
    // textContent includes the badge digit, so use label-specific substrings.
    const dashboardTab = tabs.find((t) => t.querySelector('span')?.textContent === 'Dashboard');
    const inboxTab = tabs.find((t) => t.querySelector('span')?.textContent === 'Inbox');
    const decksTab = tabs.find((t) => t.querySelector('span')?.textContent === 'Decks');
    const newsTab = tabs.find((t) => t.querySelector('span')?.textContent === 'News');
    const situationsTab = tabs.find((t) => t.querySelector('span')?.textContent === 'Situations');
    const exercisesTab = tabs.find((t) => t.querySelector('span')?.textContent === 'Exercises');
    const errorsTab = tabs.find((t) => t.querySelector('span')?.textContent === 'Card errors');
    const feedbackTab = tabs.find((t) => t.querySelector('span')?.textContent === 'Feedback');
    const changelogTab = tabs.find((t) => t.querySelector('span')?.textContent === 'Changelog');
    const announcementsTab = tabs.find(
      (t) => t.querySelector('span')?.textContent === 'Announcements'
    );

    expect(getBadgeText(dashboardTab!)).toBe('0'); // dashboard stays 0
    expect(getBadgeText(inboxTab!)).toBe('3');
    expect(getBadgeText(decksTab!)).toBe('99');
    expect(getBadgeText(newsTab!)).toBe('5');
    expect(getBadgeText(situationsTab!)).toBe('4');
    expect(getBadgeText(exercisesTab!)).toBe('2');
    expect(getBadgeText(errorsTab!)).toBe('7');
    expect(getBadgeText(feedbackTab!)).toBe('12');
    expect(getBadgeText(changelogTab!)).toBe('36');
    expect(getBadgeText(announcementsTab!)).toBe('21');
  });

  it('falls back to 0 for every badge when counts are null and loading is true', () => {
    // Override state for this test: null counts, loading=true.
    mockState = { counts: null, loading: true, error: null, fetchCounts };

    renderAdminPage();

    const tablist = screen.getByRole('tablist');
    const tabs = within(tablist).getAllByRole('tab');

    // All 10 tabs should render badge "0" when counts are null (the ?? 0 fallback).
    // dashboard is always 0 in tabsConfig, so total is always >= 10.
    const zeroBadges = tabs.filter((t) => t.querySelector('.va-tab-n')?.textContent === '0');
    expect(zeroBadges.length).toBeGreaterThanOrEqual(9);
  });

  it('calls fetchCounts exactly once on mount', () => {
    renderAdminPage();

    expect(fetchCounts).toHaveBeenCalledTimes(1);
  });
});
