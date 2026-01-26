// src/stores/adminNewsStore.ts

/**
 * Admin News State Management Store
 *
 * Uses Zustand for state management with admin API integration.
 * Handles admin news item list, pagination, and CRUD operations.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { adminAPI } from '@/services/adminAPI';
import type {
  NewsItemResponse,
  NewsItemUpdate,
  NewsItemWithCardResponse,
  NewsItemWithQuestionCreate,
} from '@/services/adminAPI';

/**
 * Admin News Store State Interface
 */
interface AdminNewsState {
  // Data
  newsItems: NewsItemResponse[];
  selectedItem: NewsItemResponse | null;

  // Pagination
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;

  // Loading states
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;

  // Error state
  error: string | null;

  // Actions
  fetchNewsItems: () => Promise<void>;
  createNewsItem: (data: NewsItemWithQuestionCreate) => Promise<NewsItemWithCardResponse>;
  updateNewsItem: (id: string, data: NewsItemUpdate) => Promise<NewsItemResponse>;
  deleteNewsItem: (id: string) => Promise<void>;
  setPage: (page: number) => void;
  setSelectedItem: (item: NewsItemResponse | null) => void;
  clearError: () => void;
}

/**
 * Admin News store hook for components
 */
export const useAdminNewsStore = create<AdminNewsState>()(
  devtools(
    (set, get) => ({
      // Initial state
      newsItems: [],
      selectedItem: null,
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0,
      isLoading: false,
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
      error: null,

      /**
       * Fetch paginated news items list from admin API
       */
      fetchNewsItems: async () => {
        const { page, pageSize } = get();
        set({ isLoading: true, error: null });

        try {
          const response = await adminAPI.getNewsItems(page, pageSize);

          set({
            newsItems: response.items,
            total: response.total,
            totalPages: Math.ceil(response.total / response.page_size),
            isLoading: false,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to load news items';
          set({ isLoading: false, error: message, newsItems: [] });
          throw error;
        }
      },

      /**
       * Create a new news item with optional question
       */
      createNewsItem: async (data: NewsItemWithQuestionCreate) => {
        set({ isCreating: true, error: null });

        try {
          const response = await adminAPI.createNewsItem(data);

          // Re-fetch the list to get updated data
          await get().fetchNewsItems();

          set({ isCreating: false });
          return response;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to create news item';
          set({ isCreating: false, error: message });
          throw error;
        }
      },

      /**
       * Update an existing news item
       */
      updateNewsItem: async (id: string, data: NewsItemUpdate) => {
        set({ isUpdating: true, error: null });

        try {
          const updatedItem = await adminAPI.updateNewsItem(id, data);

          // Update the item in the list and selectedItem
          set((state) => ({
            newsItems: state.newsItems.map((item) => (item.id === id ? updatedItem : item)),
            selectedItem: state.selectedItem?.id === id ? updatedItem : state.selectedItem,
            isUpdating: false,
          }));

          return updatedItem;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to update news item';
          set({ isUpdating: false, error: message });
          throw error;
        }
      },

      /**
       * Delete a news item (hard delete)
       */
      deleteNewsItem: async (id: string) => {
        set({ isDeleting: true, error: null });

        try {
          await adminAPI.deleteNewsItem(id);

          // Re-fetch the list to get updated data
          // This handles pagination edge cases (e.g., last item on page)
          await get().fetchNewsItems();

          set({
            isDeleting: false,
            selectedItem: null,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to delete news item';
          set({ isDeleting: false, error: message });
          throw error;
        }
      },

      /**
       * Set current page and re-fetch
       */
      setPage: (page: number) => {
        set({ page });
        get().fetchNewsItems();
      },

      /**
       * Set the selected news item for edit/delete dialogs
       */
      setSelectedItem: (item: NewsItemResponse | null) => set({ selectedItem: item }),

      /**
       * Clear current error message
       */
      clearError: () => set({ error: null }),
    }),
    { name: 'adminNewsStore' }
  )
);

// ============================================
// Selectors (Optional optimization)
// ============================================

export const selectNewsItems = (state: AdminNewsState) => state.newsItems;
export const selectSelectedItem = (state: AdminNewsState) => state.selectedItem;
export const selectIsLoading = (state: AdminNewsState) => state.isLoading;
export const selectIsCreating = (state: AdminNewsState) => state.isCreating;
export const selectIsUpdating = (state: AdminNewsState) => state.isUpdating;
export const selectIsDeleting = (state: AdminNewsState) => state.isDeleting;
export const selectError = (state: AdminNewsState) => state.error;
export const selectPagination = (state: AdminNewsState) => ({
  page: state.page,
  pageSize: state.pageSize,
  total: state.total,
  totalPages: state.totalPages,
});
