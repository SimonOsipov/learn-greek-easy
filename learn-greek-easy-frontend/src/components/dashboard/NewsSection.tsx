/**
 * NewsSection Component
 *
 * Displays the 3 most recent news items on the dashboard.
 * Features:
 * - Fetches news via adminAPI.getNewsItems()
 * - Shows loading skeleton while fetching
 * - Returns null if no items or on error (hides section gracefully)
 * - Responsive grid layout (1/2/3 columns)
 * - Cards with semi-transparent image backgrounds
 * - News content always displays in Greek (learning material)
 * - UI buttons follow user's language preference via i18n
 * - PostHog analytics tracking on click
 */

import React, { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { NewsCard, NewsCardSkeleton } from '@/components/news';
import { trackNewsPageSeeAllClicked } from '@/lib/analytics';
import { reportAPIError } from '@/lib/errorReporting';
import { adminAPI, type NewsItemResponse } from '@/services/adminAPI';

/**
 * Main NewsSection component
 */
export const NewsSection: React.FC = () => {
  const { t } = useTranslation('common');

  const [items, setItems] = useState<NewsItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // News content always displays in Greek - this is learning material
  const newsLang: 'el' | 'en' | 'ru' = 'el';

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setLoading(true);
        setHasError(false);
        const response = await adminAPI.getNewsItems(1, 3);
        setItems(response.items);
      } catch (error) {
        reportAPIError(error, { operation: 'fetchNewsItems', endpoint: '/api/v1/news' });
        setHasError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

  // Hide section on error
  if (hasError) {
    return null;
  }

  // Hide section if no items (after loading completes)
  if (!loading && items.length === 0) {
    return null;
  }

  return (
    <section data-testid="news-section">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t('dashboard.news.title')}</h2>
        <Link
          to="/news"
          onClick={() => trackNewsPageSeeAllClicked()}
          className="text-sm text-primary hover:underline"
          data-testid="news-section-see-all"
        >
          {t('dashboard.news.seeAll')} &rarr;
        </Link>
      </div>
      {loading ? (
        <div
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
          data-testid="news-section-loading"
        >
          {[1, 2, 3].map((i) => (
            <NewsCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <NewsCard key={item.id} article={item} newsLang={newsLang} page="dashboard" />
          ))}
        </div>
      )}
    </section>
  );
};
