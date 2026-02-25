/**
 * Changelog State Management Store
 *
 * Uses Zustand for state management.
 * Handles public changelog list and pagination for user-facing page.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { changelogAPI } from '@/services/changelogAPI';
import type { ChangelogItem, ChangelogTag } from '@/types/changelog';

/**
 * Changelog Store State Interface
 */
interface ChangelogState {
  // Data
  items: ChangelogItem[];
  allItems: ChangelogItem[];

  // Filter
  activeTag: ChangelogTag | null;

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
  setPage: (page: number) => void;
  setTag: (tag: ChangelogTag | null) => void;
  reset: () => void;
}

/**
 * Initial state for reset functionality
 */
const INITIAL_STATE = {
  items: [] as ChangelogItem[],
  allItems: [] as ChangelogItem[],
  activeTag: null as ChangelogTag | null,
  page: 1,
  pageSize: 5,
  total: 0,
  totalPages: 0,
  isLoading: false,
  error: null,
};

/** Derive paginated items from allItems + activeTag + page.
 * NOTE: Backend enforces page_size <= 50. If >50 entries exist, only newest 50 are fetched. */
function derivePagedState(
  allItems: ChangelogItem[],
  activeTag: ChangelogTag | null,
  page: number,
  pageSize: number
) {
  const filtered = activeTag ? allItems.filter((item) => item.tag === activeTag) : allItems;
  const filteredTotal = filtered.length;
  const filteredTotalPages = Math.ceil(filteredTotal / pageSize);
  const safePage = Math.min(page, Math.max(filteredTotalPages, 1));
  const start = (safePage - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize),
    total: filteredTotal,
    totalPages: filteredTotalPages,
    page: safePage,
  };
}

/**
 * Changelog store hook for components
 */
export const useChangelogStore = create<ChangelogState>()(
  devtools(
    (set, get) => ({
      ...INITIAL_STATE,

      /**
       * Fetch all changelog entries from public API, then derive paginated view
       */
      fetchChangelog: async (language?: string) => {
        set({ isLoading: true, error: null });
        try {
          // Fetch ALL entries (backend hard max = 50)
          const response = await changelogAPI.getList(1, 50, language);
          const { activeTag, page, pageSize } = get();
          const derived = derivePagedState(response.items, activeTag, page, pageSize);
          set({
            allItems: response.items,
            ...derived,
            isLoading: false,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to load changelog';
          set({ isLoading: false, error: message, items: [], allItems: [] });
          throw error;
        }
      },

      /**
       * Set current page (client-side only, no API call)
       */
      setPage: (page: number) => {
        const { allItems, activeTag, pageSize } = get();
        const derived = derivePagedState(allItems, activeTag, page, pageSize);
        set(derived);
      },

      /**
       * Set active tag filter and reset to page 1
       */
      setTag: (tag: ChangelogTag | null) => {
        const { allItems, pageSize } = get();
        const derived = derivePagedState(allItems, tag, 1, pageSize); // always page 1
        set({ activeTag: tag, ...derived });
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
export const selectActiveTag = (state: ChangelogState) => state.activeTag;
export const selectAllItems = (state: ChangelogState) => state.allItems;
