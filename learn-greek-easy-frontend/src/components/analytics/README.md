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

**Data Source**: `useAnalytics().data?.streak`

**Usage**:
```tsx
<StreakWidget isLoading={false} />
```

### WordStatusWidget
Shows distribution of cards across learning stages (new, learning, review, mastered).

**Props**:
- `isLoading?: boolean` - Show loading skeleton

**Data Source**: `useAnalytics().data?.wordStatus`

**Usage**:
```tsx
<WordStatusWidget isLoading={false} />
```

### RetentionWidget
Displays retention rate percentage with color-coded indicator.

**Props**:
- `isLoading?: boolean` - Show loading skeleton

**Data Source**: `useAnalytics().data?.retention`

**Usage**:
```tsx
<RetentionWidget isLoading={false} />
```

### TimeStudiedWidget
Shows total time studied with formatted duration.

**Props**:
- `isLoading?: boolean` - Show loading skeleton

**Data Source**: `useAnalytics().data?.summary.totalTimeStudied`

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

All analytics widgets consume data from `useAnalytics()` (TanStack Query):

1. Dashboard mounts and `useAnalytics()` fetches data automatically (enabled when `userId` is set)
2. Data is cached per `(userId, dateRange)` — no redundant fetches across widgets
3. Date range filter changes invalidate the cache and trigger a refetch automatically
4. Hook returns `{ data: AnalyticsDashboardData | undefined, isLoading, isFetching, error, refetch }`

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
