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
  NewsCountry,
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

  // Filter
  countryFilter: NewsCountry | 'all';

  // Regeneration state
  regeneratingId: string | null;
  cooldownEndTime: number | null;

  // Actions
  fetchNewsItems: () => Promise<void>;
  createNewsItem: (data: NewsItemWithQuestionCreate) => Promise<NewsItemWithCardResponse>;
  updateNewsItem: (id: string, data: NewsItemUpdate) => Promise<NewsItemResponse>;
  deleteNewsItem: (id: string) => Promise<void>;
  regenerateAudio: (id: string) => Promise<void>;
  setPage: (page: number) => void;
  setSelectedItem: (item: NewsItemResponse | null) => void;
  setCountryFilter: (filter: NewsCountry | 'all') => void;
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
      countryFilter: 'all' as NewsCountry | 'all',
      regeneratingId: null,
      cooldownEndTime: null,

      /**
       * Fetch paginated news items list from admin API
       */
      fetchNewsItems: async () => {
        const { page, pageSize, countryFilter } = get();
        set({ isLoading: true, error: null });

        try {
          const response = await adminAPI.getNewsItems(
            page,
            pageSize,
            countryFilter === 'all' ? undefined : countryFilter
          );

          set((state) => ({
            newsItems: response.items,
            total: response.total,
            totalPages: Math.ceil(response.total / response.page_size),
            isLoading: false,
            selectedItem: state.selectedItem
              ? (response.items.find((item) => item.id === state.selectedItem?.id) ?? null)
              : null,
          }));
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
       * Regenerate audio for a news item
       */
      regenerateAudio: async (id: string) => {
        if (get().regeneratingId !== null) return;

        set({ regeneratingId: id, error: null });

        try {
          await adminAPI.regenerateAudio(id);

          set({
            regeneratingId: null,
            cooldownEndTime: Date.now() + 15_000,
          });

          setTimeout(() => {
            set({ cooldownEndTime: null });
            get().fetchNewsItems();
          }, 15_000);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to regenerate audio';
          set({ regeneratingId: null, cooldownEndTime: null, error: message });
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
       * Set country filter, reset to page 1, and re-fetch
       */
      setCountryFilter: (filter: NewsCountry | 'all') => {
        set({ countryFilter: filter, page: 1 });
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
export const selectRegeneratingId = (state: AdminNewsState) => state.regeneratingId;
export const selectCooldownEndTime = (state: AdminNewsState) => state.cooldownEndTime;
export const selectCountryFilter = (state: AdminNewsState) => state.countryFilter;
