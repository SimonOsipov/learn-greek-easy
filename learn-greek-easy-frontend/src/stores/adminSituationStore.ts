import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { adminAPI } from '@/services/adminAPI';
import { refetchAdminTabCounts } from '@/stores/adminTabCountsStore';
import type {
  SituationCreatePayload,
  SituationDetailResponse,
  SituationListItem,
  SituationStatus,
} from '@/types/situation';

// --- Store interface ---

interface AdminSituationState {
  // Data
  situations: SituationListItem[];
  selectedSituation: SituationDetailResponse | null;

  // Pagination
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;

  // Loading states
  isLoading: boolean;
  isLoadingDetail: boolean;
  isCreating: boolean;
  isDeleting: boolean;

  // Error
  error: string | null;
  detailError: string | null;

  // Filters
  statusFilter: SituationStatus | null;
  levelFilter: 'B1' | 'A2' | null;
  searchQuery: string;
  statusCounts: Record<string, number>;
  sortMode: 'newest' | 'oldest' | 'draftsFirst';

  // Drawer state
  drawerItemId: string | null;

  // Actions
  fetchSituations: () => Promise<void>;
  createSituation: (payload: SituationCreatePayload) => Promise<void>;
  deleteSituation: (id: string) => Promise<void>;
  fetchSituationDetail: (id: string) => Promise<void>;
  setPage: (page: number) => void;
  setStatusFilter: (status: SituationStatus | null) => void;
  setLevelFilter: (level: 'B1' | 'A2' | null) => void;
  setSearchQuery: (query: string) => void;
  setSortMode: (mode: 'newest' | 'oldest' | 'draftsFirst') => void;
  openDrawer: (id: string) => void;
  closeDrawer: () => void;
  setSelectedSituation: (situation: SituationDetailResponse | null) => void;
  clearSelectedSituation: () => void;
  clearError: () => void;
}

// --- Store ---

export const useAdminSituationStore = create<AdminSituationState>()(
  devtools(
    (set, get) => ({
      // Initial state
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
      levelFilter: null,
      searchQuery: '',
      statusCounts: {},
      sortMode: 'draftsFirst' as 'newest' | 'oldest' | 'draftsFirst',
      drawerItemId: null,

      fetchSituations: async () => {
        set({ isLoading: true, error: null });
        try {
          const { page, pageSize, statusFilter, searchQuery } = get();
          const response = await adminAPI.getSituations(
            page,
            pageSize,
            statusFilter ?? undefined,
            searchQuery || undefined
          );
          set({
            situations: response.items,
            total: response.total,
            totalPages: Math.ceil(response.total / response.page_size),
            statusCounts: response.status_counts,
            isLoading: false,
          });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Failed to fetch situations',
            isLoading: false,
          });
        }
      },

      createSituation: async (payload: SituationCreatePayload) => {
        set({ isCreating: true, error: null });
        try {
          await adminAPI.createSituation(payload);
          set({ isCreating: false });
          await get().fetchSituations();
          refetchAdminTabCounts();
        } catch (err) {
          set({ isCreating: false });
          throw err;
        }
      },

      deleteSituation: async (id: string) => {
        set({ isDeleting: true, error: null });
        try {
          await adminAPI.deleteSituation(id);
          set({ isDeleting: false });
          await get().fetchSituations();
          refetchAdminTabCounts();
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Failed to delete situation',
            isDeleting: false,
          });
          throw err;
        }
      },

      fetchSituationDetail: async (id: string) => {
        set({ isLoadingDetail: true, detailError: null, selectedSituation: null });
        try {
          const detail = await adminAPI.getSituationDetail(id);
          set({ selectedSituation: detail, isLoadingDetail: false });
        } catch (err) {
          set({
            detailError: err instanceof Error ? err.message : 'Failed to load situation details',
            isLoadingDetail: false,
            selectedSituation: null,
          });
        }
      },

      setPage: (page: number) => {
        set({ page });
        get().fetchSituations();
      },

      setStatusFilter: (status: SituationStatus | null) => {
        set({ statusFilter: status, page: 1 });
        get().fetchSituations();
      },

      setLevelFilter: (level: 'B1' | 'A2' | null) => {
        set({ levelFilter: level, page: 1 });
      },

      setSearchQuery: (query: string) => {
        set({ searchQuery: query, page: 1 });
      },

      setSortMode: (mode) => {
        set({ sortMode: mode, page: 1 });
      },

      openDrawer: (id: string) => {
        set({ drawerItemId: id });
      },

      closeDrawer: () => {
        set({ drawerItemId: null });
      },

      setSelectedSituation: (situation: SituationDetailResponse | null) => {
        set({ selectedSituation: situation });
      },

      clearSelectedSituation: () => {
        set({ selectedSituation: null, detailError: null });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    { name: 'adminSituationStore' }
  )
);

// --- Selectors ---

export const selectSituations = (state: AdminSituationState) => state.situations;
export const selectSelectedSituation = (state: AdminSituationState) => state.selectedSituation;
export const selectIsLoading = (state: AdminSituationState) => state.isLoading;
export const selectIsLoadingDetail = (state: AdminSituationState) => state.isLoadingDetail;
export const selectIsCreating = (state: AdminSituationState) => state.isCreating;
export const selectIsDeleting = (state: AdminSituationState) => state.isDeleting;
export const selectError = (state: AdminSituationState) => state.error;
export const selectDetailError = (state: AdminSituationState) => state.detailError;
export const selectPage = (state: AdminSituationState) => state.page;
export const selectPageSize = (state: AdminSituationState) => state.pageSize;
export const selectTotal = (state: AdminSituationState) => state.total;
export const selectTotalPages = (state: AdminSituationState) => state.totalPages;
export const selectStatusFilter = (state: AdminSituationState) => state.statusFilter;
export const selectLevelFilter = (state: AdminSituationState) => state.levelFilter;
export const selectSearchQuery = (state: AdminSituationState) => state.searchQuery;
export const selectStatusCounts = (state: AdminSituationState) => state.statusCounts;
export const selectSortMode = (state: AdminSituationState) => state.sortMode;
export const selectDrawerItemId = (state: AdminSituationState) => state.drawerItemId;

export const selectFilteredSituations = (state: AdminSituationState): SituationListItem[] => {
  let items = state.situations;

  // 1. Search (case-insensitive substring over scenario_el / scenario_en / scenario_ru)
  if (state.searchQuery !== '') {
    const q = state.searchQuery.toLowerCase();
    items = items.filter(
      (s) =>
        s.scenario_el.toLowerCase().includes(q) ||
        s.scenario_en.toLowerCase().includes(q) ||
        s.scenario_ru.toLowerCase().includes(q)
    );
  }

  // 2. Level filter (client-side — levels[] is available on SituationListItem)
  if (state.levelFilter !== null) {
    const lf = state.levelFilter;
    items = items.filter((s) => s.levels.includes(lf));
  }

  // NOTE: statusFilter is NOT applied here — it is server-side via fetchSituations.

  // 2. Sort (created_at is ISO string → lexical compare is correct for dates)
  const sorted = [...items];
  if (state.sortMode === 'newest') {
    sorted.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  } else if (state.sortMode === 'oldest') {
    sorted.sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
  } else if (state.sortMode === 'draftsFirst') {
    // drafts before ready; within each group newest first
    sorted.sort((a, b) => {
      const aDraft = a.status === 'draft' ? 0 : 1;
      const bDraft = b.status === 'draft' ? 0 : 1;
      if (aDraft !== bDraft) return aDraft - bDraft;
      return a.created_at < b.created_at ? 1 : -1;
    });
  }
  return sorted;
};

export const selectStatsTotals = (state: AdminSituationState) => {
  const items = state.situations;
  let ready = 0;
  let draft = 0;
  let exercisesGenerated = 0;
  // totalLast30d: computed client-side from loaded page (best-effort; full accuracy would need a
  // dedicated backend stats endpoint — TODO: add /admin/situations/stats if high accuracy needed).
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  let totalLast30d = 0;
  let oldestDraftDate: string | null = null;
  for (const s of items) {
    if (s.status === 'ready') ready += 1;
    else if (s.status === 'draft') {
      draft += 1;
      if (oldestDraftDate === null || s.created_at < oldestDraftDate) {
        oldestDraftDate = s.created_at;
      }
    }
    exercisesGenerated +=
      s.dialog_exercises_count + s.description_exercises_count + s.picture_exercises_count;
    if (new Date(s.created_at) >= thirtyDaysAgo) totalLast30d += 1;
  }
  return { total: items.length, ready, draft, exercisesGenerated, totalLast30d, oldestDraftDate };
};
