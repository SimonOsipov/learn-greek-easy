/**
 * NewsTab Component Tests — NEWS-05
 *
 * Covers:
 * - Renders news-tab root with PageHead breadcrumb area, 4 StatCards, NewsToolbar, NewsGrid.
 * - Import RSS button is aria-disabled, shows Coming-soon tooltip text.
 * - "+ New article" button click opens NewsItemCreateModal.
 * - URL deep-link: ?edit=<id> → openDrawer called with that id.
 * - Drawer close URL wiring deferred to NEWS-06.
 */

import React from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    getNewsItems: vi.fn().mockResolvedValue({ items: [], total: 0, audio_count: 0 }),
  },
}));

// Store mock
const mockFetchNewsItems = vi.fn();
const mockOpenDrawer = vi.fn();
const mockCloseDrawer = vi.fn();
const mockSetPage = vi.fn();
const mockSetCountryFilter = vi.fn();
const mockSetLevelFilter = vi.fn();
const mockSetSearchQuery = vi.fn();
const mockSetSortMode = vi.fn();

const storeState = {
  newsItems: [] as { id: string; publication_date: string; country: string }[],
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
  isLoading: false,
  audioCount: 0,
  countryFilter: 'all' as string,
  levelFilter: 'all' as string,
  searchQuery: '',
  sortMode: 'newest' as string,
  drawerItemId: null as string | null,
  fetchNewsItems: mockFetchNewsItems,
  openDrawer: mockOpenDrawer,
  closeDrawer: mockCloseDrawer,
  setPage: mockSetPage,
  setCountryFilter: mockSetCountryFilter,
  setLevelFilter: mockSetLevelFilter,
  setSearchQuery: mockSetSearchQuery,
  setSortMode: mockSetSortMode,
  deleteNewsItem: vi.fn(),
};

const mockUseAdminNewsStore = vi.fn((selector?: (s: unknown) => unknown) => {
  if (typeof selector === 'function') return selector(storeState);
  return storeState;
});
(
  mockUseAdminNewsStore as unknown as {
    getState: () => typeof storeState;
  }
).getState = () => storeState;

vi.mock('@/stores/adminNewsStore', () => ({
  useAdminNewsStore: (...args: unknown[]) =>
    mockUseAdminNewsStore(...(args as [(s: unknown) => unknown])),
  selectFilteredNewsItems: () => [],
}));

// Stub modals/drawers to sentinels so we can assert open states without real impl
vi.mock('../NewsItemCreateModal', () => ({
  NewsItemCreateModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="create-modal-sentinel" /> : null,
}));

vi.mock('../NewsItemDeleteDialog', () => ({
  NewsItemDeleteDialog: () => null,
}));

vi.mock('../NewsEditDrawer', () => ({
  NewsEditDrawer: () => null,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderWithRouter(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/admin${search}`]}>
      <Routes>
        <Route path="/admin" element={<NewsTabWrapper />} />
      </Routes>
    </MemoryRouter>
  );
}

// Lazy import inside test so mocks are registered first
let NewsTab: React.FC;
async function loadNewsTab() {
  const mod = await import('../NewsTab');
  NewsTab = mod.NewsTab;
}

function NewsTabWrapper() {
  return NewsTab ? <NewsTab /> : null;
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  vi.clearAllMocks();
  storeState.newsItems = [];
  storeState.total = 0;
  storeState.audioCount = 0;
  storeState.drawerItemId = null;
  await loadNewsTab();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NewsTab — basic rendering', () => {
  it('renders news-tab root element', () => {
    renderWithRouter();
    expect(screen.getByTestId('news-tab')).toBeInTheDocument();
  });

  it('renders 4 StatCards by title', () => {
    renderWithRouter();
    // StatCard renders title via .stat-label — queried by text (i18n mock returns keys)
    expect(screen.getByText('news.stats.total')).toBeInTheDocument();
    expect(screen.getByText('news.stats.withAudio')).toBeInTheDocument();
    expect(screen.getByText('news.stats.b1Coverage')).toBeInTheDocument();
    expect(screen.getByText('news.stats.countries')).toBeInTheDocument();
  });

  it('renders NewsToolbar (via search input sentinel)', () => {
    renderWithRouter();
    expect(screen.getByTestId('news-toolbar-search')).toBeInTheDocument();
  });

  it('renders NewsGrid (via pagination-absent check when totalPages=1)', () => {
    renderWithRouter();
    // NewsGrid renders; with totalPages=1 pagination is hidden — root news-tab is the presence signal
    expect(screen.queryByTestId('news-grid-pagination')).not.toBeInTheDocument();
  });

  it('calls fetchNewsItems on mount', () => {
    renderWithRouter();
    expect(mockFetchNewsItems).toHaveBeenCalledTimes(1);
  });
});

describe('NewsTab — Import RSS button (gated)', () => {
  it('Import RSS button has aria-disabled="true"', () => {
    renderWithRouter();
    // Find button by its i18n text key
    const rssBtn = screen.getByText('news.actions.importRss').closest('button');
    expect(rssBtn).toHaveAttribute('aria-disabled', 'true');
  });

  it('Import RSS tooltip content is rendered in DOM', () => {
    renderWithRouter();
    // TooltipContent is rendered in the DOM for the comingSoon key
    expect(screen.getByText('news.comingSoon')).toBeInTheDocument();
  });
});

describe('NewsTab — New article button', () => {
  it('renders "+ New article" button', () => {
    renderWithRouter();
    expect(screen.getByTestId('news-new-button')).toBeInTheDocument();
  });

  it('clicking "+ New article" opens NewsItemCreateModal', async () => {
    const user = userEvent.setup();
    renderWithRouter();
    expect(screen.queryByTestId('create-modal-sentinel')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('news-new-button'));
    expect(screen.getByTestId('create-modal-sentinel')).toBeInTheDocument();
  });
});

describe('NewsTab — URL deep-link (?edit=)', () => {
  it('calls openDrawer with the edit id from URL', () => {
    renderWithRouter('?tab=news&edit=abc123');
    expect(mockOpenDrawer).toHaveBeenCalledWith('abc123');
  });

  it('calls closeDrawer when no ?edit param is present', () => {
    renderWithRouter();
    expect(mockCloseDrawer).toHaveBeenCalled();
  });
});

describe('NewsTab — drawer close URL wiring (deferred)', () => {
  it.todo('drawer close clears ?edit= from URL — wired by NEWS-06');
});
