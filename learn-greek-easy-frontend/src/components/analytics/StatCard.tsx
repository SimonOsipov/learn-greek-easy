import React from 'react';

import { TrendingUp, TrendingDown } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Props for StatCard component
 */
export interface StatCardProps {
  /** Icon element to display (from Lucide React) */
  icon: React.ReactNode;
  /** Metric label text */
  label: string;
  /** Main metric value (number or string) */
  value: string | number;
  /** Optional explanatory text below value */
  subtext?: string;
  /** Optional trend indicator */
  trend?: {
    value: string | number;
    direction: 'up' | 'down' | 'neutral';
  };
  /** Color scheme for the card */
  colorScheme?: 'primary' | 'success' | 'warning' | 'danger';
  /** Show loading skeleton */
  isLoading?: boolean;
}

/**
 * Get color classes based on color scheme
 */
const getColorClasses = (scheme: StatCardProps['colorScheme']) => {
  switch (scheme) {
    case 'success':
      return {
        icon: 'text-success',
        bg: 'bg-success/15',
        trend: 'text-success',
      };
    case 'warning':
      return {
        icon: 'text-warning',
        bg: 'bg-warning/15',
        trend: 'text-warning',
      };
    case 'danger':
      return {
        icon: 'text-danger',
        bg: 'bg-danger/15',
        trend: 'text-danger',
      };
    case 'primary':
    default:
      return {
        icon: 'text-primary',
        bg: 'bg-primary/15',
        trend: 'text-primary',
      };
  }
};

/**
 * Get trend icon and color based on direction
 */
const getTrendDisplay = (direction: 'up' | 'down' | 'neutral') => {
  switch (direction) {
    case 'up':
      return {
        Icon: TrendingUp,
        color: 'text-success',
      };
    case 'down':
      return {
        Icon: TrendingDown,
        color: 'text-danger',
      };
    case 'neutral':
    default:
      return {
        Icon: null,
        color: 'text-muted-foreground',
      };
  }
};

/**
 * StatCard Component
 *
 * Generic reusable widget for displaying a single metric with icon, label, value, and optional trend.
 * Used as a building block for dashboard statistics display.
 *
 * @example
 * ```tsx
 * <StatCard
 *   icon={<Trophy className="h-5 w-5" />}
 *   label="Words Mastered"
 *   value={127}
 *   subtext="Your vocabulary is growing!"
 *   trend={{ value: "+15 this week", direction: "up" }}
 *   colorScheme="success"
 * />
 * ```
 */
export const StatCard: React.FC<StatCardProps> = ({
  icon,
  label,
  value,
  subtext,
  trend,
  colorScheme = 'primary',
  isLoading = false,
}) => {
  const colors = getColorClasses(colorScheme);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  const trendDisplay = trend ? getTrendDisplay(trend.direction) : null;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <div className="mt-2">
              <span className="text-3xl font-bold text-foreground">{value}</span>
            </div>
            {subtext && <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>}
            {trend && (
              <div className="mt-2 flex items-center gap-1">
                {trendDisplay?.Icon && (
                  <trendDisplay.Icon
                    className={`h-4 w-4 ${trendDisplay.color}`}
                    aria-hidden="true"
                  />
                )}
                <span className={`text-xs font-medium ${trendDisplay?.color || colors.trend}`}>
                  {trend.value}
                </span>
              </div>
            )}
          </div>
          <div className={`rounded-full p-3 ${colors.bg}`}>
            <div className={`h-8 w-8 ${colors.icon}`}>{icon}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
