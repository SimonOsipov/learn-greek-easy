import React from 'react';

import { BookOpen, Flame, Trophy } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface StatsGridProps {
  /** Current learning streak in days */
  streak: number;
  /** Total number of words learned */
  wordsLearned: number;
  /** Total experience points earned */
  totalXP: number;
  /** Date when user joined (for calculating average) */
  joinedDate: Date | string;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Get motivational message based on streak length
 */
export const getStreakMessage = (streak: number): string => {
  if (streak >= 30) return "Incredible! You're on fire!";
  if (streak >= 14) return 'Amazing streak! Keep it up!';
  if (streak >= 7) return 'Great job! One week strong!';
  if (streak >= 3) return 'Nice start! Keep going!';
  return 'Start your learning streak today!';
};

/**
 * StatsGrid displays key learning statistics in a responsive grid layout.
 * Shows streak, words learned, and total XP in individual cards.
 */
export const StatsGrid: React.FC<StatsGridProps> = ({
  streak,
  wordsLearned,
  totalXP,
  joinedDate,
  className,
}) => {
  // Calculate days since joining for average words per day
  const daysSinceJoining = Math.floor(
    (new Date().getTime() - new Date(joinedDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Calculate average words per day
  const avgWordsPerDay = daysSinceJoining > 0 ? Math.round(wordsLearned / daysSinceJoining) : 0;

  // Calculate level from XP (1000 XP per level)
  const xpPerLevel = 1000;
  const level = Math.floor(totalXP / xpPerLevel) || 1;
  const currentLevelXP = totalXP % xpPerLevel;
  const progressPercent = (currentLevelXP / xpPerLevel) * 100;

  return (
    <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {/* Streak Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current Streak
            </CardTitle>
            <Flame className="h-5 w-5 text-orange-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-foreground">
            {streak}
            <span className="ml-1 text-lg font-normal text-muted-foreground">
              {streak === 1 ? 'day' : 'days'}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{getStreakMessage(streak)}</p>
        </CardContent>
      </Card>

      {/* Words Learned Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Words Learned
            </CardTitle>
            <BookOpen className="h-5 w-5 text-blue-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-foreground">{wordsLearned.toLocaleString()}</div>
          <p className="mt-2 text-xs text-muted-foreground">
            ~{avgWordsPerDay} words per day average
          </p>
        </CardContent>
      </Card>

      {/* Total XP Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total XP</CardTitle>
            <Trophy className="h-5 w-5 text-yellow-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-foreground">{totalXP.toLocaleString()}</div>
          <p className="mt-2 text-xs text-muted-foreground">
            Level {level} - {Math.round(progressPercent)}% to next level
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
