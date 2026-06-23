/**
 * NewsSection Component Tests
 *
 * Tests for the dashboard NewsSection including:
 * - Renders title, "See All" link, country filter tabs, difficulty label, level toggle
 * - Calls adminAPI.getNewsItems(1, 6) on mount
 * - Country filtering: clicking a tab refetches with country param
 * - Shows 6 skeletons during loading
 * - Returns null on error or empty
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import userEvent from '@testing-library/user-event';

import { NewsSection } from '@/components/dashboard/NewsSection';
import { render, screen, waitFor, within } from '@/lib/test-utils';
import { adminAPI, type NewsItemResponse } from '@/services/adminAPI';

// Mock adminAPI
vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    getNewsItems: vi.fn(),
  },
}));

// Mock analytics — use importOriginal to preserve other exports used by ThemeContext/LanguageContext providers
vi.mock('@/lib/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/analytics')>();
  return {
    ...actual,
    track: vi.fn(),
  };
});

// Mock error reporting
vi.mock('@/lib/errorReporting', () => ({
  reportAPIError: vi.fn(),
}));

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
  country_counts = { cyprus: 0, greece: 0, world: 0 }
) => ({
  items,
  total,
  page: 1,
  page_size: 6,
  limit: 6,
  pages: Math.ceil(total / 6),
  country_counts,
  audio_count: 0,
});

describe('NewsSection Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders title and "See All" link', async () => {
      const items = Array.from({ length: 6 }, (_, i) => createMockNewsItem({ id: `item-${i}` }));
      (adminAPI.getNewsItems as Mock).mockResolvedValue(createPaginatedResponse(items, 6));

      render(<NewsSection />);

      await waitFor(() => {
        expect(screen.getByTestId('news-section')).toBeInTheDocument();
      });

      expect(screen.getByText('Cyprus News To Learn And Practice')).toBeInTheDocument();
      expect(screen.getByTestId('news-section-see-all')).toBeInTheDocument();
      expect(screen.getByTestId('news-section-see-all')).toHaveAttribute('href', '/news');
    });

    it('renders country filter buttons', async () => {
      const items = [createMockNewsItem({ id: 'item-1' })];
      (adminAPI.getNewsItems as Mock).mockResolvedValue(
        createPaginatedResponse(items, 1, { cyprus: 3, greece: 2, world: 1 })
      );

      render(<NewsSection />);

      await waitFor(() => {
        expect(screen.getByTestId('news-section')).toBeInTheDocument();
      });

      const filters = screen.getByTestId('news-filters');
      expect(within(filters).getByRole('button', { name: /All/ })).toBeInTheDocument();
      expect(within(filters).getByRole('button', { name: /Cyprus/ })).toBeInTheDocument();
      expect(within(filters).getByRole('button', { name: /Greece/ })).toBeInTheDocument();
      expect(within(filters).getByRole('button', { name: /World/ })).toBeInTheDocument();
    });

    it('renders difficulty label', async () => {
      const items = [createMockNewsItem({ id: 'item-1' })];
      (adminAPI.getNewsItems as Mock).mockResolvedValue(createPaginatedResponse(items, 1));

      render(<NewsSection />);

      await waitFor(() => {
        expect(screen.getByText('Difficulty:')).toBeInTheDocument();
      });
    });

    it('renders level toggle buttons', async () => {
      const items = [createMockNewsItem({ id: 'item-1' })];
      (adminAPI.getNewsItems as Mock).mockResolvedValue(createPaginatedResponse(items, 1));

      render(<NewsSection />);

      await waitFor(() => {
        const filters = screen.getByTestId('news-filters');
        expect(within(filters).getByRole('button', { name: /A2/ })).toBeInTheDocument();
        expect(within(filters).getByRole('button', { name: /B1/ })).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('calls adminAPI.getNewsItems(1, 6) on mount', async () => {
      const items = [createMockNewsItem({ id: 'item-1' })];
      (adminAPI.getNewsItems as Mock).mockResolvedValue(createPaginatedResponse(items, 1));

      render(<NewsSection />);

      await waitFor(() => {
        expect(adminAPI.getNewsItems).toHaveBeenCalledWith(1, 6, undefined);
      });
    });

    it('displays articles after successful fetch', async () => {
      const items = [
        createMockNewsItem({ id: 'item-1', title_el: 'Πρώτο Άρθρο' }),
        createMockNewsItem({ id: 'item-2', title_el: 'Δεύτερο Άρθρο' }),
      ];
      (adminAPI.getNewsItems as Mock).mockResolvedValue(createPaginatedResponse(items, 2));

      render(<NewsSection />);

      await waitFor(() => {
        expect(screen.getByText('Πρώτο Άρθρο')).toBeInTheDocument();
      });
      expect(screen.getByText('Δεύτερο Άρθρο')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows 6 skeletons while loading', async () => {
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      (adminAPI.getNewsItems as Mock).mockReturnValue(pendingPromise);

      render(<NewsSection />);

      const loadingContainer = screen.getByTestId('news-section-loading');
      expect(loadingContainer).toBeInTheDocument();
      // 6 skeleton cards should be rendered
      const skeletons = loadingContainer.children;
      expect(skeletons).toHaveLength(6);

      // Clean up
      resolvePromise!(createPaginatedResponse([], 0));
    });
  });

  describe('Country Filtering', () => {
    it('refetches with country param when clicking a country button', async () => {
      const user = userEvent.setup();
      const items = [createMockNewsItem({ id: 'item-1' })];
      (adminAPI.getNewsItems as Mock).mockResolvedValue(
        createPaginatedResponse(items, 1, { cyprus: 3, greece: 2, world: 1 })
      );

      render(<NewsSection />);

      await waitFor(() => {
        expect(screen.getByTestId('news-filters')).toBeInTheDocument();
      });

      const filters = screen.getByTestId('news-filters');
      await user.click(within(filters).getByRole('button', { name: /Cyprus/ }));

      await waitFor(() => {
        expect(adminAPI.getNewsItems).toHaveBeenCalledWith(1, 6, 'cyprus');
      });
    });

    it('refetches without country param when clicking All button', async () => {
      const user = userEvent.setup();
      const items = [createMockNewsItem({ id: 'item-1' })];
      (adminAPI.getNewsItems as Mock).mockResolvedValue(
        createPaginatedResponse(items, 1, { cyprus: 3, greece: 2, world: 1 })
      );

      render(<NewsSection />);

      await waitFor(() => {
        expect(screen.getByTestId('news-filters')).toBeInTheDocument();
      });

      const filters = screen.getByTestId('news-filters');

      // Click Cyprus first
      await user.click(within(filters).getByRole('button', { name: /Cyprus/ }));

      await waitFor(() => {
        expect(adminAPI.getNewsItems).toHaveBeenCalledWith(1, 6, 'cyprus');
      });

      // Click All to reset
      await user.click(within(filters).getByRole('button', { name: /All/ }));

      await waitFor(() => {
        expect(adminAPI.getNewsItems).toHaveBeenCalledWith(1, 6, undefined);
      });
    });
  });

  describe('Error and Empty States', () => {
    it('returns null on error', async () => {
      (adminAPI.getNewsItems as Mock).mockRejectedValue(new Error('Network error'));

      render(<NewsSection />);

      await waitFor(() => {
        expect(screen.queryByTestId('news-section')).not.toBeInTheDocument();
      });
    });

    it('returns null when no items after loading', async () => {
      (adminAPI.getNewsItems as Mock).mockResolvedValue(createPaginatedResponse([], 0));

      render(<NewsSection />);

      await waitFor(() => {
        expect(screen.queryByTestId('news-section')).not.toBeInTheDocument();
      });
    });
  });

  // PERF-04-02/03: first-row eager wiring + null-variants guard
  describe('Eager loading for first-row cards (PERF-04-02/03)', () => {
    const variantSet = {
      400: 'https://cdn.example.com/img_400w.webp',
      800: 'https://cdn.example.com/img_800w.webp',
      1600: 'https://cdn.example.com/img_1600w.webp',
    };

    it('first 3 cards with non-null image_variants get loading="eager", 4th card stays lazy', async () => {
      // 4 items, all with non-null image_variants
      const items = Array.from({ length: 4 }, (_, i) =>
        createMockNewsItem({
          id: `item-${i}`,
          image_url: 'https://cdn.example.com/original.jpg',
          image_variants: variantSet,
        })
      );
      (adminAPI.getNewsItems as Mock).mockResolvedValue(createPaginatedResponse(items, 4));

      render(<NewsSection />);

      await waitFor(() => {
        expect(screen.getByTestId('news-section')).toBeInTheDocument();
      });

      // All 4 article images should be rendered — wait for the post-fetch
      // re-render (the section testid appears in the loading commit too), then
      // grab them in DOM order.
      await waitFor(() => {
        expect(document.querySelectorAll('img[aria-hidden="true"]')).toHaveLength(4);
      });
      const allImgs = Array.from(
        document.querySelectorAll('img[aria-hidden="true"]')
      ) as HTMLImageElement[];

      // First 3 must be eager (PERF-04-02 AC)
      expect(allImgs[0].getAttribute('loading')).toBe('eager');
      expect(allImgs[1].getAttribute('loading')).toBe('eager');
      expect(allImgs[2].getAttribute('loading')).toBe('eager');
      // 4th must NOT be eager
      expect(allImgs[3].getAttribute('loading')).toBe('lazy');
    });

    it('first-row card with null image_variants stays lazy (null-variants guard, PERF-04-03)', async () => {
      // Item 0 has null variants; item 1 has non-null variants — both are in the first row (index < 3)
      const items = [
        createMockNewsItem({
          id: 'item-null',
          image_url: 'https://cdn.example.com/original.jpg',
          image_variants: null, // null → must stay lazy even though index=0
        }),
        createMockNewsItem({
          id: 'item-variants',
          image_url: 'https://cdn.example.com/original.jpg',
          image_variants: variantSet, // has variants → must be eager
        }),
      ];
      (adminAPI.getNewsItems as Mock).mockResolvedValue(createPaginatedResponse(items, 2));

      render(<NewsSection />);

      await waitFor(() => {
        expect(screen.getByTestId('news-section')).toBeInTheDocument();
      });

      // Wait for the post-fetch re-render before reading the images.
      await waitFor(() => {
        expect(document.querySelectorAll('img[aria-hidden="true"]')).toHaveLength(2);
      });
      const allImgs = Array.from(
        document.querySelectorAll('img[aria-hidden="true"]')
      ) as HTMLImageElement[];

      // item-null: index=0 but image_variants==null → must NOT be eager
      expect(allImgs[0].getAttribute('loading')).toBe('lazy');
      // item-variants: index=1 with image_variants present → must be eager
      expect(allImgs[1].getAttribute('loading')).toBe('eager');
    });
  });
});
