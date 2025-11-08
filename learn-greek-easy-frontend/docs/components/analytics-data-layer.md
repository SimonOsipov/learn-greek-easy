# Analytics Data Layer Reference

Data structures, stores, and APIs for analytics.

[← Back to Main Components Reference](../Components-Reference.md)

---

## Analytics Data Layer

**Purpose**: TypeScript interfaces, mock data services, and state management for analytics and progress tracking features.

**Location**:
- Types: `/src/types/analytics.ts`
- Mock API: `/src/services/mockAnalyticsAPI.ts`
- Mock Data: `/src/services/mockAnalyticsData.ts`
- Store: `/src/stores/analyticsStore.ts`

---

### TypeScript Interfaces (8)

**Complete type definitions from Task 06.01**:

1. **AnalyticsSnapshot**: Daily analytics snapshot representing complete learning state at end of a specific date
2. **ProgressDataPoint**: Single point on progress chart timeline with multiple metric values
3. **DeckPerformanceStats**: Analytics for a single deck used in bar charts
4. **WordStatusBreakdown**: Distribution of cards across learning states for pie charts
5. **RetentionRate**: Retention rate at specific interval tracking long-term memory
6. **StudyStreak**: Study streak information with current and historical best streaks
7. **AnalyticsActivityItem**: Single activity feed item representing review session or achievement
8. **AnalyticsDashboardData**: Complete analytics data for dashboard (single query returns all needed data)

**Key Interface Example**:
```typescript
// From /src/types/analytics.ts
interface AnalyticsDashboardData {
  userId: string;
  dateRange: {
    startDate: Date;
    endDate: Date;
    label: string; // "Last 7 days", "Last 30 days", "All time"
  };
  fetchedAt: Date;

  summary: {
    totalCardsReviewed: number;
    totalTimeStudied: number; // seconds
    averageAccuracy: number; // 0-100
    cardsNewlyMastered: number;
  };

  streak: StudyStreak;
  progressData: ProgressDataPoint[];
  deckStats: DeckPerformanceStats[];
  wordStatus: WordStatusBreakdown;
  retention: RetentionRate[];
  recentActivity: AnalyticsActivityItem[];
}
```

**See**: `/src/types/analytics.ts` for complete interface definitions with detailed JSDoc comments

---

### Mock Analytics API

**File**: `/src/services/mockAnalyticsAPI.ts`

**Purpose**: Simulates backend API for analytics data with localStorage persistence and 5-minute cache.

**Key Methods**:
```typescript
// Fetch complete dashboard data
export const fetchAnalyticsDashboard = async (
  userId: string,
  dateRange: 'last7' | 'last30' | 'alltime'
): Promise<AnalyticsDashboardData>

// Fetch progress data points for charts
export const fetchProgressData = async (
  userId: string,
  dateRange: string
): Promise<ProgressDataPoint[]>

// Fetch deck performance stats
export const fetchDeckPerformance = async (
  userId: string
): Promise<DeckPerformanceStats[]>

// Fetch study streak information
export const fetchStudyStreak = async (
  userId: string
): Promise<StudyStreak>
```

**Caching Behavior**:
- 5-minute cache duration for dashboard data
- Cache key: `analytics_cache_${userId}_${dateRange}`
- Automatic cache invalidation on data updates
- localStorage persistence across sessions

---

### Analytics Store

**File**: `/src/stores/analyticsStore.ts`

**Purpose**: Zustand store for managing analytics state, data fetching, and date range selection.

**State Shape**:
```typescript
interface AnalyticsStore {
  // Data
  dashboardData: AnalyticsDashboardData | null;
  dateRange: 'last7' | 'last30' | 'alltime';

  // Loading states
  loading: boolean;
  refreshing: boolean;
  error: string | null;

  // Actions
  loadAnalytics: (userId: string) => Promise<void>;
  refreshAnalytics: () => Promise<void>;
  setDateRange: (range: string) => void;
  clearError: () => void;
}
```

**Selectors**:
```typescript
// Memoized selectors for derived data
export const selectProgressData = (state: AnalyticsStore) => state.dashboardData?.progressData || [];
export const selectDeckPerformance = (state: AnalyticsStore) => state.dashboardData?.deckStats || [];
export const selectIsLoading = (state: AnalyticsStore) => state.loading || state.refreshing;
export const selectError = (state: AnalyticsStore) => state.error;
```

**Usage Pattern**:
```tsx
import { useAnalyticsStore } from '@/stores/analyticsStore';

// Load data on mount
useEffect(() => {
  if (user) {
    useAnalyticsStore.getState().loadAnalytics(user.id);
  }
}, [user]);

// Access data with selectors
const progressData = useAnalyticsStore(selectProgressData);
const loading = useAnalyticsStore(selectIsLoading);
```

---

### Data Flow Architecture

**Complete data flow from store to UI components**:

1. **User triggers analytics page load**
   - `useAnalytics()` hook called with `autoLoad: true`
   - Hook checks if data exists and loads if needed

2. **Store fetches data from mock API**
   - `analyticsStore.loadAnalytics(userId)` called
   - Sets `loading: true`
   - Calls `fetchAnalyticsDashboard(userId, dateRange)`

3. **Mock API returns data**
   - Checks localStorage cache (5-minute TTL)
   - Returns cached data if fresh
   - Generates mock data if cache expired
   - Persists to localStorage

4. **Store updates state**
   - Sets `dashboardData` with response
   - Sets `loading: false`
   - Clears any previous errors

5. **Components consume data via hooks**
   - `useAnalytics()` - Complete dashboard data
   - `useProgressData()` - Progress chart data
   - `useDeckPerformance()` - Deck stats for bar charts
   - `useStudyStreak()` - Streak information

6. **Chart components render visualization**
   - ChartContainer handles loading/empty states
   - Recharts renders charts with data
   - ChartTooltip and ChartLegend provide interactivity

**Refresh Flow**:
- User clicks refresh button
- `refreshAnalytics()` called
- Sets `refreshing: true` (doesn't clear existing data)
- Bypasses cache by clearing cache entry
- Fetches fresh data
- Updates `dashboardData` and sets `refreshing: false`

**Date Range Change Flow**:
- User selects new date range
- `setDateRange(newRange)` called
- Store updates `dateRange` state
- Automatically triggers `loadAnalytics()` with new range
- UI updates with filtered data

---

### localStorage Persistence

**Cache Keys**:
```typescript
// Analytics dashboard cache
`analytics_cache_${userId}_${dateRange}`

// Cache metadata
`analytics_cache_meta_${userId}_${dateRange}`
```

**Cache Structure**:
```typescript
{
  data: AnalyticsDashboardData,
  timestamp: number, // Unix timestamp
  ttl: number // 300000 (5 minutes)
}
```

**Cache Invalidation**:
- Automatic expiration after 5 minutes
- Manual invalidation on refresh
- Cleared on logout
- Cleared on date range change

---

