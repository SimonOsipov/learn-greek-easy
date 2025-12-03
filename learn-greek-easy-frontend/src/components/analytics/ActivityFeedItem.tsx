// src/components/analytics/ActivityFeedItem.tsx

import React from 'react';

import { formatDistanceToNow } from 'date-fns';
import { BookOpen, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import type { AnalyticsActivityItem } from '@/types/analytics';

export interface ActivityFeedItemProps {
  activity: AnalyticsActivityItem;
}

/**
 * ActivityFeedItem Component
 *
 * Displays a single activity item (review session or achievement) with:
 * - Deck name and icon
 * - Card count (with singular/plural handling)
 * - Color-coded accuracy percentage
 * - Time spent with clock icon
 * - Relative time display ("2 hours ago")
 * - Click navigation to deck detail page
 * - Keyboard accessibility (Enter/Space keys)
 *
 * @example
 * ```tsx
 * <ActivityFeedItem activity={activityData} />
 * ```
 */
export const ActivityFeedItem: React.FC<ActivityFeedItemProps> = ({ activity }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (activity.deckId) {
      navigate(`/decks/${activity.deckId}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  /**
   * Get accuracy color class based on percentage
   * - Green: ≥80% (excellent)
   * - Yellow: 60-79% (good, needs improvement)
   * - Red: <60% (needs attention)
   */
  const getAccuracyColor = (accuracy: number): string => {
    if (accuracy >= 80) return 'text-green-600';
    if (accuracy >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  /**
   * Format time duration from seconds to "Xh Ym" or "Xm"
   * Reuses pattern from TimeStudiedWidget
   */
  const formatTimeDuration = (seconds: number): string => {
    if (seconds === 0) return '0m';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${minutes}m`;
    }
  };

  /**
   * Get relative time string using date-fns
   * Examples: "2 hours ago", "3 days ago", "just now"
   */
  const getRelativeTime = (date: Date): string => {
    return formatDistanceToNow(date, { addSuffix: true });
  };

  // Handle cases where activity might not have all data
  const cardsReviewed = activity.cardsReviewed || 0;
  const accuracy = activity.accuracy || 0;
  const timeSpent = activity.timeSpent || 0;
  const deckName = activity.deckName || activity.title || 'Unknown Deck';

  return (
    <Card
      className="cursor-pointer p-4 transition-shadow hover:shadow-md"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${deckName}`}
    >
      <div className="flex items-start gap-3">
        {/* Deck Icon */}
        <div className="bg-primary-100 flex-shrink-0 rounded-lg p-2">
          <BookOpen className="text-primary-600 h-5 w-5" aria-hidden="true" />
        </div>

        {/* Activity Content */}
        <div className="min-w-0 flex-1">
          {/* Deck Name */}
          <p className="truncate font-medium text-gray-900">{deckName}</p>

          {/* Metrics Row */}
          {activity.type === 'review_session' && cardsReviewed > 0 && (
            <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
              {/* Card Count */}
              <span>
                {cardsReviewed} {cardsReviewed === 1 ? 'card' : 'cards'}
              </span>

              {/* Accuracy (color-coded) */}
              <span className={`font-medium ${getAccuracyColor(accuracy)}`}>
                {Math.round(accuracy)}%
              </span>

              {/* Time Spent */}
              {timeSpent > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {formatTimeDuration(timeSpent)}
                </span>
              )}
            </div>
          )}

          {/* Achievement Type Display (for non-review activities) */}
          {activity.type !== 'review_session' && activity.description && (
            <p className="mt-1 text-sm text-gray-600">{activity.description}</p>
          )}

          {/* Relative Time */}
          <p className="mt-1 text-xs text-gray-400">{getRelativeTime(activity.timestamp)}</p>
        </div>
      </div>
    </Card>
  );
};
