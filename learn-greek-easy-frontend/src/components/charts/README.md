# Chart Components

Recharts-based chart components for visualizing analytics data.

## Components

### ChartContainer
Wrapper component providing consistent styling and responsive sizing for charts.

**Props**:
- `children: ReactNode` - Chart content
- `className?: string` - Additional CSS classes

**Usage**:
```tsx
<ChartContainer>
  <LineChart data={data}>
    {/* chart content */}
  </LineChart>
</ChartContainer>
```

### ChartTooltip
Custom tooltip component for charts with consistent styling.

**Props**:
- `active?: boolean` - Whether tooltip is active
- `payload?: any[]` - Tooltip data
- `label?: string` - Tooltip label

### ChartLegend
Custom legend component for charts.

**Props**:
- `payload?: any[]` - Legend items

### ProgressLineChart
Line chart showing cards reviewed over time.

**Data Source**: `useAnalytics().data?.progressData`

**Features**:
- Responsive sizing
- Custom tooltips on hover
- Empty state handling
- X-axis: Date (formatted as "MMM dd")
- Y-axis: Cards reviewed count

**Usage**:
```tsx
<ProgressLineChart />
```

### AccuracyAreaChart
Area chart showing review accuracy trend over time.

**Data Source**: `useAnalytics().data?.progressData`

**Features**:
- Gradient fill under area
- Percentage formatting (0-100%)
- Responsive sizing

**Usage**:
```tsx
<AccuracyAreaChart />
```

### DeckPerformanceChart
Bar chart comparing accuracy across decks.

**Data Source**: `useAnalytics().data?.deckStats`

**Features**:
- Color-coded bars (green: 80%+, yellow: 60-79%, red: <60%)
- Horizontal bars for better label readability
- Shows deck names on Y-axis

**Usage**:
```tsx
<DeckPerformanceChart />
```

### StageDistributionChart
Donut chart showing card distribution by learning stage.

**Data Source**: `useAnalytics().data?.wordStatus`

**Features**:
- 5 segments: New (gray), Learning (blue), Review (yellow), Mastered (green), Relearning (red)
- Custom legend with counts
- Percentage labels

**Usage**:
```tsx
<StageDistributionChart />
```

## Chart Styling

All charts follow consistent styling:
- **Colors**: Match Style Guide (primary, success, warning, muted)
- **Height**: 300px default
- **Responsive**: Full width of container
- **Tooltips**: Dark background, white text, rounded corners
- **Legends**: Bottom position, horizontal layout

## Empty States

All charts handle empty data:
- Display centered empty state with icon and message
- No crashes or broken charts
- Helpful messages guide users to take action

## Data Requirements

Charts consume data from `useAnalytics()` (TanStack Query hook).

**Return shape**: `{ data, isLoading, isFetching, loading, error, refetch }`

- `data: AnalyticsDashboardData | undefined` (from `@/types/analytics`):
  - `data.progressData: ProgressDataPoint[]` — time series data
  - `data.deckStats: DeckPerformanceStats[]` — per-deck statistics
  - `data.wordStatus: WordStatusBreakdown` — stage distribution counts
  - `data.streak: StudyStreak` — current study streak
- `isLoading: boolean` — true only on the very first fetch (no cached data yet)
- `isFetching: boolean` — true on any in-flight fetch (initial OR background refetch on focus)
- `loading: boolean` — deprecated back-compat alias for `isLoading`; prefer `isLoading` in new code
- `error: Error | null` — fetch error if any
- `refetch: () => void` — manually trigger a refetch

**Cache key**: `['analytics', userId, dateRange]`. Data auto-refetches on window focus when stale (5 min staleTime per global QueryClient defaults).
