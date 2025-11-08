# Analytics Widgets Reference

Widget components for displaying key metrics and statistics.

[← Back to Main Components Reference](../Components-Reference.md)

---

## Analytics Widget Components (5)

**Purpose**: Display key analytics metrics with loading states, color coding, and data visualization for dashboard overview.

**Location**: `/src/components/analytics/`

---

### 1. StatCard

**Purpose**: Generic reusable metric display widget with icon, value, trend indicator, and color scheme support.

**File**: `/src/components/analytics/StatCard.tsx`

**Interface**:
```typescript
interface StatCardProps {
  icon?: React.ReactElement;       // Optional Lucide icon
  label: string;                    // Metric name
  value: string | number;           // Metric value (formatted)
  subtext?: string;                 // Optional additional context
  trend?: 'up' | 'down';           // Optional trend indicator
  colorScheme?: 'primary' | 'success' | 'warning' | 'danger';  // Color theme
  isLoading?: boolean;              // Show skeleton loading state
}
```

**Usage**:
```tsx
import { StatCard } from '@/components/analytics';
import { TrendingUp } from 'lucide-react';

// Basic stat card
<StatCard
  label="Cards Due"
  value={24}
  colorScheme="primary"
/>

// With icon and trend
<StatCard
  icon={<TrendingUp />}
  label="Accuracy Rate"
  value="87%"
  subtext="Last 30 days"
  trend="up"
  colorScheme="success"
/>

// Loading state
<StatCard
  label="Total Cards"
  value={0}
  isLoading={true}
/>
```

**Features**:
- Flexible value display (string or number)
- Icon with colored background badge (4 color schemes)
- Trend arrows (up/down) for metrics
- Subtext for additional context
- Skeleton loading state
- White card with border and shadow
- 3xl font size for value (32px)
- Responsive layout with flex

**Color Schemes**:
- **Primary**: Blue (bg-blue-100, text-blue-600)
- **Success**: Green (bg-green-100, text-green-600)
- **Warning**: Yellow (bg-yellow-100, text-yellow-600)
- **Danger**: Red (bg-red-100, text-red-600)

**Props**:
| Name | Type | Default | Description |
|------|------|---------|-------------|
| icon | React.ReactElement | undefined | Optional Lucide React icon |
| label | string | required | Metric label text |
| value | string \| number | required | Metric value to display |
| subtext | string | undefined | Optional secondary text below value |
| trend | 'up' \| 'down' | undefined | Optional trend arrow indicator |
| colorScheme | 'primary' \| 'success' \| 'warning' \| 'danger' | 'primary' | Color theme for icon background |
| isLoading | boolean | false | Show skeleton loading state |

---

### 2. StreakWidget

**Purpose**: Display study streak with motivational messaging and flame icon indicator.

**File**: `/src/components/analytics/StreakWidget.tsx`

**Interface**:
```typescript
// No props - uses useStudyStreak() hook
```

**Usage**:
```tsx
import { StreakWidget } from '@/components/analytics';

<StreakWidget />
```

**Features**:
- Flame icon (orange when active, gray when inactive)
- Current streak in days (3xl font size)
- Motivational messages based on streak length
- Longest streak display
- Active streak detection (within 48 hours)
- Orange border highlight when streak active
- Skeleton loading state
- Error state handling
- Empty state message

**Motivational Messages**:
- 0 days: "Start your learning journey today!"
- 1 day: "Great start! Keep it going!"
- 2-6 days: "You're building a habit!"
- 7-29 days: "Impressive consistency!"
- 30+ days: "Amazing dedication! 🎉"

**Active Streak Logic**:
- Streak is active if currentStreak > 0 AND lastActivityDate within 48 hours
- Active: Orange flame icon, orange border
- Inactive: Gray flame icon, default border

**Data Source**:
- `useStudyStreak()` hook from Task 06.02
- Returns: `{ currentStreak, longestStreak, lastActivityDate, loading, error }`

---

### 3. WordStatusWidget

**Purpose**: Show vocabulary breakdown by learning stage (New, Learning, Review, Mastered) with icons and percentages.

**File**: `/src/components/analytics/WordStatusWidget.tsx`

**Interface**:
```typescript
// No props - uses useAnalytics() hook
```

**Usage**:
```tsx
import { WordStatusWidget } from '@/components/analytics';

<WordStatusWidget />
```

**Features**:
- 4 learning stages with unique icons and colors
- Card count badges for each stage
- Percentage calculation for each stage
- Total card count at bottom
- Color-coded icons with background badges
- Skeleton loading state
- Empty state: "No cards yet. Start learning!"
- Error state handling

**Learning Stages**:
| Stage | Label | Icon | Icon Color | Background |
|-------|-------|------|------------|------------|
| New | New | Circle | text-gray-500 | bg-gray-100 |
| Learning | Learning | BookOpen | text-blue-600 | bg-blue-100 |
| Review | Review | RefreshCw | text-yellow-600 | bg-yellow-100 |
| Mastered | Mastered | CheckCircle | text-green-600 | bg-green-100 |

**Display Format**:
- Icon badge + label (left)
- Count badge + percentage (right)
- Total: "X cards" (bottom with border-top)

**Data Source**:
- `useAnalytics()` hook from Task 06.02
- Uses `data.wordStatus` field: `{ new, learning, young (Review), mature (Mastered) }`

---

### 4. RetentionWidget

**Purpose**: Display retention rate with color-coded thresholds and brain icon.

**File**: `/src/components/analytics/RetentionWidget.tsx`

**Interface**:
```typescript
// No props - uses useAnalytics() hook
```

**Usage**:
```tsx
import { RetentionWidget } from '@/components/analytics';

<RetentionWidget />
```

**Features**:
- Color-coded retention rate (green/yellow/red)
- Brain icon with matching color scheme
- 7-day retention or average fallback
- Motivational text based on percentage
- Trend up arrow for high retention (≥75%)
- Skeleton loading state
- Empty state: "Not enough data yet"
- Error state handling

**Color Coding Thresholds**:
| Retention Rate | Color | Icon BG | Text | Message |
|----------------|-------|---------|------|---------|
| ≥ 80% | Green | bg-green-100 | text-green-600 | "Excellent!" |
| 60-79% | Yellow | bg-yellow-100 | text-yellow-600 | "Good" |
| < 60% | Red | bg-red-100 | text-red-600 | "Needs work" |

**Display Format**:
- Brain icon badge (top)
- Retention percentage (3xl font size)
- "% remembered after 7+ days" subtext
- Status message (Excellent/Good/Needs work)

**Data Source**:
- `useAnalytics()` hook from Task 06.02
- Uses `data.retention` array: `[{ interval: 7, rate: 87.5 }, ...]`
- Prefers 7-day retention, falls back to average

---

### 5. TimeStudiedWidget

**Purpose**: Display total study time with formatted duration (hours + minutes).

**File**: `/src/components/analytics/TimeStudiedWidget.tsx`

**Interface**:
```typescript
// No props - uses useAnalytics() hook
```

**Usage**:
```tsx
import { TimeStudiedWidget } from '@/components/analytics';

<TimeStudiedWidget />
```

**Features**:
- Clock icon with blue badge
- Time formatting (Xh Ym format)
- Date range context text
- Skeleton loading state
- Empty state: "No time data available"
- Error state handling

**Time Formatting**:
- Input: seconds from `data.summary.totalTimeStudied`
- Convert to minutes: `Math.floor(seconds / 60)`
- Format:
  - 0 min: "0m"
  - < 60 min: "45m"
  - ≥ 60 min: "2h 30m" or "3h" (omit minutes if 0)

**Date Range Text**:
- Based on `useAnalytics()` dateRange state:
  - 'last7': "in last 7 days"
  - 'last30': "in last 30 days"
  - 'alltime': "all time"

**Display Format**:
- Clock icon badge (blue)
- Formatted time (3xl font size)
- Date range subtext (xs font size, gray)

**Data Source**:
- `useAnalytics()` hook from Task 06.02
- Uses `data.summary.totalTimeStudied` (seconds)
- Uses `dateRange` state from hook

---

### Analytics Widgets - Common Patterns

**Shared Features**:
- All widgets use Shadcn Card components (Card, CardHeader, CardTitle, CardContent)
- All support Skeleton loading states
- All handle error states gracefully
- All show empty states when no data available
- All use Lucide React icons
- All follow consistent color scheme (blue/green/yellow/red)

**Data Integration**:
- StreakWidget: `useStudyStreak()` hook
- Other 4 widgets: `useAnalytics()` hook
- Both hooks from Task 06.02

**Loading States**:
```tsx
if (loading) {
  return (
    <Card>
      <CardContent className="p-6">
        <Skeleton className="h-[height] w-full" />
      </CardContent>
    </Card>
  );
}
```

**Error/Empty States**:
```tsx
if (error || !data) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-sm text-gray-500">Error message</p>
      </CardContent>
    </Card>
  );
}
```

**Typography Scale**:
- Widget labels: text-sm font-medium
- Main values: text-3xl font-bold
- Subtexts: text-xs text-gray-400
- Secondary info: text-sm

**Color Palette**:
- Gray: #6b7280, #9ca3af, #e5e7eb
- Blue: #2563eb, #3b82f6, #dbeafe
- Green: #10b981, #22c55e, #d1fae5
- Yellow: #f59e0b, #fbbf24, #fef3c7
- Red: #ef4444, #f87171, #fee2e2
- Orange: #f97316, #fb923c, #fed7aa

---

