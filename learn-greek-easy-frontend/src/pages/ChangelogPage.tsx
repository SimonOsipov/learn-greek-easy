/**
 * User-facing changelog page showing app updates and announcements.
 */

import React, { useCallback, useEffect, useRef } from 'react';

import { History, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ChangelogCard, ChangelogCardSkeleton, ChangelogPagination } from '@/components/changelog';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  trackChangelogPagePaginated,
  trackChangelogPageViewed,
} from '@/lib/analytics/changelogAnalytics';
import {
  selectChangelogError,
  selectChangelogItems,
  selectChangelogLoading,
  selectChangelogPagination,
  useChangelogStore,
} from '@/stores/changelogStore';

export function ChangelogPage() {
  const { t, i18n } = useTranslation('common');

  // Use selectors for optimized renders
  const items = useChangelogStore(selectChangelogItems);
  const isLoading = useChangelogStore(selectChangelogLoading);
  const error = useChangelogStore(selectChangelogError);
  const { page, pageSize, total, totalPages } = useChangelogStore(selectChangelogPagination);
  const fetchChangelog = useChangelogStore((state) => state.fetchChangelog);
  const setPage = useChangelogStore((state) => state.setPage);
  const reset = useChangelogStore((state) => state.reset);

  // Track page view once
  const hasTrackedPageView = useRef(false);

  // Initial fetch
  useEffect(() => {
    fetchChangelog().catch(() => {
      // Error handled by store
    });

    return () => {
      reset();
    };
  }, [fetchChangelog, reset]);

  // Re-fetch on language change
  useEffect(() => {
    reset();
    fetchChangelog().catch(() => {
      // Error handled by store
    });
  }, [i18n.language, fetchChangelog, reset]);

  // Track page view on first successful load
  useEffect(() => {
    if (!isLoading && items.length > 0 && !hasTrackedPageView.current) {
      trackChangelogPageViewed({ total_entries: total });
      hasTrackedPageView.current = true;
    }
  }, [isLoading, items.length, total]);

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
    fetchChangelog().catch(() => {
      // Error handled by store
    });
  }, [fetchChangelog]);

  return (
    <div className="space-y-6 pb-8" data-testid="changelog-page">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
          {t('changelog.page.title')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">
          {t('changelog.page.subtitle')}
        </p>
      </div>

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
