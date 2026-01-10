// src/stores/feedbackStore.ts

/**
 * Feedback State Management Store
 *
 * Uses Zustand for state management with real backend API integration.
 * Handles feedback list, filters, pagination, voting, and form submission.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { feedbackAPI } from '@/services/feedbackAPI';
import type {
  FeedbackItem,
  FeedbackFilters,
  CreateFeedbackRequest,
  UpdateFeedbackRequest,
  VoteResponse,
} from '@/types/feedback';

/**
 * Default filter state
 * Uses null for nullable fields (not undefined) to match FeedbackFilters type
 */
const DEFAULT_FILTERS: FeedbackFilters = {
  category: null,
  status: null,
  sort: 'votes',
  order: 'desc',
};

/**
 * Feedback Store State Interface
 */
interface FeedbackState {
  // Data
  feedbackList: FeedbackItem[];
  selectedFeedback: FeedbackItem | null;

  // Pagination
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;

  // Filters
  filters: FeedbackFilters;

  // Loading states
  isLoading: boolean;
  isSubmitting: boolean;
  isVoting: boolean;
  isDeleting: boolean;

  // Error state
  error: string | null;

  // Actions
  fetchFeedbackList: () => Promise<void>;
  fetchFeedbackById: (id: string) => Promise<void>;
  createFeedback: (data: CreateFeedbackRequest) => Promise<FeedbackItem>;
  updateFeedback: (feedbackId: string, data: UpdateFeedbackRequest) => Promise<FeedbackItem>;
  deleteFeedback: (feedbackId: string) => Promise<void>;
  vote: (feedbackId: string, voteType: 'up' | 'down') => Promise<void>;
  removeVote: (feedbackId: string) => Promise<void>;
  setFilters: (filters: Partial<FeedbackFilters>) => void;
  clearFilters: () => void;
  setPage: (page: number) => void;
  clearError: () => void;
  clearSelection: () => void;
}

/**
 * Feedback store hook for components
 */
export const useFeedbackStore = create<FeedbackState>()(
  devtools(
    (set, get) => ({
      // Initial state
      feedbackList: [],
      selectedFeedback: null,
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
      filters: DEFAULT_FILTERS,
      isLoading: false,
      isSubmitting: false,
      isVoting: false,
      isDeleting: false,
      error: null,

      /**
       * Fetch paginated feedback list from API with current filters
       */
      fetchFeedbackList: async () => {
        const { page, pageSize, filters } = get();
        set({ isLoading: true, error: null });

        try {
          const response = await feedbackAPI.getList({
            page,
            page_size: pageSize,
            // Convert null to undefined for API (null is UI state, undefined means "not set")
            category: filters.category ?? undefined,
            status: filters.status ?? undefined,
            sort: filters.sort,
            order: filters.order,
          });

          set({
            feedbackList: response.items,
            total: response.total,
            // Calculate totalPages since API doesn't return it
            totalPages: Math.ceil(response.total / response.page_size),
            isLoading: false,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to load feedback';
          set({ isLoading: false, error: message, feedbackList: [] });
          throw error;
        }
      },

      /**
       * Fetch single feedback item for detail view
       */
      fetchFeedbackById: async (id: string) => {
        set({ isLoading: true, error: null });

        try {
          const feedback = await feedbackAPI.getById(id);
          set({ selectedFeedback: feedback, isLoading: false });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to load feedback';
          set({ isLoading: false, error: message, selectedFeedback: null });
          throw error;
        }
      },

      /**
       * Submit new feedback and refresh list
       */
      createFeedback: async (data: CreateFeedbackRequest) => {
        set({ isSubmitting: true, error: null });

        try {
          const feedback = await feedbackAPI.create(data);
          // Refresh list to include new item
          await get().fetchFeedbackList();
          set({ isSubmitting: false });
          return feedback;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to submit feedback';
          set({ isSubmitting: false, error: message });
          throw error;
        }
      },

      /**
       * Update existing feedback and update local state
       */
      updateFeedback: async (feedbackId: string, data: UpdateFeedbackRequest) => {
        set({ isSubmitting: true, error: null });

        try {
          const updatedFeedback = await feedbackAPI.update(feedbackId, data);

          // Update the feedback in list and selectedFeedback
          set((state) => ({
            feedbackList: state.feedbackList.map((f) =>
              f.id === feedbackId ? updatedFeedback : f
            ),
            selectedFeedback:
              state.selectedFeedback?.id === feedbackId ? updatedFeedback : state.selectedFeedback,
            isSubmitting: false,
          }));

          return updatedFeedback;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to update feedback';
          set({ isSubmitting: false, error: message });
          throw error;
        }
      },

      /**
       * Delete feedback and update local state
       */
      deleteFeedback: async (feedbackId: string) => {
        set({ isDeleting: true, error: null });

        try {
          await feedbackAPI.delete(feedbackId);

          // Remove the feedback from list and clear selection if it was selected
          set((state) => ({
            feedbackList: state.feedbackList.filter((f) => f.id !== feedbackId),
            selectedFeedback:
              state.selectedFeedback?.id === feedbackId ? null : state.selectedFeedback,
            total: state.total - 1,
            isDeleting: false,
          }));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to delete feedback';
          set({ isDeleting: false, error: message });
          throw error;
        }
      },

      /**
       * Vote on feedback (creates or updates vote)
       * Maps VoteResponse to update local state
       */
      vote: async (feedbackId: string, voteType: 'up' | 'down') => {
        set({ isVoting: true, error: null });

        try {
          const response: VoteResponse = await feedbackAPI.vote(feedbackId, voteType);

          // Map VoteResponse to update feedback in list and selectedFeedback
          set((state) => ({
            feedbackList: state.feedbackList.map((f) =>
              f.id === feedbackId
                ? { ...f, vote_count: response.new_vote_count, user_vote: response.vote_type }
                : f
            ),
            selectedFeedback:
              state.selectedFeedback?.id === feedbackId
                ? {
                    ...state.selectedFeedback,
                    vote_count: response.new_vote_count,
                    user_vote: response.vote_type,
                  }
                : state.selectedFeedback,
            isVoting: false,
          }));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to vote';
          set({ isVoting: false, error: message });
          throw error;
        }
      },

      /**
       * Remove vote from feedback
       * Maps VoteResponse to update local state (vote_type will be null)
       */
      removeVote: async (feedbackId: string) => {
        set({ isVoting: true, error: null });

        try {
          const response: VoteResponse = await feedbackAPI.removeVote(feedbackId);

          // Map VoteResponse to update feedback in list and selectedFeedback
          set((state) => ({
            feedbackList: state.feedbackList.map((f) =>
              f.id === feedbackId
                ? { ...f, vote_count: response.new_vote_count, user_vote: response.vote_type }
                : f
            ),
            selectedFeedback:
              state.selectedFeedback?.id === feedbackId
                ? {
                    ...state.selectedFeedback,
                    vote_count: response.new_vote_count,
                    user_vote: response.vote_type,
                  }
                : state.selectedFeedback,
            isVoting: false,
          }));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to remove vote';
          set({ isVoting: false, error: message });
          throw error;
        }
      },

      /**
       * Update filters and automatically re-fetch feedback
       */
      setFilters: (newFilters: Partial<FeedbackFilters>) => {
        set((state) => ({
          filters: { ...state.filters, ...newFilters },
          page: 1, // Reset to first page on filter change
        }));
        get().fetchFeedbackList();
      },

      /**
       * Reset all filters to defaults
       */
      clearFilters: () => {
        set({ filters: DEFAULT_FILTERS, page: 1 });
        get().fetchFeedbackList();
      },

      /**
       * Set current page and re-fetch
       */
      setPage: (page: number) => {
        set({ page });
        get().fetchFeedbackList();
      },

      /**
       * Clear current error message
       */
      clearError: () => set({ error: null }),

      /**
       * Clear the currently selected feedback
       */
      clearSelection: () => set({ selectedFeedback: null }),
    }),
    { name: 'feedbackStore' }
  )
);

// ============================================
// Selectors (Optional optimization)
// ============================================

export const selectFeedbackList = (state: FeedbackState) => state.feedbackList;
export const selectSelectedFeedback = (state: FeedbackState) => state.selectedFeedback;
export const selectIsLoading = (state: FeedbackState) => state.isLoading;
export const selectIsSubmitting = (state: FeedbackState) => state.isSubmitting;
export const selectIsVoting = (state: FeedbackState) => state.isVoting;
export const selectIsDeleting = (state: FeedbackState) => state.isDeleting;
export const selectError = (state: FeedbackState) => state.error;
export const selectFilters = (state: FeedbackState) => state.filters;
export const selectPagination = (state: FeedbackState) => ({
  page: state.page,
  pageSize: state.pageSize,
  total: state.total,
  totalPages: state.totalPages,
});
