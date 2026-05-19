// src/stores/adminTabCountsStore.ts

/**
 * Admin Tab Counts State Management Store
 *
 * Uses Zustand for state management with admin API integration.
 * Provides aggregate badge counts for each admin tab section.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { AdminTabCountsResponse } from '@/services/adminAPI';
import { adminAPI } from '@/services/adminAPI';

/**
 * Admin Tab Counts Store State Interface
 */
interface AdminTabCountsState {
  counts: AdminTabCountsResponse | null;
  loading: boolean;
  error: string | null;
  fetchCounts: () => Promise<void>;
}

/**
 * Admin Tab Counts store hook for components
 */
export const useAdminTabCountsStore = create<AdminTabCountsState>()(
  devtools(
    (set) => ({
      // Initial state
      counts: null,
      loading: false,
      error: null,

      /**
       * Fetch unified tab badge counts from admin API
       */
      fetchCounts: async () => {
        set({ loading: true, error: null });

        try {
          const counts = await adminAPI.getAdminTabCounts();
          set({ counts, loading: false });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to load tab counts';
          set({ error: message, loading: false });
        }
      },
    }),
    { name: 'AdminTabCountsStore' }
  )
);

// ============================================
// Selectors
// ============================================

export const selectTabCount =
  (key: keyof AdminTabCountsResponse) =>
  (s: AdminTabCountsState): number =>
    s.counts?.[key] ?? 0;
