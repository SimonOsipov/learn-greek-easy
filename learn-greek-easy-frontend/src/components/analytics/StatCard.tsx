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
        icon: 'text-green-600',
        bg: 'bg-green-100',
        trend: 'text-green-600',
      };
    case 'warning':
      return {
        icon: 'text-yellow-600',
        bg: 'bg-yellow-100',
        trend: 'text-yellow-600',
      };
    case 'danger':
      return {
        icon: 'text-red-600',
        bg: 'bg-red-100',
        trend: 'text-red-600',
      };
    case 'primary':
    default:
      return {
        icon: 'text-blue-600',
        bg: 'bg-blue-100',
        trend: 'text-blue-600',
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
        color: 'text-green-600',
      };
    case 'down':
      return {
        Icon: TrendingDown,
        color: 'text-red-600',
      };
    case 'neutral':
    default:
      return {
        Icon: null,
        color: 'text-gray-600',
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
            <p className="text-sm font-medium text-gray-500">{label}</p>
            <div className="mt-2">
              <span className="text-3xl font-bold text-gray-900">{value}</span>
            </div>
            {subtext && (
              <p className="text-xs text-gray-400 mt-1">{subtext}</p>
            )}
            {trend && (
              <div className="flex items-center gap-1 mt-2">
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
          <div className={`p-3 rounded-full ${colors.bg}`}>
            <div className={`w-8 h-8 ${colors.icon}`}>
              {icon}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
