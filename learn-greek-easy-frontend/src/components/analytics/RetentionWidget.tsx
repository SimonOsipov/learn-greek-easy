import React from 'react';

import { Brain, TrendingUp } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalytics } from '@/hooks/useAnalytics';
import type { AnalyticsDashboardData, RetentionRate } from '@/types/analytics';

/**
 * Props for RetentionWidget component
 */
export interface RetentionWidgetProps {
  /** Show loading skeleton */
  isLoading?: boolean;
}

/**
 * Color configuration for retention rate thresholds
 */
interface RetentionColors {
  text: string;
  bg: string;
  icon: string;
}

/**
 * Get color classes based on retention rate threshold
 * Green: ≥80% (excellent)
 * Yellow: 60-79% (good)
 * Red: <60% (needs improvement)
 */
const getRetentionColor = (rate: number): RetentionColors => {
  if (rate >= 80) {
    return {
      text: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-100 dark:bg-green-900/50',
      icon: 'text-green-600 dark:text-green-400',
    };
  }
  if (rate >= 60) {
    return {
      text: 'text-yellow-600 dark:text-yellow-400',
      bg: 'bg-yellow-100 dark:bg-yellow-900/50',
      icon: 'text-yellow-600 dark:text-yellow-400',
    };
  }
  return {
    text: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/50',
    icon: 'text-red-600 dark:text-red-400',
  };
};

/**
 * Calculate average retention rate from retention data
 * Uses 7-day retention as primary metric
 */
const calculateRetentionRate = (data: AnalyticsDashboardData | null): number | null => {
  // Try to get 7-day retention rate
  if (data?.retention && Array.isArray(data.retention)) {
    const sevenDayRetention = data.retention.find((r: RetentionRate) => r.interval === 7);
    if (sevenDayRetention && typeof sevenDayRetention.retention === 'number') {
      return sevenDayRetention.retention;
    }

    // Fallback: calculate average of all retention intervals
    const validRetentions = data.retention
      .filter((r: RetentionRate) => typeof r.retention === 'number')
      .map((r: RetentionRate) => r.retention);

    if (validRetentions.length > 0) {
      return Math.round(
        validRetentions.reduce((sum: number, val: number) => sum + val, 0) / validRetentions.length
      );
    }
  }

  return null;
};

/**
 * RetentionWidget Component
 *
 * Display retention rate (% of cards remembered after 7+ days) with color-coded visual indicator.
 * Helps users understand their long-term memory retention effectiveness.
 *
 * Features:
 * - Color-coded based on threshold (green ≥80%, yellow 60-79%, red <60%)
 * - Shows "N/A" when insufficient data (< 7 days)
 * - Brain icon with matching color scheme
 * - Explanatory subtext
 * - Trend indicator for improving retention
 *
 * @example
 * ```tsx
 * <RetentionWidget />
 * ```
 */
export const RetentionWidget: React.FC<RetentionWidgetProps> = ({ isLoading: propLoading }) => {
  const { data, loading: dataLoading } = useAnalytics();
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

  const retentionRate = calculateRetentionRate(data);
  const hasData = retentionRate !== null && retentionRate !== undefined;
  const displayValue = hasData ? `${Math.round(retentionRate)}%` : 'N/A';

  const colors = hasData
    ? getRetentionColor(retentionRate)
    : {
        text: 'text-muted-foreground',
        bg: 'bg-muted',
        icon: 'text-muted-foreground',
      };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">Retention Rate</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${colors.text}`}>{displayValue}</span>
              {hasData && retentionRate >= 75 && (
                <TrendingUp className={`h-5 w-5 ${colors.icon}`} aria-hidden="true" />
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {hasData ? '% remembered after 7+ days' : 'Insufficient data'}
            </p>
          </div>
          <div className={`rounded-full p-3 ${colors.bg}`}>
            <Brain className={`h-8 w-8 ${colors.icon}`} aria-hidden="true" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
