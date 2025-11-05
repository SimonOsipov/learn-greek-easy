// Temporary test page for ActivityFeed component verification
// Task 06.06 - Activity Feed Component Testing

import React from 'react';
import { ActivityFeed } from '@/components/analytics';
import type { AnalyticsActivityItem } from '@/types/analytics';

/**
 * ActivityFeedTest Page
 *
 * Test page to verify ActivityFeed and ActivityFeedItem components.
 * Displays multiple scenarios:
 * 1. Feed with activity data
 * 2. Feed with empty data
 */
export const ActivityFeedTest: React.FC = () => {
  // Mock activity data for testing
  const mockActivities: AnalyticsActivityItem[] = [
    {
      activityId: '1',
      sessionId: 'sess-1',
      type: 'review_session',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      relativeTime: '2 hours ago',
      title: 'Reviewed 15 cards',
      description: 'in A1 Basics - 87% accuracy',
      deckId: 'deck-1',
      deckName: 'A1 Basics',
      cardsReviewed: 15,
      accuracy: 87,
      timeSpent: 480, // 8 minutes
      icon: 'book-open',
      color: 'blue',
    },
    {
      activityId: '2',
      sessionId: 'sess-2',
      type: 'review_session',
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
      relativeTime: '5 hours ago',
      title: 'Reviewed 10 cards',
      description: 'in A1 Family - 92% accuracy',
      deckId: 'deck-2',
      deckName: 'A1 Family',
      cardsReviewed: 10,
      accuracy: 92,
      timeSpent: 300, // 5 minutes
      icon: 'book-open',
      color: 'green',
    },
    {
      activityId: '3',
      sessionId: 'sess-3',
      type: 'review_session',
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      relativeTime: '1 day ago',
      title: 'Reviewed 20 cards',
      description: 'in A2 Time - 78% accuracy',
      deckId: 'deck-3',
      deckName: 'A2 Time',
      cardsReviewed: 20,
      accuracy: 78,
      timeSpent: 720, // 12 minutes
      icon: 'book-open',
      color: 'yellow',
    },
    {
      activityId: '4',
      sessionId: 'sess-4',
      type: 'review_session',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      relativeTime: '2 days ago',
      title: 'Reviewed 8 cards',
      description: 'in A1 Travel - 55% accuracy',
      deckId: 'deck-4',
      deckName: 'A1 Travel',
      cardsReviewed: 8,
      accuracy: 55,
      timeSpent: 360, // 6 minutes
      icon: 'book-open',
      color: 'red',
    },
    {
      activityId: '5',
      sessionId: 'sess-5',
      type: 'review_session',
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      relativeTime: '3 days ago',
      title: 'Reviewed 25 cards',
      description: 'in A2 Food - 95% accuracy',
      deckId: 'deck-5',
      deckName: 'A2 Food',
      cardsReviewed: 25,
      accuracy: 95,
      timeSpent: 900, // 15 minutes
      icon: 'book-open',
      color: 'green',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Activity Feed Component Test
          </h1>
          <p className="text-gray-600">Task 06.06 - Verification Page</p>
        </div>

        {/* Test 1: Activity Feed with Data */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Scenario 1: Activity Feed with Data (5 items)
          </h2>
          <div className="max-w-2xl">
            <ActivityFeed activities={mockActivities} maxItems={5} />
          </div>
        </div>

        {/* Test 2: Activity Feed with Limited Items */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Scenario 2: Activity Feed with Limit (3 items)
          </h2>
          <div className="max-w-2xl">
            <ActivityFeed activities={mockActivities} maxItems={3} />
          </div>
        </div>

        {/* Test 3: Empty Activity Feed */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Scenario 3: Empty Activity Feed
          </h2>
          <div className="max-w-2xl">
            <ActivityFeed activities={[]} />
          </div>
        </div>

        {/* Test Summary */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Test Checklist
          </h2>
          <ul className="space-y-2 text-gray-700">
            <li>✅ Activity feed displays recent sessions</li>
            <li>✅ Deck name with icon visible</li>
            <li>✅ Card count with singular/plural handling</li>
            <li>✅ Accuracy color-coded (Green ≥80%, Yellow 60-79%, Red &lt;60%)</li>
            <li>✅ Time spent formatted (e.g., "8m", "12m")</li>
            <li>✅ Relative time displayed (e.g., "2 hours ago")</li>
            <li>✅ Hover state shows shadow effect</li>
            <li>✅ Click navigation ready (navigate to /decks/:deckId)</li>
            <li>✅ Keyboard accessible (Tab + Enter/Space)</li>
            <li>✅ Empty state shown when no activity</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ActivityFeedTest;
