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
    levels: string[];
    dialog_lines_count: number;
    roles: string[];
    picture_image_url: string | null;
    audio_duration_seconds: number | null;
    source_title_en: string | null;
    source_country: string | null;
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
    levels: overrides.levels ?? [],
    dialog_lines_count: overrides.dialog_lines_count ?? 0,
    roles: overrides.roles ?? [],
    picture_image_url: overrides.picture_image_url ?? null,
    audio_duration_seconds: overrides.audio_duration_seconds ?? null,
    source_title_en: overrides.source_title_en ?? null,
    source_country: overrides.source_country ?? null,
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
    it('returns all zeros when statusCounts is empty and situations is empty', () => {
      // Post-fix contract: total = statusCounts.ready + statusCounts.draft (both 0 when missing)
      useAdminSituationStore.setState({ situations: [], statusCounts: {} });
      const result = selectStatsTotals(useAdminSituationStore.getState());
      expect(result).toEqual({
        total: 0,
        ready: 0,
        draft: 0,
        exercisesGenerated: 0,
        totalLast30d: 0,
        oldestDraftDate: null,
      });
    });
  });

  // ============================================================
  // 13. selectStatsTotals — catalog contract (ADMIN2-41-03 regression oracle)
  //
  // UPDATED from page-local to catalog contract. The page has 2 ready + 1 draft
  // (3 items), but statusCounts reports ready=4, draft=71 for the whole catalog.
  // Post-fix: total=75, ready=4, draft=71 — NOT page item counts.
  // ============================================================
  describe('selectStatsTotals — catalog contract (ADMIN2-41-03)', () => {
    it('total/ready/draft come from statusCounts, not from counting page items', () => {
      // Page has 2 ready + 1 draft — diverges from catalog statusCounts intentionally.
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
          status: 'ready',
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
      // Catalog has 4 ready + 71 draft = 75 total; page has 2 ready + 1 draft = 3 total.
      useAdminSituationStore.setState({
        situations: items as any,
        statusCounts: { ready: 4, draft: 71 },
        total: 3, // filtered total — must be IGNORED for stat cards
      });

      const result = selectStatsTotals(useAdminSituationStore.getState());
      // Catalog total (from statusCounts sum) — NOT items.length
      expect(result.total).toBe(75); // catalog total (statusCounts sum), not items.length
      // Catalog ready/draft (from statusCounts) — NOT page item status counts
      expect(result.ready).toBe(4);
      expect(result.draft).toBe(71);
      // exercisesGenerated still sums from the loaded page items (unchanged)
      expect(result.exercisesGenerated).toBe(13); // 2+3+1 + 0+4+0 + 1+0+2
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

  // ============================================================
  // 14. setLevelFilter + selectFilteredSituations level predicate (SAR2-26-05)
  // ============================================================
  describe('setLevelFilter', () => {
    it('defaults to null', () => {
      expect(useAdminSituationStore.getState().levelFilter).toBeNull();
    });

    it('setLevelFilter("B1") sets levelFilter to "B1" and resets page to 1', () => {
      act(() => {
        useAdminSituationStore.getState().setLevelFilter('B1');
      });
      expect(useAdminSituationStore.getState().levelFilter).toBe('B1');
      expect(useAdminSituationStore.getState().page).toBe(1);
    });

    it('setLevelFilter(null) clears levelFilter', () => {
      act(() => {
        useAdminSituationStore.getState().setLevelFilter('A2');
        useAdminSituationStore.getState().setLevelFilter(null);
      });
      expect(useAdminSituationStore.getState().levelFilter).toBeNull();
    });
  });

  describe('selectFilteredSituations — levelFilter predicate', () => {
    it('returns all items when levelFilter is null', () => {
      const items = [
        makeSituation({ id: 'a', levels: ['B1'] }),
        makeSituation({ id: 'b', levels: ['A2'] }),
        makeSituation({ id: 'c', levels: [] }),
      ];
      useAdminSituationStore.setState({
        situations: items as any,
        levelFilter: null,
        searchQuery: '',
        sortMode: 'newest',
      });
      const result = selectFilteredSituations(useAdminSituationStore.getState());
      expect(result).toHaveLength(3);
    });

    it('filters to items whose levels include "B1" when levelFilter="B1"', () => {
      const items = [
        makeSituation({ id: 'a', levels: ['B1'] }),
        makeSituation({ id: 'b', levels: ['A2'] }),
        makeSituation({ id: 'c', levels: ['B1', 'A2'] }),
        makeSituation({ id: 'd', levels: [] }),
      ];
      useAdminSituationStore.setState({
        situations: items as any,
        levelFilter: 'B1',
        searchQuery: '',
        sortMode: 'newest',
      });
      const result = selectFilteredSituations(useAdminSituationStore.getState());
      expect(result.map((i) => i.id)).toEqual(expect.arrayContaining(['a', 'c']));
      expect(result).toHaveLength(2);
    });

    it('filters to items whose levels include "A2" when levelFilter="A2"', () => {
      const items = [
        makeSituation({ id: 'a', levels: ['B1'] }),
        makeSituation({ id: 'b', levels: ['A2'] }),
      ];
      useAdminSituationStore.setState({
        situations: items as any,
        levelFilter: 'A2',
        searchQuery: '',
        sortMode: 'newest',
      });
      const result = selectFilteredSituations(useAdminSituationStore.getState());
      expect(result.map((i) => i.id)).toEqual(['b']);
    });
  });
});

// ============================================================
// ADMIN2-41-03 — selectStatsTotals catalog-total RED tests
//
// These 4 specs lock in the POST-FIX contract for F6.
// They FAIL today because selectStatsTotals currently reads from
// state.situations (page items), not state.statusCounts (catalog).
// They will turn GREEN once the executor updates selectStatsTotals to:
//   total = (statusCounts.ready ?? 0) + (statusCounts.draft ?? 0)
//   ready = statusCounts.ready ?? 0
//   draft  = statusCounts.draft  ?? 0
// ============================================================

describe('adminSituationStore — ADMIN2-41-03 catalog-total contract', () => {
  beforeEach(() => {
    useAdminSituationStore.setState(initialState);
    vi.clearAllMocks();
  });

  // ── Test 1: total = statusCounts sum, NOT situations.length ─────────────────
  it('T1: total is statusCounts.ready + statusCounts.draft, not page item count', () => {
    // 10 page items all draft; catalog reports 4 ready + 71 draft = 75.
    const pageItems = Array.from({ length: 10 }, (_, i) =>
      makeSituation({ id: String(i), status: 'draft' })
    );
    useAdminSituationStore.setState({
      situations: pageItems as any,
      statusCounts: { ready: 4, draft: 71 },
      total: 10, // filtered state.total — must be ignored
    });

    const result = selectStatsTotals(useAdminSituationStore.getState());
    // FAILS today (returns 10 = items.length); GREEN after fix (returns 75)
    expect(result.total).toBe(75);
  });

  // ── Test 2: ready/draft come from statusCounts, not page item status tallies ─
  it('T2: ready and draft are from statusCounts, not from counting page statuses', () => {
    // Page has 10 all-draft items; catalog reports 4 ready + 71 draft.
    const pageItems = Array.from({ length: 10 }, (_, i) =>
      makeSituation({ id: String(i), status: 'draft' })
    );
    useAdminSituationStore.setState({
      situations: pageItems as any,
      statusCounts: { ready: 4, draft: 71 },
    });

    const result = selectStatsTotals(useAdminSituationStore.getState());
    // FAILS today: current selector counts page → ready=0, draft=10
    expect(result.ready).toBe(4);
    expect(result.draft).toBe(71);
  });

  // ── Test 3: state.total (filtered) is ignored; catalog total uses statusCounts ─
  it('T3: catalog total ignores filtered state.total (uses statusCounts sum instead)', () => {
    // state.total=10 is the filtered page count; statusCounts sum=75 is the catalog.
    const pageItems = Array.from({ length: 10 }, (_, i) =>
      makeSituation({ id: String(i), status: 'draft' })
    );
    useAdminSituationStore.setState({
      situations: pageItems as any,
      statusCounts: { ready: 4, draft: 71 },
      total: 10,
    });

    const result = selectStatsTotals(useAdminSituationStore.getState());
    // Must equal 75 (statusCounts sum), NOT 10 (state.total filtered), NOT 10 (items.length)
    expect(result.total).toBe(75); // FAILS today
    expect(result.total).not.toBe(10);
  });

  // ── Test 4: totalLast30d and oldestDraftDate remain PAGE-LOCAL (D12) ─────────
  it('T4: totalLast30d and oldestDraftDate are still computed from loaded page items', () => {
    const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 days ago
    const oldDate = '2020-01-01T00:00:00Z'; // well outside 30-day window

    const pageItems = [
      makeSituation({ id: '1', status: 'draft', created_at: recentDate }),
      makeSituation({ id: '2', status: 'draft', created_at: oldDate }),
      makeSituation({ id: '3', status: 'ready', created_at: recentDate }),
    ];
    // statusCounts has much larger catalog numbers — should NOT affect page-local stats
    useAdminSituationStore.setState({
      situations: pageItems as any,
      statusCounts: { ready: 4, draft: 71 },
    });

    const result = selectStatsTotals(useAdminSituationStore.getState());

    // totalLast30d: only items within 30 days from the PAGE (2 of 3: id=1 and id=3)
    expect(result.totalLast30d).toBe(2);
    // oldestDraftDate: oldest draft from the PAGE (oldDate, not catalog-wide)
    expect(result.oldestDraftDate).toBe(oldDate);
  });

  // ── Test 5 (adversarial): readyPercent inputs — 4/75 → feeds a 5% result ───
  // selectStatsTotals does NOT compute readyPercent; SituationsTab.tsx does.
  // This test verifies the selector emits the exact inputs the component
  // needs to compute Math.round((4/75)*100) = 5.
  it('T5-adv: selector returns ready=4 and total=75 so component can compute pct=5', () => {
    useAdminSituationStore.setState({
      situations: [],
      statusCounts: { ready: 4, draft: 71 },
      total: 10, // filtered — must be ignored
    });

    const result = selectStatsTotals(useAdminSituationStore.getState());
    // Component computes: Math.round((result.ready / result.total) * 100)
    expect(result.ready).toBe(4);
    expect(result.total).toBe(75);
    const computedPct = result.total > 0 ? Math.round((result.ready / result.total) * 100) : 0;
    expect(computedPct).toBe(5); // round(4/75*100) = round(5.33) = 5
  });

  // ── Test 6 (adversarial): zero-catalog — selector returns total=0 so component
  // computes readyPercent=0 with NO divide-by-zero / NaN ──────────────────────
  it('T6-adv: zero statusCounts → total=0, ready=0 — no NaN in readyPercent computation', () => {
    useAdminSituationStore.setState({
      situations: [],
      statusCounts: {},
    });

    const result = selectStatsTotals(useAdminSituationStore.getState());
    expect(result.total).toBe(0);
    expect(result.ready).toBe(0);
    // Simulate the component guard: total > 0 ? Math.round(ready/total*100) : 0
    const computedPct = result.total > 0 ? Math.round((result.ready / result.total) * 100) : 0;
    expect(computedPct).toBe(0);
    expect(Number.isNaN(computedPct)).toBe(false);
    expect(Number.isFinite(computedPct)).toBe(true);
  });
});
