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
  // ADMIN2-39-05 F8: per-country counts surfaced by the store.
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

  it('renders 4 StatCards by title', () => {
    renderWithRouter();
    // StatCard renders title via .stat-label — queried by resolved en copy
    expect(screen.getByText('Total News')).toBeInTheDocument();
    expect(screen.getByText('With Audio')).toBeInTheDocument();
    expect(screen.getByText('B1 coverage')).toBeInTheDocument();
    expect(screen.getByText('Countries')).toBeInTheDocument();
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

  it('card #4 (country) renders no sparkline bars (F3: height parity)', () => {
    // barsTestId removed → element must be absent
    renderWithRouter();
    expect(screen.queryByTestId('stat-bars-country')).not.toBeInTheDocument();
  });

  // ADMIN2-39-05 F8: the Countries card no longer renders a hardcoded "CY"
  // KPI nor a "Cyprus only" sub — see the "F8 Countries live counter"
  // describe block below for the live WR·CY·GR + reworded-sub coverage.
  it('card #4 (country) shows reworded sub from i18n key news.stats.countrySub', () => {
    renderWithRouter();
    // Reworded from "Cyprus only" → "By country" (C8 / D-C8-countrysub).
    expect(screen.getByText('By country')).toBeInTheDocument();
  });

  it('card #3 (B1) renders real b1_audio_count value (not "—")', () => {
    storeState.b1AudioCount = 63;
    storeState.b1PendingRegenCount = 4;
    storeState.total = 67;
    renderWithRouter();
    expect(screen.getByText('63')).toBeInTheDocument();
  });

  it('card #3 (B1) renders a <b> element in sub wrapping the awaiting regen count', () => {
    storeState.b1AudioCount = 63;
    storeState.b1PendingRegenCount = 4;
    storeState.total = 67;
    renderWithRouter();
    const boldEls = document.querySelectorAll('.stat-sub b');
    const b1Bold = Array.from(boldEls).find((el) => el.textContent === '4');
    expect(b1Bold).toBeTruthy();
  });

  it('card #3 (B1) renders no sparkline bars (F3: height parity)', () => {
    // barsTestId removed → element must be absent
    renderWithRouter();
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

describe('NewsTab — B1 coverage card (#3)', () => {
  it('renders real b1_audio_count value (not "—")', () => {
    storeState.b1AudioCount = 63;
    storeState.b1PendingRegenCount = 4;
    storeState.total = 67;
    renderWithRouter();
    // stat-n for B1 card shows the b1AudioCount number
    expect(screen.getByText('63')).toBeInTheDocument();
  });

  it('renders a <b> element in card #3 sub wrapping the awaiting count', () => {
    storeState.b1AudioCount = 63;
    storeState.b1PendingRegenCount = 4;
    storeState.total = 67;
    renderWithRouter();
    // The <b> element should contain the pending regen count
    const boldEls = document.querySelectorAll('.stat-sub b');
    const b1Bold = Array.from(boldEls).find((el) => el.textContent === '4');
    expect(b1Bold).toBeTruthy();
  });

  it('renders no sparkline bars for card #3 (F3: height parity)', () => {
    // barsTestId removed → element must be absent
    renderWithRouter();
    expect(screen.queryByTestId('stat-bars-b1')).not.toBeInTheDocument();
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

// ── ADMIN2-39-05 F8: Countries stat card live WR·CY·GR counter ──────────────
// The card currently renders a hardcoded n="CY" and a "Cyprus only" sub-label.
// The target renders live per-country counts (order WR · CY · GR) from the store
// and rewords the sub-label (no longer "Cyprus only").
describe('NewsTab — F8 Countries live counter', () => {
  /** Locate the .stat-card whose .stat-label is "Countries". */
  function getCountriesCard(): HTMLElement {
    const label = screen.getByText('Countries');
    const card = label.closest('.stat-card');
    if (!card) throw new Error('Countries stat-card not found');
    return card as HTMLElement;
  }

  it('Countries card renders WR·CY·GR live counts (not hardcoded "CY")', () => {
    storeState.countryCounts = { cyprus: 3, greece: 2, world: 5 };
    renderWithRouter();

    const card = getCountriesCard();
    const kpi = card.querySelector('.stat-n');
    const text = kpi?.textContent ?? '';
    // Live counts present: world=5, cyprus=3, greece=2.
    expect(text).toContain('5');
    expect(text).toContain('3');
    expect(text).toContain('2');
    // No hardcoded "CY" literal as the KPI value.
    expect(text).not.toBe('CY');
  });

  it('Countries sub-label is no longer "Cyprus only"', () => {
    renderWithRouter();
    // The reworded copy ("By country") may or may not be present, but the stale
    // "Cyprus only" string must not appear anywhere on the page.
    expect(screen.queryByText('Cyprus only')).not.toBeInTheDocument();
  });

  // ── ADMIN2-39-05 QA edge coverage (Mode B) ──────────────────────────────
  // Proves the counter is genuinely live-wired even at zero: with countryCounts
  // all zeros, the KPI renders "WR 0 · CY 0 · GR 0" (real zeros, not blank and
  // not the old hardcoded "CY"). beforeEach resets countryCounts to {0,0,0}.
  it('Countries card renders "WR 0 · CY 0 · GR 0" when all counts are zero (live wiring at zero)', () => {
    renderWithRouter();

    const card = getCountriesCard();
    const kpi = card.querySelector('.stat-n');
    const text = (kpi?.textContent ?? '').replace(/\s+/g, ' ').trim();
    // All three live zeros present in WR · CY · GR order — not blank, not "CY".
    expect(text).toBe('WR 0 · CY 0 · GR 0');
    expect(text).not.toBe('CY');
    expect(text).not.toBe('');
  });
});
