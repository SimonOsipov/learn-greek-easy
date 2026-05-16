/**
 * NewsGrid Component Tests
 *
 * Covers NEWS-04 acceptance criteria:
 * - Empty state: amber Kicker + helper text + "Clear filters" button that resets all four filters.
 * - Pagination footer hidden when totalPages <= 1, shown when > 1.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock i18n ──────────────────────────────────────────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

// ── Mock store state (mutable for tests) ───────────────────────────────
const mockSetCountryFilter = vi.fn();
const mockSetLevelFilter = vi.fn();
const mockSetSearchQuery = vi.fn();
const mockSetSortMode = vi.fn();
const mockSetPage = vi.fn();

const storeState = {
  items: [] as {
    id: string;
    title_el: string;
    title_en: string;
    title_ru: string;
    description_el: string;
    description_en: string;
    description_ru: string;
    publication_date: string;
    image_url: null;
    audio_url: null;
    audio_generated_at: null;
    audio_duration_seconds: null;
    audio_file_size_bytes: null;
    created_at: string;
    updated_at: string;
    country: 'cyprus';
    title_el_a2: null;
    description_el_a2: null;
    audio_a2_url: null;
    audio_a2_duration_seconds: null;
    audio_a2_generated_at: null;
    audio_a2_file_size_bytes: null;
    has_a2_content: false;
    original_article_url: string;
  }[],
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 1,
};

vi.mock('@/stores/adminNewsStore', () => {
  const selectFilteredNewsItems = () => storeState.items;

  const useAdminNewsStore = vi.fn((selector?: (s: unknown) => unknown) => {
    const state = {
      ...storeState,
      setCountryFilter: mockSetCountryFilter,
      setLevelFilter: mockSetLevelFilter,
      setSearchQuery: mockSetSearchQuery,
      setSortMode: mockSetSortMode,
      setPage: mockSetPage,
    };
    if (typeof selector === 'function') return selector(state);
    return state;
  });

  // Static method for getState (used in NewsCard)
  (useAdminNewsStore as unknown as { getState: () => { openDrawer: () => void } }).getState =
    () => ({
      openDrawer: vi.fn(),
    });

  return { useAdminNewsStore, selectFilteredNewsItems };
});

import { NewsGrid } from '../NewsGrid';

describe('NewsGrid', () => {
  beforeEach(() => {
    storeState.items = [];
    storeState.page = 1;
    storeState.total = 0;
    storeState.totalPages = 1;
    vi.clearAllMocks();
  });

  // ── Empty state ────────────────────────────────────────────────────────

  it('shows empty state when filtered items list is empty', () => {
    storeState.items = [];
    render(<NewsGrid onRequestDelete={vi.fn()} />);
    expect(screen.getByText('No articles match these filters.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });

  it('empty state "Clear filters" button resets all four filters', async () => {
    storeState.items = [];
    const user = userEvent.setup();
    render(<NewsGrid onRequestDelete={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(mockSetCountryFilter).toHaveBeenCalledWith('all');
    expect(mockSetLevelFilter).toHaveBeenCalledWith('all');
    expect(mockSetSearchQuery).toHaveBeenCalledWith('');
    expect(mockSetSortMode).toHaveBeenCalledWith('newest');
  });

  // ── Pagination ─────────────────────────────────────────────────────────

  it('hides pagination footer when totalPages <= 1', () => {
    storeState.totalPages = 1;
    storeState.items = [];
    render(<NewsGrid onRequestDelete={vi.fn()} />);
    expect(screen.queryByTestId('news-grid-pagination')).not.toBeInTheDocument();
  });

  it('shows pagination footer when totalPages > 1', () => {
    storeState.totalPages = 3;
    storeState.page = 1;
    storeState.total = 30;
    storeState.items = [];
    render(<NewsGrid onRequestDelete={vi.fn()} />);
    expect(screen.getByTestId('news-grid-pagination')).toBeInTheDocument();
    expect(screen.getByText('Showing 1–10 of 30')).toBeInTheDocument();
  });

  it('calls setPage with decremented value when Previous is clicked', async () => {
    storeState.totalPages = 3;
    storeState.page = 2;
    storeState.total = 30;
    storeState.items = [];
    const user = userEvent.setup();
    render(<NewsGrid onRequestDelete={vi.fn()} />);
    await user.click(screen.getByTestId('news-grid-prev'));
    expect(mockSetPage).toHaveBeenCalledWith(1);
  });

  it('calls setPage with incremented value when Next is clicked', async () => {
    storeState.totalPages = 3;
    storeState.page = 2;
    storeState.total = 30;
    storeState.items = [];
    const user = userEvent.setup();
    render(<NewsGrid onRequestDelete={vi.fn()} />);
    await user.click(screen.getByTestId('news-grid-next'));
    expect(mockSetPage).toHaveBeenCalledWith(3);
  });
});
