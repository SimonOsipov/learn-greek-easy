/**
 * adminFeedbackStore Tests — FBDR-03 surface area only
 *
 * Tests for the drawer-state additions introduced in FBDR-03:
 * - openFeedbackId + openInnerTab initial state
 * - openDrawer (with and without explicit tab)
 * - closeDrawer (resets both fields)
 * - setInnerTab (transitions)
 * - openDrawer idempotency (re-open while already open)
 *
 * Existing actions (fetchFeedbackList, updateFeedback, deleteFeedback,
 * setSelectedFeedback, etc.) are NOT tested here — out of scope.
 */

import { act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { useAdminFeedbackStore } from '../adminFeedbackStore';

// Mock the API modules so the store can be imported without real network calls
vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    listFeedback: vi.fn(),
    updateFeedback: vi.fn(),
  },
}));

vi.mock('@/services/feedbackAPI', () => ({
  feedbackAPI: {
    delete: vi.fn(),
  },
}));

describe('adminFeedbackStore — drawer state (FBDR-03)', () => {
  beforeEach(() => {
    // Reset drawer state between tests
    useAdminFeedbackStore.setState({
      openFeedbackId: null,
      openInnerTab: 'reply',
    });
    vi.clearAllMocks();
  });

  describe('Initial state', () => {
    it('should have openFeedbackId as null', () => {
      const { openFeedbackId } = useAdminFeedbackStore.getState();
      expect(openFeedbackId).toBeNull();
    });

    it('should have openInnerTab defaulting to "reply"', () => {
      const { openInnerTab } = useAdminFeedbackStore.getState();
      expect(openInnerTab).toBe('reply');
    });
  });

  describe('openDrawer', () => {
    it('should set openFeedbackId to the given id', () => {
      act(() => {
        useAdminFeedbackStore.getState().openDrawer('feedback-123');
      });

      expect(useAdminFeedbackStore.getState().openFeedbackId).toBe('feedback-123');
    });

    it('should default openInnerTab to "reply" when no tab is provided', () => {
      act(() => {
        useAdminFeedbackStore.getState().openDrawer('feedback-123');
      });

      expect(useAdminFeedbackStore.getState().openInnerTab).toBe('reply');
    });

    it('should set openInnerTab to the explicitly provided tab', () => {
      act(() => {
        useAdminFeedbackStore.getState().openDrawer('feedback-456', 'thread');
      });

      const state = useAdminFeedbackStore.getState();
      expect(state.openFeedbackId).toBe('feedback-456');
      expect(state.openInnerTab).toBe('thread');
    });

    it('should set openInnerTab to "meta" when explicitly provided', () => {
      act(() => {
        useAdminFeedbackStore.getState().openDrawer('feedback-789', 'meta');
      });

      expect(useAdminFeedbackStore.getState().openInnerTab).toBe('meta');
    });
  });

  describe('closeDrawer', () => {
    it('should reset openFeedbackId to null', () => {
      useAdminFeedbackStore.setState({ openFeedbackId: 'feedback-123', openInnerTab: 'thread' });

      act(() => {
        useAdminFeedbackStore.getState().closeDrawer();
      });

      expect(useAdminFeedbackStore.getState().openFeedbackId).toBeNull();
    });

    it('should reset openInnerTab back to "reply"', () => {
      useAdminFeedbackStore.setState({ openFeedbackId: 'feedback-123', openInnerTab: 'meta' });

      act(() => {
        useAdminFeedbackStore.getState().closeDrawer();
      });

      expect(useAdminFeedbackStore.getState().openInnerTab).toBe('reply');
    });

    it('should reset both fields together', () => {
      useAdminFeedbackStore.setState({ openFeedbackId: 'feedback-abc', openInnerTab: 'thread' });

      act(() => {
        useAdminFeedbackStore.getState().closeDrawer();
      });

      const state = useAdminFeedbackStore.getState();
      expect(state.openFeedbackId).toBeNull();
      expect(state.openInnerTab).toBe('reply');
    });
  });

  describe('setInnerTab', () => {
    it('should transition from "reply" to "thread"', () => {
      useAdminFeedbackStore.setState({ openFeedbackId: 'feedback-123', openInnerTab: 'reply' });

      act(() => {
        useAdminFeedbackStore.getState().setInnerTab('thread');
      });

      expect(useAdminFeedbackStore.getState().openInnerTab).toBe('thread');
    });

    it('should transition from "thread" to "meta"', () => {
      useAdminFeedbackStore.setState({ openFeedbackId: 'feedback-123', openInnerTab: 'thread' });

      act(() => {
        useAdminFeedbackStore.getState().setInnerTab('meta');
      });

      expect(useAdminFeedbackStore.getState().openInnerTab).toBe('meta');
    });

    it('should transition from "meta" to "reply"', () => {
      useAdminFeedbackStore.setState({ openFeedbackId: 'feedback-123', openInnerTab: 'meta' });

      act(() => {
        useAdminFeedbackStore.getState().setInnerTab('reply');
      });

      expect(useAdminFeedbackStore.getState().openInnerTab).toBe('reply');
    });

    it('should not change openFeedbackId when switching tabs', () => {
      useAdminFeedbackStore.setState({ openFeedbackId: 'feedback-xyz', openInnerTab: 'reply' });

      act(() => {
        useAdminFeedbackStore.getState().setInnerTab('meta');
      });

      expect(useAdminFeedbackStore.getState().openFeedbackId).toBe('feedback-xyz');
    });
  });

  describe('openDrawer idempotency (re-open while already open)', () => {
    it('should update id when drawer is already open for a different feedback', () => {
      useAdminFeedbackStore.setState({ openFeedbackId: 'feedback-1', openInnerTab: 'reply' });

      act(() => {
        useAdminFeedbackStore.getState().openDrawer('feedback-2');
      });

      expect(useAdminFeedbackStore.getState().openFeedbackId).toBe('feedback-2');
    });

    it('should reset tab to "reply" when re-opening without explicit tab', () => {
      useAdminFeedbackStore.setState({ openFeedbackId: 'feedback-1', openInnerTab: 'meta' });

      act(() => {
        useAdminFeedbackStore.getState().openDrawer('feedback-1');
      });

      expect(useAdminFeedbackStore.getState().openInnerTab).toBe('reply');
    });

    it('should preserve the new tab when re-opening with an explicit tab', () => {
      useAdminFeedbackStore.setState({ openFeedbackId: 'feedback-1', openInnerTab: 'reply' });

      act(() => {
        useAdminFeedbackStore.getState().openDrawer('feedback-1', 'thread');
      });

      const state = useAdminFeedbackStore.getState();
      expect(state.openFeedbackId).toBe('feedback-1');
      expect(state.openInnerTab).toBe('thread');
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// FBDR-04: updateFeedbackOptimistic + rollbackFeedback
// ────────────────────────────────────────────────────────────────────────────────

import type { AdminFeedbackItem } from '@/types/feedback';

const MOCK_ITEM: AdminFeedbackItem = {
  id: 'feedback-aaa',
  title: 'Test feedback',
  description: 'Some description',
  category: 'feature_request',
  status: 'new',
  vote_count: 3,
  author: { id: 'user-1', full_name: 'Alice' },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  admin_response: null,
  admin_response_at: null,
};

describe('adminFeedbackStore — optimistic update / rollback (FBDR-04)', () => {
  beforeEach(() => {
    useAdminFeedbackStore.setState({
      feedbackList: [{ ...MOCK_ITEM }],
      selectedFeedback: null,
    });
    vi.clearAllMocks();
  });

  describe('updateFeedbackOptimistic', () => {
    it('merges patch into matching feedbackList item without network call', () => {
      act(() => {
        useAdminFeedbackStore.getState().updateFeedbackOptimistic('feedback-aaa', {
          status: 'planned',
          admin_response: 'Coming soon!',
        });
      });

      const updated = useAdminFeedbackStore
        .getState()
        .feedbackList.find((f) => f.id === 'feedback-aaa');
      expect(updated?.status).toBe('planned');
      expect(updated?.admin_response).toBe('Coming soon!');
    });

    it('preserves unpatched fields on the item', () => {
      act(() => {
        useAdminFeedbackStore
          .getState()
          .updateFeedbackOptimistic('feedback-aaa', { status: 'in_progress' });
      });

      const updated = useAdminFeedbackStore
        .getState()
        .feedbackList.find((f) => f.id === 'feedback-aaa');
      expect(updated?.title).toBe('Test feedback');
      expect(updated?.vote_count).toBe(3);
    });

    it('also merges patch into selectedFeedback when ids match', () => {
      useAdminFeedbackStore.setState({ selectedFeedback: { ...MOCK_ITEM } });

      act(() => {
        useAdminFeedbackStore
          .getState()
          .updateFeedbackOptimistic('feedback-aaa', { status: 'completed' });
      });

      expect(useAdminFeedbackStore.getState().selectedFeedback?.status).toBe('completed');
    });

    it('does not touch selectedFeedback when ids differ', () => {
      useAdminFeedbackStore.setState({
        selectedFeedback: { ...MOCK_ITEM, id: 'feedback-bbb' },
      });

      act(() => {
        useAdminFeedbackStore
          .getState()
          .updateFeedbackOptimistic('feedback-aaa', { status: 'planned' });
      });

      expect(useAdminFeedbackStore.getState().selectedFeedback?.id).toBe('feedback-bbb');
      expect(useAdminFeedbackStore.getState().selectedFeedback?.status).toBe('new');
    });

    it('is a no-op for an id not in the list', () => {
      act(() => {
        useAdminFeedbackStore
          .getState()
          .updateFeedbackOptimistic('feedback-zzz', { status: 'planned' });
      });

      const item = useAdminFeedbackStore
        .getState()
        .feedbackList.find((f) => f.id === 'feedback-aaa');
      expect(item?.status).toBe('new');
    });
  });

  describe('rollbackFeedback', () => {
    it('restores status and admin_response from snapshot', () => {
      // First apply an optimistic update
      act(() => {
        useAdminFeedbackStore.getState().updateFeedbackOptimistic('feedback-aaa', {
          status: 'planned',
          admin_response: 'Draft response',
        });
      });

      // Then roll back
      act(() => {
        useAdminFeedbackStore.getState().rollbackFeedback('feedback-aaa', {
          status: 'new',
          admin_response: null,
        });
      });

      const item = useAdminFeedbackStore
        .getState()
        .feedbackList.find((f) => f.id === 'feedback-aaa');
      expect(item?.status).toBe('new');
      expect(item?.admin_response).toBeNull();
    });

    it('also restores selectedFeedback when ids match', () => {
      useAdminFeedbackStore.setState({
        selectedFeedback: { ...MOCK_ITEM, status: 'planned', admin_response: 'Draft' },
      });

      act(() => {
        useAdminFeedbackStore.getState().rollbackFeedback('feedback-aaa', {
          status: 'new',
          admin_response: null,
        });
      });

      expect(useAdminFeedbackStore.getState().selectedFeedback?.status).toBe('new');
      expect(useAdminFeedbackStore.getState().selectedFeedback?.admin_response).toBeNull();
    });

    it('is a no-op for an id not in the list', () => {
      act(() => {
        useAdminFeedbackStore.getState().rollbackFeedback('feedback-zzz', {
          status: 'new',
          admin_response: null,
        });
      });

      const item = useAdminFeedbackStore
        .getState()
        .feedbackList.find((f) => f.id === 'feedback-aaa');
      expect(item?.status).toBe('new');
    });
  });
});
