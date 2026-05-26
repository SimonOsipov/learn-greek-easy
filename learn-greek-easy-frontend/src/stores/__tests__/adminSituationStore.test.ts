/**
 * adminSituationStore Tests — SIT-02 surface area
 *
 * Tests for the filter/sort/drawer-state additions introduced in SIT-02:
 * - New fields exist with correct defaults
 * - setSearchQuery is a pure setter (no auto-fetch)
 * - setSortMode resets page=1, NO auto-fetch
 * - openDrawer / closeDrawer transitions
 * - selectFilteredSituations: search (all langs), each sort mode, combined, statusFilter bypass
 * - selectStatsTotals: empty + mixed
 */

import { act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  useAdminSituationStore,
  selectSortMode,
  selectDrawerItemId,
  selectFilteredSituations,
  selectStatsTotals,
} from '../adminSituationStore';

// Mock the adminAPI so the store can be imported without real network calls
vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    getSituations: vi.fn(),
    createSituation: vi.fn(),
    deleteSituation: vi.fn(),
    getSituationDetail: vi.fn(),
  },
}));

// Import mock reference AFTER vi.mock is hoisted
import { adminAPI } from '@/services/adminAPI';

// Factory for SituationListItem — returns a complete object with sensible defaults
function makeSituation(
  overrides: Partial<{
    id: string;
    scenario_el: string;
    scenario_en: string;
    scenario_ru: string;
    status: 'draft' | 'ready';
    created_at: string;
    has_dialog: boolean;
    has_description: boolean;
    has_picture: boolean;
    has_dialog_audio: boolean;
    has_description_audio: boolean;
    description_timestamps_count: number;
    dialog_exercises_count: number;
    description_exercises_count: number;
    picture_exercises_count: number;
  }> = {}
) {
  return {
    id: overrides.id ?? 'sit-1',
    scenario_el: overrides.scenario_el ?? 'Σενάριο',
    scenario_en: overrides.scenario_en ?? 'Scenario',
    scenario_ru: overrides.scenario_ru ?? 'Сценарий',
    status: overrides.status ?? 'draft',
    created_at: overrides.created_at ?? '2024-01-01T00:00:00Z',
    has_dialog: overrides.has_dialog ?? false,
    has_description: overrides.has_description ?? false,
    has_picture: overrides.has_picture ?? false,
    has_dialog_audio: overrides.has_dialog_audio ?? false,
    has_description_audio: overrides.has_description_audio ?? false,
    description_timestamps_count: overrides.description_timestamps_count ?? 0,
    dialog_exercises_count: overrides.dialog_exercises_count ?? 0,
    description_exercises_count: overrides.description_exercises_count ?? 0,
    picture_exercises_count: overrides.picture_exercises_count ?? 0,
  };
}

const initialState = {
  situations: [],
  selectedSituation: null,
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 0,
  isLoading: false,
  isLoadingDetail: false,
  isCreating: false,
  isDeleting: false,
  error: null,
  detailError: null,
  statusFilter: null,
  searchQuery: '',
  statusCounts: {},
  sortMode: 'draftsFirst' as const,
  drawerItemId: null,
};

describe('adminSituationStore — SIT-02 extensions', () => {
  beforeEach(() => {
    useAdminSituationStore.setState(initialState);
    vi.clearAllMocks();
  });

  // ============================================================
  // 1. Initial state
  // ============================================================
  describe('Initial state', () => {
    it('sortMode defaults to "draftsFirst"', () => {
      expect(useAdminSituationStore.getState().sortMode).toBe('draftsFirst');
    });

    it('drawerItemId defaults to null', () => {
      expect(useAdminSituationStore.getState().drawerItemId).toBeNull();
    });
  });

  // ============================================================
  // 2. setSearchQuery — pure setter, no auto-fetch
  // ============================================================
  describe('setSearchQuery()', () => {
    it('sets searchQuery and resets page to 1', () => {
      useAdminSituationStore.setState({ page: 5 });

      act(() => {
        useAdminSituationStore.getState().setSearchQuery('Athens');
      });

      const state = useAdminSituationStore.getState();
      expect(state.searchQuery).toBe('Athens');
      expect(state.page).toBe(1);
    });

    it('does NOT call adminAPI.getSituations', () => {
      act(() => {
        useAdminSituationStore.getState().setSearchQuery('test');
      });

      expect(adminAPI.getSituations).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // 3. setSortMode — sets mode, resets page, no auto-fetch
  // ============================================================
  describe('setSortMode()', () => {
    it('sets sortMode and resets page to 1', () => {
      useAdminSituationStore.setState({ page: 3 });

      act(() => {
        useAdminSituationStore.getState().setSortMode('oldest');
      });

      const state = useAdminSituationStore.getState();
      expect(state.sortMode).toBe('oldest');
      expect(state.page).toBe(1);
    });

    it('does NOT call adminAPI.getSituations', () => {
      act(() => {
        useAdminSituationStore.getState().setSortMode('draftsFirst');
      });

      expect(adminAPI.getSituations).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // 4. openDrawer
  // ============================================================
  describe('openDrawer()', () => {
    it('sets drawerItemId to the given id', () => {
      act(() => {
        useAdminSituationStore.getState().openDrawer('sit-abc');
      });

      expect(useAdminSituationStore.getState().drawerItemId).toBe('sit-abc');
    });
  });

  // ============================================================
  // 5. closeDrawer
  // ============================================================
  describe('closeDrawer()', () => {
    it('clears drawerItemId back to null', () => {
      useAdminSituationStore.setState({ drawerItemId: 'sit-abc' });

      act(() => {
        useAdminSituationStore.getState().closeDrawer();
      });

      expect(useAdminSituationStore.getState().drawerItemId).toBeNull();
    });
  });

  // ============================================================
  // 6. selectFilteredSituations — search filter (all three langs)
  // ============================================================
  describe('selectFilteredSituations — search filter', () => {
    const items = [
      makeSituation({ id: '1', scenario_el: 'Αθήνα', scenario_en: 'Athens', scenario_ru: 'Афины' }),
      makeSituation({
        id: '2',
        scenario_el: 'Θεσσαλονίκη',
        scenario_en: 'Thessaloniki',
        scenario_ru: 'Салоники',
      }),
      makeSituation({ id: '3', scenario_el: 'Κρήτη', scenario_en: 'Crete', scenario_ru: 'Крит' }),
    ];

    beforeEach(() => {
      useAdminSituationStore.setState({ situations: items as any, searchQuery: '' });
    });

    it('empty query returns all items', () => {
      const result = selectFilteredSituations(useAdminSituationStore.getState());
      expect(result).toHaveLength(3);
    });

    it('matches by scenario_en (case-insensitive)', () => {
      useAdminSituationStore.setState({ searchQuery: 'athens' });
      const result = selectFilteredSituations(useAdminSituationStore.getState());
      expect(result.map((i) => i.id)).toEqual(['1']);
    });

    it('matches by scenario_el', () => {
      useAdminSituationStore.setState({ searchQuery: 'Κρήτη' });
      const result = selectFilteredSituations(useAdminSituationStore.getState());
      expect(result.map((i) => i.id)).toEqual(['3']);
    });

    it('matches by scenario_ru', () => {
      useAdminSituationStore.setState({ searchQuery: 'салоники' });
      const result = selectFilteredSituations(useAdminSituationStore.getState());
      expect(result.map((i) => i.id)).toEqual(['2']);
    });

    it('uppercase query matches lowercase scenario_en', () => {
      useAdminSituationStore.setState({ searchQuery: 'CRETE' });
      const result = selectFilteredSituations(useAdminSituationStore.getState());
      expect(result.map((i) => i.id)).toEqual(['3']);
    });

    it('no match returns []', () => {
      useAdminSituationStore.setState({ searchQuery: 'zzznomatch' });
      const result = selectFilteredSituations(useAdminSituationStore.getState());
      expect(result).toEqual([]);
    });
  });

  // ============================================================
  // 7. selectFilteredSituations — sort "newest"
  // ============================================================
  describe('selectFilteredSituations — sort newest', () => {
    it('sorts by created_at descending', () => {
      const items = [
        makeSituation({ id: 'mid', created_at: '2024-06-01T00:00:00Z' }),
        makeSituation({ id: 'old', created_at: '2024-01-01T00:00:00Z' }),
        makeSituation({ id: 'new', created_at: '2024-12-31T00:00:00Z' }),
      ];
      useAdminSituationStore.setState({
        situations: items as any,
        sortMode: 'newest',
        searchQuery: '',
      });

      const result = selectFilteredSituations(useAdminSituationStore.getState());
      expect(result.map((i) => i.id)).toEqual(['new', 'mid', 'old']);
    });
  });

  // ============================================================
  // 8. selectFilteredSituations — sort "oldest"
  // ============================================================
  describe('selectFilteredSituations — sort oldest', () => {
    it('sorts by created_at ascending', () => {
      const items = [
        makeSituation({ id: 'mid', created_at: '2024-06-01T00:00:00Z' }),
        makeSituation({ id: 'old', created_at: '2024-01-01T00:00:00Z' }),
        makeSituation({ id: 'new', created_at: '2024-12-31T00:00:00Z' }),
      ];
      useAdminSituationStore.setState({
        situations: items as any,
        sortMode: 'oldest',
        searchQuery: '',
      });

      const result = selectFilteredSituations(useAdminSituationStore.getState());
      expect(result.map((i) => i.id)).toEqual(['old', 'mid', 'new']);
    });
  });

  // ============================================================
  // 9. selectFilteredSituations — sort "draftsFirst"
  // ============================================================
  describe('selectFilteredSituations — sort draftsFirst', () => {
    it('drafts appear before ready; within each group newest first', () => {
      const items = [
        makeSituation({ id: 'ready-old', status: 'ready', created_at: '2024-01-01T00:00:00Z' }),
        makeSituation({ id: 'draft-new', status: 'draft', created_at: '2024-12-01T00:00:00Z' }),
        makeSituation({ id: 'ready-new', status: 'ready', created_at: '2024-11-01T00:00:00Z' }),
        makeSituation({ id: 'draft-old', status: 'draft', created_at: '2024-03-01T00:00:00Z' }),
      ];
      useAdminSituationStore.setState({
        situations: items as any,
        sortMode: 'draftsFirst',
        searchQuery: '',
      });

      const result = selectFilteredSituations(useAdminSituationStore.getState());
      // drafts first (newest draft first), then ready (newest ready first)
      expect(result.map((i) => i.id)).toEqual(['draft-new', 'draft-old', 'ready-new', 'ready-old']);
    });
  });

  // ============================================================
  // 10. selectFilteredSituations — search + sort combined
  // ============================================================
  describe('selectFilteredSituations — search + sort combined', () => {
    it('search narrows set, then sort applies to narrowed set', () => {
      const items = [
        makeSituation({ id: 'a', scenario_en: 'Athens', created_at: '2024-06-01T00:00:00Z' }),
        makeSituation({ id: 'b', scenario_en: 'Athens', created_at: '2024-12-01T00:00:00Z' }),
        makeSituation({ id: 'c', scenario_en: 'Crete', created_at: '2024-01-01T00:00:00Z' }),
      ];
      useAdminSituationStore.setState({
        situations: items as any,
        searchQuery: 'athens',
        sortMode: 'oldest',
      });

      const result = selectFilteredSituations(useAdminSituationStore.getState());
      // only 'a' and 'b' match; oldest first → 'a' before 'b'
      expect(result.map((i) => i.id)).toEqual(['a', 'b']);
    });
  });

  // ============================================================
  // 11. selectFilteredSituations — statusFilter is NOT applied client-side
  // ============================================================
  describe('selectFilteredSituations — statusFilter bypass', () => {
    it('does NOT filter by statusFilter (server-side concern)', () => {
      const items = [
        makeSituation({ id: 'draft-1', status: 'draft' }),
        makeSituation({ id: 'ready-1', status: 'ready' }),
      ];
      useAdminSituationStore.setState({
        situations: items as any,
        statusFilter: 'draft',
        searchQuery: '',
        sortMode: 'newest',
      });

      const result = selectFilteredSituations(useAdminSituationStore.getState());
      // both items returned — statusFilter is server-side only
      expect(result).toHaveLength(2);
    });
  });

  // ============================================================
  // 12. selectStatsTotals — empty
  // ============================================================
  describe('selectStatsTotals — empty', () => {
    it('returns all zeros when situations is empty', () => {
      useAdminSituationStore.setState({ situations: [] });
      const result = selectStatsTotals(useAdminSituationStore.getState());
      expect(result).toEqual({ total: 0, ready: 0, draft: 0, exercisesGenerated: 0 });
    });
  });

  // ============================================================
  // 13. selectStatsTotals — mixed
  // ============================================================
  describe('selectStatsTotals — mixed', () => {
    it('counts statuses and sums exercise counts correctly', () => {
      const items = [
        makeSituation({
          id: '1',
          status: 'ready',
          dialog_exercises_count: 2,
          description_exercises_count: 3,
          picture_exercises_count: 1,
        }),
        makeSituation({
          id: '2',
          status: 'draft',
          dialog_exercises_count: 0,
          description_exercises_count: 4,
          picture_exercises_count: 0,
        }),
        makeSituation({
          id: '3',
          status: 'draft',
          dialog_exercises_count: 1,
          description_exercises_count: 0,
          picture_exercises_count: 2,
        }),
      ];
      useAdminSituationStore.setState({ situations: items as any });

      const result = selectStatsTotals(useAdminSituationStore.getState());
      expect(result).toEqual({
        total: 3,
        ready: 1,
        draft: 2,
        exercisesGenerated: 13, // 2+3+1 + 0+4+0 + 1+0+2
      });
    });
  });

  // ============================================================
  // Selector pass-through tests
  // ============================================================
  describe('selectSortMode / selectDrawerItemId', () => {
    it('selectSortMode returns current sortMode', () => {
      useAdminSituationStore.setState({ sortMode: 'draftsFirst' });
      expect(selectSortMode(useAdminSituationStore.getState())).toBe('draftsFirst');
    });

    it('selectDrawerItemId returns current drawerItemId', () => {
      useAdminSituationStore.setState({ drawerItemId: 'sit-99' });
      expect(selectDrawerItemId(useAdminSituationStore.getState())).toBe('sit-99');
    });
  });
});
