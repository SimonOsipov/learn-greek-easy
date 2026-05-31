/**
 * feedbackStore Tests — test-coverage audit (High tier)
 *
 * Covers:
 * - vote() updates BOTH feedbackList and selectedFeedback, leaves other items untouched
 * - removeVote() nulls user_vote + resets isVoting
 * - fetchFeedbackList() converts null filters to undefined for the API
 * - fetchFeedbackList() derives totalPages from response.page_size (not store pageSize)
 * - setFilters() resets page to 1 and uses a functional set (no stale-overwrite race)
 */

import { act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { feedbackAPI } from '@/services/feedbackAPI';
import type { FeedbackItem, FeedbackListResponse, VoteResponse } from '@/types/feedback';

import { useFeedbackStore } from '../feedbackStore';

// Mock the API module so the store can run without real network calls
vi.mock('@/services/feedbackAPI', () => ({
  feedbackAPI: {
    getList: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    vote: vi.fn(),
    removeVote: vi.fn(),
  },
}));

const makeItem = (overrides: Partial<FeedbackItem> = {}): FeedbackItem => ({
  id: 'fb-1',
  title: 'Test feedback',
  description: 'Some description',
  category: 'feature_request',
  status: 'new',
  vote_count: 5,
  user_vote: null,
  author: { id: 'user-1', full_name: 'Alice' },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  admin_response: null,
  admin_response_at: null,
  ...overrides,
});

// Pristine initial state to restore between tests
const INITIAL_STATE = {
  feedbackList: [] as FeedbackItem[],
  selectedFeedback: null as FeedbackItem | null,
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0,
  filters: { category: null, status: null, sort: 'votes' as const, order: 'desc' as const },
  isLoading: false,
  isSubmitting: false,
  isVoting: false,
  isDeleting: false,
  error: null as string | null,
};

describe('feedbackStore', () => {
  beforeEach(() => {
    useFeedbackStore.setState({ ...INITIAL_STATE });
    vi.clearAllMocks();
  });

  describe('vote', () => {
    it('updates the matching item in feedbackList and leaves other items untouched', async () => {
      const target = makeItem({ id: 'fb-1', vote_count: 5, user_vote: null });
      const other = makeItem({ id: 'fb-2', vote_count: 2, user_vote: 'up' });
      useFeedbackStore.setState({ feedbackList: [target, other] });

      const voteResponse: VoteResponse = {
        feedback_id: 'fb-1',
        vote_type: 'up',
        new_vote_count: 6,
      };
      vi.mocked(feedbackAPI.vote).mockResolvedValue(voteResponse);

      await act(async () => {
        await useFeedbackStore.getState().vote('fb-1', 'up');
      });

      const list = useFeedbackStore.getState().feedbackList;
      const updated = list.find((f) => f.id === 'fb-1');
      const untouched = list.find((f) => f.id === 'fb-2');

      expect(updated?.vote_count).toBe(6);
      expect(updated?.user_vote).toBe('up');
      // Other item must be byte-for-byte unchanged
      expect(untouched?.vote_count).toBe(2);
      expect(untouched?.user_vote).toBe('up');
      expect(untouched).toBe(other);
    });

    it('updates selectedFeedback when its id matches', async () => {
      const item = makeItem({ id: 'fb-1', vote_count: 5, user_vote: null });
      useFeedbackStore.setState({
        feedbackList: [item],
        selectedFeedback: { ...item },
      });

      vi.mocked(feedbackAPI.vote).mockResolvedValue({
        feedback_id: 'fb-1',
        vote_type: 'up',
        new_vote_count: 6,
      });

      await act(async () => {
        await useFeedbackStore.getState().vote('fb-1', 'up');
      });

      const selected = useFeedbackStore.getState().selectedFeedback;
      expect(selected?.vote_count).toBe(6);
      expect(selected?.user_vote).toBe('up');
    });

    it('does not touch selectedFeedback when its id differs', async () => {
      const listItem = makeItem({ id: 'fb-1' });
      const selected = makeItem({ id: 'fb-2', vote_count: 9, user_vote: 'down' });
      useFeedbackStore.setState({
        feedbackList: [listItem],
        selectedFeedback: selected,
      });

      vi.mocked(feedbackAPI.vote).mockResolvedValue({
        feedback_id: 'fb-1',
        vote_type: 'up',
        new_vote_count: 6,
      });

      await act(async () => {
        await useFeedbackStore.getState().vote('fb-1', 'up');
      });

      // selectedFeedback (fb-2) must be untouched
      expect(useFeedbackStore.getState().selectedFeedback).toBe(selected);
      expect(useFeedbackStore.getState().selectedFeedback?.vote_count).toBe(9);
    });

    it('keeps both slices consistent for the same id', async () => {
      const item = makeItem({ id: 'fb-1', vote_count: 5, user_vote: null });
      useFeedbackStore.setState({
        feedbackList: [item],
        selectedFeedback: { ...item },
      });

      vi.mocked(feedbackAPI.vote).mockResolvedValue({
        feedback_id: 'fb-1',
        vote_type: 'up',
        new_vote_count: 6,
      });

      await act(async () => {
        await useFeedbackStore.getState().vote('fb-1', 'up');
      });

      const state = useFeedbackStore.getState();
      const fromList = state.feedbackList.find((f) => f.id === 'fb-1');
      expect(fromList?.vote_count).toBe(state.selectedFeedback?.vote_count);
      expect(fromList?.user_vote).toBe(state.selectedFeedback?.user_vote);
    });

    it('resets isVoting and sets error on failure', async () => {
      useFeedbackStore.setState({ feedbackList: [makeItem({ id: 'fb-1' })] });
      vi.mocked(feedbackAPI.vote).mockRejectedValue(new Error('boom'));

      await expect(
        act(async () => {
          await useFeedbackStore.getState().vote('fb-1', 'up');
        })
      ).rejects.toThrow('boom');

      expect(useFeedbackStore.getState().isVoting).toBe(false);
      expect(useFeedbackStore.getState().error).toBe('boom');
    });
  });

  describe('removeVote', () => {
    it('nulls user_vote and updates vote_count in both slices', async () => {
      const item = makeItem({ id: 'fb-1', vote_count: 6, user_vote: 'up' });
      useFeedbackStore.setState({
        feedbackList: [item],
        selectedFeedback: { ...item },
      });

      const response: VoteResponse = {
        feedback_id: 'fb-1',
        vote_type: null,
        new_vote_count: 5,
      };
      vi.mocked(feedbackAPI.removeVote).mockResolvedValue(response);

      await act(async () => {
        await useFeedbackStore.getState().removeVote('fb-1');
      });

      const state = useFeedbackStore.getState();
      const fromList = state.feedbackList.find((f) => f.id === 'fb-1');
      expect(fromList?.user_vote).toBeNull();
      expect(fromList?.vote_count).toBe(5);
      expect(state.selectedFeedback?.user_vote).toBeNull();
      expect(state.selectedFeedback?.vote_count).toBe(5);
    });

    it('resets isVoting to false after success', async () => {
      useFeedbackStore.setState({ feedbackList: [makeItem({ id: 'fb-1', user_vote: 'up' })] });
      vi.mocked(feedbackAPI.removeVote).mockResolvedValue({
        feedback_id: 'fb-1',
        vote_type: null,
        new_vote_count: 4,
      });

      await act(async () => {
        await useFeedbackStore.getState().removeVote('fb-1');
      });

      expect(useFeedbackStore.getState().isVoting).toBe(false);
    });

    it('leaves non-matching list items untouched', async () => {
      const target = makeItem({ id: 'fb-1', vote_count: 6, user_vote: 'up' });
      const other = makeItem({ id: 'fb-2', vote_count: 3, user_vote: 'down' });
      useFeedbackStore.setState({ feedbackList: [target, other] });

      vi.mocked(feedbackAPI.removeVote).mockResolvedValue({
        feedback_id: 'fb-1',
        vote_type: null,
        new_vote_count: 5,
      });

      await act(async () => {
        await useFeedbackStore.getState().removeVote('fb-1');
      });

      const untouched = useFeedbackStore.getState().feedbackList.find((f) => f.id === 'fb-2');
      expect(untouched).toBe(other);
      expect(untouched?.user_vote).toBe('down');
    });

    it('resets isVoting and sets error on failure', async () => {
      useFeedbackStore.setState({ feedbackList: [makeItem({ id: 'fb-1' })] });
      vi.mocked(feedbackAPI.removeVote).mockRejectedValue(new Error('remove failed'));

      await expect(
        act(async () => {
          await useFeedbackStore.getState().removeVote('fb-1');
        })
      ).rejects.toThrow('remove failed');

      expect(useFeedbackStore.getState().isVoting).toBe(false);
      expect(useFeedbackStore.getState().error).toBe('remove failed');
    });
  });

  describe('fetchFeedbackList', () => {
    it('converts null category/status filters to undefined for the API call', async () => {
      useFeedbackStore.setState({
        filters: { category: null, status: null, sort: 'votes', order: 'desc' },
      });

      const response: FeedbackListResponse = {
        total: 0,
        page: 1,
        page_size: 20,
        items: [],
      };
      vi.mocked(feedbackAPI.getList).mockResolvedValue(response);

      await act(async () => {
        await useFeedbackStore.getState().fetchFeedbackList();
      });

      expect(feedbackAPI.getList).toHaveBeenCalledWith(
        expect.objectContaining({
          category: undefined,
          status: undefined,
          sort: 'votes',
          order: 'desc',
        })
      );
      // Ensure null was NOT passed through
      const callArg = vi.mocked(feedbackAPI.getList).mock.calls[0][0];
      expect(callArg?.category).toBeUndefined();
      expect(callArg?.status).toBeUndefined();
    });

    it('passes set filter values through unchanged', async () => {
      useFeedbackStore.setState({
        filters: {
          category: 'bug_incorrect_data',
          status: 'planned',
          sort: 'created_at',
          order: 'asc',
        },
      });

      vi.mocked(feedbackAPI.getList).mockResolvedValue({
        total: 0,
        page: 1,
        page_size: 20,
        items: [],
      });

      await act(async () => {
        await useFeedbackStore.getState().fetchFeedbackList();
      });

      expect(feedbackAPI.getList).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'bug_incorrect_data',
          status: 'planned',
          sort: 'created_at',
          order: 'asc',
        })
      );
    });

    it('derives totalPages from response.page_size, not the store pageSize', async () => {
      // Store pageSize is 20, but the API echoes a different page_size (10)
      useFeedbackStore.setState({ pageSize: 20 });

      vi.mocked(feedbackAPI.getList).mockResolvedValue({
        total: 25,
        page: 1,
        page_size: 10,
        items: [],
      });

      await act(async () => {
        await useFeedbackStore.getState().fetchFeedbackList();
      });

      // ceil(25 / 10) = 3, not ceil(25 / 20) = 2
      expect(useFeedbackStore.getState().totalPages).toBe(3);
      expect(useFeedbackStore.getState().total).toBe(25);
    });

    it('stores items and clears loading on success', async () => {
      const items = [makeItem({ id: 'fb-1' }), makeItem({ id: 'fb-2' })];
      vi.mocked(feedbackAPI.getList).mockResolvedValue({
        total: 2,
        page: 1,
        page_size: 20,
        items,
      });

      await act(async () => {
        await useFeedbackStore.getState().fetchFeedbackList();
      });

      const state = useFeedbackStore.getState();
      expect(state.feedbackList).toHaveLength(2);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('clears the list and sets error on failure', async () => {
      useFeedbackStore.setState({ feedbackList: [makeItem({ id: 'fb-1' })] });
      vi.mocked(feedbackAPI.getList).mockRejectedValue(new Error('fetch failed'));

      await expect(
        act(async () => {
          await useFeedbackStore.getState().fetchFeedbackList();
        })
      ).rejects.toThrow('fetch failed');

      const state = useFeedbackStore.getState();
      expect(state.feedbackList).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('fetch failed');
    });
  });

  describe('setFilters', () => {
    beforeEach(() => {
      // setFilters triggers fetchFeedbackList; give it a benign resolved value
      vi.mocked(feedbackAPI.getList).mockResolvedValue({
        total: 0,
        page: 1,
        page_size: 20,
        items: [],
      });
    });

    it('merges the partial filter into existing filters', async () => {
      useFeedbackStore.setState({
        filters: { category: null, status: 'new', sort: 'votes', order: 'desc' },
      });

      await act(async () => {
        useFeedbackStore.getState().setFilters({ category: 'feature_request' });
      });

      const filters = useFeedbackStore.getState().filters;
      expect(filters.category).toBe('feature_request');
      // Existing status preserved
      expect(filters.status).toBe('new');
      expect(filters.sort).toBe('votes');
    });

    it('resets page to 1', async () => {
      useFeedbackStore.setState({ page: 5 });

      await act(async () => {
        useFeedbackStore.getState().setFilters({ status: 'completed' });
      });

      expect(useFeedbackStore.getState().page).toBe(1);
    });

    it('does not overwrite a concurrent filter change (functional set, no stale race)', async () => {
      useFeedbackStore.setState({
        filters: { category: null, status: null, sort: 'votes', order: 'desc' },
      });

      // Two back-to-back partial updates touching different fields.
      // A functional set merges both; a stale-snapshot set would drop the first.
      await act(async () => {
        useFeedbackStore.getState().setFilters({ category: 'feature_request' });
        useFeedbackStore.getState().setFilters({ status: 'planned' });
      });

      const filters = useFeedbackStore.getState().filters;
      expect(filters.category).toBe('feature_request');
      expect(filters.status).toBe('planned');
    });

    it('triggers a re-fetch with the merged filters', async () => {
      useFeedbackStore.setState({
        filters: { category: null, status: null, sort: 'votes', order: 'desc' },
      });

      await act(async () => {
        useFeedbackStore.getState().setFilters({ category: 'bug_incorrect_data' });
      });

      expect(feedbackAPI.getList).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'bug_incorrect_data', page: 1 })
      );
    });
  });
});
