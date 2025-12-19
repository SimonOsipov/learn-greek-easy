import React from 'react';

import { Calendar, Clock, TrendingUp } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface ActivityTimelineProps {
  /** Date when user joined */
  joinedDate: Date | string;
  /** Date of last activity (optional) */
  lastActivity?: Date | string | null;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Format a date for display
 */
export const formatDate = (date: Date | string): string => {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Calculate days between a date and now
 */
const getDaysAgo = (date: Date | string): number => {
  return Math.floor((new Date().getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
};

/**
 * ActivityTimeline displays a timeline of user activity milestones.
 * Shows join date and last activity with relative time indicators.
 */
export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  joinedDate,
  lastActivity,
  className,
}) => {
  const daysSinceJoining = getDaysAgo(joinedDate);
  const daysSinceLastActivity = lastActivity ? getDaysAgo(lastActivity) : null;

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          Activity Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Joined Date */}
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">Joined Learn Greek Easy</p>
            <p className="text-sm text-muted-foreground">{formatDate(joinedDate)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {daysSinceJoining} {daysSinceJoining === 1 ? 'day' : 'days'} ago
            </p>
          </div>
        </div>

        {/* Last Activity */}
        {lastActivity && (
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Last Active</p>
              <p className="text-sm text-muted-foreground">{formatDate(lastActivity)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {daysSinceLastActivity} {daysSinceLastActivity === 1 ? 'day' : 'days'} ago
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
