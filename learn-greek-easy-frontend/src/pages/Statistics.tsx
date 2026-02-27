import React, { useEffect } from 'react';

import { useTranslation } from 'react-i18next';

import {
  ProgressLineChart,
  AccuracyAreaChart,
  DeckPerformanceChart,
  StageDistributionChart,
} from '@/components/charts';
import {
  StatsGrid,
  LevelProgressCard,
  AchievementsGrid,
  achievementConfigs,
  CultureReadinessCard,
  MotivationalMessageCard,
} from '@/components/statistics';
import type { Achievement } from '@/components/statistics';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuthStore } from '@/stores/authStore';
import { useXPStore, selectXPStats } from '@/stores/xpStore';

/**
 * Loading skeleton for the statistics page
 */
const StatisticsLoadingSkeleton: React.FC = () => (
  <div className="space-y-6">
    {/* Culture Readiness Skeleton */}
    <Card>
      <CardContent className="flex items-center gap-6 p-6">
        <Skeleton className="h-[120px] w-[120px] shrink-0 rounded-full" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </CardContent>
      <CardContent>
        {/* Category row skeletons */}
        <div className="mt-4 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-20 shrink-0" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-16 shrink-0" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    {/* Stats Grid Skeleton */}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-20" />
            <Skeleton className="mt-2 h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>

    {/* Level Progress Skeleton */}
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-2 h-4 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="mt-3 h-4 w-64" />
      </CardContent>
    </Card>

    {/* Charts Skeleton */}
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[280px] w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);

/**
 * Statistics Page
 *
 * Displays comprehensive analytics and learning statistics:
 * - User stats grid (streak, words learned, total XP)
 * - Level progress card
 * - Progress over time (line chart)
 * - Accuracy trend (area chart)
 * - Deck performance comparison (bar chart)
 * - Learning stage distribution (pie chart)
 * - Achievements grid
 * - Activity timeline
 *
 * All charts fetch their own data via hooks.
 */
const Statistics: React.FC = () => {
  const { t } = useTranslation('statistics');
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const { data: analyticsData } = useAnalytics(true); // Auto-load analytics on mount
  const xpStats = useXPStore(selectXPStats);
  const loadXPStats = useXPStore((state) => state.loadXPStats);

  // Load XP stats on mount
  useEffect(() => {
    loadXPStats();
  }, [loadXPStats]);

  // Show loading skeleton while user data is loading
  if (isLoading) {
    return (
      <div className="space-y-6 pb-8" data-testid="statistics-page">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground md:text-3xl">{t('page.title')}</h1>
          <p className="mt-2 text-muted-foreground">{t('page.subtitle')}</p>
        </div>
        <StatisticsLoadingSkeleton />
      </div>
    );
  }

  // Handle case where user is not available
  if (!user) {
    return (
      <div className="space-y-6 pb-8" data-testid="statistics-page">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground md:text-3xl">{t('page.title')}</h1>
          <p className="mt-2 text-muted-foreground">{t('page.subtitle')}</p>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">{t('page.loginRequired')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Extract stats from user
  const { stats } = user;

  // Get streak from analytics data (fetched from backend API)
  const currentStreak = analyticsData?.streak?.currentStreak ?? 0;

  const wordsLearned = analyticsData?.summary?.totalCardsReviewed ?? 0;
  const achievements: Achievement[] = achievementConfigs.map((config) => ({
    id: config.id,
    name: t(config.nameKey),
    icon: config.icon,
    unlocked: config.checkUnlocked(wordsLearned, currentStreak),
    description: t(config.descriptionKey),
  }));

  return (
    <div className="space-y-6 pb-8" data-testid="statistics-page">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground md:text-3xl">{t('page.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('page.subtitle')}</p>
      </div>

      {/* Culture Exam Readiness */}
      <section aria-labelledby="culture-readiness-heading" className="mb-6">
        <h2 id="culture-readiness-heading" className="sr-only">
          {t('cultureReadiness.title')}
        </h2>
        <CultureReadinessCard />
        <div className="mt-3">
          <MotivationalMessageCard />
        </div>
      </section>

      {/* User Stats Section */}
      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">
          {t('page.learningStats')}
        </h2>
        <StatsGrid
          streak={currentStreak}
          wordsLearned={analyticsData?.summary?.totalCardsReviewed ?? 0}
          totalXP={xpStats?.total_xp ?? 0}
          cultureQuestionsMastered={analyticsData?.summary?.cultureQuestionsMastered ?? 0}
          joinedDate={stats.joinedDate}
        />
      </section>

      {/* Level Progress */}
      <LevelProgressCard />

      <Separator />

      {/* Achievements */}
      <AchievementsGrid achievements={achievements} />

      {/* Analytics Charts Section */}
      <section aria-labelledby="analytics-heading">
        <h2 id="analytics-heading" className="mb-4 text-lg font-semibold text-foreground">
          {t('page.learningAnalytics')}
        </h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Progress Over Time */}
          <ProgressLineChart height={280} />

          {/* Accuracy Trend */}
          <AccuracyAreaChart height={280} />

          {/* Deck Performance */}
          <DeckPerformanceChart height={320} maxDecks={6} />

          {/* Stage Distribution */}
          <StageDistributionChart height={320} />
        </div>
      </section>
    </div>
  );
};

export default Statistics;
