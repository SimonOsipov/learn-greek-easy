/**
 * NewsToolbar Component Tests — NEWS-03
 *
 * Covers:
 * - Renders all 4 controls
 * - URL hydration on mount
 * - URL write-back on SegControl change
 * - Search debounce (250 ms)
 * - Clear-X: shows only when input non-empty; clears input + URL + store
 */

import React from 'react';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { NewsToolbar } from '../NewsToolbar';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

// Store mock — we track calls to each setter
const mockSetCountryFilter = vi.fn();
const mockSetLevelFilter = vi.fn();
const mockSetSearchQuery = vi.fn();
const mockSetSortMode = vi.fn();

const storeState = {
  countryFilter: 'all' as string,
  levelFilter: 'all' as string,
  searchQuery: '',
  sortMode: 'newest' as string,
  setCountryFilter: mockSetCountryFilter,
  setLevelFilter: mockSetLevelFilter,
  setSearchQuery: mockSetSearchQuery,
  setSortMode: mockSetSortMode,
};

vi.mock('@/stores/adminNewsStore', () => ({
  useAdminNewsStore: () => storeState,
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function renderWithRouter(initialSearch = '') {
  return render(
    <MemoryRouter initialEntries={[`/${initialSearch}`]}>
      <Routes>
        <Route path="/" element={<NewsToolbar />} />
      </Routes>
    </MemoryRouter>
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('NewsToolbar — renders all controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.countryFilter = 'all';
    storeState.levelFilter = 'all';
    storeState.searchQuery = '';
    storeState.sortMode = 'newest';
  });

  it('renders Country SegControl with All/CY/GR/World options', () => {
    renderWithRouter();
    // Both SegControls have an "All" button — use getAllByText
    expect(screen.getAllByText('All').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('🇨🇾 CY')).toBeInTheDocument();
    expect(screen.getByText('🇬🇷 GR')).toBeInTheDocument();
    expect(screen.getByText('🌍 World')).toBeInTheDocument();
  });

  it('renders Level SegControl with B2/A2/B1 options', () => {
    renderWithRouter();
    expect(screen.getByText('B2')).toBeInTheDocument();
    expect(screen.getByText('A2')).toBeInTheDocument();
    expect(screen.getByText('B1')).toBeInTheDocument();
  });

  it('renders search input', () => {
    renderWithRouter();
    expect(screen.getByTestId('news-toolbar-search')).toBeInTheDocument();
  });

  it('renders sort dropdown trigger', () => {
    renderWithRouter();
    expect(screen.getByTestId('news-toolbar-sort-trigger')).toBeInTheDocument();
  });

  it('does NOT show clear-X when search is empty', () => {
    renderWithRouter();
    expect(screen.queryByTestId('news-toolbar-search-clear')).not.toBeInTheDocument();
  });
});

describe('NewsToolbar — URL hydration on mount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.countryFilter = 'all';
    storeState.levelFilter = 'all';
    storeState.searchQuery = '';
    storeState.sortMode = 'newest';
  });

  it('calls setCountryFilter with "greece" when ?country=greece', () => {
    renderWithRouter('?country=greece');
    expect(mockSetCountryFilter).toHaveBeenCalledWith('greece');
  });

  it('calls setLevelFilter with "B2" when ?level=B2', () => {
    renderWithRouter('?level=B2');
    expect(mockSetLevelFilter).toHaveBeenCalledWith('B2');
  });

  it('calls setSearchQuery with "cyprus" when ?q=cyprus', () => {
    renderWithRouter('?q=cyprus');
    expect(mockSetSearchQuery).toHaveBeenCalledWith('cyprus');
  });

  it('calls setSortMode with "oldest" when ?sort=oldest', () => {
    renderWithRouter('?sort=oldest');
    expect(mockSetSortMode).toHaveBeenCalledWith('oldest');
  });

  it('calls all four setters when all params present', () => {
    renderWithRouter('?country=greece&level=B2&q=cyprus&sort=oldest');
    expect(mockSetCountryFilter).toHaveBeenCalledWith('greece');
    expect(mockSetLevelFilter).toHaveBeenCalledWith('B2');
    expect(mockSetSearchQuery).toHaveBeenCalledWith('cyprus');
    expect(mockSetSortMode).toHaveBeenCalledWith('oldest');
  });

  it('does not call setCountryFilter when country param absent', () => {
    renderWithRouter('');
    expect(mockSetCountryFilter).not.toHaveBeenCalled();
  });
});

describe('NewsToolbar — URL write-back on SegControl change', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.countryFilter = 'all';
    storeState.levelFilter = 'all';
    storeState.searchQuery = '';
    storeState.sortMode = 'newest';
  });

  it('calls setCountryFilter when a country option is clicked', async () => {
    const user = userEvent.setup();
    renderWithRouter();
    await user.click(screen.getByText('🇬🇷 GR'));
    expect(mockSetCountryFilter).toHaveBeenCalledWith('greece');
  });

  it('calls setLevelFilter when a level option is clicked', async () => {
    const user = userEvent.setup();
    renderWithRouter();
    await user.click(screen.getByText('B2'));
    expect(mockSetLevelFilter).toHaveBeenCalledWith('B2');
  });
});

describe('NewsToolbar — Search debounce', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.countryFilter = 'all';
    storeState.levelFilter = 'all';
    storeState.searchQuery = '';
    storeState.sortMode = 'newest';
  });

  it('does NOT immediately call setSearchQuery with non-empty value while typing', async () => {
    const user = userEvent.setup();
    renderWithRouter();

    const input = screen.getByTestId('news-toolbar-search');
    // Type quickly — debounce is 250 ms; check immediately after type
    await user.type(input, 'h');

    // Any call with 'h' should not have happened yet (debounce hasn't fired)
    const callsWithH = mockSetSearchQuery.mock.calls.filter(([v]) => v === 'h');
    expect(callsWithH).toHaveLength(0);
  });

  it('calls setSearchQuery after 250 ms debounce', async () => {
    const user = userEvent.setup();
    renderWithRouter();

    const input = screen.getByTestId('news-toolbar-search');
    await user.type(input, 'hel');

    // Wait longer than the 250 ms debounce
    await new Promise((resolve) => setTimeout(resolve, 400));

    const callsWithContent = mockSetSearchQuery.mock.calls.filter(([v]) => v !== '');
    expect(callsWithContent.length).toBeGreaterThan(0);
    expect(callsWithContent[callsWithContent.length - 1][0]).toBe('hel');
  }, 10000);
});

describe('NewsToolbar — Clear-X behaviour', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.countryFilter = 'all';
    storeState.levelFilter = 'all';
    storeState.searchQuery = '';
    storeState.sortMode = 'newest';
  });

  it('shows clear-X button only when input is non-empty', async () => {
    const user = userEvent.setup();
    renderWithRouter();

    const input = screen.getByTestId('news-toolbar-search');
    expect(screen.queryByTestId('news-toolbar-search-clear')).not.toBeInTheDocument();

    await user.type(input, 'abc');
    expect(screen.getByTestId('news-toolbar-search-clear')).toBeInTheDocument();
  });

  it('clicking clear-X clears the input', async () => {
    const user = userEvent.setup();
    renderWithRouter();

    const input = screen.getByTestId('news-toolbar-search') as HTMLInputElement;
    await user.type(input, 'abc');
    expect(input.value).toBe('abc');

    await user.click(screen.getByTestId('news-toolbar-search-clear'));
    expect(input.value).toBe('');
  });

  it('clicking clear-X calls setSearchQuery with empty string', async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.type(screen.getByTestId('news-toolbar-search'), 'abc');
    vi.clearAllMocks();

    await user.click(screen.getByTestId('news-toolbar-search-clear'));
    expect(mockSetSearchQuery).toHaveBeenCalledWith('');
  });

  it('clear-X disappears after clicking it', async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.type(screen.getByTestId('news-toolbar-search'), 'abc');
    await user.click(screen.getByTestId('news-toolbar-search-clear'));
    expect(screen.queryByTestId('news-toolbar-search-clear')).not.toBeInTheDocument();
  });
});
