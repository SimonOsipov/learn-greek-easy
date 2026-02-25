/**
 * changelogStore Tests
 *
 * Tests for the Zustand changelog store including:
 * - Initial state defaults
 * - fetchChangelog API call and data storage
 * - Client-side pagination via setPage (no API call)
 * - Tag filtering via setTag (resets page to 1)
 * - reset() restores initial state
 */

import { act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { changelogAPI } from '@/services/changelogAPI';
import type { ChangelogItem } from '@/types/changelog';

import { useChangelogStore } from '../changelogStore';

// Mock the changelogAPI
vi.mock('@/services/changelogAPI', () => ({
  changelogAPI: {
    getList: vi.fn(),
  },
}));

// Helper factory for mock items
const createMockItem = (overrides: Partial<ChangelogItem> = {}): ChangelogItem => ({
  id: 'item-1',
  title: 'Test Entry',
  content: 'Test content',
  tag: 'new_feature',
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-01-15T10:00:00Z',
  ...overrides,
});

// Create 12 mock items: 4 new_feature, 4 bug_fix, 4 announcement
const createMockItems = (): ChangelogItem[] => [
  ...Array.from({ length: 4 }, (_, i) =>
    createMockItem({
      id: `new-feature-${i + 1}`,
      tag: 'new_feature',
      title: `New Feature ${i + 1}`,
    })
  ),
  ...Array.from({ length: 4 }, (_, i) =>
    createMockItem({ id: `bug-fix-${i + 1}`, tag: 'bug_fix', title: `Bug Fix ${i + 1}` })
  ),
  ...Array.from({ length: 4 }, (_, i) =>
    createMockItem({
      id: `announcement-${i + 1}`,
      tag: 'announcement',
      title: `Announcement ${i + 1}`,
    })
  ),
];

describe('changelogStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useChangelogStore.getState().reset();
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useChangelogStore.getState();
      expect(state.items).toEqual([]);
      expect(state.allItems).toEqual([]);
      expect(state.activeTag).toBeNull();
      expect(state.page).toBe(1);
      expect(state.pageSize).toBe(5);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.total).toBe(0);
      expect(state.totalPages).toBe(0);
    });
  });

  describe('fetchChangelog', () => {
    it('should call changelogAPI.getList with page=1, pageSize=50, and language', async () => {
      const mockItems = createMockItems();
      vi.mocked(changelogAPI.getList).mockResolvedValue({
        items: mockItems,
        total: mockItems.length,
        page: 1,
        page_size: 50,
      });

      await act(async () => {
        await useChangelogStore.getState().fetchChangelog('en');
      });

      expect(changelogAPI.getList).toHaveBeenCalledWith(1, 50, 'en');
    });

    it('should store fetched items in allItems', async () => {
      const mockItems = createMockItems();
      vi.mocked(changelogAPI.getList).mockResolvedValue({
        items: mockItems,
        total: mockItems.length,
        page: 1,
        page_size: 50,
      });

      await act(async () => {
        await useChangelogStore.getState().fetchChangelog('en');
      });

      expect(useChangelogStore.getState().allItems).toEqual(mockItems);
    });

    it('should derive items/total/totalPages via pagination from allItems', async () => {
      const mockItems = createMockItems(); // 12 items
      vi.mocked(changelogAPI.getList).mockResolvedValue({
        items: mockItems,
        total: mockItems.length,
        page: 1,
        page_size: 50,
      });

      await act(async () => {
        await useChangelogStore.getState().fetchChangelog('en');
      });

      const state = useChangelogStore.getState();
      // pageSize=5, 12 items => 3 pages, page 1 has 5 items
      expect(state.items).toHaveLength(5);
      expect(state.total).toBe(12);
      expect(state.totalPages).toBe(3);
      expect(state.page).toBe(1);
    });

    it('should set isLoading to true during fetch and false after', async () => {
      let resolvePromise: (value: unknown) => void;
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(changelogAPI.getList).mockReturnValue(
        delayedPromise as ReturnType<typeof changelogAPI.getList>
      );

      // Start fetch without awaiting
      const fetchPromise = useChangelogStore.getState().fetchChangelog('en');

      // Should be loading now
      expect(useChangelogStore.getState().isLoading).toBe(true);

      // Resolve the delayed promise
      resolvePromise!({ items: [], total: 0, page: 1, page_size: 50 });
      await fetchPromise;

      expect(useChangelogStore.getState().isLoading).toBe(false);
    });

    it('should set error state when fetch fails', async () => {
      vi.mocked(changelogAPI.getList).mockRejectedValue(new Error('Network error'));

      await expect(
        act(async () => {
          await useChangelogStore.getState().fetchChangelog('en');
        })
      ).rejects.toThrow('Network error');

      const state = useChangelogStore.getState();
      expect(state.error).toBe('Network error');
      expect(state.isLoading).toBe(false);
      expect(state.items).toEqual([]);
      expect(state.allItems).toEqual([]);
    });

    it('should clear error on successful fetch', async () => {
      // Set an error first
      useChangelogStore.setState({ error: 'Previous error' });

      const mockItems = createMockItems();
      vi.mocked(changelogAPI.getList).mockResolvedValue({
        items: mockItems,
        total: mockItems.length,
        page: 1,
        page_size: 50,
      });

      await act(async () => {
        await useChangelogStore.getState().fetchChangelog('en');
      });

      expect(useChangelogStore.getState().error).toBeNull();
    });
  });

  describe('setPage', () => {
    it('should NOT call the API — only slices from allItems', async () => {
      const mockItems = createMockItems(); // 12 items
      // Pre-populate allItems
      useChangelogStore.setState({ allItems: mockItems, total: 12, totalPages: 3 });

      act(() => {
        useChangelogStore.getState().setPage(2);
      });

      expect(changelogAPI.getList).not.toHaveBeenCalled();
    });

    it('should update page and items when setPage(2) is called', () => {
      const mockItems = createMockItems(); // 12 items
      useChangelogStore.setState({ allItems: mockItems });

      act(() => {
        useChangelogStore.getState().setPage(2);
      });

      const state = useChangelogStore.getState();
      expect(state.page).toBe(2);
      // Page 2 with pageSize=5: items 5-9 (indices)
      expect(state.items).toHaveLength(5);
      expect(state.items[0]).toEqual(mockItems[5]);
    });

    it('should show last 2 items on page 3 of 12 items', () => {
      const mockItems = createMockItems(); // 12 items
      useChangelogStore.setState({ allItems: mockItems });

      act(() => {
        useChangelogStore.getState().setPage(3);
      });

      const state = useChangelogStore.getState();
      expect(state.page).toBe(3);
      expect(state.items).toHaveLength(2); // 12 - 10 = 2 items on page 3
    });
  });

  describe('setTag', () => {
    it('should filter allItems to only new_feature entries', () => {
      const mockItems = createMockItems(); // 4 new_feature, 4 bug_fix, 4 announcement
      useChangelogStore.setState({ allItems: mockItems });

      act(() => {
        useChangelogStore.getState().setTag('new_feature');
      });

      const state = useChangelogStore.getState();
      expect(state.activeTag).toBe('new_feature');
      // 4 new_feature items, pageSize=5, all fit on page 1
      expect(state.total).toBe(4);
      expect(state.items).toHaveLength(4);
      state.items.forEach((item) => expect(item.tag).toBe('new_feature'));
    });

    it('should reset page to 1 when tag changes', () => {
      const mockItems = createMockItems();
      useChangelogStore.setState({ allItems: mockItems, page: 3 });

      act(() => {
        useChangelogStore.getState().setTag('bug_fix');
      });

      expect(useChangelogStore.getState().page).toBe(1);
    });

    it('should return all items when setTag(null) is called', () => {
      const mockItems = createMockItems(); // 12 items
      useChangelogStore.setState({ allItems: mockItems, activeTag: 'new_feature' });

      act(() => {
        useChangelogStore.getState().setTag(null);
      });

      const state = useChangelogStore.getState();
      expect(state.activeTag).toBeNull();
      expect(state.total).toBe(12);
      // page 1 with pageSize=5
      expect(state.items).toHaveLength(5);
    });
  });

  describe('reset', () => {
    it('should return to initial state and clear activeTag', async () => {
      // Load some data first
      const mockItems = createMockItems();
      vi.mocked(changelogAPI.getList).mockResolvedValue({
        items: mockItems,
        total: mockItems.length,
        page: 1,
        page_size: 50,
      });

      await act(async () => {
        await useChangelogStore.getState().fetchChangelog('en');
      });

      // Set a tag and page
      act(() => {
        useChangelogStore.getState().setTag('bug_fix');
        useChangelogStore.getState().setPage(1);
      });

      // Now reset
      act(() => {
        useChangelogStore.getState().reset();
      });

      const state = useChangelogStore.getState();
      expect(state.items).toEqual([]);
      expect(state.allItems).toEqual([]);
      expect(state.activeTag).toBeNull();
      expect(state.page).toBe(1);
      expect(state.pageSize).toBe(5);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.total).toBe(0);
      expect(state.totalPages).toBe(0);
    });
  });
});
