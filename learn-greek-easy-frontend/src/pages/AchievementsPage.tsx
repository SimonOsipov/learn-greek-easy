import React, { useEffect, useMemo } from 'react';

import { Trophy, AlertCircle, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AchievementCategory } from '@/components/achievements';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
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
 * Loading skeleton for achievements page
 */
const AchievementsLoadingSkeleton: React.FC = () => (
  <div className="space-y-6">
    {/* Stats skeleton */}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="pt-6">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="mt-2 h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>

    {/* Category skeletons */}
    {[1, 2].map((i) => (
      <div key={i} className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((j) => (
            <Card key={j}>
              <CardContent className="p-4">
                <Skeleton className="h-24 w-full" />
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
    return groupByCategory(achievements.achievements);
  }, [achievements]);

  const categories = Object.keys(groupedAchievements);

  // Stats from API response
  const totalCount = achievements?.total_count ?? 0;
  const unlockedCount = achievements?.unlocked_count ?? 0;
  const totalXPEarned = achievements?.total_xp_earned ?? 0;
  const progressPercent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6 pb-8" data-testid="achievements-page">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary md:text-3xl">
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
              {t('stats.heading', 'Achievement Statistics')}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Unlocked Count */}
              <Card>
                <CardContent className="flex items-center gap-3 pt-6">
                  <div className="rounded-full bg-purple-100 p-3 dark:bg-purple-900/50">
                    <Trophy className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t('stats.unlocked', 'Unlocked')}
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {unlockedCount}
                      <span className="text-base font-normal text-muted-foreground">
                        /{totalCount}
                      </span>
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Progress Percentage */}
              <Card>
                <CardContent className="flex items-center gap-3 pt-6">
                  <div className="rounded-full bg-green-100 p-3 dark:bg-green-900/50">
                    <Trophy className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t('stats.progress', 'Progress')}
                    </p>
                    <p className="text-2xl font-bold text-foreground">{progressPercent}%</p>
                  </div>
                </CardContent>
              </Card>

              {/* Total XP Earned */}
              <Card>
                <CardContent className="flex items-center gap-3 pt-6">
                  <div className="rounded-full bg-amber-100 p-3 dark:bg-amber-900/50">
                    <Star className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t('stats.xpEarned', 'XP Earned')}
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {totalXPEarned.toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <Separator />

          {/* Achievement Categories */}
          {categories.length > 0 ? (
            <div className="space-y-8">
              {categories.map((category) => (
                <AchievementCategory
                  key={category}
                  category={category}
                  achievements={groupedAchievements[category]}
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
