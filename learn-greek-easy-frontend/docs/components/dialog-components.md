# Activity Feed & Dialog Components Reference

Activity feed and utility dialog components.

[← Back to Main Components Reference](../Components-Reference.md)

---

## Activity Feed Components (2)

**Purpose**: Display recent study sessions and achievements in a feed format with navigation capabilities.

**Location**: `/src/components/analytics/`

---

### ActivityFeed

**Location**: `src/components/analytics/ActivityFeed.tsx`
**Purpose**: Container component that displays a list of recent study sessions and achievements

#### Props
```typescript
interface ActivityFeedProps {
  activities: AnalyticsActivityItem[];  // Array of activity items to display
  maxItems?: number;                     // Maximum number of items to display (default: 10)
}
```

#### Features
- Displays last N activity items (configurable via `maxItems` prop)
- Empty state with motivational message and icon
- Vertical list layout with consistent spacing (space-y-3)
- Card wrapper with header ("Recent Activity")
- Auto-slices activities array to show only `maxItems`
- Responsive design

#### Usage
```tsx
import { ActivityFeed } from '@/components/analytics';
import { useAnalytics } from '@/hooks/useAnalytics';

function Dashboard() {
  const { data } = useAnalytics({ autoLoad: true });

  return (
    <ActivityFeed
      activities={data?.recentActivity || []}
      maxItems={10}
    />
  );
}
```

#### Empty State
When `activities.length === 0`:
- BookOpen icon (w-12 h-12) centered
- "No recent activity" message
- "Start learning to see your progress here!" subtext
- Gray color scheme (text-gray-400)
- Centered layout with py-12 padding

#### Layout Structure
```
┌─────────────────────────────────┐
│ Recent Activity                 │  ← CardHeader with CardTitle
├─────────────────────────────────┤
│ [ActivityFeedItem]              │  ← First activity
│ [ActivityFeedItem]              │  ← Second activity
│ [ActivityFeedItem]              │  ← Third activity
│ ...                             │
└─────────────────────────────────┘
```

---

### ActivityFeedItem

**Location**: `src/components/analytics/ActivityFeedItem.tsx`
**Purpose**: Display a single activity item (review session or achievement) with deck info, metrics, and navigation

#### Props
```typescript
interface ActivityFeedItemProps {
  activity: AnalyticsActivityItem;  // Single activity item data
}
```

#### Features
- **Deck Name with Icon**: BookOpen icon in primary-100 background, deck name truncated
- **Card Count**: Singular/plural handling ("1 card" vs "15 cards")
- **Color-Coded Accuracy**:
  - Green (≥80%): `text-green-600` - Excellent performance
  - Yellow (60-79%): `text-yellow-600` - Good, needs improvement
  - Red (<60%): `text-red-600` - Needs attention
- **Time Spent**: Clock icon with formatted duration ("8m", "1h 23m")
- **Relative Time**: Uses `date-fns` `formatDistanceToNow()` ("2 hours ago", "3 days ago")
- **Click Navigation**: Navigates to `/decks/:deckId` on click
- **Keyboard Accessible**: Enter/Space keys trigger navigation
- **Hover State**: Shadow transition (`hover:shadow-md transition-shadow`)

#### Implementation Details

**Time Duration Formatting** (from seconds):
```typescript
const formatTimeDuration = (seconds: number): string => {
  if (seconds === 0) return '0m';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
};
```

**Accuracy Color Logic**:
```typescript
const getAccuracyColor = (accuracy: number): string => {
  if (accuracy >= 80) return 'text-green-600';   // Excellent
  if (accuracy >= 60) return 'text-yellow-600';  // Good
  return 'text-red-600';                         // Needs attention
};
```

**Keyboard Navigation**:
```typescript
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    handleClick();  // Navigate to deck detail page
  }
};
```

#### Usage
```tsx
import { ActivityFeedItem } from '@/components/analytics';

function ActivityList() {
  const activity = {
    activityId: '1',
    type: 'review_session',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),  // 2 hours ago
    deckId: 'deck-1',
    deckName: 'A1 Basics',
    cardsReviewed: 15,
    accuracy: 87,
    timeSpent: 480,  // 8 minutes in seconds
    // ... other fields
  };

  return <ActivityFeedItem activity={activity} />;
}
```

#### Layout Structure
```
┌───────────────────────────────────────┐
│ 📖 A1 Basics                          │  ← Icon + Deck Name
│ 15 cards • 87% • ⏱️ 8m               │  ← Metrics (cards, accuracy, time)
│ 2 hours ago                           │  ← Relative time
└───────────────────────────────────────┘
```

#### Accessibility
- `role="button"` for clickable card
- `tabIndex={0}` for keyboard focus
- `aria-label="View details for {deckName}"` for screen readers
- `aria-hidden="true"` on decorative icons
- Keyboard navigation with Enter/Space keys

#### Styling Patterns
- **Icon Badge**: `p-2 bg-primary-100 rounded-lg` with `text-primary-600` icon
- **Hover Effect**: `hover:shadow-md transition-shadow` for smooth shadow appearance
- **Cursor**: `cursor-pointer` to indicate clickability
- **Text Truncation**: `truncate` on deck name to prevent overflow
- **Gap Spacing**: `gap-3` between icon and content
- **Metrics Row**: `flex items-center gap-3` with `text-sm text-gray-500`

#### Dependencies
- `react-router-dom`: useNavigate() for navigation
- `date-fns`: formatDistanceToNow() for relative time
- `lucide-react`: BookOpen, Clock icons
- `@/components/ui/card`: Card component from shadcn/ui

---
