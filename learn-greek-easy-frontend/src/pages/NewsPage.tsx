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

import { AlertCircle, Headphones, Newspaper } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { NewsFilters, NewsGrid, NewsPagination, ScrollToTopButton } from '@/components/news';
import { NewsReaderSheet } from '@/components/news/NewsReaderSheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import '@/features/decks/dx/dx.css';
import { track } from '@/lib/analytics';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [countryCounts, setCountryCounts] = useState<{
    cyprus: number;
    greece: number;
    world: number;
  }>({ cyprus: 0, greece: 0, world: 0 });

  // Reader sheet state — which article (if any) is open in the slide-over
  const [openArticle, setOpenArticle] = useState<NewsItemResponse | null>(null);
  // Whether the reader should autostart playback (set when opened via a card Play button)
  const [openAutoplay, setOpenAutoplay] = useState(false);

  // Track if we've already tracked the page view (only track on first successful load)
  const hasTrackedPageView = useRef(false);

  // Stale-response guard — incremented on each fetch; resolved responses from
  // older requests are discarded if a newer request has already been issued.
  const latestRequestId = useRef(0);

  // Cache for previously fetched country+page results (cleared on unmount)
  const newsCache = useRef<
    Record<
      string,
      {
        articles: NewsItemResponse[];
        totalItems: number;
        countryCounts: { cyprus: number; greece: number; world: number };
      }
    >
  >({});

  // Calculate total pages
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  // True when a filter (country or search) is active — determines which empty-state branch to show.
  // newsLevel is intentionally excluded: it's display-only and never sent to the API.
  const isFiltered = countryFilter !== 'all' || searchQuery.trim().length > 0;

  /**
   * Fetch news articles for a specific page
   */
  const fetchNews = useCallback(
    async (page: number, country?: NewsCountry, q?: string) => {
      // Assign a unique ID to this invocation so stale responses can be detected
      const requestId = ++latestRequestId.current;

      const cacheKey = `${country ?? 'all'}:${q ?? ''}:${page}`;

      // Return cached data instantly (no loading spinner, no API call)
      const cached = newsCache.current[cacheKey];
      if (cached) {
        setArticles(cached.articles);
        setTotalItems(cached.totalItems);
        setCurrentPage(page);
        setCountryCounts(cached.countryCounts);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await adminAPI.getNewsItems(page, ITEMS_PER_PAGE, country, q || undefined);

        // Discard if a newer request was issued while this one was in flight
        if (requestId !== latestRequestId.current) return;

        setArticles(response.items);
        setTotalItems(response.total);
        setCurrentPage(page);
        if (response.country_counts) {
          setCountryCounts(response.country_counts);

          // Cache the result for future filter toggles
          newsCache.current[cacheKey] = {
            articles: response.items,
            totalItems: response.total,
            countryCounts: response.country_counts,
          };
        }

        // Track page view only on first successful load
        if (!hasTrackedPageView.current) {
          track('news_page_viewed', { total_articles: response.total });
          hasTrackedPageView.current = true;
        }
      } catch (err) {
        // Don't update error state if a newer request has already taken over
        if (requestId !== latestRequestId.current) return;

        const errorMessage = err instanceof Error ? err.message : t('news.error.description');
        setError(errorMessage);
        reportAPIError(err, {
          operation: 'fetchNewsItems',
          endpoint: '/api/v1/news',
          page,
        });
      } finally {
        // Only clear loading if this is still the latest request
        if (requestId === latestRequestId.current) {
          setIsLoading(false);
        }
      }
    },
    [t]
  );

  /**
   * Handle page change with analytics and scroll to top
   */
  const handlePageChange = useCallback(
    (newPage: number) => {
      track('news_page_paginated', {
        from_page: currentPage,
        to_page: newPage,
        total_pages: totalPages,
      });
      fetchNews(
        newPage,
        countryFilter === 'all' ? undefined : countryFilter,
        searchQuery || undefined
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [currentPage, totalPages, fetchNews, countryFilter, searchQuery]
  );

  /**
   * Handle country filter tab change
   */
  const handleCountryChange = useCallback(
    (value: string) => {
      const newFilter = value as CountryFilter;
      setCountryFilter(newFilter);
      fetchNews(
        1,
        newFilter === 'all' ? undefined : (newFilter as NewsCountry),
        searchQuery || undefined
      );
    },
    [fetchNews, searchQuery]
  );

  /**
   * Handle search query change — resets to page 1, preserves country + level
   */
  const handleSearchChange = useCallback(
    (q: string) => {
      setSearchQuery(q);
      fetchNews(1, countryFilter === 'all' ? undefined : countryFilter, q || undefined);
    },
    [fetchNews, countryFilter]
  );

  /**
   * Handle retry after error
   */
  const handleRetry = useCallback(() => {
    fetchNews(
      currentPage,
      countryFilter === 'all' ? undefined : countryFilter,
      searchQuery || undefined
    );
  }, [fetchNews, currentPage, countryFilter, searchQuery]);

  const handleLevelChange = useCallback((level: NewsLevel) => {
    setPersistedNewsLevel(level);
    setNewsLevel(level);
    track('news_level_toggled', { level, page: 'news' });
  }, []);

  /** Open the reader slide-over for an article. Fires news_article_opened.
   *  `opts.autoplay` (set when opened via a card Play button) autostarts the reader audio. */
  const handleOpenArticle = useCallback(
    (article: NewsItemResponse, opts?: { autoplay?: boolean }) => {
      setOpenArticle(article);
      setOpenAutoplay(opts?.autoplay ?? false);
      try {
        const domain = new URL(article.original_article_url).hostname;
        track('news_article_opened', {
          item_id: article.id,
          article_domain: domain,
          level: newsLevel,
        });
      } catch {
        track('news_article_opened', {
          item_id: article.id,
          level: newsLevel,
        });
      }
    },
    [newsLevel]
  );

  // Initial load
  useEffect(() => {
    fetchNews(1);
  }, [fetchNews]);

  return (
    <div className="space-y-6 pb-20 lg:pb-8" data-testid="news-page">
      {/* Page Header */}
      <div className="dx-index-head">
        <span className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-fg3 before:h-2 before:w-2 before:rounded-full before:bg-primary before:shadow-[0_0_0_4px_hsl(var(--primary)/0.18)] before:content-['']">
          {t('news.page.kicker')}
        </span>
        <h1
          className="m-0 font-display text-[clamp(34px,4vw,50px)] font-bold leading-[1.02] tracking-[-0.04em]"
          data-testid="news-page-title"
        >
          {t('news.page.title')}
        </h1>
        <p className="mt-2 text-[16px] text-fg2">{t('news.page.subtitle')}</p>
      </div>

      {/* Country Filters + Difficulty Toggle */}
      <NewsFilters
        countryFilter={countryFilter}
        onCountryChange={handleCountryChange}
        newsLevel={newsLevel}
        onLevelChange={handleLevelChange}
        countryCounts={countryCounts}
        searchValue={searchQuery}
        onSearchChange={handleSearchChange}
      />

      {/* Error State */}
      {error && (
        <Card className="border-danger/50 bg-danger/10" data-testid="news-error">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-danger" />
            <div className="flex-1">
              <h3 className="font-medium text-danger">{t('news.error.title')}</h3>
              <p className="mt-1 text-sm text-danger/80">{t('news.error.description')}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="mt-3 border-danger/30 text-danger hover:bg-danger/10"
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
          <NewsGrid
            articles={articles}
            newsLang={NEWS_LANG}
            level={newsLevel}
            onOpen={handleOpenArticle}
          />

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

      {/* Empty State — split: filtered vs truly-empty */}
      {!isLoading &&
        !error &&
        articles.length === 0 &&
        (isFiltered ? (
          <div
            className="glass flex min-h-[400px] flex-col items-center justify-center p-8 text-center"
            role="status"
            aria-label={t('news.empty.filtered.title')}
            data-testid="news-empty-filtered"
          >
            <Headphones className="mb-4 h-10 w-10 text-fg3" aria-hidden="true" />
            <h3 className="mb-2 font-display text-[19px] font-semibold text-fg">
              {t('news.empty.filtered.title')}
            </h3>
            <p className="max-w-sm text-sm text-fg2">{t('news.empty.filtered.body')}</p>
          </div>
        ) : (
          <div
            className="glass flex min-h-[400px] flex-col items-center justify-center p-8 text-center"
            role="status"
            aria-label={t('news.empty.title')}
            data-testid="news-empty"
          >
            <Newspaper className="mb-4 h-10 w-10 text-fg3" aria-hidden="true" />
            <h3 className="mb-2 font-display text-[19px] font-semibold text-fg">
              {t('news.empty.title')}
            </h3>
            <p className="max-w-sm text-sm text-fg2">{t('news.empty.description')}</p>
          </div>
        ))}

      <ScrollToTopButton />

      {/* Reader slide-over — renders at root of page to avoid z-index stacking issues */}
      <NewsReaderSheet
        article={openArticle}
        open={openArticle !== null}
        autoplay={openAutoplay}
        onOpenChange={(o) => {
          if (!o) {
            setOpenArticle(null);
            setOpenAutoplay(false);
          }
        }}
        level={newsLevel}
        onLevelChange={handleLevelChange}
      />
    </div>
  );
};
