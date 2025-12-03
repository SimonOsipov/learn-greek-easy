import React from 'react';

import { Clock } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalytics } from '@/hooks/useAnalytics';
import type { DateRangeType } from '@/stores/analyticsStore';

/**
 * Props for TimeStudiedWidget component
 */
export interface TimeStudiedWidgetProps {
  /** Show loading skeleton */
  isLoading?: boolean;
}

/**
 * Format time studied in minutes to human-readable string
 * Examples: "0m", "45m", "1h 23m", "12h 34m"
 */
const formatTimeStudied = (totalSeconds: number): string => {
  if (totalSeconds === 0) return '0m';

  const minutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }

  return `${minutes}m`;
};

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
  const formattedTime = formatTimeStudied(timeStudiedSeconds);
  const rangeText = getDateRangeLabel(dateRange);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500">Time Studied</p>
            <div className="mt-2">
              <span className="text-3xl font-bold text-gray-900">{formattedTime}</span>
            </div>
            <p className="mt-1 text-xs text-gray-400">{rangeText}</p>
          </div>
          <div className="rounded-full bg-blue-100 p-3">
            <Clock className="h-8 w-8 text-blue-600" aria-hidden="true" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
