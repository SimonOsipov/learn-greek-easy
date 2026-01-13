import React from 'react';

import { Clock } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalytics } from '@/hooks/useAnalytics';
import { formatStudyTime } from '@/lib/timeFormatUtils';
import type { DateRangeType } from '@/stores/analyticsStore';

/**
 * Props for TimeStudiedWidget component
 */
export interface TimeStudiedWidgetProps {
  /** Show loading skeleton */
  isLoading?: boolean;
}

// Use formatStudyTime from timeFormatUtils for consistent formatting with day support

/**
 * Get date range label for display
 */
const getDateRangeLabel = (dateRange: DateRangeType): string => {
  switch (dateRange) {
    case 'last7':
      return 'in last 7 days';
    case 'last30':
      return 'in last 30 days';
    case 'alltime':
      return 'all time';
    default:
      return 'in selected period';
  }
};

/**
 * TimeStudiedWidget Component
 *
 * Display total time studied with formatted duration.
 * Shows time investment in learning activities for the selected date range.
 *
 * Features:
 * - Time formatted as "Xh Ym" (e.g., "12h 34m")
 * - Clock icon with blue color scheme
 * - Date range context in subtext
 * - Handles zero time gracefully ("0m")
 * - Automatically updates when date range changes
 *
 * @example
 * ```tsx
 * <TimeStudiedWidget />
 * ```
 */
export const TimeStudiedWidget: React.FC<TimeStudiedWidgetProps> = ({ isLoading: propLoading }) => {
  const { data, dateRange, loading: dataLoading } = useAnalytics();
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

  // Get total time studied from summary
  const timeStudiedSeconds = data?.summary?.totalTimeStudied ?? 0;
  const formattedTime = formatStudyTime(timeStudiedSeconds);
  const rangeText = getDateRangeLabel(dateRange);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">Time Studied</p>
            <div className="mt-2">
              <span className="text-3xl font-bold text-foreground">{formattedTime}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{rangeText}</p>
          </div>
          <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900/50">
            <Clock className="h-8 w-8 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
