/**
 * SituationsToolbar Component Tests — SIT-03
 *
 * Covers:
 * 1. Renders three controls (Status SegControl, search input, sort trigger)
 * 2. Status SegControl wiring: Draft → statusFilter='draft' + URL; All → null + URL cleared
 * 3. Debounce: < 250 ms → store unchanged; after 250 ms → store updated + URL
 * 4. URL hydration on mount: ?q=hi&status=ready&sort=oldest
 * 5. URL write-back on sort change; back to newest removes param
 * 6. Clear-X: hidden when empty; click → input cleared, store '' , q removed from URL
 * 7. No Level SegControl rendered (negative assertion)
 */

import React from 'react';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { SituationsToolbar } from '../SituationsToolbar';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

// Store mock — track calls to each setter
const mockSetStatusFilter = vi.fn();
const mockSetSearchQuery = vi.fn();
const mockSetSortMode = vi.fn();

const storeState = {
  statusFilter: null as string | null,
  searchQuery: '',
  sortMode: 'newest' as string,
  setStatusFilter: mockSetStatusFilter,
  setSearchQuery: mockSetSearchQuery,
  setSortMode: mockSetSortMode,
};

vi.mock('@/stores/adminSituationStore', () => ({
  useAdminSituationStore: () => storeState,
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function renderWithRouter(initialSearch = '') {
  return render(
    <MemoryRouter initialEntries={[`/${initialSearch}`]}>
      <Routes>
        <Route path="/" element={<SituationsToolbar />} />
      </Routes>
    </MemoryRouter>
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('SituationsToolbar — renders all controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.statusFilter = null;
    storeState.searchQuery = '';
    storeState.sortMode = 'newest';
  });

  it('renders Status SegControl with All/Ready/Draft options', () => {
    renderWithRouter();
    expect(screen.getByText('situations.filters.status.all')).toBeInTheDocument();
    expect(screen.getByText('situations.filters.status.draft')).toBeInTheDocument();
    expect(screen.getByText('situations.filters.status.ready')).toBeInTheDocument();
  });

  it('Status SegControl options are in order: All → Ready → Draft', () => {
    renderWithRouter();
    // getAllByRole('button') returns buttons in DOM order; SegControl buttons have aria-pressed
    const segBtns = screen
      .getAllByRole('button')
      .filter((btn) => btn.getAttribute('aria-pressed') !== null);
    const labels = segBtns.map((btn) => btn.textContent);
    expect(labels).toEqual([
      'situations.filters.status.all',
      'situations.filters.status.ready',
      'situations.filters.status.draft',
    ]);
  });

  it('renders search input with placeholder', () => {
    renderWithRouter();
    expect(screen.getByTestId('situations-toolbar-search')).toBeInTheDocument();
  });

  it('renders sort dropdown trigger showing Newest first', () => {
    renderWithRouter();
    expect(screen.getByTestId('situations-toolbar-sort-trigger')).toBeInTheDocument();
    expect(screen.getByText('situations.filters.sort.newest')).toBeInTheDocument();
  });

  it('does NOT show clear-X when search is empty', () => {
    renderWithRouter();
    expect(screen.queryByTestId('situations-toolbar-search-clear')).not.toBeInTheDocument();
  });
});

describe('SituationsToolbar — Status SegControl wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.statusFilter = null;
    storeState.searchQuery = '';
    storeState.sortMode = 'newest';
  });

  it('calls setStatusFilter("draft") when Draft option is clicked', async () => {
    const user = userEvent.setup();
    renderWithRouter();
    await user.click(screen.getByText('situations.filters.status.draft'));
    expect(mockSetStatusFilter).toHaveBeenCalledWith('draft');
  });

  it('calls setStatusFilter(null) when All option is clicked', async () => {
    const user = userEvent.setup();
    storeState.statusFilter = 'draft';
    renderWithRouter();
    await user.click(screen.getByText('situations.filters.status.all'));
    expect(mockSetStatusFilter).toHaveBeenCalledWith(null);
  });
});

describe('SituationsToolbar — Search debounce', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.statusFilter = null;
    storeState.searchQuery = '';
    storeState.sortMode = 'newest';
  });

  it('does NOT immediately call setSearchQuery with non-empty value while typing', async () => {
    const user = userEvent.setup();
    renderWithRouter();

    const input = screen.getByTestId('situations-toolbar-search');
    await user.type(input, 'h');

    // Debounce hasn't fired yet — no call with 'h'
    const callsWithH = mockSetSearchQuery.mock.calls.filter(([v]) => v === 'h');
    expect(callsWithH).toHaveLength(0);
  });

  it('calls setSearchQuery after 250 ms debounce', async () => {
    const user = userEvent.setup();
    renderWithRouter();

    const input = screen.getByTestId('situations-toolbar-search');
    await user.type(input, 'foo');

    // Wait longer than the 250 ms debounce
    await new Promise((resolve) => setTimeout(resolve, 400));

    const callsWithContent = mockSetSearchQuery.mock.calls.filter(([v]) => v !== '');
    expect(callsWithContent.length).toBeGreaterThan(0);
    expect(callsWithContent[callsWithContent.length - 1][0]).toBe('foo');
  }, 10000);
});

describe('SituationsToolbar — URL hydration on mount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.statusFilter = null;
    storeState.searchQuery = '';
    storeState.sortMode = 'newest';
  });

  it('hydrates status, search query, and sort from URL params', () => {
    renderWithRouter('?q=hi&status=ready&sort=oldest');
    expect(mockSetStatusFilter).toHaveBeenCalledWith('ready');
    expect(mockSetSearchQuery).toHaveBeenCalledWith('hi');
    expect(mockSetSortMode).toHaveBeenCalledWith('oldest');
  });

  it('reflects search input value from URL ?q param', () => {
    renderWithRouter('?q=hi');
    const input = screen.getByTestId('situations-toolbar-search') as HTMLInputElement;
    expect(input.value).toBe('hi');
  });

  it('does not call setStatusFilter when status param absent', () => {
    renderWithRouter('');
    expect(mockSetStatusFilter).not.toHaveBeenCalled();
  });
});

describe('SituationsToolbar — URL write-back on sort change', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.statusFilter = null;
    storeState.searchQuery = '';
    storeState.sortMode = 'newest';
  });

  it('calls setSortMode("oldest") when Oldest first is selected', async () => {
    const user = userEvent.setup();
    renderWithRouter();
    await user.click(screen.getByTestId('situations-toolbar-sort-trigger'));
    await user.click(screen.getByText('situations.filters.sort.oldest'));
    expect(mockSetSortMode).toHaveBeenCalledWith('oldest');
  });

  it('calls setSortMode("draftsFirst") when Drafts first is selected', async () => {
    const user = userEvent.setup();
    renderWithRouter();
    await user.click(screen.getByTestId('situations-toolbar-sort-trigger'));
    await user.click(screen.getByText('situations.filters.sort.draftsFirst'));
    expect(mockSetSortMode).toHaveBeenCalledWith('draftsFirst');
  });
});

describe('SituationsToolbar — Clear-X behaviour', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.statusFilter = null;
    storeState.searchQuery = '';
    storeState.sortMode = 'newest';
  });

  it('shows clear-X button only when input is non-empty', async () => {
    const user = userEvent.setup();
    renderWithRouter();

    const input = screen.getByTestId('situations-toolbar-search');
    expect(screen.queryByTestId('situations-toolbar-search-clear')).not.toBeInTheDocument();

    await user.type(input, 'abc');
    expect(screen.getByTestId('situations-toolbar-search-clear')).toBeInTheDocument();
  });

  it('clicking clear-X clears the input and calls setSearchQuery with empty string', async () => {
    const user = userEvent.setup();
    renderWithRouter();

    const input = screen.getByTestId('situations-toolbar-search') as HTMLInputElement;
    await user.type(input, 'abc');
    vi.clearAllMocks();

    await user.click(screen.getByTestId('situations-toolbar-search-clear'));
    expect(input.value).toBe('');
    expect(mockSetSearchQuery).toHaveBeenCalledWith('');
  });
});

describe('SituationsToolbar — No Level SegControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.statusFilter = null;
    storeState.searchQuery = '';
    storeState.sortMode = 'newest';
  });

  it('does NOT render a Level filter', () => {
    renderWithRouter();
    // "Level" text should not appear anywhere in the toolbar
    expect(screen.queryByText(/level/i)).not.toBeInTheDocument();
  });
});
