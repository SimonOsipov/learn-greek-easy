// src/stores/adminFeedbackStore.ts

/**
 * Admin Feedback State Management Store
 *
 * Uses Zustand for state management with admin API integration.
 * Handles admin feedback list, filters, pagination, and status/response updates.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { adminAPI } from '@/services/adminAPI';
import type {
  AdminFeedbackItem,
  FeedbackCategory,
  FeedbackStatus,
  AdminFeedbackUpdateRequest,
} from '@/types/feedback';

/**
 * Admin Feedback filters state
 */
interface AdminFeedbackFilters {
  status: FeedbackStatus | null;
  category: FeedbackCategory | null;
}

/**
 * Default filter state
 */
const DEFAULT_FILTERS: AdminFeedbackFilters = {
  status: null,
  category: null,
};

/**
 * Admin Feedback Store State Interface
 */
interface AdminFeedbackState {
  // Data
  feedbackList: AdminFeedbackItem[];
  selectedFeedback: AdminFeedbackItem | null;

  // Pagination
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;

  // Filters
  filters: AdminFeedbackFilters;

  // Loading states
  isLoading: boolean;
  isUpdating: boolean;

  // Error state
  error: string | null;

  // Actions
  fetchFeedbackList: () => Promise<void>;
  updateFeedback: (
    feedbackId: string,
    data: AdminFeedbackUpdateRequest
  ) => Promise<AdminFeedbackItem>;
  setFilters: (filters: Partial<AdminFeedbackFilters>) => void;
  clearFilters: () => void;
  setPage: (page: number) => void;
  clearError: () => void;
  setSelectedFeedback: (feedback: AdminFeedbackItem | null) => void;
}

/**
 * Admin Feedback store hook for components
 */
export const useAdminFeedbackStore = create<AdminFeedbackState>()(
  devtools(
    (set, get) => ({
      // Initial state
      feedbackList: [],
      selectedFeedback: null,
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0,
      filters: DEFAULT_FILTERS,
      isLoading: false,
      isUpdating: false,
      error: null,

      /**
       * Fetch paginated feedback list from admin API with current filters
       */
      fetchFeedbackList: async () => {
        const { page, pageSize, filters } = get();
        set({ isLoading: true, error: null });

        try {
          const response = await adminAPI.listFeedback({
            page,
            page_size: pageSize,
            status: filters.status ?? undefined,
            category: filters.category ?? undefined,
          });

          set({
            feedbackList: response.items,
            total: response.total,
            totalPages: Math.ceil(response.total / response.page_size),
            isLoading: false,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to load feedback';
          set({ isLoading: false, error: message, feedbackList: [] });
          throw error;
        }
      },

      /**
       * Update feedback status and/or admin response
       */
      updateFeedback: async (feedbackId: string, data: AdminFeedbackUpdateRequest) => {
        set({ isUpdating: true, error: null });

        try {
          const updatedFeedback = await adminAPI.updateFeedback(feedbackId, data);

          // Update the feedback in list and selectedFeedback
          set((state) => ({
            feedbackList: state.feedbackList.map((f) =>
              f.id === feedbackId ? updatedFeedback : f
            ),
            selectedFeedback:
              state.selectedFeedback?.id === feedbackId ? updatedFeedback : state.selectedFeedback,
            isUpdating: false,
          }));

          return updatedFeedback;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to update feedback';
          set({ isUpdating: false, error: message });
          throw error;
        }
      },

      /**
       * Update filters and automatically re-fetch feedback
       */
      setFilters: (newFilters: Partial<AdminFeedbackFilters>) => {
        set((state) => ({
          filters: { ...state.filters, ...newFilters },
          page: 1, // Reset to first page on filter change
        }));
        get().fetchFeedbackList();
      },

      /**
       * Reset all filters to defaults
       */
      clearFilters: () => {
        set({ filters: DEFAULT_FILTERS, page: 1 });
        get().fetchFeedbackList();
      },

      /**
       * Set current page and re-fetch
       */
      setPage: (page: number) => {
        set({ page });
        get().fetchFeedbackList();
      },

      /**
       * Clear current error message
       */
      clearError: () => set({ error: null }),

      /**
       * Set the selected feedback for response dialog
       */
      setSelectedFeedback: (feedback: AdminFeedbackItem | null) =>
        set({ selectedFeedback: feedback }),
    }),
    { name: 'adminFeedbackStore' }
  )
);

// ============================================
// Selectors (Optional optimization)
// ============================================

export const selectAdminFeedbackList = (state: AdminFeedbackState) => state.feedbackList;
export const selectSelectedFeedback = (state: AdminFeedbackState) => state.selectedFeedback;
export const selectIsLoading = (state: AdminFeedbackState) => state.isLoading;
export const selectIsUpdating = (state: AdminFeedbackState) => state.isUpdating;
export const selectError = (state: AdminFeedbackState) => state.error;
export const selectFilters = (state: AdminFeedbackState) => state.filters;
export const selectPagination = (state: AdminFeedbackState) => ({
  page: state.page,
  pageSize: state.pageSize,
  total: state.total,
  totalPages: state.totalPages,
});
