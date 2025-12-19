import React from 'react';

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
  getDefaultAchievements,
  ActivityTimeline,
} from '@/components/statistics';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';

/**
 * Loading skeleton for the statistics page
 */
const StatisticsLoadingSkeleton: React.FC = () => (
  <div className="space-y-6">
    {/* Stats Grid Skeleton */}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
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
  const { user, isLoading } = useAuth();

  // Show loading skeleton while user data is loading
  if (isLoading) {
    return (
      <div className="space-y-6 pb-8" data-testid="statistics-page">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-semibold text-text-primary md:text-3xl">Statistics</h1>
          <p className="mt-2 text-muted-foreground">
            Track your learning progress and achievements.
          </p>
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
          <h1 className="text-2xl font-semibold text-text-primary md:text-3xl">Statistics</h1>
          <p className="mt-2 text-muted-foreground">
            Track your learning progress and achievements.
          </p>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Please log in to view your statistics.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Extract stats from user
  const { stats } = user;
  const achievements = getDefaultAchievements(stats.wordsLearned, stats.streak);

  return (
    <div className="space-y-6 pb-8" data-testid="statistics-page">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary md:text-3xl">Statistics</h1>
        <p className="mt-2 text-muted-foreground">Track your learning progress and achievements.</p>
      </div>

      {/* User Stats Section */}
      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">
          Your Learning Stats
        </h2>
        <StatsGrid
          streak={stats.streak}
          wordsLearned={stats.wordsLearned}
          totalXP={stats.totalXP}
          joinedDate={stats.joinedDate}
        />
      </section>

      {/* Level Progress */}
      <LevelProgressCard totalXP={stats.totalXP} />

      <Separator />

      {/* Analytics Charts Section */}
      <section aria-labelledby="analytics-heading">
        <h2 id="analytics-heading" className="mb-4 text-lg font-semibold text-foreground">
          Learning Analytics
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

      <Separator />

      {/* Achievements Section */}
      <section aria-labelledby="achievements-heading">
        <h2 id="achievements-heading" className="sr-only">
          Achievements
        </h2>
        <AchievementsGrid achievements={achievements} />
      </section>

      {/* Activity Timeline */}
      <ActivityTimeline joinedDate={stats.joinedDate} lastActivity={stats.lastActivity} />
    </div>
  );
};

export default Statistics;
