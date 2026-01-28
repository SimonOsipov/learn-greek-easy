/**
 * Changelog State Management Store
 *
 * Uses Zustand for state management.
 * Handles public changelog list and pagination for user-facing page.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { changelogAPI } from '@/services/changelogAPI';
import type { ChangelogItem } from '@/types/changelog';

/**
 * Changelog Store State Interface
 */
interface ChangelogState {
  // Data
  items: ChangelogItem[];

  // Pagination
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;

  // Loading state
  isLoading: boolean;

  // Error state
  error: string | null;

  // Actions
  fetchChangelog: (language?: string) => Promise<void>;
  setPage: (page: number, language?: string) => void;
  reset: () => void;
}

/**
 * Initial state for reset functionality
 */
const INITIAL_STATE = {
  items: [] as ChangelogItem[],
  page: 1,
  pageSize: 5,
  total: 0,
  totalPages: 0,
  isLoading: false,
  error: null,
};

/**
 * Changelog store hook for components
 */
export const useChangelogStore = create<ChangelogState>()(
  devtools(
    (set, get) => ({
      ...INITIAL_STATE,

      /**
       * Fetch paginated changelog entries from public API
       */
      fetchChangelog: async (language?: string) => {
        const { page, pageSize } = get();
        set({ isLoading: true, error: null });

        try {
          const response = await changelogAPI.getList(page, pageSize, language);

          set({
            items: response.items,
            total: response.total,
            totalPages: Math.ceil(response.total / response.page_size),
            isLoading: false,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to load changelog';
          set({ isLoading: false, error: message, items: [] });
          throw error;
        }
      },

      /**
       * Set current page and re-fetch
       */
      setPage: (page: number, language?: string) => {
        set({ page });
        get().fetchChangelog(language);
      },

      /**
       * Reset store to initial state
       */
      reset: () => set(INITIAL_STATE),
    }),
    { name: 'changelogStore' }
  )
);

// ============================================
// Selectors (Optional optimization)
// ============================================

export const selectChangelogItems = (state: ChangelogState) => state.items;
export const selectChangelogLoading = (state: ChangelogState) => state.isLoading;
export const selectChangelogError = (state: ChangelogState) => state.error;
export const selectChangelogPage = (state: ChangelogState) => state.page;
export const selectChangelogPageSize = (state: ChangelogState) => state.pageSize;
export const selectChangelogTotal = (state: ChangelogState) => state.total;
export const selectChangelogTotalPages = (state: ChangelogState) => state.totalPages;
