// src/components/analytics/ActivityFeed.tsx

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ActivityFeedItem } from './ActivityFeedItem';
import { BookOpen } from 'lucide-react';
import type { AnalyticsActivityItem } from '@/types/analytics';

export interface ActivityFeedProps {
  /**
   * Array of activity items to display
   */
  activities: AnalyticsActivityItem[];

  /**
   * Maximum number of items to display
   * @default 10
   */
  maxItems?: number;
}

/**
 * ActivityFeed Component
 *
 * Displays a list of recent study sessions and achievements.
 * Shows:
 * - Last N activity items (configurable via maxItems prop)
 * - Empty state when no activity exists
 * - Vertical list with consistent spacing
 *
 * Each activity item shows deck name, cards reviewed, accuracy,
 * time spent, and relative time ("2 hours ago").
 *
 * @example
 * ```tsx
 * import { ActivityFeed } from '@/components/analytics';
 * import { useAnalytics } from '@/hooks/useAnalytics';
 *
 * function Dashboard() {
 *   const { data } = useAnalytics({ autoLoad: true });
 *
 *   return (
 *     <ActivityFeed
 *       activities={data?.recentActivity || []}
 *       maxItems={10}
 *     />
 *   );
 * }
 * ```
 */
export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activities,
  maxItems = 10,
}) => {
  // Limit the number of activities displayed
  const displayActivities = activities.slice(0, maxItems);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {displayActivities.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <BookOpen className="w-12 h-12 mb-3" aria-hidden="true" />
            <p className="text-sm font-medium">No recent activity</p>
            <p className="text-xs mt-1">Start learning to see your progress here!</p>
          </div>
        ) : (
          /* Activity List */
          <div className="space-y-3">
            {displayActivities.map((activity) => (
              <ActivityFeedItem key={activity.activityId} activity={activity} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
