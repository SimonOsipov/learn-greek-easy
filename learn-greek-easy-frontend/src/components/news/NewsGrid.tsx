/**
 * NewsGrid Component
 *
 * Responsive grid layout for displaying news articles.
 * Adapts from 1 column on mobile to 3 columns on large screens.
 *
 * Features:
 * - Responsive grid: 1 col -> 2 col (sm) -> 3 col (lg)
 * - Loading state with skeleton placeholders
 * - Accessibility attributes for screen readers
 * - Uses NewsCard with height="tall" (300px)
 */

import React from 'react';

import { useTranslation } from 'react-i18next';

import { type NewsItemResponse } from '@/services/adminAPI';

import { NewsCard } from './NewsCard';
import { NewsCardSkeleton } from './NewsCardSkeleton';

export interface NewsGridProps {
  /** Array of news articles to display */
  articles: NewsItemResponse[];
  /** Language for displaying news content */
  newsLang?: 'el' | 'en' | 'ru';
  /** Show loading skeleton state */
  isLoading?: boolean;
  /** Number of skeleton cards to show during loading */
  skeletonCount?: number;
}

export const NewsGrid: React.FC<NewsGridProps> = ({
  articles,
  newsLang = 'el',
  isLoading = false,
  skeletonCount = 8,
}) => {
  const { t } = useTranslation('common');

  // Loading state - show skeleton grid
  if (isLoading) {
    return (
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="news-grid-loading"
        role="list"
        aria-label={t('news.loading', 'Loading news articles')}
        aria-busy="true"
      >
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <div key={index} role="listitem">
            <NewsCardSkeleton height="tall" />
          </div>
        ))}
      </div>
    );
  }

  // Empty state - return null, parent component handles empty message
  if (!articles || articles.length === 0) {
    return null;
  }

  // Render news grid
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      data-testid="news-grid"
      role="list"
      aria-label={t('news.gridLabel', 'News articles')}
    >
      {articles.map((article) => (
        <div key={article.id} role="listitem">
          <NewsCard article={article} newsLang={newsLang} height="tall" />
        </div>
      ))}
    </div>
  );
};
