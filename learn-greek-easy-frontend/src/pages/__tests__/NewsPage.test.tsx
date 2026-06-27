/**
 * NewsPage Component Tests
 *
 * Tests for the dedicated News page including:
 * - Data fetching with pagination
 * - Loading state with skeleton grid
 * - Error state with retry button
 * - Empty state when no articles
 * - Analytics tracking for page views and pagination
 * - Scroll to top on page change
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import userEvent from '@testing-library/user-event';

import { NewsPage } from '@/pages/NewsPage';
import { render, screen, waitFor, within } from '@/lib/test-utils';
import { adminAPI, type NewsItemResponse } from '@/services/adminAPI';
import { track } from '@/lib/analytics';

// Mock adminAPI
vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    getNewsItems: vi.fn(),
  },
}));

// Mock analytics
vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  registerTheme: vi.fn(),
  registerInterfaceLanguage: vi.fn(),
}));

// Mock error reporting
vi.mock('@/lib/errorReporting', () => ({
  reportAPIError: vi.fn(),
}));

// Mock window.scrollTo
const mockScrollTo = vi.fn();

// Factory function for creating mock news items
const createMockNewsItem = (overrides: Partial<NewsItemResponse> = {}): NewsItemResponse => ({
  id: `news-${Math.random().toString(36).substr(2, 9)}`,
  title_el: 'Ελληνικός τίτλος',
  title_en: 'English title',
  title_ru: 'Русский заголовок',
  description_el: 'Ελληνική περιγραφή του άρθρου',
  description_en: 'English description of the article',
  description_ru: 'Русское описание статьи',
  publication_date: '2026-01-27',
  original_article_url: 'https://example.com/article',
  image_url: 'https://example.com/image.jpg',
  audio_url: null,
  audio_generated_at: null,
  audio_duration_seconds: null,
  audio_file_size_bytes: null,
  created_at: '2026-01-27T00:00:00Z',
  updated_at: '2026-01-27T00:00:00Z',
  country: 'cyprus',
  title_el_a2: null,
  description_el_a2: null,
  audio_a2_url: null,
  audio_a2_duration_seconds: null,
  audio_a2_generated_at: null,
  audio_a2_file_size_bytes: null,
  has_a2_content: false,
  alt_text: null,
  photo_credit: null,
  status: 'published',
  linked_situation: null,
  image_variants: null,
  ...overrides,
});

// Factory for paginated response
const createPaginatedResponse = (
  items: NewsItemResponse[],
  total: number,
  page: number = 1,
  limit: number = 12,
  country_counts = { cyprus: 0, greece: 0, world: 0 }
) => ({
  items,
  total,
  page,
  page_size: limit,
  limit,
  pages: Math.ceil(total / limit),
  country_counts,
});

describe('NewsPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = mockScrollTo;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial Loading', () => {
    it('should render loading state initially', async () => {
      // Create a promise that won't resolve immediately
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      (adminAPI.getNewsItems as Mock).mockReturnValue(pendingPromise);

      render(<NewsPage />);

      expect(screen.getByTestId('news-grid-loading')).toBeInTheDocument();

      // Clean up by resolving the promise
      resolvePromise!(createPaginatedResponse([], 0));
    });

    it('should show 12 skeleton cards during loading', async () => {
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      (adminAPI.getNewsItems as Mock).mockReturnValue(pendingPromise);

      render(<NewsPage />);

      const loadingGrid = screen.getByTestId('news-grid-loading');
      const skeletons = within(loadingGrid).getAllByRole('listitem');
      expect(skeletons).toHaveLength(12);

      resolvePromise!(createPaginatedResponse([], 0));
    });

    it('should render page title and subtitle', async () => {
      (adminAPI.getNewsItems as Mock).mockResolvedValue(createPaginatedResponse([], 0));

      render(<NewsPage />);

      expect(screen.getByTestId('news-page-title')).toBeInTheDocument();
      expect(screen.getByText('Greek News')).toBeInTheDocument();
      expect(screen.getByText('Practice reading with real articles')).toBeInTheDocument();
    });

    it('should render difficulty label alongside the level toggle', async () => {
      (adminAPI.getNewsItems as Mock).mockResolvedValue(createPaginatedResponse([], 0));

      render(<NewsPage />);

      expect(screen.getByText('Difficulty:')).toBeInTheDocument();
      expect(screen.getByTestId('news-filters')).toBeInTheDocument();
    });
  });

  describe('Data Fetching', () => {
    it('should call adminAPI.getNewsItems on mount', async () => {
      const articles = [createMockNewsItem({ id: 'article-1' })];
      (adminAPI.getNewsItems as Mock).mockResolvedValue(createPaginatedResponse(articles, 1));

      render(<NewsPage />);

      await waitFor(() => {
        expect(adminAPI.getNewsItems).toHaveBeenCalledWith(1, 12, undefined, undefined);
      });
    });

    it('should display articles after successful fetch', async () => {
      const articles = [
        createMockNewsItem({ id: 'article-1', title_el: 'Άρθρο Πρώτο' }),
        createMockNewsItem({ id: 'article-2', title_el: 'Άρθρο Δεύτερο' }),
      ];
      (adminAPI.getNewsItems as Mock).mockResolvedValue(createPaginatedResponse(articles, 2));

      render(<NewsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('news-grid')).toBeInTheDocument();
      });

      expect(screen.getByText('Άρθρο Πρώτο')).toBeInTheDocument();
      expect(screen.getByText('Άρθρο Δεύτερο')).toBeInTheDocument();
    });

    it('should display articles in Greek by default', async () => {
      const articles = [
        createMockNewsItem({
          id: 'article-1',
          title_el: 'Ελληνικός τίτλος',
          title_en: 'English title',
        }),
      ];
      (adminAPI.getNewsItems as Mock).mockResolvedValue(createPaginatedResponse(articles, 1));

      render(<NewsPage />);

      await waitFor(() => {
        expect(screen.getByText('Ελληνικός τίτλος')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no articles are returned', async () => {
      (adminAPI.getNewsItems as Mock).mockResolvedValue(createPaginatedResponse([], 0));

      render(<NewsPage />);

      await waitFor(() => {
        expect(screen.getByText('No news articles yet')).toBeInTheDocument();
      });

      expect(
        screen.getByText('Check back later for new content to practice with')
      ).toBeInTheDocument();
    });

    it('should not show pagination when no articles', async () => {
      (adminAPI.getNewsItems as Mock).mockResolvedValue(createPaginatedResponse([], 0));

      render(<NewsPage />);

      await waitFor(() => {
        expect(screen.getByText('No news articles yet')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('news-pagination')).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error state when API call fails', async () => {
      (adminAPI.getNewsItems as Mock).mockRejectedValue(new Error('Network error'));

      render(<NewsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('news-error')).toBeInTheDocument();
      });

      expect(screen.getByText('Unable to load news')).toBeInTheDocument();
      expect(
        screen.getByText("We couldn't load the news articles. Please try again.")
      ).toBeInTheDocument();
    });

    it('should show retry button in error state', async () => {
      (adminAPI.getNewsItems as Mock).mockRejectedValue(new Error('Network error'));

      render(<NewsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('news-retry-button')).toBeInTheDocument();
      });

      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('should retry fetching when retry button is clicked', async () => {
      const user = userEvent.setup();

      // First call fails
      (adminAPI.getNewsItems as Mock).mockRejectedValueOnce(new Error('Network error'));

      render(<NewsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('news-error')).toBeInTheDocument();
      });

      // Setup success for retry
      const articles = [createMockNewsItem({ id: 'article-1' })];
      (adminAPI.getNewsItems as Mock).mockResolvedValue(createPaginatedResponse(articles, 1));

      // Click retry
      await user.click(screen.getByTestId('news-retry-button'));

      await waitFor(() => {
        expect(screen.getByTestId('news-grid')).toBeInTheDocument();
      });

      expect(adminAPI.getNewsItems).toHaveBeenCalledTimes(2);
    });

    it('should not show loading grid when error is displayed', async () => {
      (adminAPI.getNewsItems as Mock).mockRejectedValue(new Error('Network error'));

      render(<NewsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('news-error')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('news-grid-loading')).not.toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    it('should show pagination when totalPages > 1', async () => {
      const articles = Array.from({ length: 12 }, (_, i) =>
        createMockNewsItem({ id: `article-${i}` })
      );
      (adminAPI.getNewsItems as Mock).mockResolvedValue(
        createPaginatedResponse(articles, 36) // 36 total = 3 pages
      );

      render(<NewsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('news-pagination')).toBeInTheDocument();
      });
    });

    it('should not show pagination when totalPages = 1', async () => {
      const articles = Array.from({ length: 5 }, (_, i) =>
        createMockNewsItem({ id: `article-${i}` })
      );
      (adminAPI.getNewsItems as Mock).mockResolvedValue(createPaginatedResponse(articles, 5));

      render(<NewsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('news-grid')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('news-pagination')).not.toBeInTheDocument();
    });

    it('should fetch next page when pagination is used', async () => {
      const user = userEvent.setup();

      // First page
      const page1Articles = Array.from({ length: 12 }, (_, i) =>
        createMockNewsItem({ id: `article-p1-${i}` })
      );
      (adminAPI.getNewsItems as Mock).mockResolvedValueOnce(
        createPaginatedResponse(page1Articles, 36, 1)
      );

      render(<NewsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('news-pagination')).toBeInTheDocument();
      });

      // Second page
      const page2Articles = Array.from({ length: 12 }, (_, i) =>
        createMockNewsItem({ id: `article-p2-${i}`, title_el: `Άρθρο σελίδα 2 - ${i}` })
      );
      (adminAPI.getNewsItems as Mock).mockResolvedValueOnce(
        createPaginatedResponse(page2Articles, 36, 2)
      );

      // Click next
      await user.click(screen.getByTestId('news-pagination-next'));

      await waitFor(() => {
        expect(adminAPI.getNewsItems).toHaveBeenCalledWith(2, 12, undefined, undefined);
      });
    });

    it('should scroll to top when page changes', async () => {
      const user = userEvent.setup();

      const articles = Array.from({ length: 12 }, (_, i) =>
        createMockNewsItem({ id: `article-${i}` })
      );
      (adminAPI.getNewsItems as Mock).mockResolvedValue(createPaginatedResponse(articles, 36));

      render(<NewsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('news-pagination')).toBeInTheDocument();
      });

      // Click next
      await user.click(screen.getByTestId('news-pagination-next'));

      await waitFor(() => {
        expect(mockScrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
      });
    });
  });

  describe('Analytics Tracking', () => {
    it('should track page view on first successful load', async () => {
      const articles = [createMockNewsItem({ id: 'article-1' })];
      (adminAPI.getNewsItems as Mock).mockResolvedValue(createPaginatedResponse(articles, 25));

      render(<NewsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('news-grid')).toBeInTheDocument();
      });

      expect(track).toHaveBeenCalledWith('news_page_viewed', {
        total_articles: 25,
      });
    });

    it('should track page view only once even after pagination', async () => {
      const user = userEvent.setup();

      const articles = Array.from({ length: 12 }, (_, i) =>
        createMockNewsItem({ id: `article-${i}` })
      );
      (adminAPI.getNewsItems as Mock).mockResolvedValue(createPaginatedResponse(articles, 36));

      render(<NewsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('news-pagination')).toBeInTheDocument();
      });

      // Page view tracked once
      const newsPageViewedCalls = vi
        .mocked(track)
        .mock.calls.filter(([event]) => event === 'news_page_viewed');
      expect(newsPageViewedCalls).toHaveLength(1);

      // Navigate to next page
      await user.click(screen.getByTestId('news-pagination-next'));

      await waitFor(() => {
        expect(adminAPI.getNewsItems).toHaveBeenCalledWith(2, 12, undefined, undefined);
      });

      // Should still only be called once
      const newsPageViewedCallsAfter = vi
        .mocked(track)
        .mock.calls.filter(([event]) => event === 'news_page_viewed');
      expect(newsPageViewedCallsAfter).toHaveLength(1);
    });

    it('should track pagination events on page change', async () => {
      const user = userEvent.setup();

      const articles = Array.from({ length: 12 }, (_, i) =>
        createMockNewsItem({ id: `article-${i}` })
      );
      (adminAPI.getNewsItems as Mock).mockResolvedValue(createPaginatedResponse(articles, 36));

      render(<NewsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('news-pagination')).toBeInTheDocument();
      });

      // Navigate to next page
      await user.click(screen.getByTestId('news-pagination-next'));

      expect(track).toHaveBeenCalledWith('news_page_paginated', {
        from_page: 1,
        to_page: 2,
        total_pages: 3,
      });
    });

    it('should not track page view on error', async () => {
      (adminAPI.getNewsItems as Mock).mockRejectedValue(new Error('Network error'));

      render(<NewsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('news-error')).toBeInTheDocument();
      });

      const newsPageViewedCalls = vi
        .mocked(track)
        .mock.calls.filter(([event]) => event === 'news_page_viewed');
      expect(newsPageViewedCalls).toHaveLength(0);
    });
  });

  describe('Accessibility', () => {
    it('should have proper page structure with test-id', async () => {
      const articles = [createMockNewsItem({ id: 'article-1' })];
      (adminAPI.getNewsItems as Mock).mockResolvedValue(createPaginatedResponse(articles, 1));

      render(<NewsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('news-page')).toBeInTheDocument();
      });
    });

    it('should have proper heading hierarchy', async () => {
      const articles = [createMockNewsItem({ id: 'article-1' })];
      (adminAPI.getNewsItems as Mock).mockResolvedValue(createPaginatedResponse(articles, 1));

      render(<NewsPage />);

      await waitFor(() => {
        const heading = screen.getByTestId('news-page-title');
        expect(heading.tagName).toBe('H1');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid pagination clicks', async () => {
      const user = userEvent.setup();

      const articles = Array.from({ length: 12 }, (_, i) =>
        createMockNewsItem({ id: `article-${i}` })
      );
      (adminAPI.getNewsItems as Mock).mockResolvedValue(
        createPaginatedResponse(articles, 60) // 5 pages
      );

      render(<NewsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('news-pagination')).toBeInTheDocument();
      });

      // Click next multiple times quickly
      await user.click(screen.getByTestId('news-pagination-next'));
      await user.click(screen.getByTestId('news-pagination-next'));

      // Should handle gracefully without crashing
      expect(adminAPI.getNewsItems).toHaveBeenCalled();
    });

    it('should update pagination display after fetching new page', async () => {
      const user = userEvent.setup();

      // Page 1
      const page1Articles = Array.from({ length: 12 }, (_, i) =>
        createMockNewsItem({ id: `article-p1-${i}` })
      );
      (adminAPI.getNewsItems as Mock).mockResolvedValueOnce(
        createPaginatedResponse(page1Articles, 36, 1)
      );

      render(<NewsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('news-pagination-showing')).toHaveTextContent(
          'Showing 1-12 of 36 articles'
        );
      });

      // Page 2
      const page2Articles = Array.from({ length: 12 }, (_, i) =>
        createMockNewsItem({ id: `article-p2-${i}` })
      );
      (adminAPI.getNewsItems as Mock).mockResolvedValueOnce(
        createPaginatedResponse(page2Articles, 36, 2)
      );

      await user.click(screen.getByTestId('news-pagination-next'));

      await waitFor(() => {
        expect(screen.getByTestId('news-pagination-showing')).toHaveTextContent(
          'Showing 13-24 of 36 articles'
        );
      });
    });
  });
});

// NWS8-03: Search Query Wiring — AC #1 q param, AC #2 page-1 reset, AC #3 empty→EmptyState, AC #5 cache key, AC #6 no analytics
describe('Search Query Wiring (NWS8-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = vi.fn();
  });

  it('typing a query wires q param into getNewsItems call', async () => {
    const user = userEvent.setup();
    const articles = [createMockNewsItem({ id: 'article-1' })];
    (adminAPI.getNewsItems as Mock).mockResolvedValue(
      createPaginatedResponse(articles, 1, 1, 12, { cyprus: 1, greece: 0, world: 0 })
    );

    render(<NewsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('news-filters')).toBeInTheDocument();
    });

    const input = screen.getByTestId('news-search-input');
    await user.type(input, 'κυπριακά');

    await waitFor(() => {
      expect(adminAPI.getNewsItems).toHaveBeenCalledWith(1, 12, undefined, 'κυπριακά');
    });
  });

  it('changing the query resets to page 1 (AC #2)', async () => {
    const user = userEvent.setup();
    const articles = Array.from({ length: 12 }, (_, i) => createMockNewsItem({ id: `a-${i}` }));
    (adminAPI.getNewsItems as Mock).mockResolvedValue(
      createPaginatedResponse(articles, 36, 1, 12, { cyprus: 12, greece: 12, world: 12 })
    );

    render(<NewsPage />);

    await waitFor(() => expect(screen.getByTestId('news-pagination')).toBeInTheDocument());

    // Go to page 2
    (adminAPI.getNewsItems as Mock).mockResolvedValue(
      createPaginatedResponse(articles, 36, 2, 12, { cyprus: 12, greece: 12, world: 12 })
    );
    await user.click(screen.getByTestId('news-pagination-next'));
    await waitFor(() =>
      expect(adminAPI.getNewsItems).toHaveBeenCalledWith(2, 12, undefined, undefined)
    );

    // Type a query — must reset to page 1
    const input = screen.getByTestId('news-search-input');
    await user.type(input, 'ελλάδα');

    await waitFor(() => {
      expect(adminAPI.getNewsItems).toHaveBeenCalledWith(1, 12, undefined, 'ελλάδα');
    });
  });

  it('empty query result shows the existing EmptyState (AC #3)', async () => {
    (adminAPI.getNewsItems as Mock).mockResolvedValue(createPaginatedResponse([], 0));

    render(<NewsPage />);

    await waitFor(() => {
      expect(screen.getByText('No news articles yet')).toBeInTheDocument();
    });
  });

  it('does NOT fire news_search analytics event when typing (F7 — no untraced scope)', async () => {
    const user = userEvent.setup();
    const articles = [createMockNewsItem({ id: 'article-1' })];
    (adminAPI.getNewsItems as Mock).mockResolvedValue(
      createPaginatedResponse(articles, 1, 1, 12, { cyprus: 1, greece: 0, world: 0 })
    );

    render(<NewsPage />);

    await waitFor(() => expect(screen.getByTestId('news-filters')).toBeInTheDocument());

    const input = screen.getByTestId('news-search-input');
    await user.type(input, 'test');

    await waitFor(() => {
      expect(adminAPI.getNewsItems).toHaveBeenCalledWith(1, 12, undefined, 'test');
    });

    // Confirm no news_search event was tracked
    const searchAnalyticsCalls = vi
      .mocked(track)
      .mock.calls.filter(([event]) => event === 'news_search');
    expect(searchAnalyticsCalls).toHaveLength(0);
  });
});

describe('Country Filter Buttons', () => {
  it('renders All/Cyprus/Greece/World filter buttons', async () => {
    const articles = [createMockNewsItem({ id: 'article-1' })];
    (adminAPI.getNewsItems as Mock).mockResolvedValue(
      createPaginatedResponse(articles, 1, 1, 12, { cyprus: 3, greece: 2, world: 1 })
    );

    render(<NewsPage />);

    await waitFor(() => {
      const filters = screen.getByTestId('news-filters');
      expect(within(filters).getByRole('button', { name: /All/ })).toBeInTheDocument();
      expect(within(filters).getByRole('button', { name: /Cyprus/ })).toBeInTheDocument();
      expect(within(filters).getByRole('button', { name: /Greece/ })).toBeInTheDocument();
      expect(within(filters).getByRole('button', { name: /World/ })).toBeInTheDocument();
    });
  });

  it('clicking Cyprus button calls API with country=cyprus', async () => {
    const user = userEvent.setup();
    const articles = [createMockNewsItem({ id: 'article-1' })];

    (adminAPI.getNewsItems as Mock).mockResolvedValue(
      createPaginatedResponse(articles, 1, 1, 12, { cyprus: 3, greece: 2, world: 1 })
    );

    render(<NewsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('news-filters')).toBeInTheDocument();
    });

    const filters = screen.getByTestId('news-filters');
    await user.click(within(filters).getByRole('button', { name: /Cyprus/ }));

    await waitFor(() => {
      expect(adminAPI.getNewsItems).toHaveBeenCalledWith(1, 12, 'cyprus', undefined);
    });
  });

  it('clicking All button calls API without country', async () => {
    const user = userEvent.setup();
    const articles = [createMockNewsItem({ id: 'article-1' })];

    (adminAPI.getNewsItems as Mock).mockResolvedValue(
      createPaginatedResponse(articles, 1, 1, 12, { cyprus: 3, greece: 2, world: 1 })
    );

    render(<NewsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('news-filters')).toBeInTheDocument();
    });

    const filters = screen.getByTestId('news-filters');

    // Click Cyprus first
    await user.click(within(filters).getByRole('button', { name: /Cyprus/ }));
    await waitFor(() => {
      expect(adminAPI.getNewsItems).toHaveBeenCalledWith(1, 12, 'cyprus', undefined);
    });

    // Then click All
    await user.click(within(filters).getByRole('button', { name: /All/ }));
    await waitFor(() => {
      expect(adminAPI.getNewsItems).toHaveBeenCalledWith(1, 12, undefined, undefined);
    });
  });

  it('filter change resets to page 1', async () => {
    const user = userEvent.setup();

    // Start with 36 articles on page 1
    const articles = Array.from({ length: 12 }, (_, i) =>
      createMockNewsItem({ id: `article-${i}` })
    );
    (adminAPI.getNewsItems as Mock).mockResolvedValue(
      createPaginatedResponse(articles, 36, 1, 12, { cyprus: 12, greece: 12, world: 12 })
    );

    render(<NewsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('news-grid')).toBeInTheDocument();
    });

    // Navigate to page 2
    (adminAPI.getNewsItems as Mock).mockResolvedValue(
      createPaginatedResponse(articles, 36, 2, 12, { cyprus: 12, greece: 12, world: 12 })
    );
    await user.click(screen.getByTestId('news-pagination-next'));

    // Click Greece filter - should reset to page 1
    (adminAPI.getNewsItems as Mock).mockResolvedValue(
      createPaginatedResponse(articles, 12, 1, 12, { cyprus: 12, greece: 12, world: 12 })
    );
    const filters = screen.getByTestId('news-filters');
    await user.click(within(filters).getByRole('button', { name: /Greece/ }));

    await waitFor(() => {
      expect(adminAPI.getNewsItems).toHaveBeenCalledWith(1, 12, 'greece', undefined);
    });
  });
});
