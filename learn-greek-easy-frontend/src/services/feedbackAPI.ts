// src/services/feedbackAPI.ts

/**
 * Feedback API Service
 *
 * Provides methods for feedback operations including:
 * - Listing feedback with pagination and filtering
 * - Creating feedback
 * - Deleting feedback
 * - Voting operations
 */

import type {
  CreateFeedbackRequest,
  FeedbackItem,
  FeedbackListParams,
  FeedbackListResponse,
  UpdateFeedbackRequest,
  VoteRequest,
  VoteResponse,
} from '@/types/feedback';

import { api, buildQueryString } from './api';

// ============================================
// Feedback API Methods
// ============================================

export const feedbackAPI = {
  /**
   * List feedback with pagination and filters
   */
  getList: async (params: FeedbackListParams = {}): Promise<FeedbackListResponse> => {
    const queryString = buildQueryString({
      category: params.category,
      status: params.status,
      sort: params.sort || 'created_at',
      order: params.order || 'desc',
      page: params.page || 1,
      page_size: params.page_size || 20,
    });
    return api.get<FeedbackListResponse>(`/api/v1/feedback${queryString}`);
  },

  /**
   * Get single feedback by ID
   */
  getById: async (feedbackId: string): Promise<FeedbackItem> => {
    return api.get<FeedbackItem>(`/api/v1/feedback/${feedbackId}`);
  },

  /**
   * Create new feedback
   */
  create: async (data: CreateFeedbackRequest): Promise<FeedbackItem> => {
    return api.post<FeedbackItem>('/api/v1/feedback', data);
  },

  /**
   * Update feedback (own items only)
   */
  update: async (feedbackId: string, data: UpdateFeedbackRequest): Promise<FeedbackItem> => {
    return api.put<FeedbackItem>(`/api/v1/feedback/${feedbackId}`, data);
  },

  /**
   * Delete feedback (own items only)
   */
  delete: async (feedbackId: string): Promise<void> => {
    return api.delete<void>(`/api/v1/feedback/${feedbackId}`);
  },

  /**
   * Vote on feedback (creates or updates vote)
   */
  vote: async (feedbackId: string, voteType: VoteRequest['vote_type']): Promise<VoteResponse> => {
    return api.post<VoteResponse>(`/api/v1/feedback/${feedbackId}/vote`, {
      vote_type: voteType,
    });
  },

  /**
   * Remove vote from feedback
   */
  removeVote: async (feedbackId: string): Promise<VoteResponse> => {
    return api.delete<VoteResponse>(`/api/v1/feedback/${feedbackId}/vote`);
  },
};
