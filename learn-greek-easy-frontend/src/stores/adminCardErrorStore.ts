// src/stores/adminCardErrorStore.ts

/**
 * Admin Card Error State Management Store
 *
 * Uses Zustand for state management with admin API integration.
 * Handles admin card error list, filters, pagination, and status/notes updates.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { adminAPI } from '@/services/adminAPI';
import type {
  AdminCardErrorResponse,
  AdminCardErrorUpdateRequest,
  CardErrorStatus,
  CardType,
} from '@/types/cardError';

/**
 * Admin Card Error filters state
 */
interface AdminCardErrorFilters {
  status: CardErrorStatus | null;
  cardType: CardType | null;
}

/**
 * Default filter state
 */
const DEFAULT_FILTERS: AdminCardErrorFilters = {
  status: null,
  cardType: null,
};

/**
 * Admin Card Error Store State Interface
 */
interface AdminCardErrorState {
  // Data
  errorList: AdminCardErrorResponse[];
  selectedError: AdminCardErrorResponse | null;

  // Pagination
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;

  // Filters
  filters: AdminCardErrorFilters;

  // Loading states
  isLoading: boolean;
  isUpdating: boolean;

  // Error state
  error: string | null;

  // Actions
  fetchErrorList: () => Promise<void>;
  updateError: (
    errorId: string,
    data: AdminCardErrorUpdateRequest
  ) => Promise<AdminCardErrorResponse>;
  setFilters: (filters: Partial<AdminCardErrorFilters>) => void;
  clearFilters: () => void;
  setPage: (page: number) => void;
  clearError: () => void;
  setSelectedError: (error: AdminCardErrorResponse | null) => void;
}

/**
 * Admin Card Error store hook for components
 */
export const useAdminCardErrorStore = create<AdminCardErrorState>()(
  devtools(
    (set, get) => ({
      // Initial state
      errorList: [],
      selectedError: null,
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0,
      filters: DEFAULT_FILTERS,
      isLoading: false,
      isUpdating: false,
      error: null,

      /**
       * Fetch paginated card error list from admin API with current filters
       */
      fetchErrorList: async () => {
        const { page, pageSize, filters } = get();
        set({ isLoading: true, error: null });

        try {
          const response = await adminAPI.listCardErrors({
            page,
            page_size: pageSize,
            status: filters.status ?? undefined,
            card_type: filters.cardType ?? undefined,
          });

          set({
            errorList: response.items,
            total: response.total,
            totalPages: Math.ceil(response.total / response.page_size),
            isLoading: false,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to load card errors';
          set({ isLoading: false, error: message, errorList: [] });
          throw error;
        }
      },

      /**
       * Update card error status and/or admin notes
       */
      updateError: async (errorId: string, data: AdminCardErrorUpdateRequest) => {
        set({ isUpdating: true, error: null });

        try {
          const updatedError = await adminAPI.updateCardError(errorId, data);

          // Update the error in list and selectedError
          set((state) => ({
            errorList: state.errorList.map((e) => (e.id === errorId ? updatedError : e)),
            selectedError: state.selectedError?.id === errorId ? updatedError : state.selectedError,
            isUpdating: false,
          }));

          return updatedError;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to update card error';
          set({ isUpdating: false, error: message });
          throw error;
        }
      },

      /**
       * Update filters and automatically re-fetch errors
       */
      setFilters: (newFilters: Partial<AdminCardErrorFilters>) => {
        set((state) => ({
          filters: { ...state.filters, ...newFilters },
          page: 1, // Reset to first page on filter change
        }));
        get().fetchErrorList();
      },

      /**
       * Reset all filters to defaults
       */
      clearFilters: () => {
        set({ filters: DEFAULT_FILTERS, page: 1 });
        get().fetchErrorList();
      },

      /**
       * Set current page and re-fetch
       */
      setPage: (page: number) => {
        set({ page });
        get().fetchErrorList();
      },

      /**
       * Clear current error message
       */
      clearError: () => set({ error: null }),

      /**
       * Set the selected error for detail modal
       */
      setSelectedError: (error: AdminCardErrorResponse | null) => set({ selectedError: error }),
    }),
    { name: 'adminCardErrorStore' }
  )
);

// ============================================
// Selectors (Optional optimization)
// ============================================

export const selectAdminCardErrorList = (state: AdminCardErrorState) => state.errorList;
export const selectSelectedCardError = (state: AdminCardErrorState) => state.selectedError;
export const selectCardErrorIsLoading = (state: AdminCardErrorState) => state.isLoading;
export const selectCardErrorIsUpdating = (state: AdminCardErrorState) => state.isUpdating;
export const selectCardErrorError = (state: AdminCardErrorState) => state.error;
export const selectCardErrorFilters = (state: AdminCardErrorState) => state.filters;
export const selectCardErrorPagination = (state: AdminCardErrorState) => ({
  page: state.page,
  pageSize: state.pageSize,
  total: state.total,
  totalPages: state.totalPages,
});
