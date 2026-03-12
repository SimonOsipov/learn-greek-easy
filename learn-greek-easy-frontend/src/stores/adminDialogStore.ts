// src/stores/adminDialogStore.ts

/**
 * Admin Dialog State Management Store
 *
 * Uses Zustand for state management with admin API integration.
 * Handles admin listening dialog list, pagination, and delete operations.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { adminAPI } from '@/services/adminAPI';
import type { DialogStatus, ListeningDialogListItem } from '@/services/adminAPI';

interface AdminDialogState {
  dialogs: ListeningDialogListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  isLoading: boolean;
  isDeleting: boolean;
  isCreating: boolean;
  error: string | null;
  fetchDialogs: () => Promise<void>;
  deleteDialog: (id: string) => Promise<void>;
  createDialog: (jsonPayload: string) => Promise<void>;
  setPage: (page: number) => void;
  clearError: () => void;
}

export const useAdminDialogStore = create<AdminDialogState>()(
  devtools(
    (set, get) => ({
      dialogs: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
      isLoading: false,
      isDeleting: false,
      isCreating: false,
      error: null,

      fetchDialogs: async () => {
        set({ isLoading: true, error: null });
        try {
          const { page, pageSize } = get();
          const response = await adminAPI.getListeningDialogs(page, pageSize);
          set({
            dialogs: response.items,
            total: response.total,
            totalPages: Math.ceil(response.total / response.page_size),
            isLoading: false,
          });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Failed to fetch dialogs',
            isLoading: false,
          });
        }
      },

      deleteDialog: async (id: string) => {
        set({ isDeleting: true, error: null });
        try {
          await adminAPI.deleteListeningDialog(id);
          set({ isDeleting: false });
          await get().fetchDialogs();
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Failed to delete dialog',
            isDeleting: false,
          });
          throw err;
        }
      },

      createDialog: async (jsonPayload: string) => {
        set({ isCreating: true, error: null });
        try {
          const parsed = JSON.parse(jsonPayload);
          await adminAPI.createListeningDialog(parsed);
          set({ isCreating: false });
          await get().fetchDialogs();
        } catch (err) {
          set({ isCreating: false });
          throw err;
        }
      },

      setPage: (page: number) => {
        set({ page });
        get().fetchDialogs();
      },

      clearError: () => set({ error: null }),
    }),
    { name: 'adminDialogStore' }
  )
);

// Re-export type for use in components
export type { DialogStatus, ListeningDialogListItem };
