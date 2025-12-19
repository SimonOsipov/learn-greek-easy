import React from 'react';

import { Star } from 'lucide-react';

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
              Level {level}
            </CardTitle>
            <CardDescription>
              {currentLevelXP.toLocaleString()} / {xpPerLevel.toLocaleString()} XP
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-lg">
            {xpToNextLevel} XP to Level {level + 1}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Progress value={progressPercent} className="h-3" />
        <p className="mt-3 text-sm text-muted-foreground">
          Keep learning to earn more XP and level up! Each lesson, quiz, and review session
          contributes to your progress.
        </p>
      </CardContent>
    </Card>
  );
};
