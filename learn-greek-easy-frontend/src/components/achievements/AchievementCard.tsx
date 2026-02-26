import React from 'react';

import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
  const { t, i18n } = useTranslation('achievements');
  const {
    id,
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

  // Get translated name, description, and hint (fallback to API values)
  const translatedName = t(`items.${id}.name`, name);
  const translatedDescription = t(`items.${id}.description`, description);
  const translatedHint = t(`items.${id}.hint`, hint);

  // Format unlocked date if available, using the current language locale
  const formattedDate = unlocked_at
    ? new Date(unlocked_at).toLocaleDateString(i18n.language)
    : null;

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all hover:scale-[1.02] hover:shadow-md active:scale-[0.98]',
        unlocked
          ? 'border-purple-300 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/30'
          : 'border-border bg-muted/30 opacity-75',
        className
      )}
      role="article"
      aria-label={`Achievement: ${translatedName}`}
    >
      <CardContent className="p-3 sm:p-4">
        {/* Icon and Status */}
        <div className="flex items-start">
          <div className="flex items-center gap-3">
            {/* Achievement Icon */}
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg sm:h-12 sm:w-12',
                unlocked
                  ? 'bg-purple-100 text-purple-600 dark:bg-purple-800/50 dark:text-purple-300'
                  : 'bg-muted text-muted-foreground grayscale'
              )}
              aria-hidden="true"
            >
              <AchievementIcon icon={icon} size={24} />
            </div>

            {/* Name and Description */}
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">{translatedName}</h3>
              <p className={cn('text-sm text-muted-foreground', !unlocked && 'hidden sm:block')}>
                {unlocked ? translatedDescription : translatedHint}
              </p>
            </div>
          </div>
        </div>

        {/* Progress Section -- conditional display */}
        {unlocked ? (
          <div className="mt-3 sm:mt-4">
            <Badge variant="secondary" className="text-xs">
              {t('status.completed')}
            </Badge>
          </div>
        ) : progress > 0 ? (
          <div className="mt-3 sm:mt-4">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {current_value} / {threshold}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress
              value={progress}
              className="h-2 [&>div]:bg-muted-foreground"
              aria-label={`Progress: ${Math.round(progress)}%`}
            />
          </div>
        ) : null}

        {/* XP Reward Badge */}
        <div className="mt-3 flex items-center justify-between">
          <Badge
            variant="secondary"
            className={cn(
              unlocked
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                : ''
            )}
          >
            <Star className="mr-1 h-3 w-3" aria-hidden="true" />
            {xp_reward} XP
          </Badge>

          {/* Unlocked date or status */}
          {unlocked && formattedDate ? (
            <span className="text-xs text-muted-foreground">
              {t('card.unlockedOn', { date: formattedDate })}
            </span>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              {t('card.locked')}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
