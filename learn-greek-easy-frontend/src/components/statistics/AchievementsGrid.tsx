import React, { useMemo } from 'react';

import { formatDistanceToNow } from 'date-fns';
import { Award, ArrowRight, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { AchievementIcon } from '@/components/achievements/AchievementIcon';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { AchievementResponse } from '@/services/xpAPI';
import {
  useXPStore,
  selectAchievements,
  selectIsLoadingAchievements,
  selectXPError,
} from '@/stores/xpStore';

interface AchievementsGridProps {
  className?: string;
}

function getRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
}

interface RecentUnlockCardProps {
  achievement: AchievementResponse;
  tAch: (key: string, fallback: string) => string;
}

function RecentUnlockCard({ achievement: a, tAch }: RecentUnlockCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-800 dark:bg-purple-900/30 sm:flex-1">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-800/50 dark:text-purple-300">
        <AchievementIcon icon={a.icon} size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {tAch(`items.${a.id}.name`, a.name)}
        </p>
        <p className="text-xs text-muted-foreground">{getRelativeTime(a.unlocked_at)}</p>
      </div>
      <Badge
        variant="secondary"
        className="shrink-0 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
      >
        <Star className="mr-1 h-3 w-3" />
        {a.xp_reward} XP
      </Badge>
    </div>
  );
}

export const AchievementsGrid: React.FC<AchievementsGridProps> = ({ className }) => {
  const { t } = useTranslation('statistics');
  const { t: tAch } = useTranslation('achievements');
  const achievements = useXPStore(selectAchievements);
  const isLoading = useXPStore(selectIsLoadingAchievements);
  const error = useXPStore(selectXPError);

  const recentlyUnlocked = useMemo(
    () =>
      achievements
        ? achievements.achievements
            .filter((a) => a.unlocked && a.unlocked_at)
            .sort((a, b) => new Date(b.unlocked_at!).getTime() - new Date(a.unlocked_at!).getTime())
            .slice(0, 3)
        : [],
    [achievements]
  );

  const nextUp = useMemo(
    () =>
      achievements
        ? (achievements.achievements
            .filter((a) => !a.unlocked && a.progress > 0)
            .sort((a, b) => {
              if (b.progress !== a.progress) return b.progress - a.progress;
              return a.threshold - b.threshold;
            })[0] ?? null)
        : null,
    [achievements]
  );

  if (isLoading && !achievements) {
    return (
      <Card className={cn(className)}>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-56" />
        </CardContent>
      </Card>
    );
  }

  if (error && !achievements) {
    return (
      <Card className={cn(className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            {t('achievements.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{t('error.loadingData', { error })}</p>
        </CardContent>
      </Card>
    );
  }

  if (!achievements) {
    return null;
  }

  const isEmptyWithProgress = achievements.unlocked_count === 0 && nextUp !== null;
  const isEmptyNoProgress = achievements.unlocked_count === 0 && nextUp === null;

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          {t('achievements.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary stats */}
        <div className="flex items-center gap-4 text-sm">
          <span className="font-semibold">
            {t('achievements.summary.unlocked', {
              unlocked: achievements.unlocked_count,
              total: achievements.total_count,
            })}
          </span>
          <span className="text-muted-foreground">
            {t('achievements.summary.xpEarned', {
              xp: achievements.total_xp_earned,
            })}
          </span>
        </div>

        {/* Empty State 1: 0 unlocked but some progress toward achievements */}
        {isEmptyWithProgress && (
          <div
            role="status"
            className="mt-4 rounded-lg border bg-purple-50/80 p-4 dark:bg-purple-950/20"
          >
            <p className="text-center text-sm text-muted-foreground">
              {t('achievements.emptyState.someProgress')}
            </p>
          </div>
        )}

        {/* Empty State 2: 0 unlocked and 0 progress */}
        {isEmptyNoProgress && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t('achievements.emptyState.noProgress')}
            </p>
          </div>
        )}

        {/* Recently Unlocked */}
        {recentlyUnlocked.length > 0 && (
          <section className="mt-4">
            <h4 className="mb-2 text-sm font-semibold text-foreground">
              {t('achievements.recentlyUnlocked.title')}
            </h4>
            <div className="flex flex-col gap-3 sm:flex-row">
              {recentlyUnlocked.map((a) => (
                <RecentUnlockCard key={a.id} achievement={a} tAch={tAch} />
              ))}
            </div>
          </section>
        )}

        {/* Next Up */}
        {nextUp !== null && (
          <section className="mt-4">
            <h4 className="mb-2 text-sm font-semibold text-foreground">
              {t('achievements.nextUp.title')}
            </h4>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <AchievementIcon icon={nextUp.icon} size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {tAch(`items.${nextUp.id}.name`, nextUp.name)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tAch(`items.${nextUp.id}.hint`, nextUp.hint ?? '')}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  <Star className="mr-1 h-3 w-3" />
                  {nextUp.xp_reward} XP
                </Badge>
              </div>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>{t('achievements.nextUp.progress')}</span>
                  <span>
                    {nextUp.current_value} / {nextUp.threshold}
                  </span>
                </div>
                <Progress
                  value={nextUp.progress}
                  className="h-2"
                  aria-label={`Progress: ${Math.round(nextUp.progress)}%`}
                />
              </div>
            </div>
          </section>
        )}

        {/* CTA */}
        <Link
          to="/achievements"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
        >
          {t('achievements.summary.viewAll')}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  );
};
