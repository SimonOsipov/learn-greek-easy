# Display Components Reference

Display and data visualization components.

[← Back to Main Components Reference](../Components-Reference.md)

---

### MetricCard

**Purpose**: Display KPI metrics with value, label, and sublabel

**Location**: `src/components/display/MetricCard.tsx`

**Interface**:
```typescript
interface MetricCardProps {
  label: string;
  value: number | string;
  sublabel: string;
  color?: 'primary' | 'orange' | 'green' | 'blue' | 'muted';
  icon?: React.ReactNode;
  loading?: boolean;
  onClick?: () => void;
  tooltip?: string;
}
```

**Usage**:
```tsx
<MetricCard
  label="Due Today"
  value={24}
  sublabel="cards to review"
  color="primary"
  tooltip="Cards scheduled for review today"
/>

<MetricCard
  label="Current Streak"
  value={12}
  sublabel="days"
  color="orange"
  icon={<FlameIcon />}
/>
```

**Variants**:
- `primary`: Blue text color (#2563eb)
- `orange`: Orange text (#f97316)
- `green`: Green text (#10b981)
- `blue`: Blue text (#3b82f6)
- `muted`: Gray text (#6b7280)

**Styling**:
- Hover animation: `translateY(-2px)`
- White card with border
- Value: 2rem (32px) font size, 700 weight

---

### ChartContainer

**Location**: `src/components/charts/ChartContainer.tsx`
**Purpose**: Responsive wrapper for Recharts charts with loading and empty states

#### Props
```typescript
interface ChartContainerProps {
  children: React.ReactNode;      // Chart content (usually ResponsiveContainer + Chart)
  title?: string;                  // Optional card title
  description?: string;            // Optional card description
  loading?: boolean;               // Show skeleton loading state
  noData?: boolean;                // Show empty state message
  className?: string;              // Additional CSS classes
  height?: number;                 // Fixed height (overrides responsive)
  bordered?: boolean;              // Show card border (default: true)
  background?: boolean;            // Show card background (default: true)
}
```

#### Usage
```tsx
import { ChartContainer } from '@/components/charts';
import { LineChart, Line } from 'recharts';

<ChartContainer title="Progress Over Time" height={300}>
  <LineChart data={data}>
    <Line dataKey="value" />
  </LineChart>
</ChartContainer>
```

#### Features
- **Auto-responsive height** based on viewport (mobile 250px, tablet 300px, desktop 350px)
- **Skeleton loading state** integration from Shadcn/ui
- **Empty state** with "No data available" message
- **Optional Shadcn Card wrapper** with title/description
- **Window resize listener** for responsive behavior
- **Flexible height** via height prop or auto-responsive

---

### ChartTooltip

**Location**: `src/components/charts/ChartTooltip.tsx`
**Purpose**: Custom tooltip for Recharts with Shadcn styling

#### Props
```typescript
interface ChartTooltipProps {
  active?: boolean;                // Whether tooltip is active
  payload?: Array;                 // Data for tooltip display
  label?: string;                  // Tooltip label
  className?: string;              // Additional CSS classes
  formatter?: (value) => string;   // Custom value formatter
  labelFormatter?: (label) => string; // Custom label formatter
}
```

#### Usage
```tsx
import { ChartTooltip } from '@/components/charts';
import { LineChart, Tooltip } from 'recharts';

<LineChart data={data}>
  <Tooltip content={<ChartTooltip formatter={(v) => `${v}%`} />} />
</LineChart>
```

#### Features
- **Matches Shadcn/ui theme** (border, background, shadow)
- **Color indicators** for multi-series data
- **Custom formatters** for values and labels
- **Responsive min-width** (120px)
- **Accessibility** with proper semantic HTML

---

### ChartLegend

**Location**: `src/components/charts/ChartLegend.tsx`
**Purpose**: Custom legend for Recharts with consistent styling

#### Props
```typescript
interface ChartLegendProps {
  payload?: Array;                 // Legend items
  wrapperClassName?: string;       // Wrapper CSS classes
  className?: string;              // List CSS classes
  vertical?: boolean;              // Vertical layout (default: horizontal)
  onClick?: (dataKey: string) => void; // Click handler for items
}
```

#### Usage
```tsx
import { ChartLegend } from '@/components/charts';
import { LineChart, Legend } from 'recharts';

<LineChart data={data}>
  <Legend content={<ChartLegend vertical={false} />} />
</LineChart>
```

#### Features
- **Horizontal or vertical layout** based on prop
- **Color indicators** matching chart colors
- **Optional click handler** for interactive legends
- **Consistent text styling** with muted-foreground
- **Flexible positioning** via wrapperClassName

---

### ProgressLineChart

**Location**: `src/components/charts/ProgressLineChart.tsx`
**Purpose**: Line chart showing word status progression over time (3 trends)

#### Props
```typescript
interface ProgressLineChartProps {
  height?: number;      // Chart height in pixels (default: responsive)
  className?: string;   // Additional CSS classes
}
```

#### Usage
```tsx
import { ProgressLineChart } from '@/components/charts';

<ProgressLineChart height={350} />
```

#### Features
- **3 trend lines**: New Cards (cyan), Learning Cards (blue), Mastered Cards (green)
- **Data source**: `useProgressData()` hook (last 30 days)
- **Responsive design**: Mobile (250px) → Tablet (300px) → Desktop (350px)
- **Date formatting**: X-axis shows "MMM dd" format via date-fns
- **Loading/error/empty states**: Full state management
- **Custom tooltip**: Shows date + card counts for all 3 series
- **Legend**: Bottom-aligned with circle icons

#### Data Structure
```typescript
// Uses ProgressDataPoint[] from useProgressData()
{
  dateString: "2025-11-04",
  cardsNew: 45,
  cardsLearning: 120,
  cardsMastered: 342,
  accuracy: 87
}
```

---

### AccuracyAreaChart

**Location**: `src/components/charts/AccuracyAreaChart.tsx`
**Purpose**: Area chart with gradient showing accuracy percentage trend

#### Props
```typescript
interface AccuracyAreaChartProps {
  height?: number;      // Chart height in pixels (default: responsive)
  className?: string;   // Additional CSS classes
}
```

#### Usage
```tsx
import { AccuracyAreaChart } from '@/components/charts';

<AccuracyAreaChart height={300} />
```

#### Features
- **Gradient fill**: Blue gradient from opaque (top) to transparent (bottom)
- **Data source**: `useProgressData()` hook (accuracy field)
- **Y-axis range**: 0-100% with percentage formatting
- **Date formatting**: X-axis shows "MMM dd" format
- **Loading/error/empty states**: Full state management
- **Custom tooltip**: Shows date + percentage value
- **Responsive design**: Adjusts height, ticks, and fonts by viewport

#### Data Structure
```typescript
// Uses ProgressDataPoint[] from useProgressData()
{
  dateString: "2025-11-04",
  accuracy: 87.5  // Percentage (0-100)
}
```

---

### DeckPerformanceChart

**Location**: `src/components/charts/DeckPerformanceChart.tsx`
**Purpose**: Horizontal bar chart comparing mastery percentages across decks

#### Props
```typescript
interface DeckPerformanceChartProps {
  height?: number;      // Chart height in pixels (default: responsive)
  maxDecks?: number;    // Maximum decks to display (default: 8)
  className?: string;   // Additional CSS classes
}
```

#### Usage
```tsx
import { DeckPerformanceChart } from '@/components/charts';

<DeckPerformanceChart height={400} maxDecks={8} />
```

#### Features
- **Horizontal bars**: Layout optimized for deck name readability
- **Data source**: `useDeckPerformance()` hook
- **Sorting**: Decks sorted by mastery descending (best first)
- **8-color spectrum**: Each deck gets unique color from spectrum palette
- **X-axis**: Shows 0-100% with percentage formatting
- **Y-axis**: Shows deck names (responsive width: 100-140px)
- **Custom tooltip**: Shows deck name, mastery %, cards mastered/total, accuracy
- **Loading/error/empty states**: Full state management

#### Data Structure
```typescript
// Uses DeckPerformanceStats[] from useDeckPerformance()
{
  deckId: "deck-1",
  deckName: "A1 Basics",
  mastery: 87.5,        // Percentage (cardsMastered / cardsInDeck × 100)
  cardsMastered: 342,
  cardsInDeck: 400,
  accuracy: 88.2
}
```

---

### StageDistributionChart

**Location**: `src/components/charts/StageDistributionChart.tsx`
**Purpose**: Pie chart showing distribution of cards across learning stages

#### Props
```typescript
interface StageDistributionChartProps {
  height?: number;      // Chart height in pixels (default: responsive)
  className?: string;   // Additional CSS classes
}
```

#### Usage
```tsx
import { StageDistributionChart } from '@/components/charts';

<StageDistributionChart height={350} />
```

#### Features
- **5 learning stages**: New, Learning, Review, Mastered, Relearning
- **Data source**: `useAnalytics()` hook (wordStatus field)
- **Percentage labels**: Shows % on each pie slice
- **Stage-specific colors**: Distinct colors from spectrum palette
- **Legend**: Bottom-aligned with stage names and percentages
- **Responsive sizing**: Outer radius adjusts 80-120px by viewport
- **Loading/error/empty states**: Full state management
- **Custom tooltip**: Shows stage name, card count, and percentage

#### Data Structure
```typescript
// Uses WordStatusBreakdown from useAnalytics()
{
  new: 45,
  learning: 120,
  review: 90,
  mastered: 342,
  relearning: 24,
  total: 621,
  newPercent: 7.2,
  learningPercent: 19.3,
  reviewPercent: 14.5,
  masteredPercent: 55.1,
  relearningPercent: 3.9
}
```

---

### DeckCard

**Purpose**: Display deck with progress, stats, and status

**Location**: `src/components/display/DeckCard.tsx`

**Interface**:
```typescript
interface DeckCardProps {
  deck: {
    id: string;
    title: string;
    description: string;
    status: 'in-progress' | 'completed' | 'not-started';
    progress: {
      current: number;
      total: number;
      percentage: number;
    };
    stats: {
      due: number;
      mastered: number;
      learning: number;
    };
  };
  onClick?: () => void;
  onQuickAction?: () => void;
  showStats?: boolean;
}
```

**Usage**:
```tsx
<DeckCard
  deck={{
    id: '1',
    title: 'A1 Essential Words',
    description: 'Basic vocabulary for everyday communication',
    status: 'in-progress',
    progress: { current: 68, total: 100, percentage: 68 },
    stats: { due: 12, mastered: 68, learning: 32 }
  }}
  onClick={() => navigate('/deck/1')}
  showStats={true}
/>
```

**Features**:
- Status badge (top-right)
- Progress bar with percentage
- Quick stats row
- Hover border color change
- Clickable card interaction

---

### WelcomeSection

**Purpose**: Personalized greeting and encouragement

**Location**: `src/components/display/WelcomeSection.tsx`

**Interface**:
```typescript
interface WelcomeSectionProps {
  userName: string;
  encouragingMessage?: string;
  lastActivity?: Date;
}
```

**Usage**:
```tsx
<WelcomeSection
  userName="Alex"
  encouragingMessage="Great work on your 12-day streak!"
  lastActivity={new Date('2025-10-24')}
/>
```

**Features**:
- Dynamic time-based greeting (Good morning/afternoon/evening)
- Personalized encouragement
- Last activity timestamp

---

### QuickActionsPanel

**Purpose**: Grouped action buttons with hierarchy

**Location**: `src/components/interactive/QuickActionsPanel.tsx`

**Interface**:
```typescript
interface QuickActionsPanelProps {
  primaryAction: {
    label: string;
    count?: number;
    onClick: () => void;
  };
  secondaryActions: Array<{
    label: string;
    onClick: () => void;
  }>;
}
```

**Usage**:
```tsx
<QuickActionsPanel
  primaryAction={{
    label: 'Review Cards',
    count: 24,
    onClick: () => startReview()
  }}
  secondaryActions={[
    { label: 'Add New Deck', onClick: () => navigate('/decks/new') },
    { label: 'View Statistics', onClick: () => navigate('/statistics') },
    { label: 'Practice Mode', onClick: () => startPractice() }
  ]}
/>
```

**Styling**:
- Primary: Large button with gradient background
- Secondary: Gray buttons with default size
- Vertical stack layout

---

### UpcomingReviews

**Purpose**: Display review schedule

**Location**: `src/components/display/UpcomingReviews.tsx`

**Interface**:
```typescript
interface UpcomingReviewsProps {
  reviews: Array<{
    period: string;
    count: number;
  }>;
  onViewAll?: () => void;
}
```

**Usage**:
```tsx
<UpcomingReviews
  reviews={[
    { period: 'Today', count: 24 },
    { period: 'Tomorrow', count: 12 },
    { period: 'This Week', count: 48 }
  ]}
  onViewAll={() => navigate('/schedule')}
/>
```

**Features**:
- Clean list layout
- Period + count display
- Optional "View All" action
- Card container

---

### LearningTip

**Purpose**: Display helpful tips and encouragement

**Location**: `src/components/display/LearningTip.tsx`

**Interface**:
```typescript
interface LearningTipProps {
  tip: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'warning' | 'success';
}
```

**Usage**:
```tsx
<LearningTip
  tip="Review your cards at the same time each day to build a strong habit!"
  icon={<LightbulbIcon />}
/>
```

**Styling**:
- Warm yellow gradient background
- Rounded corners
- Icon + text layout
- Friendly, encouraging tone

---

### PageContainer

**Purpose**: Max-width wrapper for page content

**Location**: `src/components/layout/PageContainer.tsx`

**Interface**:
```typescript
interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}
```

**Usage**:
```tsx
<PageContainer>
  <Header />
  <main>{/* page content */}</main>
</PageContainer>
```

**Styling**:
- Max-width: 1440px
- Centered with auto margins
- Horizontal padding: 1rem

---

### ContentLayout

**Purpose**: Two-column grid for main content + sidebar

**Location**: `src/components/layout/ContentLayout.tsx`

**Interface**:
```typescript
interface ContentLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
}
```

**Usage**:
```tsx
<ContentLayout
  sidebar={
    <>
      <QuickActionsPanel {...actions} />
      <UpcomingReviews {...reviews} />
      <LearningTip {...tip} />
    </>
  }
>
  <MetricsGrid />
  <DeckSection />
</ContentLayout>
```

**Styling**:
- Desktop: `grid-template-columns: 2fr 1fr`
- Mobile: Single column, sidebar below
- Gap: 1.5rem (24px)

---

