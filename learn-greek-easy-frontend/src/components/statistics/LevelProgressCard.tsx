import React from 'react';

import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface LevelProgressCardProps {
  /** Total experience points earned */
  totalXP: number;
  /** XP required per level (default: 1000) */
  xpPerLevel?: number;
  /** Optional CSS class name */
  className?: string;
}

/**
 * LevelProgressCard displays the user's current level and progress toward the next level.
 * Shows a progress bar and XP remaining.
 */
export const LevelProgressCard: React.FC<LevelProgressCardProps> = ({
  totalXP,
  xpPerLevel = 1000,
  className,
}) => {
  const { t } = useTranslation('statistics');

  // Calculate level from XP
  const level = Math.floor(totalXP / xpPerLevel) || 1;
  const currentLevelXP = totalXP % xpPerLevel;
  const progressPercent = (currentLevelXP / xpPerLevel) * 100;
  const xpToNextLevel = xpPerLevel - currentLevelXP;

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              {t('level.title', { level })}
            </CardTitle>
            <CardDescription>
              {t('level.xpProgress', {
                current: currentLevelXP.toLocaleString(),
                total: xpPerLevel.toLocaleString(),
              })}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-lg">
            {t('level.xpToNext', { xp: xpToNextLevel, level: level + 1 })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Progress value={progressPercent} className="h-3" />
        <p className="mt-3 text-sm text-muted-foreground">{t('level.description')}</p>
      </CardContent>
    </Card>
  );
};
