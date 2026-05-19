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

// Monotonic counter shared across all in-flight fetchCounts() invocations.
// Each call captures the current value and only commits its result if it is
// still the latest — protects against out-of-order responses from concurrent
// fire-and-forget refetches overwriting newer state.
let tabCountsFetchSeq = 0;

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
        const fetchSeq = ++tabCountsFetchSeq;
        set({ loading: true, error: null });

        try {
          const counts = await adminAPI.getAdminTabCounts();
          if (fetchSeq !== tabCountsFetchSeq) return;
          set({ counts, loading: false });
        } catch (error) {
          if (fetchSeq !== tabCountsFetchSeq) return;
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

// ============================================
// Fire-and-forget refetch helper
// ============================================

/**
 * Call from admin mutation success paths to keep tab badge counts in sync.
 * Fire-and-forget — does not block the calling action's UX flow.
 */
export const refetchAdminTabCounts = (): void => {
  void useAdminTabCountsStore.getState().fetchCounts();
};
