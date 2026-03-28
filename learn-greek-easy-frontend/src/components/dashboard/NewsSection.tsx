/**
 * NewsSection Component
 *
 * Displays the 6 most recent news items on the dashboard.
 * Features:
 * - Fetches news via adminAPI.getNewsItems()
 * - Country filter tabs with counts
 * - Difficulty label + level toggle
 * - Shows loading skeleton while fetching
 * - Returns null if no items or on error (hides section gracefully)
 * - Responsive grid layout (1/2/3 columns)
 * - Cards with semi-transparent image backgrounds
 * - News content always displays in Greek (learning material)
 * - UI buttons follow user's language preference via i18n
 * - PostHog analytics tracking on click
 */

import React, { useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { NewsCard, NewsCardSkeleton, NewsFilters } from '@/components/news';
import { track } from '@/lib/analytics';
import { reportAPIError } from '@/lib/errorReporting';
import { adminAPI, type NewsCountry, type NewsItemResponse } from '@/services/adminAPI';
import { getPersistedNewsLevel, setPersistedNewsLevel, type NewsLevel } from '@/utils/newsLevel';

type CountryFilter = 'all' | NewsCountry;

/**
 * Main NewsSection component
 */
export const NewsSection: React.FC = () => {
  const { t } = useTranslation('common');

  const [items, setItems] = useState<NewsItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [newsLevel, setNewsLevel] = useState<NewsLevel>(getPersistedNewsLevel);
  const [countryFilter, setCountryFilter] = useState<CountryFilter>('all');
  const [countryCounts, setCountryCounts] = useState<{
    cyprus: number;
    greece: number;
    world: number;
  }>({ cyprus: 0, greece: 0, world: 0 });

  // News content always displays in Greek - this is learning material
  const newsLang: 'el' | 'en' | 'ru' = 'el';

  const handleLevelChange = useCallback((level: NewsLevel) => {
    setPersistedNewsLevel(level);
    setNewsLevel(level);
    track('news_level_toggled', { level, page: 'dashboard' });
  }, []);

  const fetchNews = useCallback(async (country?: NewsCountry) => {
    try {
      setLoading(true);
      setHasError(false);
      const response = await adminAPI.getNewsItems(1, 6, country);
      setItems(response.items);
      if (response.country_counts) {
        setCountryCounts(response.country_counts);
      }
    } catch (error) {
      reportAPIError(error, { operation: 'fetchNewsItems', endpoint: '/api/v1/news' });
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCountryChange = useCallback(
    (value: string) => {
      const newFilter = value as CountryFilter;
      setCountryFilter(newFilter);
      fetchNews(newFilter === 'all' ? undefined : (newFilter as NewsCountry));
    },
    [fetchNews]
  );

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

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
      {/* Header row: title + See All link */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t('dashboard.news.title')}</h2>
        <Link
          to="/news"
          onClick={() => track('news_page_see_all_clicked')}
          className="text-sm text-primary hover:underline"
          data-testid="news-section-see-all"
        >
          {t('dashboard.news.seeAll')} &rarr;
        </Link>
      </div>

      {/* Filter row: country buttons + difficulty toggle */}
      <NewsFilters
        countryFilter={countryFilter}
        onCountryChange={handleCountryChange}
        newsLevel={newsLevel}
        onLevelChange={handleLevelChange}
        countryCounts={countryCounts}
        className="mb-4"
      />

      {loading ? (
        <div
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
          data-testid="news-section-loading"
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <NewsCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <NewsCard
              key={item.id}
              article={item}
              newsLang={newsLang}
              page="dashboard"
              level={newsLevel}
              variant="compact"
            />
          ))}
        </div>
      )}
    </section>
  );
};
