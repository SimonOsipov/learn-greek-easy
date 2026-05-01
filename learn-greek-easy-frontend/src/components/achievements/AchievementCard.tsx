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
 * Unlocked state uses --success tokens; locked state uses muted/fg-3/bg-2 tokens.
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
        'relative overflow-hidden',
        unlocked ? 'border-success/30 bg-success/10' : 'border-line bg-muted/30 opacity-75',
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
                unlocked ? 'bg-success/15 text-success' : 'bg-bg-2 text-fg3 grayscale'
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
          // Clamp display values to handle read-before-reconcile race during GAMIF-04 rollout
          // (server may return current_value > threshold while unlocked: false)
          (() => {
            const displayValue = Math.min(current_value, threshold);
            const displayPercent = Math.min(100, Math.round(progress));
            return (
              <div className="mt-3 sm:mt-4">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {displayValue} / {threshold}
                  </span>
                  <span>{displayPercent}%</span>
                </div>
                <Progress
                  value={displayPercent}
                  className="h-2 [&>div]:bg-muted-foreground"
                  aria-label={`Progress: ${displayPercent}%`}
                />
              </div>
            );
          })()
        ) : null}

        {/* XP Reward Badge */}
        <div className="mt-3 flex items-center justify-between">
          {unlocked ? (
            <span className="badge b-green">
              <Star className="h-3 w-3" aria-hidden="true" />
              {xp_reward} XP
            </span>
          ) : (
            <Badge variant="secondary">
              <Star className="mr-1 h-3 w-3" aria-hidden="true" />
              {xp_reward} XP
            </Badge>
          )}

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
