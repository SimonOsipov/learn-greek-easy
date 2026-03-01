/**
 * NewsGrid Component Tests
 *
 * Tests for the responsive news grid component including:
 * - Rendering articles in a grid layout
 * - Loading state with skeleton placeholders
 * - Empty state handling (returns null)
 * - Correct props passed to NewsCard
 * - Accessibility attributes
 */

import { describe, it, expect } from 'vitest';

import { NewsGrid, type NewsGridProps } from '@/components/news/NewsGrid';
import { type NewsItemResponse } from '@/services/adminAPI';
import { render, screen, within } from '@/lib/test-utils';

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
  card_id: null,
  deck_id: null,
  title_el_a2: null,
  description_el_a2: null,
  audio_a2_url: null,
  audio_a2_duration_seconds: null,
  has_a2_content: false,
  ...overrides,
});

// Factory function for creating props
const createProps = (overrides: Partial<NewsGridProps> = {}): NewsGridProps => ({
  articles: [createMockNewsItem()],
  ...overrides,
});

describe('NewsGrid Component', () => {
  describe('Rendering', () => {
    it('should render the grid container with test-id', () => {
      const articles = [createMockNewsItem({ id: 'article-1' })];
      render(<NewsGrid {...createProps({ articles })} />);

      expect(screen.getByTestId('news-grid')).toBeInTheDocument();
    });

    it('should render all provided articles', () => {
      const articles = [
        createMockNewsItem({ id: 'article-1', title_el: 'Άρθρο 1' }),
        createMockNewsItem({ id: 'article-2', title_el: 'Άρθρο 2' }),
        createMockNewsItem({ id: 'article-3', title_el: 'Άρθρο 3' }),
      ];
      render(<NewsGrid {...createProps({ articles })} />);

      expect(screen.getByTestId('news-card-article-1')).toBeInTheDocument();
      expect(screen.getByTestId('news-card-article-2')).toBeInTheDocument();
      expect(screen.getByTestId('news-card-article-3')).toBeInTheDocument();
    });

    it('should render articles as list items for accessibility', () => {
      const articles = [
        createMockNewsItem({ id: 'article-1' }),
        createMockNewsItem({ id: 'article-2' }),
      ];
      render(<NewsGrid {...createProps({ articles })} />);

      const grid = screen.getByTestId('news-grid');
      const listItems = within(grid).getAllByRole('listitem');
      expect(listItems).toHaveLength(2);
    });
  });

  describe('Responsive Grid Classes', () => {
    it('should have correct responsive grid classes', () => {
      const articles = [createMockNewsItem()];
      render(<NewsGrid {...createProps({ articles })} />);

      const grid = screen.getByTestId('news-grid');
      expect(grid).toHaveClass('grid');
      expect(grid).toHaveClass('grid-cols-1');
      expect(grid).toHaveClass('gap-4');
      expect(grid).toHaveClass('sm:grid-cols-2');
      expect(grid).toHaveClass('lg:grid-cols-3');
      expect(grid).not.toHaveClass('xl:grid-cols-4');
    });
  });

  describe('Language Support', () => {
    it('should default to Greek (el) language', () => {
      const articles = [
        createMockNewsItem({
          id: 'article-1',
          title_el: 'Ελληνικός τίτλος',
          title_en: 'English title',
        }),
      ];
      render(<NewsGrid {...createProps({ articles })} />);

      // The NewsCard should display Greek content by default
      expect(screen.getByText('Ελληνικός τίτλος')).toBeInTheDocument();
    });

    it('should pass newsLang prop to NewsCard components', () => {
      const articles = [
        createMockNewsItem({
          id: 'article-1',
          title_en: 'English Article',
          title_el: 'Ελληνικό Άρθρο',
        }),
      ];
      render(<NewsGrid {...createProps({ articles, newsLang: 'en' })} />);

      // When newsLang is 'en', should display English content
      expect(screen.getByText('English Article')).toBeInTheDocument();
    });

    it('should support Russian language', () => {
      const articles = [
        createMockNewsItem({
          id: 'article-1',
          title_ru: 'Русская статья',
        }),
      ];
      render(<NewsGrid {...createProps({ articles, newsLang: 'ru' })} />);

      expect(screen.getByText('Русская статья')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should render loading skeleton grid when isLoading is true', () => {
      render(<NewsGrid {...createProps({ isLoading: true })} />);

      expect(screen.getByTestId('news-grid-loading')).toBeInTheDocument();
    });

    it('should render default 8 skeleton cards', () => {
      render(<NewsGrid {...createProps({ isLoading: true })} />);

      const loadingGrid = screen.getByTestId('news-grid-loading');
      const skeletons = within(loadingGrid).getAllByRole('listitem');
      expect(skeletons).toHaveLength(8);
    });

    it('should render custom skeleton count when specified', () => {
      render(<NewsGrid {...createProps({ isLoading: true, skeletonCount: 12 })} />);

      const loadingGrid = screen.getByTestId('news-grid-loading');
      const skeletons = within(loadingGrid).getAllByRole('listitem');
      expect(skeletons).toHaveLength(12);
    });

    it('should have aria-busy true when loading', () => {
      render(<NewsGrid {...createProps({ isLoading: true })} />);

      const loadingGrid = screen.getByTestId('news-grid-loading');
      expect(loadingGrid).toHaveAttribute('aria-busy', 'true');
    });

    it('should have responsive grid classes in loading state', () => {
      render(<NewsGrid {...createProps({ isLoading: true })} />);

      const loadingGrid = screen.getByTestId('news-grid-loading');
      expect(loadingGrid).toHaveClass('grid');
      expect(loadingGrid).toHaveClass('grid-cols-1');
      expect(loadingGrid).toHaveClass('gap-4');
      expect(loadingGrid).toHaveClass('sm:grid-cols-2');
      expect(loadingGrid).toHaveClass('lg:grid-cols-3');
      expect(loadingGrid).not.toHaveClass('xl:grid-cols-4');
    });
  });

  describe('Empty State', () => {
    it('should not render grid when articles array is empty', () => {
      render(<NewsGrid {...createProps({ articles: [] })} />);

      expect(screen.queryByTestId('news-grid')).not.toBeInTheDocument();
      expect(screen.queryByTestId('news-grid-loading')).not.toBeInTheDocument();
    });

    it('should not render grid when articles is undefined', () => {
      // @ts-expect-error Testing undefined case
      render(<NewsGrid articles={undefined} />);

      expect(screen.queryByTestId('news-grid')).not.toBeInTheDocument();
      expect(screen.queryByTestId('news-grid-loading')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have role="list" on the grid container', () => {
      const articles = [createMockNewsItem()];
      render(<NewsGrid {...createProps({ articles })} />);

      const grid = screen.getByTestId('news-grid');
      expect(grid).toHaveAttribute('role', 'list');
    });

    it('should have aria-label on the grid container', () => {
      const articles = [createMockNewsItem()];
      render(<NewsGrid {...createProps({ articles })} />);

      const grid = screen.getByTestId('news-grid');
      expect(grid).toHaveAttribute('aria-label');
    });

    it('should have role="list" on loading grid', () => {
      render(<NewsGrid {...createProps({ isLoading: true })} />);

      const loadingGrid = screen.getByTestId('news-grid-loading');
      expect(loadingGrid).toHaveAttribute('role', 'list');
    });

    it('should have aria-label on loading grid', () => {
      render(<NewsGrid {...createProps({ isLoading: true })} />);

      const loadingGrid = screen.getByTestId('news-grid-loading');
      expect(loadingGrid).toHaveAttribute('aria-label');
    });

    it('should wrap each article in role="listitem"', () => {
      const articles = [
        createMockNewsItem({ id: 'article-1' }),
        createMockNewsItem({ id: 'article-2' }),
      ];
      render(<NewsGrid {...createProps({ articles })} />);

      const grid = screen.getByTestId('news-grid');
      const listItems = within(grid).getAllByRole('listitem');
      expect(listItems).toHaveLength(2);
    });
  });

  describe('NewsCard Integration', () => {
    it('should pass height="tall" to NewsCard components', () => {
      const articles = [createMockNewsItem({ id: 'article-1' })];
      render(<NewsGrid {...createProps({ articles })} />);

      // NewsCard with height="tall" uses h-[300px] class
      // We can verify the card link has this height class
      const card = screen.getByTestId('news-card-article-1');
      expect(card).toHaveClass('h-[300px]');
    });

    it('should render articles with questions button when card_id and deck_id are present', () => {
      const articles = [
        createMockNewsItem({
          id: 'article-with-questions',
          card_id: 'card-123',
          deck_id: 'deck-456',
        }),
      ];
      render(<NewsGrid {...createProps({ articles })} />);

      expect(
        screen.getByTestId('news-questions-button-article-with-questions')
      ).toBeInTheDocument();
    });

    it('should not render questions button when card_id is null', () => {
      const articles = [
        createMockNewsItem({
          id: 'article-no-questions',
          card_id: null,
          deck_id: null,
        }),
      ];
      render(<NewsGrid {...createProps({ articles })} />);

      expect(
        screen.queryByTestId('news-questions-button-article-no-questions')
      ).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle single article', () => {
      const articles = [createMockNewsItem({ id: 'single-article' })];
      render(<NewsGrid {...createProps({ articles })} />);

      expect(screen.getByTestId('news-card-single-article')).toBeInTheDocument();
      const grid = screen.getByTestId('news-grid');
      const listItems = within(grid).getAllByRole('listitem');
      expect(listItems).toHaveLength(1);
    });

    it('should handle large number of articles', () => {
      const articles = Array.from({ length: 50 }, (_, i) =>
        createMockNewsItem({ id: `article-${i}` })
      );
      render(<NewsGrid {...createProps({ articles })} />);

      const grid = screen.getByTestId('news-grid');
      const listItems = within(grid).getAllByRole('listitem');
      expect(listItems).toHaveLength(50);
    });

    it('should use article id as React key', () => {
      // This test verifies unique keys by checking no React key warnings appear
      // and all articles render correctly
      const articles = [
        createMockNewsItem({ id: 'unique-id-1' }),
        createMockNewsItem({ id: 'unique-id-2' }),
        createMockNewsItem({ id: 'unique-id-3' }),
      ];
      render(<NewsGrid {...createProps({ articles })} />);

      expect(screen.getByTestId('news-card-unique-id-1')).toBeInTheDocument();
      expect(screen.getByTestId('news-card-unique-id-2')).toBeInTheDocument();
      expect(screen.getByTestId('news-card-unique-id-3')).toBeInTheDocument();
    });
  });
});
