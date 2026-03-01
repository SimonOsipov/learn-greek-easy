/**
 * NewsPage Component
 *
 * Dedicated page for browsing news articles with:
 * - Paginated display (12 items per page)
 * - Loading state with skeleton grid
 * - Error state with retry button
 * - Empty state when no articles
 * - Analytics tracking for page views and pagination
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { AlertCircle, Newspaper } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/feedback/EmptyState';
import {
  COUNTRY_CONFIG,
  NewsGrid,
  NewsLevelToggle,
  NewsPagination,
  ScrollToTopButton,
} from '@/components/news';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  trackNewsLevelToggled,
  trackNewsPagePaginated,
  trackNewsPageViewed,
} from '@/lib/analytics/newsAnalytics';
import { reportAPIError } from '@/lib/errorReporting';
import { adminAPI, type NewsCountry, type NewsItemResponse } from '@/services/adminAPI';
import { getPersistedNewsLevel, setPersistedNewsLevel, type NewsLevel } from '@/utils/newsLevel';

/** Items displayed per page */
const ITEMS_PER_PAGE = 12;

/** News language - Greek for learning material */
const NEWS_LANG = 'el';

type CountryFilter = 'all' | NewsCountry;

export const NewsPage: React.FC = () => {
  const { t } = useTranslation('common');

  // State
  const [articles, setArticles] = useState<NewsItemResponse[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState<CountryFilter>('all');
  const [newsLevel, setNewsLevel] = useState<NewsLevel>(getPersistedNewsLevel);
  const [countryCounts, setCountryCounts] = useState<{
    cyprus: number;
    greece: number;
    world: number;
  }>({ cyprus: 0, greece: 0, world: 0 });

  // Track if we've already tracked the page view (only track on first successful load)
  const hasTrackedPageView = useRef(false);

  // Calculate total pages
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  /**
   * Fetch news articles for a specific page
   */
  const fetchNews = useCallback(
    async (page: number, country?: NewsCountry) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await adminAPI.getNewsItems(page, ITEMS_PER_PAGE, country);
        setArticles(response.items);
        setTotalItems(response.total);
        setCurrentPage(page);
        if (response.country_counts) {
          setCountryCounts(response.country_counts);
        }

        // Track page view only on first successful load
        if (!hasTrackedPageView.current) {
          trackNewsPageViewed({ total_articles: response.total });
          hasTrackedPageView.current = true;
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : t('news.error.description');
        setError(errorMessage);
        reportAPIError(err, {
          operation: 'fetchNewsItems',
          endpoint: '/api/v1/news',
          page,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [t]
  );

  /**
   * Handle page change with analytics and scroll to top
   */
  const handlePageChange = useCallback(
    (newPage: number) => {
      trackNewsPagePaginated({
        from_page: currentPage,
        to_page: newPage,
        total_pages: totalPages,
      });
      fetchNews(newPage, countryFilter === 'all' ? undefined : countryFilter);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [currentPage, totalPages, fetchNews, countryFilter]
  );

  /**
   * Handle country filter tab change
   */
  const handleCountryChange = useCallback(
    (value: string) => {
      const newFilter = value as CountryFilter;
      setCountryFilter(newFilter);
      fetchNews(1, newFilter === 'all' ? undefined : (newFilter as NewsCountry));
    },
    [fetchNews]
  );

  /**
   * Handle retry after error
   */
  const handleRetry = useCallback(() => {
    fetchNews(currentPage, countryFilter === 'all' ? undefined : countryFilter);
  }, [fetchNews, currentPage, countryFilter]);

  const handleLevelChange = useCallback((level: NewsLevel) => {
    setPersistedNewsLevel(level);
    setNewsLevel(level);
    trackNewsLevelToggled({ level, page: 'news' });
  }, []);

  // Initial load
  useEffect(() => {
    fetchNews(1);
  }, [fetchNews]);

  return (
    <div className="space-y-6 pb-20 lg:pb-8" data-testid="news-page">
      {/* Page Header */}
      <div>
        <h1
          className="text-2xl font-semibold text-foreground md:text-3xl"
          data-testid="news-page-title"
        >
          {t('news.page.title')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">{t('news.page.subtitle')}</p>
      </div>

      {/* Country Filter Tabs + Difficulty Toggle */}
      <div className="flex items-center gap-4">
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

      {/* Error State */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/10" data-testid="news-error">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-destructive" />
            <div className="flex-1">
              <h3 className="font-medium text-destructive">{t('news.error.title')}</h3>
              <p className="mt-1 text-sm text-destructive/80">{t('news.error.description')}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="mt-3 border-destructive/30 text-destructive hover:bg-destructive/10"
                data-testid="news-retry-button"
              >
                {t('news.error.retry')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && !error && (
        <NewsGrid
          articles={[]}
          newsLang={NEWS_LANG}
          isLoading={true}
          skeletonCount={ITEMS_PER_PAGE}
          level={newsLevel}
        />
      )}

      {/* Content: Grid + Pagination */}
      {!isLoading && !error && articles.length > 0 && (
        <>
          <NewsGrid articles={articles} newsLang={NEWS_LANG} level={newsLevel} />

          {totalPages > 1 && (
            <NewsPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={handlePageChange}
              isLoading={isLoading}
            />
          )}
        </>
      )}

      {/* Empty State */}
      {!isLoading && !error && articles.length === 0 && (
        <EmptyState
          icon={Newspaper}
          title={t('news.empty.title')}
          description={t('news.empty.description')}
        />
      )}

      <ScrollToTopButton />
    </div>
  );
};
