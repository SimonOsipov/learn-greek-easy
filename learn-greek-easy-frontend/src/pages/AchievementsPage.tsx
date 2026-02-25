import React, { useEffect, useMemo, useState } from 'react';

import { Trophy, AlertCircle, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AchievementCard, AchievementCategory } from '@/components/achievements';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AchievementResponse } from '@/services/xpAPI';
import {
  useXPStore,
  selectAchievements,
  selectIsLoadingAchievements,
  selectXPError,
} from '@/stores/xpStore';

/**
 * Group achievements by category
 */
const groupByCategory = (
  achievements: AchievementResponse[]
): Record<string, AchievementResponse[]> => {
  return achievements.reduce(
    (groups, achievement) => {
      const category = achievement.category || 'other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(achievement);
      return groups;
    },
    {} as Record<string, AchievementResponse[]>
  );
};

/**
 * Normalise achievement data to fix backend inconsistencies.
 * When unlocked === true, progress is forced to 100 regardless of API value.
 */
export const normaliseAchievement = (a: AchievementResponse): AchievementResponse => ({
  ...a,
  progress: a.unlocked ? 100 : a.progress,
});

/**
 * Sort achievements within a category:
 * 1. Unlocked first
 * 2. In-progress (progress > 0) sorted by progress descending
 * 3. Locked (progress === 0)
 */
export const sortAchievements = (achievements: AchievementResponse[]): AchievementResponse[] => {
  return [...achievements].sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    return b.progress - a.progress;
  });
};

export type StatusFilter = 'all' | 'unlocked' | 'in_progress' | 'locked';

export const STATUS_FILTERS: Record<StatusFilter, (a: AchievementResponse) => boolean> = {
  all: () => true,
  unlocked: (a) => a.unlocked === true,
  in_progress: (a) => !a.unlocked && a.progress > 0,
  locked: (a) => !a.unlocked && a.progress === 0,
};

/**
 * Loading skeleton for achievements page
 */
const AchievementsLoadingSkeleton: React.FC = () => (
  <div className="space-y-6">
    {/* Mobile compact stats */}
    <Card className="sm:hidden">
      <CardContent className="grid grid-cols-3 gap-2 px-2 py-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-6 w-10" />
          </div>
        ))}
      </CardContent>
    </Card>

    {/* Desktop stat cards */}
    <div className="hidden gap-4 sm:grid sm:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-7 w-12" />
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>

    {/* Filter tabs skeleton */}
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-8 w-20 rounded-full" />
      ))}
    </div>

    {/* Collapsed category skeletons */}
    {[1, 2].map((i) => (
      <div key={i} className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-28" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-4" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[1, 2].map((j) => (
            <Card key={j}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    ))}
  </div>
);

/**
 * Empty state for achievements page
 */
const EmptyState: React.FC = () => {
  const { t } = useTranslation('achievements');

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-purple-100 p-4 dark:bg-purple-900/50">
        <Trophy className="h-8 w-8 text-purple-600 dark:text-purple-400" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">
        {t('empty.title', 'No achievements available')}
      </h3>
      <p className="mt-2 max-w-sm text-muted-foreground">
        {t('empty.description', 'Start learning to unlock achievements!')}
      </p>
    </div>
  );
};

/**
 * Achievements Page
 *
 * Displays all achievements grouped by category with:
 * - Overall stats header (unlocked count, total XP)
 * - Category sections with achievement cards
 * - Loading, empty, and error states
 */
const AchievementsPage: React.FC = () => {
  const { t } = useTranslation('achievements');
  const achievements = useXPStore(selectAchievements);
  const isLoading = useXPStore(selectIsLoadingAchievements);
  const error = useXPStore(selectXPError);
  const loadAchievements = useXPStore((state) => state.loadAchievements);

  // Load achievements on mount
  useEffect(() => {
    loadAchievements();
  }, [loadAchievements]);

  // Group achievements by category
  const groupedAchievements = useMemo(() => {
    if (!achievements?.achievements) return {};
    const normalised = achievements.achievements.map(normaliseAchievement);
    const grouped = groupByCategory(normalised);
    return Object.fromEntries(
      Object.entries(grouped).map(([cat, items]) => [cat, sortAchievements(items)])
    );
  }, [achievements]);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Compute counts for each filter tab
  const filterCounts = useMemo(() => {
    const all = achievements?.achievements ?? [];
    const normalised = all.map(normaliseAchievement);
    return {
      all: normalised.length,
      unlocked: normalised.filter(STATUS_FILTERS.unlocked).length,
      in_progress: normalised.filter(STATUS_FILTERS.in_progress).length,
      locked: normalised.filter(STATUS_FILTERS.locked).length,
    } satisfies Record<StatusFilter, number>;
  }, [achievements]);

  // Apply active filter to grouped achievements, hiding empty categories
  const filteredGroupedAchievements = useMemo(() => {
    const predicate = STATUS_FILTERS[statusFilter];
    const result: Record<string, AchievementResponse[]> = {};
    for (const [category, items] of Object.entries(groupedAchievements)) {
      const filtered = items.filter(predicate);
      if (filtered.length > 0) {
        result[category] = filtered;
      }
    }
    return result;
  }, [groupedAchievements, statusFilter]);

  const filteredCategories = Object.keys(filteredGroupedAchievements);

  // "Almost There" — top 3 in-progress achievements by progress descending
  const almostThereAchievements = useMemo(() => {
    if (!achievements?.achievements) return [];
    return achievements.achievements
      .map(normaliseAchievement)
      .filter((a) => !a.unlocked && a.progress > 0)
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 3);
  }, [achievements]);

  const showAlmostThere =
    almostThereAchievements.length > 0 &&
    (statusFilter === 'all' || statusFilter === 'in_progress');

  // Stats from API response
  const totalCount = achievements?.total_count ?? 0;
  const unlockedCount = achievements?.unlocked_count ?? 0;
  const totalXPEarned = achievements?.total_xp_earned ?? 0;
  const progressPercent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6 pb-24 lg:pb-8" data-testid="achievements-page">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
          {t('page.title', 'Achievements')}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t('page.subtitle', 'Track your learning milestones and earn rewards')}
        </p>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
            <div className="flex-1">
              <h3 className="font-medium text-red-900 dark:text-red-100">
                {t('error.loadFailed', 'Failed to load achievements')}
              </h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadAchievements(true)}
                className="mt-3 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300"
              >
                {t('error.retry', 'Try Again')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && !error && <AchievementsLoadingSkeleton />}

      {/* Main Content */}
      {!isLoading && !error && achievements && (
        <>
          {/* Stats Header */}
          <section aria-labelledby="achievements-stats-heading">
            <h2 id="achievements-stats-heading" className="sr-only">
              {t('stats.heading')}
            </h2>

            {/* Mobile: compact single card */}
            <Card className="sm:hidden">
              <CardContent className="grid grid-cols-3 gap-2 px-2 py-3">
                <div className="flex flex-col items-center text-center">
                  <div className="rounded-full bg-purple-100 p-1.5 dark:bg-purple-900/50">
                    <Trophy className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{t('stats.unlocked')}</p>
                  <p className="text-lg font-bold text-foreground">
                    {unlockedCount}
                    <span className="text-xs font-normal text-muted-foreground">/{totalCount}</span>
                  </p>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="rounded-full bg-green-100 p-1.5 dark:bg-green-900/50">
                    <Trophy className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{t('stats.progress')}</p>
                  <p className="text-lg font-bold text-foreground">{progressPercent}%</p>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="rounded-full bg-amber-100 p-1.5 dark:bg-amber-900/50">
                    <Star className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{t('stats.xpEarned')}</p>
                  <p className="text-lg font-bold text-foreground">
                    {totalXPEarned.toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Desktop: three separate cards */}
            <div className="hidden sm:grid sm:grid-cols-3 sm:gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <div className="rounded-full bg-purple-100 p-3 dark:bg-purple-900/50">
                    <Trophy className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <CardDescription>{t('stats.unlocked')}</CardDescription>
                    <CardTitle>
                      {unlockedCount}
                      <span className="text-base font-normal text-muted-foreground">
                        /{totalCount}
                      </span>
                    </CardTitle>
                  </div>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <div className="rounded-full bg-green-100 p-3 dark:bg-green-900/50">
                    <Trophy className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <CardDescription>{t('stats.progress')}</CardDescription>
                    <CardTitle>{progressPercent}%</CardTitle>
                  </div>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <div className="rounded-full bg-amber-100 p-3 dark:bg-amber-900/50">
                    <Star className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <CardDescription>{t('stats.xpEarned')}</CardDescription>
                    <CardTitle>{totalXPEarned.toLocaleString()}</CardTitle>
                  </div>
                </CardHeader>
              </Card>
            </div>
          </section>

          <Separator />

          {/* Status Filter Tabs */}
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <TabsList className="w-full justify-start">
              {(Object.keys(STATUS_FILTERS) as StatusFilter[]).map((key) => (
                <TabsTrigger key={key} value={key} className="gap-2">
                  {t(`filter.${key === 'in_progress' ? 'inProgress' : key}`)}
                  <Badge variant="secondary" className="ml-1 min-w-[1.25rem] px-1.5">
                    {filterCounts[key]}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Almost There Section */}
          {showAlmostThere && (
            <section
              className="rounded-lg border-l-4 border-amber-400 bg-amber-50/50 p-4 dark:border-amber-500 dark:bg-amber-950/20"
              aria-labelledby="almost-there-heading"
              data-testid="almost-there-section"
            >
              <div className="mb-3">
                <h2
                  id="almost-there-heading"
                  className="text-base font-semibold text-amber-900 dark:text-amber-200"
                >
                  {t('section.almostThereTitle', 'Almost There!')}
                </h2>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  {t('section.almostThereSubtitle', "You're so close to unlocking these!")}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {almostThereAchievements.map((achievement) => (
                  <AchievementCard
                    key={achievement.id}
                    achievement={achievement}
                    className="border-amber-200 opacity-100 dark:border-amber-800"
                  />
                ))}
              </div>
            </section>
          )}

          {/* Achievement Categories */}
          {filteredCategories.length > 0 ? (
            <div className="space-y-8">
              {filteredCategories.map((category) => (
                <AchievementCategory
                  key={category}
                  category={category}
                  achievements={filteredGroupedAchievements[category]}
                />
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </>
      )}

      {/* Empty State (no data) */}
      {!isLoading && !error && !achievements && <EmptyState />}
    </div>
  );
};

export default AchievementsPage;
