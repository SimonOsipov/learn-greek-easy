# Analytics Hooks Reference

Custom React hooks for analytics data fetching and state management.

[← Back to Main Components Reference](../Components-Reference.md)

---

## Analytics Hooks

**Purpose**: Custom React hooks for accessing analytics data from the analytics store with automatic loading, caching, and state management.

**Location**: `/src/hooks/`

**Dependencies**:
- `@/stores/analyticsStore` - Zustand analytics store
- `@/stores/authStore` - User authentication state
- React hooks (useEffect, etc.)

---

### useAnalytics

**Purpose**: Primary hook for analytics dashboard data with automatic loading, date range management, and refresh capability.

**File**: `/src/hooks/useAnalytics.ts`

**Interface**:
```typescript
interface UseAnalyticsReturn {
  data: AnalyticsDashboardData | null;
  loading: boolean;
  error: string | null;
  dateRange: 'last7' | 'last30' | 'alltime';
  refresh: () => Promise<void>;
  setDateRange: (range: 'last7' | 'last30' | 'alltime') => void;
}

function useAnalytics(autoLoad?: boolean): UseAnalyticsReturn
```

**Usage**:
```tsx
import { useAnalytics } from '@/hooks/useAnalytics';

// Basic usage with auto-load
const { data, loading, error, refresh, setDateRange } = useAnalytics(true);

if (loading) return <Loading />;
if (error) return <Error message={error} />;
if (!data) return <Empty />;

return (
  <div>
    <DateRangePicker
      value={dateRange}
      onChange={setDateRange}
    />
    <Button onClick={refresh}>Refresh</Button>
    <Dashboard data={data} />
  </div>
);

// Manual loading
const AnalyticsPage = () => {
  const { data, loading, refresh } = useAnalytics(false);

  useEffect(() => {
    // Load data when user is authenticated
    if (user) {
      useAnalyticsStore.getState().loadAnalytics(user.id);
    }
  }, [user]);

  return <Dashboard data={data} />;
};
```

**Features**:
- Auto-load on mount (optional via autoLoad parameter)
- Automatic user ID detection from auth store
- Date range selection with automatic data refresh
- Manual refresh capability
- 5-minute cache from analyticsStore
- Loading and error state management
- Returns null for data until loaded

**Parameters**:
| Name | Type | Default | Description |
|------|------|---------|-------------|
| autoLoad | boolean | false | Automatically load analytics data on mount if no data exists |

**Return Value**:
| Property | Type | Description |
|----------|------|-------------|
| data | AnalyticsDashboardData \| null | Complete dashboard data including summary, streak, progress, deck stats, word status, retention, and recent activity |
| loading | boolean | Combined loading state (initial load or refreshing) |
| error | string \| null | Error message if data fetch failed |
| dateRange | 'last7' \| 'last30' \| 'alltime' | Current selected date range |
| refresh | () => Promise<void> | Function to manually refresh analytics data (bypasses cache) |
| setDateRange | (range) => void | Function to change date range filter (triggers automatic reload) |

**Cache Behavior**:
- Uses 5-minute cache from analyticsStore
- Cache key includes userId and dateRange
- `refresh()` bypasses cache and forces fresh data
- `setDateRange()` triggers new fetch with new cache key
- Cache persists in localStorage across sessions

**Integration with Auth**:
```tsx
// Hook automatically uses current user from auth store
const { data } = useAnalytics(true);

// If user logs out, data is cleared
// If user changes, new data is automatically loaded
```

**Date Range Behavior**:
```tsx
const { dateRange, setDateRange } = useAnalytics();

// Change to last 30 days
setDateRange('last30'); // Triggers automatic data reload

// Change to all time
setDateRange('alltime'); // Triggers automatic data reload

// Each date range has its own cache
```

**Related Hooks**:
- [useProgressData](#useprogressdata) - Specialized hook for progress chart data
- [useDeckPerformance](#usedeckperformance) - Specialized hook for deck stats
- [useStudyStreak](#usestudystreak) - Specialized hook for streak data

---

### useProgressData

**Purpose**: Hook for progress chart data points with derived selector for optimized re-renders.

**File**: `/src/hooks/useProgressData.ts`

**Interface**:
```typescript
interface UseProgressDataReturn {
  progressData: ProgressDataPoint[];
  loading: boolean;
  error: string | null;
}

function useProgressData(): UseProgressDataReturn
```

**Usage**:
```tsx
import { useProgressData } from '@/hooks/useProgressData';
import { LineChart, Line } from 'recharts';

const ProgressChart = () => {
  const { progressData, loading, error } = useProgressData();

  if (loading) return <Skeleton className="h-[300px]" />;
  if (error) return <Alert variant="destructive">{error}</Alert>;

  return (
    <LineChart data={progressData}>
      <Line dataKey="cardsMastered" stroke="#3b82f6" />
      <Line dataKey="cardsReviewed" stroke="#10b981" />
    </LineChart>
  );
};
```

**Features**:
- Returns only progress data array (no full dashboard data)
- Uses memoized selector for performance
- Empty array if no data loaded
- Shares loading/error state with main analytics store
- No parameters required (uses current analytics store state)

**Return Value**:
| Property | Type | Description |
|----------|------|-------------|
| progressData | ProgressDataPoint[] | Array of data points with date, cardsMastered, cardsReviewed, accuracy, timeStudied, etc. |
| loading | boolean | True if analytics data is currently loading |
| error | string \| null | Error message if data fetch failed |

**ProgressDataPoint Interface**:
```typescript
interface ProgressDataPoint {
  date: Date;
  dateString: string; // ISO format for charting
  cardsMastered: number;
  cardsReviewed: number;
  accuracy: number; // 0-100
  timeStudied: number; // seconds
  streak: number;
  cardsNew: number;
  cardsLearning: number;
  cardsReview: number;
}
```

**Data Flow**:
1. Analytics store loads dashboard data via `useAnalytics()`
2. `useProgressData()` extracts progressData array via selector
3. Component receives only relevant data (no full dashboard object)
4. Re-renders only when progressData array changes

**Performance Optimization**:
- Uses `selectProgressData` selector for shallow comparison
- Only re-renders when progressData reference changes
- More efficient than using full dashboardData object

**Integration Example**:
```tsx
// Parent loads all analytics data
const DashboardPage = () => {
  useAnalytics(true); // Loads all data

  return (
    <div>
      <ProgressChart /> {/* Uses useProgressData */}
      <DeckChart /> {/* Uses useDeckPerformance */}
    </div>
  );
};

// Child components use specialized hooks
const ProgressChart = () => {
  const { progressData } = useProgressData(); // Only subscribes to progressData
  return <LineChart data={progressData} />;
};
```

---

### useDeckPerformance

**Purpose**: Hook for deck performance statistics with derived selector for bar chart data.

**File**: `/src/hooks/useDeckPerformance.ts`

**Interface**:
```typescript
interface UseDeckPerformanceReturn {
  deckStats: DeckPerformanceStats[];
  loading: boolean;
  error: string | null;
}

function useDeckPerformance(): UseDeckPerformanceReturn
```

**Usage**:
```tsx
import { useDeckPerformance } from '@/hooks/useDeckPerformance';
import { BarChart, Bar } from 'recharts';

const DeckPerformanceChart = () => {
  const { deckStats, loading, error } = useDeckPerformance();

  if (loading) return <Skeleton className="h-[300px]" />;
  if (error) return <Alert variant="destructive">{error}</Alert>;

  return (
    <BarChart data={deckStats}>
      <Bar dataKey="accuracy" fill="#3b82f6" />
      <Bar dataKey="mastery" fill="#10b981" />
    </BarChart>
  );
};
```

**Features**:
- Returns only deck stats array (no full dashboard data)
- Uses memoized selector for performance
- Empty array if no data loaded
- Shares loading/error state with main analytics store
- No parameters required (uses current analytics store state)

**Return Value**:
| Property | Type | Description |
|----------|------|-------------|
| deckStats | DeckPerformanceStats[] | Array of deck performance objects with accuracy, mastery, card counts, time spent, etc. |
| loading | boolean | True if analytics data is currently loading |
| error | string \| null | Error message if data fetch failed |

**DeckPerformanceStats Interface**:
```typescript
interface DeckPerformanceStats {
  deckId: string;
  deckName: string;
  deckColor: string; // hex code for chart bars

  // Card counts
  cardsInDeck: number;
  cardsNew: number;
  cardsLearning: number;
  cardsReview: number;
  cardsMastered: number;

  // Performance metrics
  accuracy: number; // 0-100
  successRate: number; // 0-100
  averageEaseFactor: number; // 1.3-2.5

  // Time investment
  timeSpent: number; // seconds
  sessionsCompleted: number;
  averageTimePerCard: number; // seconds

  // Progress rate
  mastery: number; // percentage (cardsMastered / cardsInDeck) × 100
  completionRate: number; // percentage started

  // Recent performance (last 7 days)
  recentAccuracy: number;
  cardsGraduatedRecently: number;
}
```

**Common Use Cases**:
```tsx
// Bar chart: Accuracy per deck
<BarChart data={deckStats}>
  <Bar dataKey="accuracy" fill="#3b82f6" />
</BarChart>

// Bar chart: Mastery per deck
<BarChart data={deckStats}>
  <Bar dataKey="mastery" fill="#10b981" />
</BarChart>

// Multi-series bar chart
<BarChart data={deckStats}>
  <Bar dataKey="cardsNew" fill="#e5e7eb" />
  <Bar dataKey="cardsLearning" fill="#3b82f6" />
  <Bar dataKey="cardsMastered" fill="#10b981" />
</BarChart>

// Deck comparison table
<Table>
  {deckStats.map(deck => (
    <TableRow key={deck.deckId}>
      <TableCell>{deck.deckName}</TableCell>
      <TableCell>{deck.mastery}%</TableCell>
      <TableCell>{deck.accuracy}%</TableCell>
    </TableRow>
  ))}
</Table>
```

**Sorting and Filtering**:
```tsx
const { deckStats } = useDeckPerformance();

// Sort by mastery (highest first)
const sortedByMastery = [...deckStats].sort((a, b) => b.mastery - a.mastery);

// Filter decks with low accuracy (< 70%)
const lowAccuracyDecks = deckStats.filter(deck => deck.accuracy < 70);

// Top 5 decks by time spent
const topByTime = [...deckStats]
  .sort((a, b) => b.timeSpent - a.timeSpent)
  .slice(0, 5);
```

---

### useStudyStreak

**Purpose**: Hook for study streak information with current streak, longest streak, and activity history.

**File**: `/src/hooks/useStudyStreak.ts`

**Interface**:
```typescript
interface UseStudyStreakReturn {
  streak: StudyStreak | undefined;
  loading: boolean;
  error: string | null;
}

function useStudyStreak(): UseStudyStreakReturn
```

**Usage**:
```tsx
import { useStudyStreak } from '@/hooks/useStudyStreak';
import { Flame } from 'lucide-react';

const StreakDisplay = () => {
  const { streak, loading, error } = useStudyStreak();

  if (loading) return <Skeleton className="h-20" />;
  if (error || !streak) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          <CardTitle>Study Streak</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">
          {streak.currentStreak} days
        </div>
        <p className="text-sm text-gray-500">
          Longest: {streak.longestStreak} days
        </p>
      </CardContent>
    </Card>
  );
};
```

**Features**:
- Returns streak object from dashboard data
- Undefined if analytics not loaded
- Shares loading/error state with main analytics store
- No parameters required (uses current analytics store state)

**Return Value**:
| Property | Type | Description |
|----------|------|-------------|
| streak | StudyStreak \| undefined | Streak object with current/longest streaks and milestone info, or undefined if not loaded |
| loading | boolean | True if analytics data is currently loading |
| error | string \| null | Error message if data fetch failed |

**StudyStreak Interface**:
```typescript
interface StudyStreak {
  // Current streak
  currentStreak: number; // consecutive days with reviews
  startDate: Date; // when current streak started
  lastActivityDate: Date; // last date with reviews

  // Historical best
  longestStreak: number; // best streak achieved
  longestStreakStart: Date;
  longestStreakEnd: Date;

  // Milestones
  milestoneReached: number; // highest milestone: 7, 30, 100, etc.
  nextMilestone: number; // next milestone to reach
  daysToNextMilestone: number; // days needed

  // Additional context
  streakBrokenToday: boolean; // activity missing yesterday
  consecutiveBreaks: number; // days without reviews
}
```

**Common Display Patterns**:
```tsx
// Basic streak display
<div className="text-3xl font-bold">
  {streak?.currentStreak || 0} days
</div>

// Active streak indicator
const isActive = streak && streak.currentStreak > 0 &&
  (new Date().getTime() - new Date(streak.lastActivityDate).getTime()) < 48 * 60 * 60 * 1000;

<Flame className={isActive ? 'text-orange-500' : 'text-gray-400'} />

// Motivational message
const getMessage = (days: number) => {
  if (days === 0) return "Start your learning journey today!";
  if (days === 1) return "Great start! Keep it going!";
  if (days < 7) return "You're building a habit!";
  if (days < 30) return "Impressive consistency!";
  return "Amazing dedication! 🎉";
};

<p>{getMessage(streak?.currentStreak || 0)}</p>

// Milestone progress
<Progress
  value={(streak.currentStreak / streak.nextMilestone) * 100}
/>
<p className="text-xs text-gray-500">
  {streak.daysToNextMilestone} days to {streak.nextMilestone}-day milestone
</p>

// Longest streak comparison
<div>
  <p>Current: {streak.currentStreak} days</p>
  <p className="text-sm text-gray-500">
    Personal best: {streak.longestStreak} days
  </p>
  {streak.currentStreak === streak.longestStreak && (
    <Badge variant="success">New Record!</Badge>
  )}
</div>
```

**Streak Status Logic**:
```tsx
// Determine if streak is active (within 48 hours)
const isStreakActive = (streak: StudyStreak): boolean => {
  if (streak.currentStreak === 0) return false;

  const hoursSinceActivity =
    (new Date().getTime() - new Date(streak.lastActivityDate).getTime()) /
    (1000 * 60 * 60);

  return hoursSinceActivity < 48;
};

// Determine streak color
const getStreakColor = (streak: StudyStreak) => {
  if (!isStreakActive(streak)) return 'gray';
  if (streak.currentStreak >= 30) return 'orange';
  if (streak.currentStreak >= 7) return 'yellow';
  return 'blue';
};
```

---

### Analytics Hooks - Common Patterns

**Hook Hierarchy**:
- `useAnalytics()` - Primary hook, loads all analytics data
- `useProgressData()` - Derived hook, accesses progressData array
- `useDeckPerformance()` - Derived hook, accesses deckStats array
- `useStudyStreak()` - Derived hook, accesses streak object

**Recommended Usage**:
```tsx
// In parent/page component: Load all data once
const DashboardPage = () => {
  const { loading, error } = useAnalytics(true);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      <ProgressChart />      {/* Uses useProgressData() */}
      <DeckChart />          {/* Uses useDeckPerformance() */}
      <StreakWidget />       {/* Uses useStudyStreak() */}
    </div>
  );
};

// In child components: Access specific data
const ProgressChart = () => {
  const { progressData } = useProgressData(); // Only subscribes to progressData
  return <LineChart data={progressData} />;
};
```

**Performance Benefits**:
- Reduces prop drilling (no passing data through multiple components)
- Optimized re-renders (components only re-render when their specific data changes)
- Centralized data management (all components access same store)
- Automatic cache handling (5-minute cache shared across all hooks)

**Error Handling Pattern**:
```tsx
const AnalyticsComponent = () => {
  const { data, loading, error } = useAnalytics(true);

  // Handle loading state
  if (loading) {
    return <Skeleton className="h-[400px]" />;
  }

  // Handle error state
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Failed to load analytics</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  // Handle empty data
  if (!data) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-gray-500">No analytics data available</p>
        </CardContent>
      </Card>
    );
  }

  // Render data
  return <Dashboard data={data} />;
};
```

**Related Components**:
- [Analytics Widget Components](#analytics-widget-components-5) - Use these hooks for data
- [Chart Components](#chart-components) - Use these hooks for chart data
- [Analytics Store](#analytics-store) - Underlying state management

---

