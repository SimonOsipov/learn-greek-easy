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
import { render, screen, waitFor } from '@/lib/test-utils';
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
    trackNewsLevelToggled: vi.fn(),
    trackNewsPageSeeAllClicked: vi.fn(),
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
  created_at: '2026-01-27T00:00:00Z',
  updated_at: '2026-01-27T00:00:00Z',
  country: 'cyprus',
  card_id: null,
  deck_id: null,
  title_el_a2: null,
  description_el_a2: null,
  audio_a2_url: null,
  audio_a2_duration_seconds: null,
  has_a2_content: false,
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

    it('renders country filter tabs', async () => {
      const items = [createMockNewsItem({ id: 'item-1' })];
      (adminAPI.getNewsItems as Mock).mockResolvedValue(
        createPaginatedResponse(items, 1, { cyprus: 3, greece: 2, world: 1 })
      );

      render(<NewsSection />);

      await waitFor(() => {
        expect(screen.getByTestId('news-section')).toBeInTheDocument();
      });

      const tabs = screen.getAllByRole('tab');
      const tabTexts = tabs.map((t) => t.textContent);
      expect(tabTexts.some((text) => text?.includes('All'))).toBe(true);
      expect(tabTexts.some((text) => text?.includes('Cyprus'))).toBe(true);
      expect(tabTexts.some((text) => text?.includes('Greece'))).toBe(true);
      expect(tabTexts.some((text) => text?.includes('World'))).toBe(true);
    });

    it('renders difficulty label', async () => {
      const items = [createMockNewsItem({ id: 'item-1' })];
      (adminAPI.getNewsItems as Mock).mockResolvedValue(createPaginatedResponse(items, 1));

      render(<NewsSection />);

      await waitFor(() => {
        expect(screen.getByText('Difficulty:')).toBeInTheDocument();
      });
    });

    it('renders level toggle', async () => {
      const items = [createMockNewsItem({ id: 'item-1' })];
      (adminAPI.getNewsItems as Mock).mockResolvedValue(createPaginatedResponse(items, 1));

      render(<NewsSection />);

      await waitFor(() => {
        expect(screen.getByTestId('news-level-toggle')).toBeInTheDocument();
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
    it('refetches with country param when clicking a country tab', async () => {
      const user = userEvent.setup();
      const items = [createMockNewsItem({ id: 'item-1' })];
      (adminAPI.getNewsItems as Mock).mockResolvedValue(
        createPaginatedResponse(items, 1, { cyprus: 3, greece: 2, world: 1 })
      );

      render(<NewsSection />);

      await waitFor(() => {
        expect(screen.getAllByRole('tab').length).toBeGreaterThan(0);
      });

      const tabs = screen.getAllByRole('tab');
      const cyprusTab = tabs.find((tab) => tab.textContent?.includes('Cyprus'));
      expect(cyprusTab).toBeDefined();
      await user.click(cyprusTab!);

      await waitFor(() => {
        expect(adminAPI.getNewsItems).toHaveBeenCalledWith(1, 6, 'cyprus');
      });
    });

    it('refetches without country param when clicking All tab', async () => {
      const user = userEvent.setup();
      const items = [createMockNewsItem({ id: 'item-1' })];
      (adminAPI.getNewsItems as Mock).mockResolvedValue(
        createPaginatedResponse(items, 1, { cyprus: 3, greece: 2, world: 1 })
      );

      render(<NewsSection />);

      await waitFor(() => {
        expect(screen.getAllByRole('tab').length).toBeGreaterThan(0);
      });

      const tabs = screen.getAllByRole('tab');

      // Click Cyprus first
      const cyprusTab = tabs.find((tab) => tab.textContent?.includes('Cyprus'));
      expect(cyprusTab).toBeDefined();
      await user.click(cyprusTab!);

      await waitFor(() => {
        expect(adminAPI.getNewsItems).toHaveBeenCalledWith(1, 6, 'cyprus');
      });

      // Click All to reset
      const allTab = tabs.find((tab) => tab.textContent?.startsWith('All'));
      expect(allTab).toBeDefined();
      await user.click(allTab!);

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
});
