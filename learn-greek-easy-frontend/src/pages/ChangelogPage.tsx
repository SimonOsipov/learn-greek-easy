/**
 * User-facing changelog page showing app updates and announcements.
 */

import React, { useCallback, useEffect, useRef } from 'react';

import { Flag, History, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  ChangelogCard,
  ChangelogCardSkeleton,
  ChangelogPagination,
  TagFilter,
} from '@/components/changelog';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  trackChangelogPagePaginated,
  trackChangelogPageViewed,
} from '@/lib/analytics/changelogAnalytics';
import {
  selectActiveTag,
  selectAllItems,
  selectChangelogError,
  selectChangelogItems,
  selectChangelogLoading,
  selectChangelogPage,
  selectChangelogPageSize,
  selectChangelogTotal,
  selectChangelogTotalPages,
  useChangelogStore,
} from '@/stores/changelogStore';

export function ChangelogPage() {
  const { t, i18n } = useTranslation('common');

  // Use selectors for optimized renders
  const items = useChangelogStore(selectChangelogItems);
  const isLoading = useChangelogStore(selectChangelogLoading);
  const error = useChangelogStore(selectChangelogError);
  const page = useChangelogStore(selectChangelogPage);
  const pageSize = useChangelogStore(selectChangelogPageSize);
  const total = useChangelogStore(selectChangelogTotal);
  const totalPages = useChangelogStore(selectChangelogTotalPages);
  const fetchChangelog = useChangelogStore((state) => state.fetchChangelog);
  const setPage = useChangelogStore((state) => state.setPage);
  const reset = useChangelogStore((state) => state.reset);
  const activeTag = useChangelogStore(selectActiveTag);
  const setTag = useChangelogStore((state) => state.setTag);
  const allItems = useChangelogStore(selectAllItems);

  // Track page view once
  const hasTrackedPageView = useRef(false);
  const hasHighlightedRef = useRef(false);

  // Effect 1: fetch on mount and re-fetch on language change (no reset on language change)
  useEffect(() => {
    fetchChangelog(i18n.language).catch(() => {
      // Error handled by store
    });
  }, [i18n.language, fetchChangelog]);

  // Effect 2: reset store on unmount only
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  // Track page view on first successful load
  useEffect(() => {
    if (!isLoading && items.length > 0 && !hasTrackedPageView.current) {
      trackChangelogPageViewed({
        page_number: page,
        total_items: total,
        items_on_page: items.length,
        language: i18n.language,
      });
      hasTrackedPageView.current = true;
    }
  }, [isLoading, items.length, total, page, i18n.language]);

  // Deep linking: scroll to entry from URL hash
  useEffect(() => {
    if (hasHighlightedRef.current || isLoading || allItems.length === 0) return;

    const hash = window.location.hash;
    if (!hash || !hash.startsWith('#entry-')) return;

    const entryId = hash.slice(7); // Remove "#entry-" prefix

    // Search allItems (full unfiltered dataset) to support cross-page navigation
    const idx = allItems.findIndex((item) => item.id === entryId);
    if (idx === -1) return;

    // Clear any active tag filter so the entry is visible
    setTag(null);

    // Calculate target page (pageSize is items per display page)
    const targetPage = Math.floor(idx / pageSize) + 1;
    if (targetPage !== page) {
      setPage(targetPage);
    }

    hasHighlightedRef.current = true;

    setTimeout(() => {
      const element = document.getElementById(`entry-${entryId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('highlight-animation');
        setTimeout(() => element.classList.remove('highlight-animation'), 2000);
      }
    }, 150);
  }, [isLoading, allItems, page, pageSize, setPage, setTag]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage !== page) {
        trackChangelogPagePaginated({
          from_page: page,
          to_page: newPage,
          total_pages: totalPages,
        });
        setPage(newPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [page, totalPages, setPage]
  );

  const handleRetry = useCallback(() => {
    fetchChangelog(i18n.language).catch(() => {
      // Error handled by store
    });
  }, [fetchChangelog, i18n.language]);

  return (
    <div className="space-y-6 pb-20 lg:pb-8" data-testid="changelog-page">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
          {t('changelog.page.title')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">
          {t('changelog.page.subtitle')}
        </p>
      </div>

      <TagFilter activeTag={activeTag} onTagChange={setTag} />

      {/* Error State */}
      {error && !isLoading && (
        <Card data-testid="changelog-error">
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('actions.retry')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && items.length === 0 && (
        <div className="space-y-4" data-testid="changelog-loading">
          {Array.from({ length: 5 }).map((_, i) => (
            <ChangelogCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Content */}
      {!isLoading && !error && items.length > 0 && (
        <>
          <div className="space-y-4" data-testid="changelog-list">
            {items.map((entry) => (
              <ChangelogCard key={entry.id} entry={entry} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <ChangelogPagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              itemsPerPage={pageSize}
              onPageChange={handlePageChange}
              isLoading={isLoading}
            />
          )}

          {/* End-of-list message on last page */}
          {page === totalPages && totalPages > 0 && (
            <div
              className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground"
              data-testid="changelog-end-message"
            >
              <Flag className="h-5 w-5" />
              <p className="text-sm">{t('endMessage', { ns: 'changelog' })}</p>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!isLoading && !error && items.length === 0 && (
        <EmptyState
          icon={History}
          title={t('changelog.empty.title')}
          description={t('changelog.empty.description')}
        />
      )}
    </div>
  );
}
