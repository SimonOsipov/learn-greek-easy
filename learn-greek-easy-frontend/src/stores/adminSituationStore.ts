import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { adminAPI } from '@/services/adminAPI';
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
  searchQuery: string;
  statusCounts: Record<string, number>;

  // Actions
  fetchSituations: () => Promise<void>;
  createSituation: (payload: SituationCreatePayload) => Promise<void>;
  deleteSituation: (id: string) => Promise<void>;
  fetchSituationDetail: (id: string) => Promise<void>;
  setPage: (page: number) => void;
  setStatusFilter: (status: SituationStatus | null) => void;
  setSearchQuery: (query: string) => void;
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
      searchQuery: '',
      statusCounts: {},

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

      setSearchQuery: (query: string) => {
        set({ searchQuery: query, page: 1 });
        get().fetchSituations();
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
export const selectSearchQuery = (state: AdminSituationState) => state.searchQuery;
export const selectStatusCounts = (state: AdminSituationState) => state.statusCounts;
