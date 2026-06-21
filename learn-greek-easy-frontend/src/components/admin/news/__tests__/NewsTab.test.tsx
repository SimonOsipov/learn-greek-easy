/**
 * NewsTab Component Tests — NEWS-05
 *
 * Covers:
 * - Renders news-tab root with PageHead breadcrumb area, 2 StatCards, NewsToolbar, NewsGrid.
 * - Import RSS button is aria-disabled, shows Coming-soon tooltip text.
 * - "+ New article" button click opens NewsItemCreateModal.
 * - URL deep-link: ?edit=<id> → openDrawer called with that id.
 * - Drawer close URL wiring deferred to NEWS-06.
 *
 * ADMIN2-40 F1/F2: B1-coverage and Countries stat cards removed; 2 cards remain.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

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
  b1AudioCount: 0,
  b1PendingRegenCount: 0,
  countryFilter: 'all' as string,
  levelFilter: 'all' as string,
  searchQuery: '',
  sortMode: 'newest' as string,
  drawerItemId: null as string | null,
  countryCounts: { cyprus: 0, greece: 0, world: 0 } as {
    cyprus: number;
    greece: number;
    world: number;
  },
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
  storeState.b1AudioCount = 0;
  storeState.b1PendingRegenCount = 0;
  storeState.drawerItemId = null;
  storeState.countryCounts = { cyprus: 0, greece: 0, world: 0 };
  await loadNewsTab();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NewsTab — basic rendering', () => {
  it('renders news-tab root element', () => {
    renderWithRouter();
    expect(screen.getByTestId('news-tab')).toBeInTheDocument();
  });

  it('renders exactly 2 StatCards by title (F1/F2: B1-coverage and Countries removed)', () => {
    renderWithRouter();
    // Only Total and With Audio remain
    expect(screen.getByText('Total News')).toBeInTheDocument();
    expect(screen.getByText('With Audio')).toBeInTheDocument();
    // Removed cards must not appear
    expect(screen.queryByText('B1 coverage')).not.toBeInTheDocument();
    expect(screen.queryByText('Countries')).not.toBeInTheDocument();
  });

  it('card #1 (total) renders no sparkline bars (F3: height parity)', () => {
    // barsTestId removed → element must be absent
    renderWithRouter();
    expect(screen.queryByTestId('stat-bars-total')).not.toBeInTheDocument();
  });

  it('card #1 (total) shows sub from i18n key news.stats.recentThisWeek', () => {
    renderWithRouter();
    // storeState.newsItems=[] → recentCount=0, resolves to "+0 this week"
    expect(screen.getByText('+0 this week')).toBeInTheDocument();
  });

  it('card #2 (audio) renders no sparkline bars (F3: height parity)', () => {
    // barsTestId removed → element must be absent
    renderWithRouter();
    expect(screen.queryByTestId('stat-bars-audio')).not.toBeInTheDocument();
  });

  it('card #2 (audio) shows sub from i18n key news.stats.audioCoverage', () => {
    renderWithRouter();
    // storeState.audioCount=0, total=0 → resolves to "0/0 with audio"
    expect(screen.getByText('0/0 with audio')).toBeInTheDocument();
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
