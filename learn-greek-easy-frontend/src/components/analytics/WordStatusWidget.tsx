import React from 'react';

import { Circle, BookOpen, RefreshCw, CheckCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalytics } from '@/hooks/useAnalytics';

/**
 * Props for WordStatusWidget component
 */
export interface WordStatusWidgetProps {
  /** Show loading skeleton */
  isLoading?: boolean;
}

/**
 * Status configuration with icons and colors
 */
interface StatusConfig {
  key: string;
  label: string;
  count: number;
  color: string;
  Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  badgeVariant: 'default' | 'secondary' | 'outline';
}

/**
 * WordStatusWidget Component
 *
 * Display breakdown of vocabulary cards by learning state (New, Learning, Review, Mastered).
 * Provides visual overview of progress through different learning stages.
 *
 * Features:
 * - 4 status categories with counts and percentages
 * - Badge + count + percentage for each status
 * - Color-coded icons (gray, blue, yellow, green)
 * - Total cards sum displayed at bottom
 * - Empty state for new users
 *
 * @example
 * ```tsx
 * <WordStatusWidget />
 * ```
 */
export const WordStatusWidget: React.FC<WordStatusWidgetProps> = ({ isLoading: propLoading }) => {
  const { data, loading: dataLoading } = useAnalytics();
  const loading = propLoading || dataLoading;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vocabulary Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48" />
        </CardContent>
      </Card>
    );
  }

  const wordStatus = data?.wordStatus;

  // Empty state
  if (!wordStatus || wordStatus.total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vocabulary Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400">No cards yet. Start learning!</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate percentages
  const calculatePercentage = (count: number): number => {
    if (wordStatus.total === 0) return 0;
    return Math.round((count / wordStatus.total) * 100);
  };

  // Status configurations
  const statuses: StatusConfig[] = [
    {
      key: 'new',
      label: 'New',
      count: wordStatus.new,
      color: 'text-gray-500',
      Icon: Circle,
      badgeVariant: 'secondary',
    },
    {
      key: 'learning',
      label: 'Learning',
      count: wordStatus.learning,
      color: 'text-blue-500',
      Icon: BookOpen,
      badgeVariant: 'secondary',
    },
    {
      key: 'review',
      label: 'Review',
      count: wordStatus.review,
      color: 'text-yellow-500',
      Icon: RefreshCw,
      badgeVariant: 'secondary',
    },
    {
      key: 'mastered',
      label: 'Mastered',
      count: wordStatus.mastered,
      color: 'text-green-500',
      Icon: CheckCircle,
      badgeVariant: 'default',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vocabulary Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {statuses.map(({ key, label, count, color, Icon, badgeVariant }) => {
          const percentage = calculatePercentage(count);
          return (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${color}`} aria-hidden={true} />
                <span className="text-sm font-medium text-gray-700">{label}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={badgeVariant}>{count}</Badge>
                <span className="w-12 text-right text-xs text-gray-500">{percentage}%</span>
              </div>
            </div>
          );
        })}
        <div className="border-t border-gray-200 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-900">Total Cards</span>
            <span className="text-lg font-bold text-gray-900">{wordStatus.total}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
