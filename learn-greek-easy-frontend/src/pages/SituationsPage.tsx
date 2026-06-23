import React, { useEffect, useRef, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Flame,
  Gauge,
  Layers,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { CultureMetricStrip } from '@/components/culture/redesign/CultureMetricStrip';
import { EmptyState } from '@/components/feedback/EmptyState';
import { SituationCard } from '@/components/situations/SituationCard';
import { SituationsHero } from '@/components/situations/SituationsHero';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Kicker } from '@/features/decks/dx';
import '@/features/decks/dx/dx.css';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLanguage } from '@/hooks/useLanguage';
import { track } from '@/lib/analytics';
import { situationAPI } from '@/services/situationAPI';
import type { LearnerSituationListItem } from '@/types/situation';

const PAGE_SIZE = 20;
const COMPREHENSION_ROUTE = '/situations/comprehension';

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
  <div className="cx-deck-grid">
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

  // Account-wide comprehension overview — non-critical; metrics fall back to 0
  // when unavailable. Loaded once (no page/filter dependency).
  const { data: comprehension } = useQuery({
    queryKey: ['situations-comprehension'],
    queryFn: () => situationAPI.getComprehension(),
    retry: false,
    staleTime: 60_000,
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

  // Server page items (unaffected by the client-side completion filter) — drive
  // the hero, what's-new chips, and the list-derived metrics.
  const pageItems = data?.items ?? [];

  // Client-side completion filter applied to server results — drives the grids.
  const filteredItems = pageItems.filter((item) => {
    if (completionFilter === 'all') return true;
    return getCompletionStatus(item) === completionFilter;
  });

  const activeFilterCount = (hasAudioFilter ? 1 : 0) + (completionFilter !== 'all' ? 1 : 0);

  // ── Resume hero: first in-progress situation, else first item ("start here") ──
  const inProgress = pageItems.find(
    (s) => s.exercise_completed > 0 && s.exercise_completed < s.exercise_total
  );
  const resumeItem = inProgress ?? pageItems[0];
  const resumeIsInProgress = !!inProgress;
  const resumePct =
    resumeItem && resumeItem.exercise_total > 0
      ? Math.round((resumeItem.exercise_completed / resumeItem.exercise_total) * 100)
      : 0;
  const siblings = resumeItem ? pageItems.filter((s) => s.id !== resumeItem.id).slice(0, 2) : [];

  const resumeStats = resumeItem
    ? [
        {
          label: t('situations.hub.statExercises', 'Exercises'),
          value: String(resumeItem.exercise_total),
        },
        {
          label: t('situations.hub.statAudio', 'Audio'),
          value: resumeItem.has_audio
            ? t('situations.hub.audioYes', 'Yes')
            : t('situations.hub.audioNo', 'No'),
        },
        {
          label: t('situations.hub.statComplete', 'Complete'),
          value: `${resumePct}%`,
        },
      ]
    : [];

  const resumeCtas = resumeItem
    ? [
        {
          label: resumeIsInProgress
            ? t('situations.hub.continue', 'Continue situation')
            : t('situations.hub.startHere', 'Start here'),
          to: `/situations/${resumeItem.id}`,
          primary: true,
          testId: 'situations-resume-cta',
        },
        {
          label: t('situations.hub.checkComprehension', 'Check comprehension'),
          to: COMPREHENSION_ROUTE,
          primary: false,
          testId: 'situations-comprehension-cta',
        },
      ]
    : [];

  // ── List-derived counts ──────────────────────────────────────────────────
  // Situations count uses the true server total. Completed is counted over the
  // loaded page: the list payload exposes no account-wide completed count, so the
  // figure is only the TRUE total when the whole dataset fits on the current page
  // (total <= page length). When the dataset spans multiple pages the count is
  // incomplete, so we mark the metric unwired (UnwiredDot) rather than show a
  // page-scoped number under an account-wide-looking label.
  const situationsTotal = data?.total ?? 0;
  const completedCount = pageItems.filter((s) => getCompletionStatus(s) === 'completed').length;
  const completedIsComplete = situationsTotal <= pageItems.length;
  const comprehensionPct = comprehension?.comprehension_percentage ?? 0;
  const streak = comprehension?.streak ?? 0;
  const whatsNewCount = comprehension?.whats_new_count ?? 0;

  // ── News-vs-everyday section split (description_source_type) ───────────────
  const newsItems = filteredItems.filter((s) => s.description_source_type === 'news');
  const everydayItems = filteredItems.filter((s) => s.description_source_type === 'original');
  // Items with no source-type signal (e.g. no description) fall into an "other"
  // bucket so they are never silently dropped from the grid.
  const otherItems = filteredItems.filter(
    (s) => s.description_source_type !== 'news' && s.description_source_type !== 'original'
  );
  const hasSections = newsItems.length > 0 || everydayItems.length > 0;

  const metrics = [
    {
      icon: <Layers size={18} aria-hidden />,
      label: t('situations.hub.metricSituations', 'Situations'),
      value: String(situationsTotal),
      tone: 'primary' as const,
    },
    {
      icon: <CheckCircle2 size={18} aria-hidden />,
      label: t('situations.hub.metricCompleted', 'Completed'),
      value: String(completedCount),
      tone: 'green' as const,
      // Page-scoped count is only the true account-wide total when the dataset
      // fits on one page; otherwise flag it as not-yet-wired.
      unwired: !completedIsComplete,
      unwiredLabel: t('situations.hub.metricCompletedUnwired', 'Completed count is page-scoped'),
    },
    {
      icon: <Gauge size={18} aria-hidden />,
      label: t('situations.hub.metricComprehension', 'Comprehension'),
      value: `${Math.round(comprehensionPct)}`,
      sub: '%',
      tone: 'violet' as const,
    },
    {
      icon: <Flame size={18} aria-hidden />,
      label: t('situations.hub.metricStreak', 'Streak'),
      value: String(streak),
      sub: t('situations.hub.days', 'days'),
      tone: 'amber' as const,
    },
  ];

  return (
    <div className="space-y-6 pb-20 lg:pb-8" data-testid="situations-page">
      {/* Page Header */}
      <div className="dx-index-head">
        <Kicker tone="primary">{t('situations.page.kicker')}</Kicker>
        <h1 className="dx-index-h">{t('situations.page.title')}</h1>
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
          {!isMobile && data && filteredItems.length !== pageItems.length && (
            <span className="shrink-0 whitespace-nowrap text-sm text-muted-foreground">
              {t('situations.filter.showing', {
                count: filteredItems.length,
                total: pageItems.length,
              })}
            </span>
          )}
        </div>

        {/* Row 2: Counter on mobile (below search), only when filtered */}
        {isMobile && data && filteredItems.length !== pageItems.length && (
          <span className="block text-sm text-muted-foreground">
            {t('situations.filter.showing', {
              count: filteredItems.length,
              total: pageItems.length,
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

      {/* Loaded content */}
      {!isLoading && !isError && data && (
        <>
          {/* Resume hero */}
          {resumeItem && (
            <SituationsHero
              situation={resumeItem}
              siblings={siblings}
              kicker={
                resumeIsInProgress
                  ? t('situations.hub.heroKickerResume', 'Continue where you left off')
                  : t('situations.hub.heroKickerStart', 'Start practising')
              }
              stats={resumeStats}
              ctas={resumeCtas}
              coverFootPct={resumePct}
            />
          )}

          {/* What's-new strip */}
          {situationsTotal > 0 && (
            <div className="cx-whatsnew">
              <span className="cx-whatsnew-l">
                {t('situations.hub.whatsNewLabel', 'Situations')}
              </span>
              <span className="cx-whatsnew-chip">
                {t('situations.hub.chipSituations', '{{n}} situations', { n: situationsTotal })}
              </span>
              {/* Completed chip only when the count covers the whole dataset
                  (single page) — otherwise it would be a misleading page-scoped figure. */}
              {completedIsComplete && (
                <>
                  <span className="cx-whatsnew-sep" aria-hidden />
                  <span className="cx-whatsnew-chip">
                    {t('situations.hub.chipCompleted', '{{n}} completed', { n: completedCount })}
                  </span>
                </>
              )}
              <span className="cx-whatsnew-sep" aria-hidden />
              <span className="cx-whatsnew-chip">
                {t('situations.hub.chipComprehension', '{{n}}% comprehension', {
                  n: Math.round(comprehensionPct),
                })}
              </span>
              {whatsNewCount > 0 && (
                <>
                  <span className="cx-whatsnew-sep" aria-hidden />
                  <span className="cx-whatsnew-chip">
                    {t('situations.hub.chipLatest', '{{n}} new this week', { n: whatsNewCount })}
                  </span>
                </>
              )}
              <Link
                to={COMPREHENSION_ROUTE}
                className="cx-whatsnew-cta"
                data-testid="situations-comprehension-chip"
              >
                {t('situations.hub.checkComprehensionArrow', 'Check comprehension →')}
              </Link>
            </div>
          )}

          {/* Metric strip */}
          {situationsTotal > 0 && <CultureMetricStrip metrics={metrics} />}

          {/* Sections / grid */}
          {filteredItems.length > 0 ? (
            hasSections ? (
              <>
                {/* From the news / Current affairs */}
                {newsItems.length > 0 && (
                  <section aria-label={t('situations.hub.sectionNewsTitle', 'From the news')}>
                    <div className="cx-section-head">
                      <Kicker tone="cyan">
                        {t('situations.hub.sectionNewsKicker', 'Current affairs')}
                      </Kicker>
                      <h2 className="cx-section-h">
                        {t('situations.hub.sectionNewsTitle', 'From the news')}
                        <span className="cx-section-meta">{newsItems.length}</span>
                      </h2>
                    </div>
                    <div className="cx-deck-grid">
                      {newsItems.map((item, index) => (
                        <SituationCard
                          key={item.id}
                          item={item}
                          scenario={getScenario(item)}
                          index={index}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Everyday & travel — rendered only when original-source situations exist */}
                {everydayItems.length > 0 && (
                  <section
                    aria-label={t('situations.hub.sectionEverydayTitle', 'Everyday & travel')}
                  >
                    <div className="cx-section-head">
                      <Kicker tone="violet">
                        {t('situations.hub.sectionEverydayKicker', 'Daily life')}
                      </Kicker>
                      <h2 className="cx-section-h">
                        {t('situations.hub.sectionEverydayTitle', 'Everyday & travel')}
                        <span className="cx-section-meta">{everydayItems.length}</span>
                      </h2>
                    </div>
                    <div className="cx-deck-grid">
                      {everydayItems.map((item, index) => (
                        <SituationCard
                          key={item.id}
                          item={item}
                          scenario={getScenario(item)}
                          index={index}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Other (no source-type signal) — never silently dropped */}
                {otherItems.length > 0 && (
                  <section aria-label={t('situations.hub.sectionOtherTitle', 'More situations')}>
                    <div className="cx-section-head">
                      <Kicker tone="primary">
                        {t('situations.hub.sectionOtherKicker', 'Browse')}
                      </Kicker>
                      <h2 className="cx-section-h">
                        {t('situations.hub.sectionOtherTitle', 'More situations')}
                        <span className="cx-section-meta">{otherItems.length}</span>
                      </h2>
                    </div>
                    <div className="cx-deck-grid">
                      {otherItems.map((item, index) => (
                        <SituationCard
                          key={item.id}
                          item={item}
                          scenario={getScenario(item)}
                          index={index}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </>
            ) : (
              // Fallback: no source-type sectioning available — flat grid.
              <div className="cx-deck-grid">
                {filteredItems.map((item, index) => (
                  <SituationCard
                    key={item.id}
                    item={item}
                    scenario={getScenario(item)}
                    index={index}
                  />
                ))}
              </div>
            )
          ) : (
            <EmptyState
              icon={BookOpen}
              title={t('situations.empty.title')}
              description={t('situations.empty.description')}
            />
          )}

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
    </div>
  );
};
