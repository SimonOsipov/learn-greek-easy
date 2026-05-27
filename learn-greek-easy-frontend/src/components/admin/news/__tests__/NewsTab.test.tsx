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
let NewsTab: React.FC<{ createOpen: boolean; onCreateOpenChange: (open: boolean) => void }>;
const mockOnCreateOpenChange = vi.fn();
async function loadNewsTab() {
  const mod = await import('../NewsTab');
  NewsTab = mod.NewsTab;
}

function NewsTabWrapper({ createOpen = false }: { createOpen?: boolean }) {
  return NewsTab ? (
    <NewsTab createOpen={createOpen} onCreateOpenChange={mockOnCreateOpenChange} />
  ) : null;
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

  it('card #1 (total) renders sparkline bars with 9 bars', () => {
    renderWithRouter();
    const barsEl = screen.getByTestId('stat-bars-total');
    expect(barsEl).toBeInTheDocument();
    // 9 bars: [4,6,3,8,5,7,9,12,6]
    expect(barsEl.querySelectorAll('span')).toHaveLength(9);
  });

  it('card #1 (total) shows sub from i18n key news.stats.recentThisWeek', () => {
    renderWithRouter();
    // t mock returns key — recentThisWeek key becomes its own text
    expect(screen.getByText('news.stats.recentThisWeek')).toBeInTheDocument();
  });

  it('card #2 (audio) renders sparkline bars with 9 bars', () => {
    renderWithRouter();
    const barsEl = screen.getByTestId('stat-bars-audio');
    expect(barsEl).toBeInTheDocument();
    // 9 bars: [10,12,11,12,13,12,12,13,12]
    expect(barsEl.querySelectorAll('span')).toHaveLength(9);
  });

  it('card #2 (audio) shows sub from i18n key news.stats.audioCoverage', () => {
    renderWithRouter();
    expect(screen.getByText('news.stats.audioCoverage')).toBeInTheDocument();
  });

  it('card #4 (country) renders sparkline bars with 9 bars', () => {
    renderWithRouter();
    const barsEl = screen.getByTestId('stat-bars-country');
    expect(barsEl).toBeInTheDocument();
    // 9 bars: [3,3,3,3,3,3,3,3,3]
    expect(barsEl.querySelectorAll('span')).toHaveLength(9);
  });

  it('card #4 (country) shows literal "CY" as the KPI value', () => {
    renderWithRouter();
    expect(screen.getByText('CY')).toBeInTheDocument();
  });

  it('card #4 (country) shows sub from i18n key news.stats.countrySub', () => {
    renderWithRouter();
    expect(screen.getByText('news.stats.countrySub')).toBeInTheDocument();
  });

  it('card #3 (B1) does not have a sparkline', () => {
    renderWithRouter();
    // B1 card has no bars — stat-bars-b1 testid should not exist
    expect(screen.queryByTestId('stat-bars-b1')).not.toBeInTheDocument();
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

// Note: Import RSS and "+ New article" action buttons are now in AdminPage's
// pageHeadPropsFor (ADMIN2-HEAD). NewsTab receives createOpen as a controlled prop.

describe('NewsTab — createOpen controlled prop', () => {
  it('renders NewsItemCreateModal when createOpen=true', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route
            path="/admin"
            element={
              NewsTab ? (
                <NewsTab createOpen={true} onCreateOpenChange={mockOnCreateOpenChange} />
              ) : null
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('create-modal-sentinel')).toBeInTheDocument();
  });

  it('does not render NewsItemCreateModal when createOpen=false', () => {
    renderWithRouter();
    expect(screen.queryByTestId('create-modal-sentinel')).not.toBeInTheDocument();
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
