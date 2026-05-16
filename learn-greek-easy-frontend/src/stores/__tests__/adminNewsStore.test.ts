/**
 * adminNewsStore Tests — NEWS-02 surface area
 *
 * Tests for the filter/sort/drawer-state additions introduced in NEWS-02:
 * - New fields exist with correct defaults
 * - setLevelFilter / setSearchQuery / setSortMode reset page=1, NO auto-fetch
 * - openDrawer / closeDrawer transitions
 * - selectFilteredNewsItems: level, search, sort
 * - selectFilterState / selectDrawerState selectors
 */

import { act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  useAdminNewsStore,
  selectFilterState,
  selectDrawerState,
  selectFilteredNewsItems,
} from '../adminNewsStore';

// Mock the adminAPI so the store can be imported without real network calls
vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    getNewsItems: vi.fn(),
    createNewsItem: vi.fn(),
    updateNewsItem: vi.fn(),
    deleteNewsItem: vi.fn(),
  },
}));

// Import mock reference AFTER vi.mock is hoisted
import { adminAPI } from '@/services/adminAPI';

// Minimal NewsItemResponse fixture helper
function makeItem(
  overrides: Partial<{
    id: string;
    country: string;
    title_el: string;
    title_en: string;
    title_ru: string;
    description_el: string | null;
    description_el_a2: string | null;
    publication_date: string;
    updated_at: string;
  }> = {}
) {
  return {
    id: overrides.id ?? 'item-1',
    country: overrides.country ?? 'GR',
    title_el: overrides.title_el ?? 'Ελληνικός τίτλος',
    title_en: overrides.title_en ?? 'English title',
    title_ru: overrides.title_ru ?? 'Русский заголовок',
    description_el: overrides.description_el ?? null,
    description_el_a2: overrides.description_el_a2 ?? null,
    publication_date: overrides.publication_date ?? '2024-01-01',
    updated_at: overrides.updated_at ?? '2024-01-01T00:00:00Z',
  };
}

const initialState = {
  newsItems: [],
  selectedItem: null,
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 0,
  audioCount: 0,
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  error: null,
  countryFilter: 'all' as const,
  levelFilter: 'all' as const,
  searchQuery: '',
  sortMode: 'newest' as const,
  drawerItemId: null,
};

describe('adminNewsStore — NEWS-02 extensions', () => {
  beforeEach(() => {
    useAdminNewsStore.setState(initialState);
    vi.clearAllMocks();
  });

  // ============================================================
  // Defaults
  // ============================================================
  describe('Initial state', () => {
    it('levelFilter defaults to "all"', () => {
      expect(useAdminNewsStore.getState().levelFilter).toBe('all');
    });

    it('searchQuery defaults to ""', () => {
      expect(useAdminNewsStore.getState().searchQuery).toBe('');
    });

    it('sortMode defaults to "newest"', () => {
      expect(useAdminNewsStore.getState().sortMode).toBe('newest');
    });

    it('drawerItemId defaults to null', () => {
      expect(useAdminNewsStore.getState().drawerItemId).toBeNull();
    });
  });

  // ============================================================
  // setLevelFilter
  // ============================================================
  describe('setLevelFilter()', () => {
    it('sets levelFilter and resets page to 1', () => {
      useAdminNewsStore.setState({ page: 3 });

      act(() => {
        useAdminNewsStore.getState().setLevelFilter('B2');
      });

      const state = useAdminNewsStore.getState();
      expect(state.levelFilter).toBe('B2');
      expect(state.page).toBe(1);
    });

    it('does NOT call adminAPI.getNewsItems', () => {
      act(() => {
        useAdminNewsStore.getState().setLevelFilter('A2');
      });

      expect(adminAPI.getNewsItems).not.toHaveBeenCalled();
    });

    it('round-trips through all values', () => {
      for (const level of ['B2', 'A2', 'B1', 'all'] as const) {
        act(() => {
          useAdminNewsStore.getState().setLevelFilter(level);
        });
        expect(useAdminNewsStore.getState().levelFilter).toBe(level);
      }
    });
  });

  // ============================================================
  // setSearchQuery
  // ============================================================
  describe('setSearchQuery()', () => {
    it('sets searchQuery and resets page to 1', () => {
      useAdminNewsStore.setState({ page: 5 });

      act(() => {
        useAdminNewsStore.getState().setSearchQuery('Athens');
      });

      const state = useAdminNewsStore.getState();
      expect(state.searchQuery).toBe('Athens');
      expect(state.page).toBe(1);
    });

    it('does NOT call adminAPI.getNewsItems', () => {
      act(() => {
        useAdminNewsStore.getState().setSearchQuery('test');
      });

      expect(adminAPI.getNewsItems).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // setSortMode
  // ============================================================
  describe('setSortMode()', () => {
    it('sets sortMode and resets page to 1', () => {
      useAdminNewsStore.setState({ page: 2 });

      act(() => {
        useAdminNewsStore.getState().setSortMode('oldest');
      });

      const state = useAdminNewsStore.getState();
      expect(state.sortMode).toBe('oldest');
      expect(state.page).toBe(1);
    });

    it('does NOT call adminAPI.getNewsItems', () => {
      act(() => {
        useAdminNewsStore.getState().setSortMode('updated');
      });

      expect(adminAPI.getNewsItems).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // openDrawer / closeDrawer
  // ============================================================
  describe('openDrawer() / closeDrawer()', () => {
    it('openDrawer sets drawerItemId', () => {
      act(() => {
        useAdminNewsStore.getState().openDrawer('item-abc');
      });

      expect(useAdminNewsStore.getState().drawerItemId).toBe('item-abc');
    });

    it('closeDrawer clears drawerItemId', () => {
      useAdminNewsStore.setState({ drawerItemId: 'item-abc' });

      act(() => {
        useAdminNewsStore.getState().closeDrawer();
      });

      expect(useAdminNewsStore.getState().drawerItemId).toBeNull();
    });

    it('openDrawer then closeDrawer round-trips', () => {
      act(() => {
        useAdminNewsStore.getState().openDrawer('item-xyz');
      });
      expect(useAdminNewsStore.getState().drawerItemId).toBe('item-xyz');

      act(() => {
        useAdminNewsStore.getState().closeDrawer();
      });
      expect(useAdminNewsStore.getState().drawerItemId).toBeNull();
    });
  });

  // ============================================================
  // selectFilterState / selectDrawerState
  // ============================================================
  describe('selectFilterState()', () => {
    it('returns all four filter fields', () => {
      useAdminNewsStore.setState({
        countryFilter: 'GR' as any,
        levelFilter: 'B2',
        searchQuery: 'foo',
        sortMode: 'oldest',
      });

      const result = selectFilterState(useAdminNewsStore.getState());
      expect(result).toEqual({
        countryFilter: 'GR',
        levelFilter: 'B2',
        searchQuery: 'foo',
        sortMode: 'oldest',
      });
    });
  });

  describe('selectDrawerState()', () => {
    it('returns drawerItemId', () => {
      useAdminNewsStore.setState({ drawerItemId: 'item-42' });
      expect(selectDrawerState(useAdminNewsStore.getState())).toEqual({ drawerItemId: 'item-42' });
    });

    it('returns null when closed', () => {
      useAdminNewsStore.setState({ drawerItemId: null });
      expect(selectDrawerState(useAdminNewsStore.getState())).toEqual({ drawerItemId: null });
    });
  });

  // ============================================================
  // selectFilteredNewsItems — level filter
  // ============================================================
  describe('selectFilteredNewsItems — level filter', () => {
    const b2Item = makeItem({ id: 'b2', description_el: 'Κείμενο B2', description_el_a2: null });
    const a2Item = makeItem({ id: 'a2', description_el: null, description_el_a2: 'Κείμενο A2' });
    const bothItem = makeItem({
      id: 'both',
      description_el: 'B2 text',
      description_el_a2: 'A2 text',
    });
    const noneItem = makeItem({ id: 'none', description_el: null, description_el_a2: null });

    beforeEach(() => {
      useAdminNewsStore.setState({ newsItems: [b2Item, a2Item, bothItem, noneItem] as any });
    });

    it('"all" level returns all items', () => {
      useAdminNewsStore.setState({ levelFilter: 'all' });
      const result = selectFilteredNewsItems(useAdminNewsStore.getState());
      expect(result.map((i) => i.id)).toEqual(expect.arrayContaining(['b2', 'a2', 'both', 'none']));
      expect(result).toHaveLength(4);
    });

    it('"B2" only matches items with non-empty description_el', () => {
      useAdminNewsStore.setState({ levelFilter: 'B2' });
      const result = selectFilteredNewsItems(useAdminNewsStore.getState());
      expect(result.map((i) => i.id)).toEqual(expect.arrayContaining(['b2', 'both']));
      expect(result).toHaveLength(2);
    });

    it('"A2" only matches items with non-empty description_el_a2', () => {
      useAdminNewsStore.setState({ levelFilter: 'A2' });
      const result = selectFilteredNewsItems(useAdminNewsStore.getState());
      expect(result.map((i) => i.id)).toEqual(expect.arrayContaining(['a2', 'both']));
      expect(result).toHaveLength(2);
    });

    it('"B1" always returns []', () => {
      useAdminNewsStore.setState({ levelFilter: 'B1' });
      const result = selectFilteredNewsItems(useAdminNewsStore.getState());
      expect(result).toEqual([]);
    });
  });

  // ============================================================
  // selectFilteredNewsItems — search filter
  // ============================================================
  describe('selectFilteredNewsItems — search filter', () => {
    const items = [
      makeItem({ id: '1', title_el: 'Αθήνα', title_en: 'Athens', title_ru: 'Афины' }),
      makeItem({
        id: '2',
        title_el: 'Θεσσαλονίκη',
        title_en: 'Thessaloniki',
        title_ru: 'Салоники',
      }),
      makeItem({ id: '3', title_el: 'Κρήτη', title_en: 'Crete', title_ru: 'Крит' }),
    ];

    beforeEach(() => {
      useAdminNewsStore.setState({ newsItems: items as any, levelFilter: 'all', searchQuery: '' });
    });

    it('empty query returns all items', () => {
      useAdminNewsStore.setState({ searchQuery: '' });
      const result = selectFilteredNewsItems(useAdminNewsStore.getState());
      expect(result).toHaveLength(3);
    });

    it('matches by title_en (case-insensitive)', () => {
      useAdminNewsStore.setState({ searchQuery: 'athens' });
      const result = selectFilteredNewsItems(useAdminNewsStore.getState());
      expect(result.map((i) => i.id)).toEqual(['1']);
    });

    it('matches by title_el', () => {
      useAdminNewsStore.setState({ searchQuery: 'Κρήτη' });
      const result = selectFilteredNewsItems(useAdminNewsStore.getState());
      expect(result.map((i) => i.id)).toEqual(['3']);
    });

    it('matches by title_ru', () => {
      useAdminNewsStore.setState({ searchQuery: 'салоники' });
      const result = selectFilteredNewsItems(useAdminNewsStore.getState());
      expect(result.map((i) => i.id)).toEqual(['2']);
    });

    it('no match returns []', () => {
      useAdminNewsStore.setState({ searchQuery: 'zzznomatch' });
      const result = selectFilteredNewsItems(useAdminNewsStore.getState());
      expect(result).toEqual([]);
    });
  });

  // ============================================================
  // selectFilteredNewsItems — sort modes
  // ============================================================
  describe('selectFilteredNewsItems — sort modes', () => {
    const items = [
      makeItem({ id: 'mid', publication_date: '2024-06-01', updated_at: '2024-07-10T00:00:00Z' }),
      makeItem({ id: 'old', publication_date: '2024-01-01', updated_at: '2024-12-01T00:00:00Z' }),
      makeItem({ id: 'new', publication_date: '2024-12-31', updated_at: '2024-02-01T00:00:00Z' }),
    ];

    beforeEach(() => {
      useAdminNewsStore.setState({
        newsItems: items as any,
        levelFilter: 'all',
        searchQuery: '',
        countryFilter: 'all',
      });
    });

    it('"newest" sorts by publication_date descending', () => {
      useAdminNewsStore.setState({ sortMode: 'newest' });
      const result = selectFilteredNewsItems(useAdminNewsStore.getState());
      expect(result.map((i) => i.id)).toEqual(['new', 'mid', 'old']);
    });

    it('"oldest" sorts by publication_date ascending', () => {
      useAdminNewsStore.setState({ sortMode: 'oldest' });
      const result = selectFilteredNewsItems(useAdminNewsStore.getState());
      expect(result.map((i) => i.id)).toEqual(['old', 'mid', 'new']);
    });

    it('"updated" sorts by updated_at descending', () => {
      useAdminNewsStore.setState({ sortMode: 'updated' });
      const result = selectFilteredNewsItems(useAdminNewsStore.getState());
      // old has most recent updated_at (2024-12-01), then mid (2024-07-10), then new (2024-02-01)
      expect(result.map((i) => i.id)).toEqual(['old', 'mid', 'new']);
    });
  });
});
