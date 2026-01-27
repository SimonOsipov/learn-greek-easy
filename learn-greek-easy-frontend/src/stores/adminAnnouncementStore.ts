// src/stores/adminAnnouncementStore.ts

/**
 * Admin Announcement State Management Store
 *
 * Uses Zustand for state management with admin API integration.
 * Handles announcement list, pagination, and detail view.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { AnnouncementItem, AnnouncementDetailResponse } from '@/services/adminAPI';
import { adminAPI } from '@/services/adminAPI';

/**
 * Admin Announcement Store State Interface
 */
interface AdminAnnouncementState {
  // Data
  announcements: AnnouncementItem[];
  selectedAnnouncement: AnnouncementDetailResponse | null;

  // Pagination
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;

  // Loading states
  isLoading: boolean;
  isLoadingDetail: boolean;

  // Error state
  error: string | null;

  // Actions
  fetchAnnouncements: () => Promise<void>;
  fetchAnnouncementDetail: (id: string) => Promise<void>;
  setPage: (page: number) => void;
  clearSelectedAnnouncement: () => void;
  clearError: () => void;
  refresh: () => Promise<void>;
}

/**
 * Admin Announcement store hook for components
 */
export const useAdminAnnouncementStore = create<AdminAnnouncementState>()(
  devtools(
    (set, get) => ({
      // Initial state
      announcements: [],
      selectedAnnouncement: null,
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0,
      isLoading: false,
      isLoadingDetail: false,
      error: null,

      /**
       * Fetch paginated announcement list from admin API
       */
      fetchAnnouncements: async () => {
        const { page, pageSize } = get();
        set({ isLoading: true, error: null });

        try {
          const response = await adminAPI.getAnnouncements(page, pageSize);

          set({
            announcements: response.items,
            total: response.total,
            totalPages: Math.ceil(response.total / response.page_size),
            isLoading: false,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to load announcements';
          set({ isLoading: false, error: message, announcements: [] });
          throw error;
        }
      },

      /**
       * Fetch single announcement detail
       */
      fetchAnnouncementDetail: async (id: string) => {
        set({ isLoadingDetail: true, error: null });

        try {
          const announcement = await adminAPI.getAnnouncementDetail(id);
          set({ selectedAnnouncement: announcement, isLoadingDetail: false });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to load announcement details';
          set({ isLoadingDetail: false, error: message, selectedAnnouncement: null });
          throw error;
        }
      },

      /**
       * Set current page and re-fetch
       */
      setPage: (page: number) => {
        set({ page });
        get().fetchAnnouncements();
      },

      /**
       * Clear selected announcement (close detail modal)
       */
      clearSelectedAnnouncement: () => set({ selectedAnnouncement: null }),

      /**
       * Clear current error message
       */
      clearError: () => set({ error: null }),

      /**
       * Refresh the announcement list (useful after creating a new announcement)
       */
      refresh: async () => {
        // Reset to first page and fetch
        set({ page: 1 });
        await get().fetchAnnouncements();
      },
    }),
    { name: 'adminAnnouncementStore' }
  )
);

// ============================================
// Selectors (Optional optimization)
// ============================================

export const selectAnnouncements = (state: AdminAnnouncementState) => state.announcements;
export const selectSelectedAnnouncement = (state: AdminAnnouncementState) =>
  state.selectedAnnouncement;
export const selectIsLoading = (state: AdminAnnouncementState) => state.isLoading;
export const selectIsLoadingDetail = (state: AdminAnnouncementState) => state.isLoadingDetail;
export const selectError = (state: AdminAnnouncementState) => state.error;
export const selectPagination = (state: AdminAnnouncementState) => ({
  page: state.page,
  pageSize: state.pageSize,
  total: state.total,
  totalPages: state.totalPages,
});
