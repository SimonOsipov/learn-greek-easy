/**
 * SituationGrid Component Tests
 *
 * Covers SIT-04 acceptance criteria:
 * - Empty state: amber Kicker + helper text + "Clear filters" button that resets filters.
 * - List rendering: one SituationCard per item.
 * - Pagination footer hidden when totalPages <= 1, shown when > 1.
 * - Prev disabled on page 1, Next disabled on last page.
 * - Next click calls setPage(page + 1).
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SituationListItem } from '@/types/situation';

// ── Mock i18n ──────────────────────────────────────────────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

// ── Mock store state (mutable for tests) ───────────────────────────────────
const mockSetSearchQuery = vi.fn();
const mockSetStatusFilter = vi.fn();
const mockSetSortMode = vi.fn();
const mockSetPage = vi.fn();
const mockOpenDrawer = vi.fn();
const mockDeleteSituation = vi.fn();

const storeState = {
  situations: [] as SituationListItem[],
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 1,
  isDeleting: false,
};

function makeItem(id: string): SituationListItem {
  return {
    id,
    scenario_el: `Σενάριο ${id}`,
    scenario_en: `Scenario ${id}`,
    scenario_ru: `Сценарий ${id}`,
    status: 'draft',
    created_at: '2025-01-01T00:00:00Z',
    has_dialog: false,
    has_description: false,
    has_picture: false,
    has_dialog_audio: false,
    has_description_audio: false,
    description_timestamps_count: 0,
    dialog_exercises_count: 0,
    description_exercises_count: 0,
    picture_exercises_count: 0,
  };
}

vi.mock('@/stores/adminSituationStore', () => {
  // selectFilteredSituations returns situations (no filter/sort applied in mock)
  const selectFilteredSituations = (s: { situations: SituationListItem[] }) => s.situations;

  const useAdminSituationStore = vi.fn((selector?: (s: unknown) => unknown) => {
    const state = {
      ...storeState,
      setSearchQuery: mockSetSearchQuery,
      setStatusFilter: mockSetStatusFilter,
      setSortMode: mockSetSortMode,
      setPage: mockSetPage,
      openDrawer: mockOpenDrawer,
      deleteSituation: mockDeleteSituation,
      isDeleting: storeState.isDeleting,
    };
    if (typeof selector === 'function') return selector(state);
    return state;
  });

  return { useAdminSituationStore, selectFilteredSituations };
});

import { SituationGrid } from '../SituationGrid';

describe('SituationGrid', () => {
  beforeEach(() => {
    storeState.situations = [];
    storeState.page = 1;
    storeState.total = 0;
    storeState.totalPages = 1;
    storeState.isDeleting = false;
    vi.clearAllMocks();
  });

  // ── Test 1: empty state ────────────────────────────────────────────────────
  it('shows empty state when filtered items list is empty', () => {
    storeState.situations = [];
    render(<SituationGrid />);
    // Kicker content
    expect(screen.getByText('situations.grid.noResults')).toBeInTheDocument();
    // Empty text
    expect(screen.getByText('situations.grid.empty')).toBeInTheDocument();
    // Clear filters button
    expect(
      screen.getByRole('button', { name: 'situations.grid.clearFilters' })
    ).toBeInTheDocument();
    // No sit-list section
    expect(document.querySelector('.sit-list')).not.toBeInTheDocument();
  });

  // ── Test 2: clear filters action ──────────────────────────────────────────
  it('Clear filters button calls setSearchQuery, setStatusFilter, setSortMode', async () => {
    storeState.situations = [];
    const user = userEvent.setup();
    render(<SituationGrid />);
    await user.click(screen.getByRole('button', { name: 'situations.grid.clearFilters' }));
    expect(mockSetSearchQuery).toHaveBeenCalledWith('');
    expect(mockSetStatusFilter).toHaveBeenCalledWith(null);
    expect(mockSetSortMode).toHaveBeenCalledWith('newest');
  });

  // ── Test 3: list rendering ────────────────────────────────────────────────
  it('renders one SituationCard per item using data-testid', () => {
    storeState.situations = [makeItem('s1'), makeItem('s2'), makeItem('s3')];
    storeState.total = 3;
    render(<SituationGrid />);
    expect(screen.getByTestId('sit-card-s1')).toBeInTheDocument();
    expect(screen.getByTestId('sit-card-s2')).toBeInTheDocument();
    expect(screen.getByTestId('sit-card-s3')).toBeInTheDocument();
  });

  // ── Test 4: pagination hidden when totalPages <= 1 ─────────────────────────
  it('hides pagination footer when totalPages <= 1', () => {
    storeState.totalPages = 1;
    render(<SituationGrid />);
    expect(screen.queryByTestId('sit-grid-pagination')).not.toBeInTheDocument();
  });

  // ── Test 5: pagination shown + Prev disabled on page 1 ────────────────────
  it('shows pagination footer with Prev disabled on page 1 and Next enabled', () => {
    storeState.totalPages = 3;
    storeState.page = 1;
    storeState.total = 30;
    storeState.situations = [];
    render(<SituationGrid />);
    expect(screen.getByTestId('sit-grid-pagination')).toBeInTheDocument();
    const prevBtn = screen.getByTestId('sit-grid-prev');
    const nextBtn = screen.getByTestId('sit-grid-next');
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();
  });

  // ── Test 6: Next disabled on last page ────────────────────────────────────
  it('disables Next button on last page', () => {
    storeState.totalPages = 3;
    storeState.page = 3;
    storeState.total = 30;
    storeState.situations = [];
    render(<SituationGrid />);
    const nextBtn = screen.getByTestId('sit-grid-next');
    expect(nextBtn).toBeDisabled();
  });

  // ── Test 7: Next click calls setPage(page + 1) ────────────────────────────
  it('Next click calls setPage with page + 1', async () => {
    storeState.totalPages = 3;
    storeState.page = 2;
    storeState.total = 30;
    storeState.situations = [];
    const user = userEvent.setup();
    render(<SituationGrid />);
    await user.click(screen.getByTestId('sit-grid-next'));
    expect(mockSetPage).toHaveBeenCalledWith(3);
  });
});
