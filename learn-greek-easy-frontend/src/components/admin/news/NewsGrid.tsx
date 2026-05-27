// src/components/admin/news/NewsGrid.tsx

import React from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { Button } from '@/components/ui/button';
import { Kicker } from '@/components/ui/kicker';
import { selectFilteredNewsItems, useAdminNewsStore } from '@/stores/adminNewsStore';

import { NewsCard } from './NewsCard';

export interface NewsGridProps {
  onRequestDelete: (id: string) => void;
}

export const NewsGrid: React.FC<NewsGridProps> = ({ onRequestDelete }) => {
  const { t } = useTranslation('admin');
  // useShallow prevents infinite re-renders caused by selectFilteredNewsItems
  // returning a new array reference (.filter().sort()) on every call.
  const items = useAdminNewsStore(useShallow(selectFilteredNewsItems));
  const {
    page,
    pageSize,
    total,
    totalPages,
    setPage,
    setCountryFilter,
    setLevelFilter,
    setSearchQuery,
    setSortMode,
  } = useAdminNewsStore();

  function handleClearFilters() {
    setCountryFilter('all');
    setLevelFilter('all');
    setSearchQuery('');
    setSortMode('newest');
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Kicker dot="amber">{t('news.list.emptyTitle')}</Kicker>
          <p className="text-sm text-muted-foreground">{t('news.list.emptyBody')}</p>
          <Button variant="outline" size="sm" onClick={handleClearFilters}>
            {t('news.list.clearFilters')}
          </Button>
        </div>
      ) : (
        <section className="news-grid">
          {items.map((item) => (
            <NewsCard key={item.id} item={item} onRequestDelete={onRequestDelete} />
          ))}
        </section>
      )}

      {/* Pagination footer — hidden when only one page */}
      {totalPages > 1 && (
        <div
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          data-testid="news-grid-pagination"
        >
          <p className="text-sm text-muted-foreground">
            {t('news.list.pagerShowing', { from, to, total })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              aria-label={t('shell.pagination.previousLabel')}
              data-testid="news-grid-prev"
            >
              <ChevronLeft className="h-4 w-4" />
              {t('news.list.pagerPrevious')}
            </Button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
              aria-label={t('shell.pagination.nextLabel')}
              data-testid="news-grid-next"
            >
              {t('news.list.pagerNext')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
