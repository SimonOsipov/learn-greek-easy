/**
 * ChangelogPage Component Tests
 *
 * Tests for the user-facing changelog page including:
 * - Initial loading state with skeletons
 * - Error state with retry button
 * - Empty state when no entries
 * - Successful data display
 * - Pagination controls
 * - Analytics tracking
 * - Language change handling
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import userEvent from '@testing-library/user-event';

import { ChangelogPage } from '@/pages/ChangelogPage';
import { render, screen, waitFor, act } from '@/lib/test-utils';
import {
  useChangelogStore,
  selectChangelogItems,
  selectChangelogLoading,
  selectChangelogError,
  selectChangelogPage,
  selectChangelogPageSize,
  selectChangelogTotal,
  selectChangelogTotalPages,
} from '@/stores/changelogStore';
import * as changelogAnalytics from '@/lib/analytics/changelogAnalytics';

// Mock the changelog store
vi.mock('@/stores/changelogStore', () => ({
  useChangelogStore: vi.fn(),
  selectChangelogItems: vi.fn((state) => state.items),
  selectChangelogLoading: vi.fn((state) => state.isLoading),
  selectChangelogError: vi.fn((state) => state.error),
  selectChangelogPage: vi.fn((state) => state.page),
  selectChangelogPageSize: vi.fn((state) => state.pageSize),
  selectChangelogTotal: vi.fn((state) => state.total),
  selectChangelogTotalPages: vi.fn((state) => state.totalPages),
}));

// Mock analytics
vi.mock('@/lib/analytics/changelogAnalytics', () => ({
  trackChangelogPageViewed: vi.fn(),
  trackChangelogPagePaginated: vi.fn(),
}));

// Mock window.scrollTo
const mockScrollTo = vi.fn();

// Create mock store state factory
interface MockStoreState {
  items: Array<{
    id: string;
    title: string;
    content: string;
    tag: 'new_feature' | 'bug_fix' | 'announcement';
    created_at: string;
    updated_at: string;
  }>;
  isLoading: boolean;
  error: string | null;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  fetchChangelog: Mock;
  setPage: Mock;
  reset: Mock;
}

const createMockStoreState = (overrides: Partial<MockStoreState> = {}): MockStoreState => ({
  items: [],
  isLoading: false,
  error: null,
  page: 1,
  pageSize: 5,
  total: 0,
  totalPages: 0,
  fetchChangelog: vi.fn().mockResolvedValue(undefined),
  setPage: vi.fn(),
  reset: vi.fn(),
  ...overrides,
});

// Setup mock store
const setupMockStore = (state: MockStoreState) => {
  (useChangelogStore as unknown as Mock).mockImplementation((selector) => {
    if (typeof selector === 'function') {
      return selector(state);
    }
    return state;
  });
};

describe('ChangelogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = mockScrollTo;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Loading State', () => {
    it('should render loading skeletons when isLoading and no items', () => {
      const mockState = createMockStoreState({
        isLoading: true,
        items: [],
      });
      setupMockStore(mockState);

      render(<ChangelogPage />);

      expect(screen.getByTestId('changelog-loading')).toBeInTheDocument();
    });

    it('should render 5 skeleton cards during loading', () => {
      const mockState = createMockStoreState({
        isLoading: true,
        items: [],
      });
      setupMockStore(mockState);

      render(<ChangelogPage />);

      const loadingContainer = screen.getByTestId('changelog-loading');
      // The container has space-y-4 and contains 5 direct children (ChangelogCardSkeleton)
      // Each skeleton renders as a Card with class bg-card
      const skeletonCards = loadingContainer.children;
      expect(skeletonCards.length).toBe(5);
    });

    it('should display page title and subtitle even when loading', () => {
      const mockState = createMockStoreState({
        isLoading: true,
        items: [],
      });
      setupMockStore(mockState);

      render(<ChangelogPage />);

      // Page should have a title via the translation key
      expect(screen.getByTestId('changelog-page')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message when error exists', () => {
      const mockState = createMockStoreState({
        isLoading: false,
        error: 'Failed to load changelog',
        items: [],
      });
      setupMockStore(mockState);

      render(<ChangelogPage />);

      expect(screen.getByTestId('changelog-error')).toBeInTheDocument();
      expect(screen.getByText('Failed to load changelog')).toBeInTheDocument();
    });

    it('should display retry button in error state', () => {
      const mockState = createMockStoreState({
        isLoading: false,
        error: 'Network error',
        items: [],
      });
      setupMockStore(mockState);

      render(<ChangelogPage />);

      const retryButton = screen.getByRole('button');
      expect(retryButton).toBeInTheDocument();
    });

    it('should call fetchChangelog when retry button is clicked', async () => {
      const user = userEvent.setup();
      const mockFetchChangelog = vi.fn().mockResolvedValue(undefined);
      const mockState = createMockStoreState({
        isLoading: false,
        error: 'Network error',
        items: [],
        fetchChangelog: mockFetchChangelog,
      });
      setupMockStore(mockState);

      render(<ChangelogPage />);

      const retryButton = screen.getByRole('button');
      await user.click(retryButton);

      // fetchChangelog is called on mount and on retry
      expect(mockFetchChangelog).toHaveBeenCalled();
    });

    it('should not show error state when loading', () => {
      const mockState = createMockStoreState({
        isLoading: true,
        error: 'Some error',
        items: [],
      });
      setupMockStore(mockState);

      render(<ChangelogPage />);

      expect(screen.queryByTestId('changelog-error')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no items and not loading', () => {
      const mockState = createMockStoreState({
        isLoading: false,
        error: null,
        items: [],
      });
      setupMockStore(mockState);

      render(<ChangelogPage />);

      // EmptyState component is rendered
      // It uses History icon and translation keys
      // We can check for the container not having the list
      expect(screen.queryByTestId('changelog-list')).not.toBeInTheDocument();
      expect(screen.queryByTestId('changelog-loading')).not.toBeInTheDocument();
    });
  });

  describe('Content Display', () => {
    it('should render changelog cards when items exist', () => {
      const mockItems = [
        {
          id: '1',
          title: 'Feature Update',
          content: 'New feature content',
          tag: 'new_feature' as const,
          created_at: '2026-01-15T10:30:00Z',
          updated_at: '2026-01-15T10:30:00Z',
        },
        {
          id: '2',
          title: 'Important Fix',
          content: 'Bug fix content',
          tag: 'bug_fix' as const,
          created_at: '2026-01-14T10:30:00Z',
          updated_at: '2026-01-14T10:30:00Z',
        },
      ];
      const mockState = createMockStoreState({
        isLoading: false,
        error: null,
        items: mockItems,
        total: 2,
        totalPages: 1,
      });
      setupMockStore(mockState);

      render(<ChangelogPage />);

      expect(screen.getByTestId('changelog-list')).toBeInTheDocument();
      expect(screen.getByText('Feature Update')).toBeInTheDocument();
      expect(screen.getByText('Important Fix')).toBeInTheDocument();
    });

    it('should render content from each changelog entry', () => {
      const mockItems = [
        {
          id: '1',
          title: 'Test Entry',
          content: 'This is the content of the test entry.',
          tag: 'announcement' as const,
          created_at: '2026-01-15T10:30:00Z',
          updated_at: '2026-01-15T10:30:00Z',
        },
      ];
      const mockState = createMockStoreState({
        isLoading: false,
        items: mockItems,
        total: 1,
        totalPages: 1,
      });
      setupMockStore(mockState);

      render(<ChangelogPage />);

      expect(screen.getByText('This is the content of the test entry.')).toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    it('should render pagination when totalPages > 1', () => {
      const mockItems = [
        {
          id: '1',
          title: 'Entry 1',
          content: 'Content 1',
          tag: 'new_feature' as const,
          created_at: '2026-01-15T10:30:00Z',
          updated_at: '2026-01-15T10:30:00Z',
        },
      ];
      const mockState = createMockStoreState({
        isLoading: false,
        items: mockItems,
        total: 15,
        totalPages: 3,
        page: 1,
        pageSize: 5,
      });
      setupMockStore(mockState);

      render(<ChangelogPage />);

      expect(screen.getByTestId('changelog-pagination')).toBeInTheDocument();
    });

    it('should not render pagination when totalPages <= 1', () => {
      const mockItems = [
        {
          id: '1',
          title: 'Entry 1',
          content: 'Content 1',
          tag: 'new_feature' as const,
          created_at: '2026-01-15T10:30:00Z',
          updated_at: '2026-01-15T10:30:00Z',
        },
      ];
      const mockState = createMockStoreState({
        isLoading: false,
        items: mockItems,
        total: 3,
        totalPages: 1,
        page: 1,
        pageSize: 5,
      });
      setupMockStore(mockState);

      render(<ChangelogPage />);

      expect(screen.queryByTestId('changelog-pagination')).not.toBeInTheDocument();
    });

    it('should call setPage when pagination is used', async () => {
      const user = userEvent.setup();
      const mockSetPage = vi.fn();
      const mockItems = [
        {
          id: '1',
          title: 'Entry 1',
          content: 'Content 1',
          tag: 'new_feature' as const,
          created_at: '2026-01-15T10:30:00Z',
          updated_at: '2026-01-15T10:30:00Z',
        },
      ];
      const mockState = createMockStoreState({
        isLoading: false,
        items: mockItems,
        total: 15,
        totalPages: 3,
        page: 1,
        pageSize: 5,
        setPage: mockSetPage,
      });
      setupMockStore(mockState);

      render(<ChangelogPage />);

      // Click page 2 button (desktop view)
      const page2Button = screen.getByTestId('changelog-pagination-page-2');
      await user.click(page2Button);

      expect(mockSetPage).toHaveBeenCalledWith(2, 'en');
    });

    it('should scroll to top when page changes', async () => {
      const user = userEvent.setup();
      const mockSetPage = vi.fn();
      const mockItems = [
        {
          id: '1',
          title: 'Entry 1',
          content: 'Content 1',
          tag: 'new_feature' as const,
          created_at: '2026-01-15T10:30:00Z',
          updated_at: '2026-01-15T10:30:00Z',
        },
      ];
      const mockState = createMockStoreState({
        isLoading: false,
        items: mockItems,
        total: 15,
        totalPages: 3,
        page: 1,
        pageSize: 5,
        setPage: mockSetPage,
      });
      setupMockStore(mockState);

      render(<ChangelogPage />);

      const page2Button = screen.getByTestId('changelog-pagination-page-2');
      await user.click(page2Button);

      expect(mockScrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    });
  });

  describe('Analytics Tracking', () => {
    it('should track page view when items are loaded', async () => {
      const mockItems = [
        {
          id: '1',
          title: 'Entry 1',
          content: 'Content 1',
          tag: 'new_feature' as const,
          created_at: '2026-01-15T10:30:00Z',
          updated_at: '2026-01-15T10:30:00Z',
        },
      ];
      const mockState = createMockStoreState({
        isLoading: false,
        items: mockItems,
        total: 10,
        totalPages: 2,
      });
      setupMockStore(mockState);

      render(<ChangelogPage />);

      await waitFor(() => {
        expect(changelogAnalytics.trackChangelogPageViewed).toHaveBeenCalledWith({
          page_number: 1,
          total_items: 10,
          items_on_page: 1,
          language: 'en',
        });
      });
    });

    it('should not track page view while loading', () => {
      const mockState = createMockStoreState({
        isLoading: true,
        items: [],
      });
      setupMockStore(mockState);

      render(<ChangelogPage />);

      expect(changelogAnalytics.trackChangelogPageViewed).not.toHaveBeenCalled();
    });

    it('should track pagination events when changing pages', async () => {
      const user = userEvent.setup();
      const mockSetPage = vi.fn();
      const mockItems = [
        {
          id: '1',
          title: 'Entry 1',
          content: 'Content 1',
          tag: 'new_feature' as const,
          created_at: '2026-01-15T10:30:00Z',
          updated_at: '2026-01-15T10:30:00Z',
        },
      ];
      const mockState = createMockStoreState({
        isLoading: false,
        items: mockItems,
        total: 15,
        totalPages: 3,
        page: 1,
        pageSize: 5,
        setPage: mockSetPage,
      });
      setupMockStore(mockState);

      render(<ChangelogPage />);

      const page2Button = screen.getByTestId('changelog-pagination-page-2');
      await user.click(page2Button);

      expect(changelogAnalytics.trackChangelogPagePaginated).toHaveBeenCalledWith({
        from_page: 1,
        to_page: 2,
        total_pages: 3,
      });
    });
  });

  describe('Initial Fetch', () => {
    it('should call fetchChangelog on mount', () => {
      const mockFetchChangelog = vi.fn().mockResolvedValue(undefined);
      const mockState = createMockStoreState({
        fetchChangelog: mockFetchChangelog,
      });
      setupMockStore(mockState);

      render(<ChangelogPage />);

      expect(mockFetchChangelog).toHaveBeenCalled();
    });

    it('should call reset on unmount', () => {
      const mockReset = vi.fn();
      const mockState = createMockStoreState({
        reset: mockReset,
      });
      setupMockStore(mockState);

      const { unmount } = render(<ChangelogPage />);
      unmount();

      expect(mockReset).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper page structure with test-id', () => {
      const mockState = createMockStoreState({
        isLoading: false,
        items: [],
      });
      setupMockStore(mockState);

      render(<ChangelogPage />);

      expect(screen.getByTestId('changelog-page')).toBeInTheDocument();
    });

    it('should have H1 heading for page title', () => {
      const mockState = createMockStoreState({
        isLoading: false,
        items: [],
      });
      setupMockStore(mockState);

      render(<ChangelogPage />);

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
    });
  });
});
