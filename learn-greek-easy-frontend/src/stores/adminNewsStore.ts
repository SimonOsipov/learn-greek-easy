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
  NewsItemCreate,
  NewsItemResponse,
  NewsItemUpdate,
  NewsItemWithCardResponse,
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
  audioCount: number;

  // Loading states
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;

  // Error state
  error: string | null;

  // Filters
  countryFilter: NewsCountry | 'all';
  levelFilter: 'all' | 'B2' | 'A2' | 'B1';
  searchQuery: string;
  sortMode: 'newest' | 'oldest' | 'updated';

  // Drawer state
  drawerItemId: string | null;

  // Actions
  fetchNewsItems: () => Promise<void>;
  createNewsItem: (data: NewsItemCreate) => Promise<NewsItemWithCardResponse>;
  updateNewsItem: (id: string, data: NewsItemUpdate) => Promise<NewsItemResponse>;
  deleteNewsItem: (id: string) => Promise<void>;
  setPage: (page: number) => void;
  setSelectedItem: (item: NewsItemResponse | null) => void;
  setCountryFilter: (filter: NewsCountry | 'all') => void;
  setLevelFilter: (level: 'all' | 'B2' | 'A2' | 'B1') => void;
  setSearchQuery: (q: string) => void;
  setSortMode: (mode: 'newest' | 'oldest' | 'updated') => void;
  openDrawer: (id: string) => void;
  closeDrawer: () => void;
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
      audioCount: 0,
      isLoading: false,
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
      error: null,
      countryFilter: 'all' as NewsCountry | 'all',
      levelFilter: 'all' as 'all' | 'B2' | 'A2' | 'B1',
      searchQuery: '',
      sortMode: 'newest' as 'newest' | 'oldest' | 'updated',
      drawerItemId: null,

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
            audioCount: response.audio_count,
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
      createNewsItem: async (data: NewsItemCreate) => {
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
       * Set country filter, reset to page 1, and re-fetch
       */
      setCountryFilter: (filter: NewsCountry | 'all') => {
        set({ countryFilter: filter, page: 1 });
        get().fetchNewsItems();
      },

      /**
       * Set level filter and reset to page 1 (client-side filter, no auto-fetch)
       */
      setLevelFilter: (level: 'all' | 'B2' | 'A2' | 'B1') => {
        set({ levelFilter: level, page: 1 });
      },

      /**
       * Set search query and reset to page 1 (client-side filter, no auto-fetch)
       */
      setSearchQuery: (q: string) => {
        set({ searchQuery: q, page: 1 });
      },

      /**
       * Set sort mode and reset to page 1 (client-side sort, no auto-fetch)
       */
      setSortMode: (mode: 'newest' | 'oldest' | 'updated') => {
        set({ sortMode: mode, page: 1 });
      },

      /**
       * Open drawer for a specific news item by id
       */
      openDrawer: (id: string) => {
        set({ drawerItemId: id });
      },

      /**
       * Close drawer
       */
      closeDrawer: () => {
        set({ drawerItemId: null });
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
export const selectCountryFilter = (state: AdminNewsState) => state.countryFilter;
export const selectFilterState = (state: AdminNewsState) => ({
  countryFilter: state.countryFilter,
  levelFilter: state.levelFilter,
  searchQuery: state.searchQuery,
  sortMode: state.sortMode,
});
export const selectDrawerState = (state: AdminNewsState) => ({
  drawerItemId: state.drawerItemId,
});
export const selectFilteredNewsItems = (state: AdminNewsState): NewsItemResponse[] => {
  let items = state.newsItems;

  // 1. Country filter (server-managed field, but also available client-side)
  if (state.countryFilter !== 'all') {
    items = items.filter((item) => item.country === state.countryFilter);
  }

  // 2. Level filter
  if (state.levelFilter !== 'all') {
    if (state.levelFilter === 'B2') {
      items = items.filter((item) => item.description_el != null && item.description_el !== '');
    } else if (state.levelFilter === 'A2') {
      items = items.filter(
        (item) => item.description_el_a2 != null && item.description_el_a2 !== ''
      );
    } else if (state.levelFilter === 'B1') {
      // B1 never matches in MVP
      return [];
    }
  }

  // 3. Search filter (case-insensitive substring across EL/EN/RU titles)
  if (state.searchQuery !== '') {
    const q = state.searchQuery.toLowerCase();
    items = items.filter(
      (item) =>
        (item.title_el ?? '').toLowerCase().includes(q) ||
        (item.title_en ?? '').toLowerCase().includes(q) ||
        (item.title_ru ?? '').toLowerCase().includes(q)
    );
  }

  // 4. Sort (ISO strings sort lexically for dates, so string comparison is sufficient)
  const sorted = [...items];
  if (state.sortMode === 'newest') {
    sorted.sort((a, b) => (a.publication_date < b.publication_date ? 1 : -1));
  } else if (state.sortMode === 'oldest') {
    sorted.sort((a, b) => (a.publication_date > b.publication_date ? 1 : -1));
  } else if (state.sortMode === 'updated') {
    sorted.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  }

  return sorted;
};
