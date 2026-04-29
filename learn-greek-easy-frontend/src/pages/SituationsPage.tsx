import React, { useEffect, useRef, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, BookOpen, Search, SlidersHorizontal, Volume2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLanguage } from '@/hooks/useLanguage';
import { track } from '@/lib/analytics';
import { getDeckBackgroundStyle } from '@/lib/deckBackground';
import { situationAPI } from '@/services/situationAPI';
import type { LearnerSituationListItem } from '@/types/situation';

const PAGE_SIZE = 20;

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

// Loading skeleton components
const SituationCardSkeleton: React.FC = () => {
  const { t } = useTranslation('common');
  return (
    <div
      className="overflow-hidden rounded-lg border bg-card shadow-sm"
      role="status"
      aria-label={t('situations.skeleton.loadingCard')}
    >
      <Skeleton className="h-1 w-full rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="flex gap-2 px-4 pb-4">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
    </div>
  );
};

const SituationGridSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <SituationCardSkeleton key={i} />
    ))}
  </div>
);

type CompletionFilter = 'all' | 'not-started' | 'in-progress' | 'completed';

function getCompletionStatus(
  item: LearnerSituationListItem
): 'not-started' | 'in-progress' | 'completed' {
  if (item.exercise_completed === 0) return 'not-started';
  if (item.exercise_total > 0 && item.exercise_completed === item.exercise_total)
    return 'completed';
  return 'in-progress';
}

// Token-based accent stripe — mirrors the deck-card recipe to avoid raw
// Tailwind palette classes. completed → success (emerald), in-progress →
// primary (brand blue), not-started → fg3 (slate, the documented neutral).
function getAccentStripeColor(item: LearnerSituationListItem): string {
  if (item.exercise_total > 0 && item.exercise_completed === item.exercise_total)
    return 'bg-success';
  if (item.exercise_completed > 0) return 'bg-primary';
  return 'bg-fg3';
}

export const SituationsPage: React.FC = () => {
  const { t } = useTranslation('common');
  const { currentLanguage } = useLanguage();
  const isMobile = useIsMobile();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [hasAudioFilter, setHasAudioFilter] = useState(false);
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const hasTrackedPageView = useRef(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['situations', page, debouncedSearch, hasAudioFilter],
    queryFn: () =>
      situationAPI.getList({
        page,
        page_size: PAGE_SIZE,
        search: debouncedSearch || undefined,
        has_audio: hasAudioFilter || undefined,
      }),
  });

  useEffect(() => {
    if (data && !hasTrackedPageView.current) {
      track('situation_list_viewed', { total_situations: data.total });
      hasTrackedPageView.current = true;
    }
  }, [data]);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const from = data ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = data ? Math.min(page * PAGE_SIZE, data.total) : 0;

  const getScenario = (item: LearnerSituationListItem) =>
    currentLanguage === 'ru' ? item.scenario_ru : item.scenario_en;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleAudioFilterToggle = () => {
    setHasAudioFilter((prev) => !prev);
    setPage(1);
  };

  const handleCompletionFilterToggle = (value: CompletionFilter) => {
    setCompletionFilter((prev) => (prev === value ? 'all' : value));
    setPage(1);
  };

  // Client-side completion filter applied to server results
  const filteredItems =
    data?.items.filter((item) => {
      if (completionFilter === 'all') return true;
      return getCompletionStatus(item) === completionFilter;
    }) ?? [];

  const activeFilterCount = (hasAudioFilter ? 1 : 0) + (completionFilter !== 'all' ? 1 : 0);

  return (
    <div className="space-y-6 pb-20 lg:pb-8" data-testid="situations-page">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
          {t('situations.page.title')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">
          {t('situations.page.subtitle')}
        </p>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3">
        {/* Row 1: Search + Counter (+ Filters toggle on mobile) */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={search}
              onChange={handleSearchChange}
              placeholder={t('situations.search.placeholder')}
              aria-label={t('situations.search.placeholder')}
              className="bg-card pl-10 pr-10"
              data-testid="situations-search"
            />
            {search.length > 0 && (
              <button
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={t('situations.search.clear')}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {isMobile && (
            <Button
              variant={filtersOpen ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltersOpen((prev) => !prev)}
              className="shrink-0 gap-1.5"
              aria-expanded={filtersOpen}
              data-testid="situations-filters-toggle"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {t('situations.filter.filters')}
              {activeFilterCount > 0 && (
                <span className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-foreground text-xs font-medium text-primary">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          )}
          {!isMobile && data && filteredItems.length !== data.total && (
            <span className="shrink-0 whitespace-nowrap text-sm text-muted-foreground">
              {t('situations.filter.showing', {
                count: filteredItems.length,
                total: data.total,
              })}
            </span>
          )}
        </div>

        {/* Row 2: Counter on mobile (below search), only when filtered */}
        {isMobile && data && filteredItems.length !== data.total && (
          <span className="block text-sm text-muted-foreground">
            {t('situations.filter.showing', {
              count: filteredItems.length,
              total: data.total,
            })}
          </span>
        )}

        {/* Row 3: Filter buttons — always visible on desktop, collapsible on mobile */}
        {(!isMobile || filtersOpen) && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={hasAudioFilter ? 'default' : 'outline'}
              size="sm"
              onClick={handleAudioFilterToggle}
              className="rounded-full"
              aria-pressed={hasAudioFilter}
              data-testid="situations-audio-filter"
            >
              {t('situations.filter.hasAudio')}
            </Button>
            <div className="h-6 w-px bg-border" aria-hidden="true" />
            <Button
              variant={completionFilter === 'not-started' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleCompletionFilterToggle('not-started')}
              className="rounded-full"
              aria-pressed={completionFilter === 'not-started'}
            >
              {t('situations.filter.notStarted')}
            </Button>
            <Button
              variant={completionFilter === 'in-progress' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleCompletionFilterToggle('in-progress')}
              className="rounded-full"
              aria-pressed={completionFilter === 'in-progress'}
            >
              {t('situations.filter.inProgress')}
            </Button>
            <Button
              variant={completionFilter === 'completed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleCompletionFilterToggle('completed')}
              className="rounded-full"
              aria-pressed={completionFilter === 'completed'}
            >
              {t('situations.filter.completed')}
            </Button>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setHasAudioFilter(false);
                  setCompletionFilter('all');
                  setPage(1);
                }}
                className="ml-auto text-muted-foreground hover:text-foreground"
              >
                <X className="mr-1 h-4 w-4" />
                {t('situations.filter.clearAll', 'Clear all')} ({activeFilterCount})
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Error State */}
      {isError && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-destructive" />
            <div className="flex-1">
              <h3 className="font-medium text-destructive">{t('situations.error.title')}</h3>
              <p className="mt-1 text-sm text-destructive/80">
                {t('situations.error.description')}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="mt-3 border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                {t('situations.error.retry')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && <SituationGridSkeleton />}

      {/* Card Grid */}
      {!isLoading && !isError && data && filteredItems.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item, index) => (
              <Link
                key={item.id}
                to={`/situations/${item.id}`}
                className="block"
                data-testid="situation-item"
                onClick={() =>
                  track('situation_card_clicked', {
                    situation_id: item.id,
                    has_audio: item.has_audio,
                    exercise_completed: item.exercise_completed,
                    exercise_total: item.exercise_total,
                    position: index,
                  })
                }
              >
                <Card
                  className="relative h-full min-h-[170px] cursor-pointer overflow-hidden transition-shadow hover:shadow-lg"
                  style={getDeckBackgroundStyle(item.source_image_url ?? undefined)}
                >
                  <div className={`h-1 w-full ${getAccentStripeColor(item)}`} />
                  <CardContent className="flex h-full flex-col gap-2 p-4">
                    <p className="line-clamp-2 text-lg font-semibold text-foreground">
                      {item.scenario_el}
                    </p>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {getScenario(item)}
                    </p>
                    <div className="mt-auto flex items-center gap-2 pt-2">
                      {item.has_audio && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                          <Volume2 className="h-3 w-3" />
                          {t('situations.card.audio')}
                        </span>
                      )}
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                        data-testid="exercise-badge"
                      >
                        <BookOpen className="h-3 w-3" />
                        {t('situations.card.exercises', {
                          completed: item.exercise_completed,
                          total: item.exercise_total,
                        })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {t('situations.pagination.showing', { from, to, total: data.total })}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page <= 1}
                  aria-label="Previous page"
                >
                  &larr;
                </Button>
                <span className="text-sm">
                  {t('pagination.page', { current: page, total: totalPages })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages}
                  aria-label="Next page"
                >
                  &rarr;
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!isLoading && !isError && data && filteredItems.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title={t('situations.empty.title')}
          description={t('situations.empty.description')}
        />
      )}
    </div>
  );
};
