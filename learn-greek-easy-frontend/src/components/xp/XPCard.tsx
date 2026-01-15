import React, { useEffect, useMemo } from 'react';

import { Star, Trophy, ChevronRight } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAnalyticsStore, selectStudyStreak } from '@/stores/analyticsStore';
import {
  useXPStore,
  selectXPStats,
  selectIsLoadingStats,
  selectIsMaxLevel,
} from '@/stores/xpStore';

/**
 * Props for XPCard component
 */
export interface XPCardProps {
  /** Optional callback when "View Achievements" is clicked */
  onViewAchievements?: () => void;
  /** Show compact version (for sidebar/header) */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Show loading skeleton */
  isLoading?: boolean;
}

/**
 * Get level color based on level tier
 * Levels 1-5: Blue, 6-10: Purple, 11-15: Gold
 */
const getLevelColor = (level: number): { bg: string; text: string; progress: string } => {
  if (level >= 11) {
    return {
      bg: 'bg-amber-100',
      text: 'text-amber-600',
      progress: 'bg-amber-500',
    };
  }
  if (level >= 6) {
    return {
      bg: 'bg-purple-100',
      text: 'text-purple-600',
      progress: 'bg-purple-500',
    };
  }
  return {
    bg: 'bg-blue-100',
    text: 'text-blue-600',
    progress: 'bg-blue-500',
  };
};

/**
 * Format large XP numbers with K suffix
 */
const formatXP = (xp: number): string => {
  if (xp >= 10000) {
    return `${(xp / 1000).toFixed(1)}K`;
  }
  return xp.toLocaleString();
};

/**
 * XPCard Component
 *
 * Displays user's XP level, progress, and achievements summary.
 * Uses data from XP store with 5-minute cache.
 * Streak data comes from analyticsStore per architecture requirements.
 */
export const XPCard: React.FC<XPCardProps> = ({
  onViewAchievements,
  compact = false,
  className,
  isLoading: propLoading,
}) => {
  // XP data from store
  const xpStats = useXPStore(selectXPStats);
  const loadingStats = useXPStore(selectIsLoadingStats);
  const isMaxLevel = useXPStore(selectIsMaxLevel);
  const loadXPStats = useXPStore((state) => state.loadXPStats);

  // Streak from analytics store (per architecture spec)
  const streak = useAnalyticsStore(selectStudyStreak);

  // Check for reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Load XP stats on mount
  useEffect(() => {
    loadXPStats();
  }, [loadXPStats]);

  const loading = propLoading || loadingStats;

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <Skeleton className={compact ? 'h-16' : 'h-32'} />
        </CardContent>
      </Card>
    );
  }

  // Default values if no data
  const level = xpStats?.current_level ?? 1;
  const totalXP = xpStats?.total_xp ?? 0;
  const xpInLevel = xpStats?.xp_in_level ?? 0;
  const xpForNextLevel = xpStats?.xp_for_next_level ?? 100;
  const progressPercentage = xpStats?.progress_percentage ?? 0;
  const levelNameEnglish = xpStats?.level_name_english ?? 'Beginner';
  const levelNameGreek = xpStats?.level_name_greek ?? 'Αρχάριος';

  const colors = getLevelColor(level);

  // Compact mode for sidebar/header
  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)} role="region" aria-label="XP Stats">
        <div className={cn('rounded-full p-1.5', colors.bg)}>
          <Star className={cn('h-4 w-4', colors.text)} aria-hidden="true" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">Level {level}</span>
          <span className="text-xs text-muted-foreground">{formatXP(totalXP)} XP</span>
        </div>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          {/* Left side: Level and XP info */}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-muted-foreground">Total XP</p>
              {streak && streak.currentStreak > 0 && (
                <span
                  className="text-xs text-orange-500"
                  aria-label={`${streak.currentStreak} day streak`}
                >
                  🔥 {streak.currentStreak}
                </span>
              )}
            </div>

            {/* Level display */}
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">Level {level}</span>
              <span className="text-sm text-muted-foreground">{levelNameEnglish}</span>
            </div>

            {/* Greek level name */}
            <p className="mt-0.5 text-xs text-muted-foreground" lang="el">
              {levelNameGreek}
            </p>

            {/* XP count */}
            <div className="mt-2">
              <span className="text-lg font-semibold text-foreground">{formatXP(totalXP)} XP</span>
            </div>

            {/* Progress bar - hide "next level" info at max level */}
            {!isMaxLevel ? (
              <div
                className="mt-3"
                role="progressbar"
                aria-valuenow={progressPercentage}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${xpInLevel} of ${xpForNextLevel} XP to next level`}
              >
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {xpInLevel} / {xpForNextLevel} XP
                  </span>
                  <span>{Math.round(progressPercentage)}%</span>
                </div>
                <Progress
                  value={progressPercentage}
                  className={cn(
                    'h-2',
                    !prefersReducedMotion && 'transition-all duration-500 ease-out'
                  )}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {xpForNextLevel - xpInLevel} XP to Level {level + 1}
                </p>
              </div>
            ) : (
              <div className="mt-3">
                <div className="flex items-center gap-1 text-amber-600">
                  <Trophy className="h-4 w-4" aria-hidden="true" />
                  <span className="text-sm font-medium">Max Level Achieved!</span>
                </div>
              </div>
            )}
          </div>

          {/* Right side: Icon */}
          <div className={cn('rounded-full p-3', colors.bg)}>
            <Star className={cn('h-8 w-8', colors.text)} aria-hidden="true" />
          </div>
        </div>

        {/* View Achievements button (optional) */}
        {onViewAchievements && (
          <button
            onClick={onViewAchievements}
            className={cn(
              'mt-4 flex w-full items-center justify-between rounded-lg border border-border p-3',
              'hover:bg-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              !prefersReducedMotion && 'transition-colors duration-200'
            )}
            aria-label="View all achievements"
          >
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium text-foreground">View Achievements</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </button>
        )}
      </CardContent>
    </Card>
  );
};
