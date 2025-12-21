import React from 'react';

import { Lock, Star } from 'lucide-react';

import { AchievementIcon } from '@/components/achievements/AchievementIcon';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { AchievementResponse } from '@/services/xpAPI';

/**
 * Props for AchievementCard component
 */
export interface AchievementCardProps {
  achievement: AchievementResponse;
  className?: string;
}

/**
 * AchievementCard Component
 *
 * Displays an individual achievement with its progress, unlock status, and XP reward.
 * Uses purple color scheme for unlocked achievements.
 */
export const AchievementCard: React.FC<AchievementCardProps> = ({ achievement, className }) => {
  const {
    name,
    description,
    icon,
    hint,
    threshold,
    xp_reward,
    unlocked,
    unlocked_at,
    progress,
    current_value,
  } = achievement;

  // Format unlocked date if available
  const formattedDate = unlocked_at ? new Date(unlocked_at).toLocaleDateString() : null;

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all',
        unlocked
          ? 'border-purple-300 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/30'
          : 'border-border bg-muted/30 opacity-75',
        className
      )}
      role="article"
      aria-label={`Achievement: ${name}`}
    >
      <CardContent className="p-4">
        {/* Icon and Status */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Achievement Icon */}
            <div
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-lg',
                unlocked
                  ? 'bg-purple-100 text-purple-600 dark:bg-purple-800/50 dark:text-purple-300'
                  : 'bg-gray-100 text-gray-500 grayscale dark:bg-gray-800 dark:text-gray-400'
              )}
              aria-hidden="true"
            >
              <AchievementIcon icon={icon} size={24} />
            </div>

            {/* Name and Description */}
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">{name}</h3>
              <p className="text-sm text-muted-foreground">{unlocked ? description : hint}</p>
            </div>
          </div>

          {/* Lock indicator for locked achievements */}
          {!unlocked && <Lock className="h-4 w-4 text-muted-foreground" aria-label="Locked" />}
        </div>

        {/* Progress Section */}
        <div className="mt-4">
          {/* Progress bar */}
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {current_value} / {threshold}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress
            value={progress}
            className={cn('h-2', unlocked ? '[&>div]:bg-purple-500' : '[&>div]:bg-gray-400')}
            aria-label={`Progress: ${Math.round(progress)}%`}
          />
        </div>

        {/* XP Reward Badge */}
        <div className="mt-3 flex items-center justify-between">
          <Badge
            variant={unlocked ? 'default' : 'outline'}
            className={cn(
              unlocked
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                : 'text-muted-foreground'
            )}
          >
            <Star className="mr-1 h-3 w-3" aria-hidden="true" />
            {xp_reward} XP
          </Badge>

          {/* Unlocked date or status */}
          {unlocked && formattedDate ? (
            <span className="text-xs text-muted-foreground">Unlocked {formattedDate}</span>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Locked
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
