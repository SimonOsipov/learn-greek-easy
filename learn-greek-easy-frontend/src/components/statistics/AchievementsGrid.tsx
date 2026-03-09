import React from 'react';

import { Award, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  useXPStore,
  selectAchievements,
  selectIsLoadingAchievements,
  selectXPError,
} from '@/stores/xpStore';

interface AchievementsGridProps {
  className?: string;
}

export const AchievementsGrid: React.FC<AchievementsGridProps> = ({ className }) => {
  const { t } = useTranslation('statistics');
  const achievements = useXPStore(selectAchievements);
  const isLoading = useXPStore(selectIsLoadingAchievements);
  const error = useXPStore(selectXPError);

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

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          {t('achievements.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
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
