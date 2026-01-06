import React, { useEffect } from 'react';

import { Star, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  useXPStore,
  selectXPStats,
  selectIsLoadingStats,
  selectIsMaxLevel,
} from '@/stores/xpStore';

export interface LevelProgressCardProps {
  /** Optional CSS class name */
  className?: string;
}

/**
 * Loading skeleton for the LevelProgressCard
 */
const LevelProgressCardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <Card className={cn(className)}>
    <CardHeader>
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-2 h-4 w-48" />
        </div>
        <Skeleton className="h-6 w-36" />
      </div>
    </CardHeader>
    <CardContent>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="mt-3 h-4 w-64" />
    </CardContent>
  </Card>
);

/**
 * LevelProgressCard displays the user's current level and progress toward the next level.
 * Shows a progress bar and XP remaining.
 *
 * Uses xpStore for accurate level calculations from the backend.
 */
export const LevelProgressCard: React.FC<LevelProgressCardProps> = ({ className }) => {
  const { t, i18n } = useTranslation('statistics');

  // Get XP data from store
  const xpStats = useXPStore(selectXPStats);
  const loadingStats = useXPStore(selectIsLoadingStats);
  const isMaxLevel = useXPStore(selectIsMaxLevel);
  const loadXPStats = useXPStore((state) => state.loadXPStats);

  // Load XP stats on mount
  useEffect(() => {
    loadXPStats();
  }, [loadXPStats]);

  // Show loading skeleton while stats are loading
  if (loadingStats && !xpStats) {
    return <LevelProgressCardSkeleton className={className} />;
  }

  // Extract level data from store (with fallbacks)
  const level = xpStats?.current_level ?? 1;
  const progressPercent = xpStats?.progress_percentage ?? 0;
  const xpToNextLevel = xpStats?.xp_for_next_level ?? 0;
  const currentLevelXP = xpStats?.xp_in_level ?? 0;
  const levelXPTotal = currentLevelXP + xpToNextLevel;
  const levelNameGreek = xpStats?.level_name_greek ?? '';
  const levelNameEnglish = xpStats?.level_name_english ?? '';

  // Get level name based on current language
  const currentLanguage = i18n.language;
  const levelName = currentLanguage === 'el' ? levelNameGreek : levelNameEnglish;

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {isMaxLevel ? (
                <Trophy className="h-5 w-5 text-yellow-500" />
              ) : (
                <Star className="h-5 w-5 text-yellow-500" />
              )}
              {t('level.title', { level })}
              {levelName && (
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  ({levelName})
                </span>
              )}
            </CardTitle>
            <CardDescription>
              {isMaxLevel
                ? t('level.xpProgress', {
                    current: currentLevelXP.toLocaleString(),
                    total: currentLevelXP.toLocaleString(),
                  })
                : t('level.xpProgress', {
                    current: currentLevelXP.toLocaleString(),
                    total: levelXPTotal.toLocaleString(),
                  })}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-lg">
            {isMaxLevel
              ? t('level.maxLevel', 'Max Level!')
              : t('level.xpToNext', { xp: xpToNextLevel.toLocaleString(), level: level + 1 })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Progress value={isMaxLevel ? 100 : progressPercent} className="h-3" />
        <p className="mt-3 text-sm text-muted-foreground">{t('level.description')}</p>
      </CardContent>
    </Card>
  );
};
