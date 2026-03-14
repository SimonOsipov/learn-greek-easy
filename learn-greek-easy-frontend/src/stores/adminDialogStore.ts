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
import type {
  DeckLevel,
  DialogStatus,
  ListeningDialogDetail,
  ListeningDialogListItem,
} from '@/services/adminAPI';

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
  cefrFilter: DeckLevel | null;
  setCefrFilter: (level: DeckLevel | null) => void;
  selectedDialog: ListeningDialogDetail | null;
  isLoadingDetail: boolean;
  detailError: string | null;
  fetchDialogDetail: (id: string) => Promise<void>;
  clearSelectedDialog: () => void;
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
      selectedDialog: null,
      isLoadingDetail: false,
      detailError: null,
      cefrFilter: null,

      fetchDialogs: async () => {
        set({ isLoading: true, error: null });
        try {
          const { page, pageSize, cefrFilter } = get();
          const response = await adminAPI.getListeningDialogs(
            page,
            pageSize,
            undefined,
            cefrFilter ?? undefined
          );
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

      setCefrFilter: (level: DeckLevel | null) => {
        set({ cefrFilter: level, page: 1 });
        get().fetchDialogs();
      },

      fetchDialogDetail: async (id: string) => {
        set({ isLoadingDetail: true, detailError: null });
        try {
          const detail = await adminAPI.getListeningDialogDetail(id);
          set({ selectedDialog: detail, isLoadingDetail: false });
        } catch (error) {
          set({
            detailError: error instanceof Error ? error.message : 'Failed to load dialog details',
            isLoadingDetail: false,
          });
        }
      },
      clearSelectedDialog: () => {
        set({ selectedDialog: null, detailError: null });
      },
    }),
    { name: 'adminDialogStore' }
  )
);

// Re-export type for use in components
export type { DeckLevel, DialogStatus, ListeningDialogDetail, ListeningDialogListItem };
