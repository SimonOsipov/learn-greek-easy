import React, { useEffect, useRef, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, BookOpen, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/hooks/useLanguage';
import { track } from '@/lib/analytics';
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

export const SituationsPage: React.FC = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { currentLanguage } = useLanguage();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [hasAudioFilter, setHasAudioFilter] = useState(false);
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

  const handleAudioFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHasAudioFilter(e.target.checked);
    setPage(1);
  };

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          value={search}
          onChange={handleSearchChange}
          placeholder={t('situations.search.placeholder')}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:max-w-xs"
          data-testid="situations-search"
        />
        <label
          className="flex cursor-pointer items-center gap-2 text-sm"
          data-testid="situations-audio-filter"
        >
          <input
            type="checkbox"
            checked={hasAudioFilter}
            onChange={handleAudioFilterChange}
            className="h-4 w-4 rounded border-input"
          />
          <span>{t('situations.filter.hasAudio')}</span>
        </label>
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
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Card Grid */}
      {!isLoading && !isError && data && data.items.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.items.map((item) => (
              <Card
                key={item.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => navigate(`/situations/${item.id}`)}
                data-testid="situation-item"
              >
                <CardContent className="flex flex-col gap-2 p-4">
                  <p className="text-sm text-foreground">{getScenario(item)}</p>
                  <div className="flex items-center gap-2">
                    {item.has_audio && (
                      <Volume2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    )}
                    <span
                      className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                      data-testid="exercise-badge"
                    >
                      <BookOpen className="mr-1 inline h-3 w-3" />
                      {t('situations.card.exercises', {
                        completed: item.exercise_completed,
                        total: item.exercise_total,
                      })}
                    </span>
                  </div>
                </CardContent>
              </Card>
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
                >
                  &rarr;
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!isLoading && !isError && data && data.items.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title={t('situations.empty.title')}
          description={t('situations.empty.description')}
        />
      )}
    </div>
  );
};
