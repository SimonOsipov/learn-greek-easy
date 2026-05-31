/**
 * adminAnnouncementStore Tests
 *
 * Covers:
 * - deleteAnnouncement rejection does NOT mutate state (no-rollback gap: nothing
 *   to roll back because state is only written on success)
 * - deleteAnnouncement success removes item, decrements total, calls refetch
 * - totalPages is derived from response.page_size (not store's pageSize)
 * - refresh() resets page to 1 before fetching
 * - initial defaults
 * - clearSelectedAnnouncement / clearError
 */

import { act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { useAdminAnnouncementStore, selectPagination } from '../adminAnnouncementStore';

// Mock adminAPI so no real network calls are made
vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    getAnnouncements: vi.fn(),
    getAnnouncementDetail: vi.fn(),
    deleteAnnouncement: vi.fn(),
  },
}));

// Mock adminTabCountsStore — refetchAdminTabCounts is a module-level side-effect
vi.mock('@/stores/adminTabCountsStore', () => ({
  refetchAdminTabCounts: vi.fn(),
}));

// Import mock references AFTER vi.mock is hoisted
import { adminAPI } from '@/services/adminAPI';
import { refetchAdminTabCounts } from '@/stores/adminTabCountsStore';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeAnnouncement(
  overrides: Partial<{
    id: string;
    title: string;
    message: string;
    link_url: string | null;
    total_recipients: number;
    read_count: number;
    created_at: string;
  }> = {}
) {
  return {
    id: overrides.id ?? 'ann-1',
    title: overrides.title ?? 'Test Announcement',
    message: overrides.message ?? 'Hello everyone',
    link_url: overrides.link_url ?? null,
    total_recipients: overrides.total_recipients ?? 100,
    read_count: overrides.read_count ?? 10,
    created_at: overrides.created_at ?? '2024-01-01T00:00:00Z',
  };
}

function makeListResponse(
  overrides: Partial<{
    items: ReturnType<typeof makeAnnouncement>[];
    total: number;
    page: number;
    page_size: number;
  }> = {}
) {
  const items = overrides.items ?? [makeAnnouncement()];
  return {
    items,
    total: overrides.total ?? items.length,
    page: overrides.page ?? 1,
    page_size: overrides.page_size ?? 10,
  };
}

const INITIAL_STATE = {
  announcements: [],
  selectedAnnouncement: null,
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 0,
  isLoading: false,
  isLoadingDetail: false,
  isDeleting: false,
  error: null,
};

// ─── tests ──────────────────────────────────────────────────────────────────

describe('adminAnnouncementStore', () => {
  beforeEach(() => {
    useAdminAnnouncementStore.setState(INITIAL_STATE);
    vi.clearAllMocks();
  });

  // ============================================================
  // Initial state
  // ============================================================
  describe('Initial state', () => {
    it('has empty announcements list', () => {
      expect(useAdminAnnouncementStore.getState().announcements).toEqual([]);
    });

    it('has page=1, pageSize=10', () => {
      const state = useAdminAnnouncementStore.getState();
      expect(state.page).toBe(1);
      expect(state.pageSize).toBe(10);
    });

    it('has total=0, totalPages=0', () => {
      const state = useAdminAnnouncementStore.getState();
      expect(state.total).toBe(0);
      expect(state.totalPages).toBe(0);
    });

    it('has all loading flags false', () => {
      const state = useAdminAnnouncementStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.isLoadingDetail).toBe(false);
      expect(state.isDeleting).toBe(false);
    });

    it('has error=null', () => {
      expect(useAdminAnnouncementStore.getState().error).toBeNull();
    });

    it('has selectedAnnouncement=null', () => {
      expect(useAdminAnnouncementStore.getState().selectedAnnouncement).toBeNull();
    });
  });

  // ============================================================
  // fetchAnnouncements — totalPages derived from response.page_size
  // ============================================================
  describe('fetchAnnouncements()', () => {
    it('sets announcements, total, and totalPages from response', async () => {
      const items = [makeAnnouncement({ id: 'a1' }), makeAnnouncement({ id: 'a2' })];
      const response = makeListResponse({ items, total: 25, page_size: 10 });
      vi.mocked(adminAPI.getAnnouncements).mockResolvedValueOnce(response);

      await act(async () => {
        await useAdminAnnouncementStore.getState().fetchAnnouncements();
      });

      const state = useAdminAnnouncementStore.getState();
      expect(state.announcements).toHaveLength(2);
      expect(state.total).toBe(25);
      // totalPages = ceil(25 / 10) = 3
      expect(state.totalPages).toBe(3);
    });

    it('derives totalPages from response.page_size, not store.pageSize', async () => {
      // Store has pageSize=10 but response uses page_size=5
      useAdminAnnouncementStore.setState({ pageSize: 10 });
      const items = [makeAnnouncement({ id: 'b1' })];
      const response = makeListResponse({ items, total: 20, page_size: 5 });
      vi.mocked(adminAPI.getAnnouncements).mockResolvedValueOnce(response);

      await act(async () => {
        await useAdminAnnouncementStore.getState().fetchAnnouncements();
      });

      // totalPages should be ceil(20/5)=4, not ceil(20/10)=2
      expect(useAdminAnnouncementStore.getState().totalPages).toBe(4);
    });

    it('sets totalPages=1 when total equals page_size exactly', async () => {
      const items = [makeAnnouncement()];
      const response = makeListResponse({ items, total: 10, page_size: 10 });
      vi.mocked(adminAPI.getAnnouncements).mockResolvedValueOnce(response);

      await act(async () => {
        await useAdminAnnouncementStore.getState().fetchAnnouncements();
      });

      expect(useAdminAnnouncementStore.getState().totalPages).toBe(1);
    });

    it('sets totalPages=0 when total=0', async () => {
      const response = makeListResponse({ items: [], total: 0, page_size: 10 });
      vi.mocked(adminAPI.getAnnouncements).mockResolvedValueOnce(response);

      await act(async () => {
        await useAdminAnnouncementStore.getState().fetchAnnouncements();
      });

      expect(useAdminAnnouncementStore.getState().totalPages).toBe(0);
    });

    it('clears isLoading on success', async () => {
      vi.mocked(adminAPI.getAnnouncements).mockResolvedValueOnce(
        makeListResponse({ items: [], total: 0, page_size: 10 })
      );

      await act(async () => {
        await useAdminAnnouncementStore.getState().fetchAnnouncements();
      });

      expect(useAdminAnnouncementStore.getState().isLoading).toBe(false);
    });

    it('sets error and clears announcements on failure', async () => {
      vi.mocked(adminAPI.getAnnouncements).mockRejectedValueOnce(new Error('Network error'));
      useAdminAnnouncementStore.setState({ announcements: [makeAnnouncement()] as any });

      await act(async () => {
        await expect(useAdminAnnouncementStore.getState().fetchAnnouncements()).rejects.toThrow(
          'Network error'
        );
      });

      const state = useAdminAnnouncementStore.getState();
      expect(state.error).toBe('Network error');
      expect(state.announcements).toEqual([]);
      expect(state.isLoading).toBe(false);
    });

    it('passes explicit page and pageSize to the API', async () => {
      vi.mocked(adminAPI.getAnnouncements).mockResolvedValueOnce(
        makeListResponse({ items: [], total: 0, page_size: 5 })
      );

      await act(async () => {
        await useAdminAnnouncementStore.getState().fetchAnnouncements(2, 5);
      });

      expect(adminAPI.getAnnouncements).toHaveBeenCalledWith(2, 5);
    });

    it('falls back to store page/pageSize when none are passed', async () => {
      useAdminAnnouncementStore.setState({ page: 3, pageSize: 20 });
      vi.mocked(adminAPI.getAnnouncements).mockResolvedValueOnce(
        makeListResponse({ items: [], total: 0, page_size: 20 })
      );

      await act(async () => {
        await useAdminAnnouncementStore.getState().fetchAnnouncements();
      });

      expect(adminAPI.getAnnouncements).toHaveBeenCalledWith(3, 20);
    });
  });

  // ============================================================
  // deleteAnnouncement — rejection does NOT mutate state
  // ============================================================
  describe('deleteAnnouncement() — rejection (no-rollback gap)', () => {
    it('does NOT remove the item from announcements when API rejects', async () => {
      const ann = makeAnnouncement({ id: 'ann-to-delete' });
      useAdminAnnouncementStore.setState({
        announcements: [ann] as any,
        total: 1,
      });
      vi.mocked(adminAPI.deleteAnnouncement).mockRejectedValueOnce(new Error('Server error'));

      await act(async () => {
        await expect(
          useAdminAnnouncementStore.getState().deleteAnnouncement('ann-to-delete')
        ).rejects.toThrow('Server error');
      });

      const state = useAdminAnnouncementStore.getState();
      expect(state.announcements).toHaveLength(1);
      expect(state.announcements[0].id).toBe('ann-to-delete');
    });

    it('does NOT decrement total when API rejects', async () => {
      const ann = makeAnnouncement({ id: 'ann-x' });
      useAdminAnnouncementStore.setState({ announcements: [ann] as any, total: 5 });
      vi.mocked(adminAPI.deleteAnnouncement).mockRejectedValueOnce(new Error('fail'));

      await act(async () => {
        await expect(
          useAdminAnnouncementStore.getState().deleteAnnouncement('ann-x')
        ).rejects.toThrow();
      });

      expect(useAdminAnnouncementStore.getState().total).toBe(5);
    });

    it('resets isDeleting to false after rejection', async () => {
      const ann = makeAnnouncement({ id: 'ann-y' });
      useAdminAnnouncementStore.setState({ announcements: [ann] as any, total: 1 });
      vi.mocked(adminAPI.deleteAnnouncement).mockRejectedValueOnce(new Error('fail'));

      await act(async () => {
        await expect(
          useAdminAnnouncementStore.getState().deleteAnnouncement('ann-y')
        ).rejects.toThrow();
      });

      expect(useAdminAnnouncementStore.getState().isDeleting).toBe(false);
    });

    it('does NOT call refetchAdminTabCounts when API rejects', async () => {
      const ann = makeAnnouncement({ id: 'ann-z' });
      useAdminAnnouncementStore.setState({ announcements: [ann] as any, total: 1 });
      vi.mocked(adminAPI.deleteAnnouncement).mockRejectedValueOnce(new Error('fail'));

      await act(async () => {
        await expect(
          useAdminAnnouncementStore.getState().deleteAnnouncement('ann-z')
        ).rejects.toThrow();
      });

      expect(refetchAdminTabCounts).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // deleteAnnouncement — success path
  // ============================================================
  describe('deleteAnnouncement() — success', () => {
    it('removes the deleted item from announcements', async () => {
      const ann1 = makeAnnouncement({ id: 'ann-1' });
      const ann2 = makeAnnouncement({ id: 'ann-2' });
      useAdminAnnouncementStore.setState({
        announcements: [ann1, ann2] as any,
        total: 2,
      });
      vi.mocked(adminAPI.deleteAnnouncement).mockResolvedValueOnce(undefined);

      await act(async () => {
        await useAdminAnnouncementStore.getState().deleteAnnouncement('ann-1');
      });

      const state = useAdminAnnouncementStore.getState();
      expect(state.announcements).toHaveLength(1);
      expect(state.announcements[0].id).toBe('ann-2');
    });

    it('decrements total by 1 on success', async () => {
      const ann = makeAnnouncement({ id: 'ann-del' });
      useAdminAnnouncementStore.setState({ announcements: [ann] as any, total: 7 });
      vi.mocked(adminAPI.deleteAnnouncement).mockResolvedValueOnce(undefined);

      await act(async () => {
        await useAdminAnnouncementStore.getState().deleteAnnouncement('ann-del');
      });

      expect(useAdminAnnouncementStore.getState().total).toBe(6);
    });

    it('calls refetchAdminTabCounts on success', async () => {
      const ann = makeAnnouncement({ id: 'ann-ref' });
      useAdminAnnouncementStore.setState({ announcements: [ann] as any, total: 1 });
      vi.mocked(adminAPI.deleteAnnouncement).mockResolvedValueOnce(undefined);

      await act(async () => {
        await useAdminAnnouncementStore.getState().deleteAnnouncement('ann-ref');
      });

      expect(refetchAdminTabCounts).toHaveBeenCalledTimes(1);
    });

    it('resets isDeleting to false on success', async () => {
      const ann = makeAnnouncement({ id: 'ann-done' });
      useAdminAnnouncementStore.setState({ announcements: [ann] as any, total: 1 });
      vi.mocked(adminAPI.deleteAnnouncement).mockResolvedValueOnce(undefined);

      await act(async () => {
        await useAdminAnnouncementStore.getState().deleteAnnouncement('ann-done');
      });

      expect(useAdminAnnouncementStore.getState().isDeleting).toBe(false);
    });

    it('leaves other announcements intact', async () => {
      const ann1 = makeAnnouncement({ id: 'ann-keep-1' });
      const ann2 = makeAnnouncement({ id: 'ann-keep-2' });
      const annDel = makeAnnouncement({ id: 'ann-del-mid' });
      useAdminAnnouncementStore.setState({
        announcements: [ann1, annDel, ann2] as any,
        total: 3,
      });
      vi.mocked(adminAPI.deleteAnnouncement).mockResolvedValueOnce(undefined);

      await act(async () => {
        await useAdminAnnouncementStore.getState().deleteAnnouncement('ann-del-mid');
      });

      const state = useAdminAnnouncementStore.getState();
      expect(state.announcements.map((a) => a.id)).toEqual(['ann-keep-1', 'ann-keep-2']);
      expect(state.total).toBe(2);
    });
  });

  // ============================================================
  // refresh() — resets page to 1 then fetches
  // ============================================================
  describe('refresh()', () => {
    it('resets page to 1 regardless of current page', async () => {
      useAdminAnnouncementStore.setState({ page: 5 });
      vi.mocked(adminAPI.getAnnouncements).mockResolvedValueOnce(
        makeListResponse({ items: [], total: 0, page_size: 10 })
      );

      await act(async () => {
        await useAdminAnnouncementStore.getState().refresh();
      });

      expect(useAdminAnnouncementStore.getState().page).toBe(1);
    });

    it('calls fetchAnnouncements (i.e., adminAPI.getAnnouncements) after resetting page', async () => {
      useAdminAnnouncementStore.setState({ page: 3, pageSize: 10 });
      vi.mocked(adminAPI.getAnnouncements).mockResolvedValueOnce(
        makeListResponse({ items: [], total: 0, page_size: 10 })
      );

      await act(async () => {
        await useAdminAnnouncementStore.getState().refresh();
      });

      // After reset, page=1 so getAnnouncements is called with page=1
      expect(adminAPI.getAnnouncements).toHaveBeenCalledWith(1, 10);
    });

    it('updates announcements from the fetched response', async () => {
      useAdminAnnouncementStore.setState({ page: 4 });
      const items = [makeAnnouncement({ id: 'fresh-1' })];
      vi.mocked(adminAPI.getAnnouncements).mockResolvedValueOnce(
        makeListResponse({ items, total: 1, page_size: 10 })
      );

      await act(async () => {
        await useAdminAnnouncementStore.getState().refresh();
      });

      const state = useAdminAnnouncementStore.getState();
      expect(state.announcements).toHaveLength(1);
      expect(state.announcements[0].id).toBe('fresh-1');
    });
  });

  // ============================================================
  // selectPagination selector
  // ============================================================
  describe('selectPagination selector', () => {
    it('returns all four pagination fields', () => {
      useAdminAnnouncementStore.setState({ page: 2, pageSize: 5, total: 30, totalPages: 6 });
      const result = selectPagination(useAdminAnnouncementStore.getState());
      expect(result).toEqual({ page: 2, pageSize: 5, total: 30, totalPages: 6 });
    });
  });

  // ============================================================
  // clearSelectedAnnouncement / clearError
  // ============================================================
  describe('clearSelectedAnnouncement()', () => {
    it('sets selectedAnnouncement to null', () => {
      useAdminAnnouncementStore.setState({
        selectedAnnouncement: makeAnnouncement() as any,
      });

      act(() => {
        useAdminAnnouncementStore.getState().clearSelectedAnnouncement();
      });

      expect(useAdminAnnouncementStore.getState().selectedAnnouncement).toBeNull();
    });
  });

  describe('clearError()', () => {
    it('sets error to null', () => {
      useAdminAnnouncementStore.setState({ error: 'some error' });

      act(() => {
        useAdminAnnouncementStore.getState().clearError();
      });

      expect(useAdminAnnouncementStore.getState().error).toBeNull();
    });
  });
});
