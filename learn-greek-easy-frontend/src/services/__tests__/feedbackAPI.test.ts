// src/services/__tests__/feedbackAPI.test.ts

/**
 * Feedback API Service Tests
 *
 * Tests for the Feedback API service covering:
 * - getList default query params (and alignment with feedbackStore defaults)
 * - getList explicit params overriding defaults
 * - vote POST body and return value
 * - removeVote DELETE path (distinct from delete)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { feedbackAPI } from '../feedbackAPI';
import { api } from '../api';
import type { FeedbackListResponse, VoteResponse } from '@/types/feedback';

// Mock the api client but keep the real buildQueryString helper, which
// feedbackAPI relies on to assemble the query string.
vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return {
    ...actual,
    api: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  };
});

const emptyListResponse: FeedbackListResponse = {
  total: 0,
  page: 1,
  page_size: 20,
  items: [],
};

describe('feedbackAPI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getList', () => {
    it('should use default query params when called with no args', async () => {
      vi.mocked(api.get).mockResolvedValue(emptyListResponse);

      await feedbackAPI.getList();

      // Defaults: sort=votes (aligned with feedbackStore DEFAULT_FILTERS), order=desc,
      // page=1, page_size=20. category/status are undefined so they are omitted.
      expect(api.get).toHaveBeenCalledWith(
        '/api/v1/feedback?sort=votes&order=desc&page=1&page_size=20'
      );
    });

    it('should default sort to "votes" matching feedbackStore defaults (not created_at)', async () => {
      vi.mocked(api.get).mockResolvedValue(emptyListResponse);

      await feedbackAPI.getList();

      const calledPath = vi.mocked(api.get).mock.calls[0][0] as string;
      const params = new URLSearchParams(calledPath.split('?')[1]);
      expect(params.get('sort')).toBe('votes');
    });

    it('should omit category and status from query string when not provided', async () => {
      vi.mocked(api.get).mockResolvedValue(emptyListResponse);

      await feedbackAPI.getList();

      const calledPath = vi.mocked(api.get).mock.calls[0][0] as string;
      expect(calledPath).not.toContain('category');
      expect(calledPath).not.toContain('status');
    });

    it('should let explicit params override defaults', async () => {
      vi.mocked(api.get).mockResolvedValue(emptyListResponse);

      await feedbackAPI.getList({
        category: 'feature_request',
        status: 'planned',
        sort: 'created_at',
        order: 'asc',
        page: 3,
        page_size: 50,
      });

      const calledPath = vi.mocked(api.get).mock.calls[0][0] as string;
      const params = new URLSearchParams(calledPath.split('?')[1]);
      expect(params.get('category')).toBe('feature_request');
      expect(params.get('status')).toBe('planned');
      expect(params.get('sort')).toBe('created_at');
      expect(params.get('order')).toBe('asc');
      expect(params.get('page')).toBe('3');
      expect(params.get('page_size')).toBe('50');
    });

    it('should return the response from api.get', async () => {
      const response: FeedbackListResponse = {
        total: 1,
        page: 1,
        page_size: 20,
        items: [],
      };
      vi.mocked(api.get).mockResolvedValue(response);

      const result = await feedbackAPI.getList();

      expect(result).toBe(response);
    });

    it('should propagate errors from api.get', async () => {
      vi.mocked(api.get).mockRejectedValue(new Error('Network error'));

      await expect(feedbackAPI.getList()).rejects.toThrow('Network error');
    });
  });

  describe('vote', () => {
    it('should POST to the vote endpoint with the vote_type body', async () => {
      const voteResponse: VoteResponse = {
        feedback_id: 'feedback-1',
        vote_type: 'up',
        new_vote_count: 5,
      };
      vi.mocked(api.post).mockResolvedValue(voteResponse);

      const result = await feedbackAPI.vote('feedback-1', 'up');

      expect(api.post).toHaveBeenCalledWith('/api/v1/feedback/feedback-1/vote', {
        vote_type: 'up',
      });
      expect(result).toBe(voteResponse);
    });

    it('should pass through "down" vote type in the body', async () => {
      const voteResponse: VoteResponse = {
        feedback_id: 'feedback-2',
        vote_type: 'down',
        new_vote_count: -1,
      };
      vi.mocked(api.post).mockResolvedValue(voteResponse);

      await feedbackAPI.vote('feedback-2', 'down');

      expect(api.post).toHaveBeenCalledWith('/api/v1/feedback/feedback-2/vote', {
        vote_type: 'down',
      });
    });

    it('should propagate errors from api.post', async () => {
      vi.mocked(api.post).mockRejectedValue(new Error('Vote failed'));

      await expect(feedbackAPI.vote('feedback-1', 'up')).rejects.toThrow('Vote failed');
    });
  });

  describe('removeVote', () => {
    it('should DELETE the vote sub-resource path (distinct from delete)', async () => {
      const voteResponse: VoteResponse = {
        feedback_id: 'feedback-1',
        vote_type: null,
        new_vote_count: 4,
      };
      vi.mocked(api.delete).mockResolvedValue(voteResponse);

      const result = await feedbackAPI.removeVote('feedback-1');

      // removeVote targets the /vote sub-path, NOT the feedback item itself.
      expect(api.delete).toHaveBeenCalledWith('/api/v1/feedback/feedback-1/vote');
      expect(result).toBe(voteResponse);
    });

    it('should hit a different path than delete()', async () => {
      vi.mocked(api.delete).mockResolvedValue(undefined);

      await feedbackAPI.removeVote('feedback-1');
      await feedbackAPI.delete('feedback-1');

      const removeVotePath = vi.mocked(api.delete).mock.calls[0][0];
      const deletePath = vi.mocked(api.delete).mock.calls[1][0];

      expect(removeVotePath).toBe('/api/v1/feedback/feedback-1/vote');
      expect(deletePath).toBe('/api/v1/feedback/feedback-1');
      expect(removeVotePath).not.toBe(deletePath);
    });

    it('should propagate errors from api.delete', async () => {
      vi.mocked(api.delete).mockRejectedValue(new Error('Remove vote failed'));

      await expect(feedbackAPI.removeVote('feedback-1')).rejects.toThrow('Remove vote failed');
    });
  });

  describe('delete', () => {
    it('should DELETE the feedback item path', async () => {
      vi.mocked(api.delete).mockResolvedValue(undefined);

      await feedbackAPI.delete('feedback-1');

      expect(api.delete).toHaveBeenCalledWith('/api/v1/feedback/feedback-1');
    });
  });
});
