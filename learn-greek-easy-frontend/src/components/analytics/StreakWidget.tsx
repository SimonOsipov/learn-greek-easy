import React from 'react';
import { Flame } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useStudyStreak } from '@/hooks/useStudyStreak';

/**
 * Props for StreakWidget component
 */
export interface StreakWidgetProps {
  /** Show loading skeleton */
  isLoading?: boolean;
}

/**
 * Get encouraging message based on streak length
 */
const getMessage = (streakDays: number, isActive: boolean): string => {
  if (!isActive || streakDays === 0) {
    return 'Start studying to build your streak!';
  }
  if (streakDays === 1) {
    return 'Great start! Come back tomorrow!';
  }
  if (streakDays < 7) {
    return "Keep going! You're building momentum!";
  }
  if (streakDays < 30) {
    return "Amazing! You're on fire!";
  }
  return 'Incredible dedication! Keep it up!';
};

/**
 * Determine if streak is currently active
 * Active means user studied yesterday or today
 */
const isStreakActive = (currentStreak: number, lastActivityDate: Date | undefined): boolean => {
  if (currentStreak === 0) return false;
  if (!lastActivityDate) return currentStreak > 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastActivity = new Date(lastActivityDate);
  lastActivity.setHours(0, 0, 0, 0);

  const daysDiff = Math.floor((today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

  // Active if studied today (0 days diff) or yesterday (1 day diff)
  return daysDiff <= 1;
};

/**
 * StreakWidget Component
 *
 * Display current study streak with motivational messaging and visual indicators.
 * Uses a flame icon that changes color based on streak status, encouraging daily habit formation.
 *
 * Features:
 * - Dynamic flame icon color (orange when active, gray when inactive)
 * - Shows current streak and longest streak
 * - Encouraging messages based on streak length
 * - Border highlight when streak is active
 *
 * @example
 * ```tsx
 * <StreakWidget />
 * ```
 */
export const StreakWidget: React.FC<StreakWidgetProps> = ({ isLoading: propLoading }) => {
  const { streak, loading: dataLoading } = useStudyStreak();
  const loading = propLoading || dataLoading;

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  // Default values if no streak data
  const currentStreak = streak?.currentStreak ?? 0;
  const longestStreak = streak?.longestStreak ?? 0;
  const lastActivityDate = streak?.lastActivityDate;

  const isActive = isStreakActive(currentStreak, lastActivityDate);
  const message = getMessage(currentStreak, isActive);

  // Determine if border should be highlighted
  const borderClass = isActive ? 'border-orange-500' : '';

  return (
    <Card className={borderClass}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500">Study Streak</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-bold text-gray-900">
                {currentStreak}
              </span>
              <span className="text-sm text-gray-500">
                {currentStreak === 1 ? 'day' : 'days'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Best: {longestStreak} {longestStreak === 1 ? 'day' : 'days'}
            </p>
          </div>
          <div className={`p-3 rounded-full ${isActive ? 'bg-orange-100' : 'bg-gray-100'}`}>
            <Flame
              className={`w-8 h-8 ${isActive ? 'text-orange-500' : 'text-gray-400'}`}
              aria-hidden="true"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">{message}</p>
      </CardContent>
    </Card>
  );
};
