/**
 * Admin Changelog Store
 *
 * Zustand store for admin changelog management with CRUD operations.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { changelogAPI } from '@/services/changelogAPI';
import type {
  ChangelogEntryAdmin,
  ChangelogCreateRequest,
  ChangelogUpdateRequest,
} from '@/types/changelog';

interface AdminChangelogState {
  // Data
  items: ChangelogEntryAdmin[];
  selectedEntry: ChangelogEntryAdmin | null;

  // Pagination
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;

  // Loading states
  isLoading: boolean;
  isSaving: boolean;
  isDeleting: boolean;

  // Error state
  error: string | null;

  // Actions
  fetchList: () => Promise<void>;
  fetchById: (id: string) => Promise<ChangelogEntryAdmin | null>;
  createEntry: (data: ChangelogCreateRequest) => Promise<ChangelogEntryAdmin>;
  updateEntry: (id: string, data: ChangelogUpdateRequest) => Promise<ChangelogEntryAdmin>;
  deleteEntry: (id: string) => Promise<void>;
  setSelectedEntry: (entry: ChangelogEntryAdmin | null) => void;
  setPage: (page: number) => void;
  clearError: () => void;
  reset: () => void;
}

const INITIAL_STATE = {
  items: [] as ChangelogEntryAdmin[],
  selectedEntry: null,
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 0,
  isLoading: false,
  isSaving: false,
  isDeleting: false,
  error: null,
};

export const useAdminChangelogStore = create<AdminChangelogState>()(
  devtools(
    (set, get) => ({
      ...INITIAL_STATE,

      fetchList: async () => {
        const { page, pageSize } = get();
        set({ isLoading: true, error: null });

        try {
          const response = await changelogAPI.adminGetList(page, pageSize);
          set({
            items: response.items,
            total: response.total,
            totalPages: Math.ceil(response.total / response.page_size),
            isLoading: false,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to load changelog entries';
          set({ isLoading: false, error: message, items: [] });
          throw error;
        }
      },

      fetchById: async (id: string) => {
        set({ isLoading: true, error: null });

        try {
          const entry = await changelogAPI.adminGetById(id);
          set({ isLoading: false, selectedEntry: entry });
          return entry;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to load changelog entry';
          set({ isLoading: false, error: message });
          throw error;
        }
      },

      createEntry: async (data: ChangelogCreateRequest) => {
        set({ isSaving: true, error: null });

        try {
          const created = await changelogAPI.adminCreate(data);
          set({ page: 1 });
          await get().fetchList();
          set({ isSaving: false });
          return created;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to create changelog entry';
          set({ isSaving: false, error: message });
          throw error;
        }
      },

      updateEntry: async (id: string, data: ChangelogUpdateRequest) => {
        set({ isSaving: true, error: null });

        try {
          const updated = await changelogAPI.adminUpdate(id, data);
          set((state) => ({
            items: state.items.map((item) => (item.id === id ? updated : item)),
            selectedEntry: state.selectedEntry?.id === id ? updated : state.selectedEntry,
            isSaving: false,
          }));
          return updated;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to update changelog entry';
          set({ isSaving: false, error: message });
          throw error;
        }
      },

      deleteEntry: async (id: string) => {
        set({ isDeleting: true, error: null });

        try {
          await changelogAPI.adminDelete(id);
          await get().fetchList();
          set({ isDeleting: false, selectedEntry: null });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to delete changelog entry';
          set({ isDeleting: false, error: message });
          throw error;
        }
      },

      setSelectedEntry: (entry: ChangelogEntryAdmin | null) => {
        set({ selectedEntry: entry });
      },

      setPage: (page: number) => {
        set({ page });
        get().fetchList();
      },

      clearError: () => {
        set({ error: null });
      },

      reset: () => {
        set(INITIAL_STATE);
      },
    }),
    { name: 'adminChangelogStore' }
  )
);

// ============================================
// Selectors (select prefix pattern)
// ============================================

export const selectAdminChangelogItems = (state: AdminChangelogState) => state.items;
export const selectAdminChangelogSelectedEntry = (state: AdminChangelogState) =>
  state.selectedEntry;
export const selectAdminChangelogIsLoading = (state: AdminChangelogState) => state.isLoading;
export const selectAdminChangelogIsSaving = (state: AdminChangelogState) => state.isSaving;
export const selectAdminChangelogIsDeleting = (state: AdminChangelogState) => state.isDeleting;
export const selectAdminChangelogError = (state: AdminChangelogState) => state.error;
export const selectAdminChangelogPage = (state: AdminChangelogState) => state.page;
export const selectAdminChangelogPageSize = (state: AdminChangelogState) => state.pageSize;
export const selectAdminChangelogTotal = (state: AdminChangelogState) => state.total;
export const selectAdminChangelogTotalPages = (state: AdminChangelogState) => state.totalPages;
