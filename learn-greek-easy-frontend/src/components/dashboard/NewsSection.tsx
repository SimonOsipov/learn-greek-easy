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

import { COUNTRY_CONFIG, NewsCard, NewsCardSkeleton, NewsLevelToggle } from '@/components/news';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trackNewsLevelToggled, trackNewsPageSeeAllClicked } from '@/lib/analytics';
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
    trackNewsLevelToggled({ level, page: 'dashboard' });
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
          onClick={() => trackNewsPageSeeAllClicked()}
          className="text-sm text-primary hover:underline"
          data-testid="news-section-see-all"
        >
          {t('dashboard.news.seeAll')} &rarr;
        </Link>
      </div>

      {/* Filter row: country tabs (left) + difficulty label + toggle (right) */}
      <div className="mb-4 flex items-center gap-4">
        <Tabs value={countryFilter} onValueChange={handleCountryChange} className="min-w-0 flex-1">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="all" className="gap-2">
              {t('news.country.all')}
              <Badge variant="secondary" className="ml-1 min-w-[1.25rem] px-1.5">
                {countryCounts.cyprus + countryCounts.greece + countryCounts.world}
              </Badge>
            </TabsTrigger>
            {(['cyprus', 'greece', 'world'] as const).map((country) => (
              <TabsTrigger key={country} value={country} className="gap-2">
                {COUNTRY_CONFIG[country].flag} {t(COUNTRY_CONFIG[country].labelKey)}
                <Badge variant="secondary" className="ml-1 min-w-[1.25rem] px-1.5">
                  {countryCounts[country]}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {t('news.level.difficulty')}
          </span>
          <NewsLevelToggle level={newsLevel} onChange={handleLevelChange} />
        </div>
      </div>

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
            />
          ))}
        </div>
      )}
    </section>
  );
};
