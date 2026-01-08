import React from 'react';

import { BookOpen, Flame, Landmark, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface StatsGridProps {
  /** Current learning streak in days */
  streak: number;
  /** Total number of words learned */
  wordsLearned: number;
  /** Total experience points earned */
  totalXP: number;
  /** Number of culture questions mastered */
  cultureQuestionsMastered: number;
  /** Date when user joined (for calculating average) */
  joinedDate: Date | string;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Get motivational message key based on streak length
 */
export const getStreakMessageKey = (streak: number): string => {
  if (streak >= 30) return 'stats.streakMessages.incredible';
  if (streak >= 14) return 'stats.streakMessages.amazing';
  if (streak >= 7) return 'stats.streakMessages.great';
  if (streak >= 3) return 'stats.streakMessages.nice';
  return 'stats.streakMessages.start';
};

/**
 * Get motivational message based on streak length (deprecated, use getStreakMessageKey with translation)
 * @deprecated Use getStreakMessageKey with t() function instead
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
  cultureQuestionsMastered,
  joinedDate,
  className,
}) => {
  const { t } = useTranslation('statistics');

  // Calculate days since joining for average words per day
  const daysSinceJoining = Math.floor(
    (new Date().getTime() - new Date(joinedDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Calculate average words per day
  const avgWordsPerDay = daysSinceJoining > 0 ? Math.round(wordsLearned / daysSinceJoining) : 0;

  return (
    <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {/* Streak Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('stats.currentStreak')}
            </CardTitle>
            <Flame className="h-5 w-5 text-orange-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-foreground">
            {streak}
            <span className="ml-1 text-lg font-normal text-muted-foreground">
              {streak === 1 ? t('stats.day') : t('stats.days')}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t(getStreakMessageKey(streak))}</p>
        </CardContent>
      </Card>

      {/* Words Learned Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('stats.wordsLearned')}
            </CardTitle>
            <BookOpen className="h-5 w-5 text-blue-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-foreground">{wordsLearned.toLocaleString()}</div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t('stats.wordsPerDay', { count: avgWordsPerDay })}
          </p>
        </CardContent>
      </Card>

      {/* Culture Questions Mastered Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('stats.cultureQuestionsMastered')}
            </CardTitle>
            <Landmark className="h-5 w-5 text-purple-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-foreground">
            {cultureQuestionsMastered.toLocaleString()}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t('stats.cultureProgress')}</p>
        </CardContent>
      </Card>

      {/* Total XP Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('stats.totalXP')}
            </CardTitle>
            <Trophy className="h-5 w-5 text-yellow-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-foreground">{totalXP.toLocaleString()}</div>
        </CardContent>
      </Card>
    </div>
  );
};
