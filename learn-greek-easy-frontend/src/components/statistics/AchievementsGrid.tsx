import React from 'react';

import { Award } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface Achievement {
  /** Unique identifier for the achievement */
  id?: string;
  /** Display name of the achievement */
  name: string;
  /** Icon or emoji to display */
  icon: string;
  /** Whether the achievement has been unlocked */
  unlocked: boolean;
  /** Optional description of how to unlock */
  description?: string;
}

export interface AchievementsGridProps {
  /** Array of achievements to display */
  achievements: Achievement[];
  /** Optional CSS class name */
  className?: string;
  /** Optional footer text */
  footerText?: string;
}

/**
 * Default achievements that can be used when no custom achievements are provided.
 * These are based on streak and words learned milestones.
 */
export const getDefaultAchievements = (wordsLearned: number, streak: number): Achievement[] => [
  {
    id: 'first-steps',
    name: 'First Steps',
    icon: '\uD83D\uDC63',
    unlocked: wordsLearned >= 10,
    description: 'Learn 10 words',
  },
  {
    id: 'week-warrior',
    name: 'Week Warrior',
    icon: '\u2694\uFE0F',
    unlocked: streak >= 7,
    description: 'Maintain a 7-day streak',
  },
  {
    id: 'century-club',
    name: 'Century Club',
    icon: '\uD83D\uDCAF',
    unlocked: wordsLearned >= 100,
    description: 'Learn 100 words',
  },
  {
    id: 'fire-keeper',
    name: 'Fire Keeper',
    icon: '\uD83D\uDD25',
    unlocked: streak >= 30,
    description: 'Maintain a 30-day streak',
  },
];

/**
 * AchievementsGrid displays a grid of achievement badges.
 * Shows locked/unlocked states with visual differentiation.
 */
export const AchievementsGrid: React.FC<AchievementsGridProps> = ({
  achievements,
  className,
  footerText = 'More achievements coming soon! Keep learning to unlock special badges.',
}) => {
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          Achievements
        </CardTitle>
        <CardDescription>
          Unlock badges by completing challenges and reaching milestones
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {achievements.map((achievement, index) => (
            <div
              key={achievement.id || index}
              className={cn(
                'flex flex-col items-center rounded-lg border-2 p-4 text-center transition-all',
                achievement.unlocked
                  ? 'border-purple-300 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/30'
                  : 'border-border bg-muted/50 opacity-60'
              )}
            >
              <div className="mb-2 text-3xl">{achievement.icon}</div>
              <p className="text-xs font-medium text-foreground">{achievement.name}</p>
              {achievement.unlocked ? (
                <Badge
                  variant="secondary"
                  className="mt-2 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                >
                  Unlocked
                </Badge>
              ) : (
                <Badge variant="outline" className="mt-2 text-muted-foreground">
                  Locked
                </Badge>
              )}
            </div>
          ))}
        </div>
        {footerText && (
          <p className="mt-6 text-center text-sm text-muted-foreground">{footerText}</p>
        )}
      </CardContent>
    </Card>
  );
};
