# Analytics Components

Widget components for displaying key statistics and metrics on the analytics dashboard.

## Components

### StatCard
Base card component for displaying statistics with optional trend indicators.

**Props**:
- `title: string` - Card title
- `value: string | number` - Main value to display
- `icon?: ReactNode` - Optional icon
- `trend?: { value: number; direction: 'up' | 'down' }` - Optional trend indicator
- `isLoading?: boolean` - Show loading skeleton

**Usage**:
```tsx
<StatCard
  title="Cards Reviewed"
  value={145}
  icon={<BookOpen />}
  trend={{ value: 12, direction: 'up' }}
/>
```

### StreakWidget
Displays current and longest study streak with flame icon.

**Props**:
- `isLoading?: boolean` - Show loading skeleton

**Data Source**: `useAnalyticsStore(selectDashboardData)?.streak`

**Usage**:
```tsx
<StreakWidget isLoading={false} />
```

### WordStatusWidget
Shows distribution of cards across learning stages (new, learning, review, mastered).

**Props**:
- `isLoading?: boolean` - Show loading skeleton

**Data Source**: `useAnalyticsStore(selectDashboardData)?.wordStatus`

**Usage**:
```tsx
<WordStatusWidget isLoading={false} />
```

### RetentionWidget
Displays retention rate percentage with color-coded indicator.

**Props**:
- `isLoading?: boolean` - Show loading skeleton

**Data Source**: `useAnalyticsStore(selectDashboardData)?.retention`

**Usage**:
```tsx
<RetentionWidget isLoading={false} />
```

### TimeStudiedWidget
Shows total time studied with formatted duration.

**Props**:
- `isLoading?: boolean` - Show loading skeleton

**Data Source**: `useAnalyticsStore(selectDashboardData)?.summary.totalTimeStudied`

**Usage**:
```tsx
<TimeStudiedWidget isLoading={false} />
```

### ActivityFeed
List of recent review sessions with deck name, accuracy, and timestamp.

**Props**:
- `activities: ActivityItem[]` - Array of activity items
- `maxItems?: number` - Maximum items to display (default: 10)

**Usage**:
```tsx
<ActivityFeed
  activities={dashboardData?.recentActivity || []}
  maxItems={10}
/>
```

### ActivityFeedItem
Individual activity feed item component.

**Props**:
- `activity: ActivityItem` - Activity data
- `onClick?: () => void` - Click handler

**Usage**:
```tsx
<ActivityFeedItem
  activity={activity}
  onClick={() => navigate(`/decks/${activity.deckId}`)}
/>
```

## Data Flow

All analytics widgets consume data from `analyticsStore`:

1. Dashboard fetches analytics on mount via `loadAnalytics(userId)`
2. Store provides selectors for efficient component updates
3. Date range filter triggers `setDateRange()` which refetches data
4. Widgets read from `selectDashboardData()` selector

## Empty States

All widgets handle empty states gracefully:
- Display "N/A" or "0" for missing data
- Show helpful empty state messages
- No crashes or console errors

## Loading States

All widgets support `isLoading` prop:
- Display Skeleton component while loading
- Match skeleton to actual component structure
- Smooth transition to loaded state
