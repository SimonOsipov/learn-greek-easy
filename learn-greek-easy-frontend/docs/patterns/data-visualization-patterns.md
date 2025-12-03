# Data Visualization Patterns

Chart colors, date formatting, and data display patterns for analytics.

[← Back to Main Style Guide](./Style-Guide.md)

---

## Chart Color Palette

### 8-Color Spectrum

**Purpose**: Consistent color scheme for multi-series charts and data visualizations across all analytics components.

**Location**: `/src/lib/chartConfig.ts`

**Color Definitions**:
```typescript
export const chartColors = {
  // Semantic colors from Shadcn/ui theme
  primary: 'hsl(var(--primary))',
  secondary: 'hsl(var(--secondary))',
  accent: 'hsl(var(--accent))',
  muted: 'hsl(var(--muted))',

  // 8-color palette for multi-series charts
  chart1: '#3b82f6', // blue-500
  chart2: '#10b981', // emerald-500
  chart3: '#f59e0b', // amber-500
  chart4: '#ef4444', // red-500
  chart5: '#8b5cf6', // violet-500
  chart6: '#06b6d4', // cyan-500
  chart7: '#ec4899', // pink-500
  chart8: '#84cc16', // lime-500

  // Grayscale for text and backgrounds
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
};
```

**8-Color Spectrum Usage**:
| Color | Hex | Tailwind | Primary Use Case |
|-------|-----|----------|------------------|
| Chart 1 | #3b82f6 | blue-500 | Primary data series, learning cards |
| Chart 2 | #10b981 | emerald-500 | Success metrics, mastered cards |
| Chart 3 | #f59e0b | amber-500 | Warning states, review cards |
| Chart 4 | #ef4444 | red-500 | Error states, low performance |
| Chart 5 | #8b5cf6 | violet-500 | Premium features, advanced metrics |
| Chart 6 | #06b6d4 | cyan-500 | New cards, beginner metrics |
| Chart 7 | #ec4899 | pink-500 | Engagement metrics, special events |
| Chart 8 | #84cc16 | lime-500 | Growth metrics, progress indicators |

---

### Color Schemes

**Pre-defined color combinations for specific chart types**:

#### Binary Scheme (2 colors)
**Use Case**: Comparison charts (e.g., This Week vs Last Week)

```typescript
binary: [chartColors.chart1, chartColors.chart2]
// Blue and Emerald
```

**Example**:
```tsx
<BarChart data={data}>
  <Bar dataKey="thisWeek" fill={chartColors.chart1} />
  <Bar dataKey="lastWeek" fill={chartColors.chart2} />
</BarChart>
```

---

#### Tertiary Scheme (3 colors)
**Use Case**: Good/Neutral/Bad categorization (e.g., Performance ratings)

```typescript
tertiary: [chartColors.chart2, chartColors.chart3, chartColors.chart4]
// Green, Amber, Red
```

**Example**:
```tsx
<PieChart data={[
  { name: 'Excellent', value: 40, fill: chartColors.chart2 },
  { name: 'Good', value: 35, fill: chartColors.chart3 },
  { name: 'Needs Work', value: 25, fill: chartColors.chart4 }
]} />
```

---

#### Spectrum Scheme (8 colors)
**Use Case**: Multi-deck performance charts

```typescript
spectrum: [
  chartColors.chart1, // blue
  chartColors.chart2, // emerald
  chartColors.chart3, // amber
  chartColors.chart4, // red
  chartColors.chart5, // violet
  chartColors.chart6, // cyan
  chartColors.chart7, // pink
  chartColors.chart8, // lime
]
```

**Example**:
```tsx
// Automatically assign colors to 8 decks
{deckStats.map((deck, index) => (
  <Bar
    key={deck.deckId}
    dataKey={deck.deckName}
    fill={colorSchemes.spectrum[index % 8]}
  />
))}
```

---

#### Performance Scheme (3 colors)
**Use Case**: Performance gradients from excellent to poor

```typescript
performance: [
  chartColors.chart2, // green (excellent 80%+)
  chartColors.chart3, // amber (good 60-79%)
  chartColors.chart4, // red (needs work <60%)
]
```

**Example**:
```tsx
const getPerformanceColor = (accuracy: number) => {
  if (accuracy >= 80) return colorSchemes.performance[0]; // green
  if (accuracy >= 60) return colorSchemes.performance[1]; // amber
  return colorSchemes.performance[2]; // red
};

<Cell fill={getPerformanceColor(deck.accuracy)} />
```

---

#### Progression Scheme (3 colors)
**Use Case**: Learning stage visualization (new → learning → mastered)

```typescript
progression: [
  chartColors.chart6, // cyan (new)
  chartColors.chart1, // blue (learning)
  chartColors.chart2, // green (mastered)
]
```

**Example**:
```tsx
<AreaChart data={data}>
  <Area dataKey="new" stackId="1" fill={colorSchemes.progression[0]} />
  <Area dataKey="learning" stackId="1" fill={colorSchemes.progression[1]} />
  <Area dataKey="mastered" stackId="1" fill={colorSchemes.progression[2]} />
</AreaChart>
```

---

### Chart Color Usage Guidelines

1. **Consistency**: Use the same color for the same data type across all charts
   - Learning cards → Always blue (#3b82f6)
   - Mastered cards → Always green (#10b981)
   - New cards → Always cyan (#06b6d4)
   - Review/Warning → Always amber (#f59e0b)

2. **Accessibility**: All colors meet WCAG AA contrast standards
   - Text on white background: ≥4.5:1 contrast ratio
   - Color-blind friendly combinations
   - Never rely solely on color to convey information

3. **Semantic Meaning**: Choose colors that match user expectations
   - Green for positive/success/completion
   - Red for negative/error/urgent
   - Blue for neutral/informational
   - Amber for warning/attention

4. **Grayscale Fallback**: Charts should be understandable in grayscale
   - Use patterns, shapes, or labels alongside colors
   - Test charts with grayscale filter

5. **Chart Legend**: Always include legend for multi-series charts
   - Use ChartLegend component for consistency
   - Position: Below chart (horizontal) or right side (vertical)

---


## Data Visualization Patterns

### Date Formatting

**Purpose**: Consistent date display across all charts and analytics components.

**Library**: `date-fns`

**Format Pattern**: `MMM dd` for chart axes (e.g., "Jan 15", "Feb 03")

**Usage**:
```typescript
import { format } from 'date-fns';

// X-axis tick formatter
<XAxis
  dataKey="dateString"
  tickFormatter={(date) => format(new Date(date), 'MMM dd')}
/>

// Tooltip label formatter
<Tooltip
  content={
    <ChartTooltip
      labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')}
    />
  }
/>
```

**Date Format Standards**:
| Context | Format | Example | Use Case |
|---------|--------|---------|----------|
| Chart X-axis | `MMM dd` | Jan 15 | Short date for limited space |
| Tooltip label | `MMM dd, yyyy` | Jan 15, 2025 | Full date with year |
| Data point | `yyyy-MM-dd` | 2025-01-15 | ISO string for data consistency |
| Relative date | `d 'days ago'` | 3 days ago | Activity feed timestamps |

**Implementation Example**:
```typescript
// Progress data point
interface ProgressDataPoint {
  date: Date; // Actual Date object
  dateString: string; // ISO format: "2025-01-15"
  // ... other metrics
}

// Chart X-axis (short format)
tickFormatter={(date) => format(new Date(date), 'MMM dd')}
// Output: "Jan 15"

// Tooltip (full format)
labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')}
// Output: "Jan 15, 2025"
```

---

### Percentage Formatting

**Purpose**: Display percentages consistently across charts and widgets.

**Format Pattern**: `${value}%`

**Usage**:
```typescript
// Tooltip formatter for accuracy metrics
formatter={(value) => `${value}%`}

// Y-axis tick formatter
<YAxis
  tickFormatter={(value) => `${value}%`}
/>

// Widget display
<div className="text-3xl font-bold">{accuracy}%</div>
```

**Percentage Display Rules**:
- Always round to whole numbers (no decimals): `Math.round(percentage)`
- Include % symbol immediately after number (no space)
- Right-align in tables for easy comparison
- Use color coding for thresholds (see Performance Scheme)

**Example**:
```typescript
// Calculate and format percentage
const calculatePercentage = (part: number, total: number): string => {
  if (total === 0) return '0%';
  return `${Math.round((part / total) * 100)}%`;
};

// Usage in component
<span className="text-sm text-gray-400">
  {calculatePercentage(cardsMastered, cardsTotal)}
</span>
```

---

### Number Formatting

**Purpose**: Format large numbers with thousands separators for readability.

**Format Pattern**: `${value.toLocaleString()}`

**Usage**:
```typescript
// Tooltip formatter for card counts
formatter={(value) => `${value.toLocaleString()} cards`}

// Large metric display
<div className="text-3xl font-bold">
  {cardsTotal.toLocaleString()}
</div>
```

**Number Formatting Rules**:
| Range | Format | Example |
|-------|--------|---------|
| 0-999 | No separator | 500 |
| 1,000-9,999 | Comma separator | 1,500 |
| 10,000+ | Comma separator | 10,500 |

**Implementation**:
```typescript
// Simple formatting
const formatNumber = (value: number): string => {
  return value.toLocaleString();
};

// With suffix for large numbers
const formatNumberCompact = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
};

// Usage
<span>{formatNumber(1500)}</span> // "1,500"
<span>{formatNumberCompact(1500000)}</span> // "1.5M"
```

---

### Gradient Definitions for Area Charts

**Purpose**: Consistent gradient fills for area charts showing progress over time.

**Usage**:
```tsx
import { AreaChart, Area, defs, linearGradient, stop } from 'recharts';

<AreaChart data={progressData}>
  <defs>
    <linearGradient id="colorMastered" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
      <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
    </linearGradient>
    <linearGradient id="colorLearning" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
    </linearGradient>
  </defs>
  <Area
    type="monotone"
    dataKey="cardsMastered"
    stroke="#10b981"
    fill="url(#colorMastered)"
  />
  <Area
    type="monotone"
    dataKey="cardsLearning"
    stroke="#3b82f6"
    fill="url(#colorLearning)"
  />
</AreaChart>
```

**Gradient Standards**:
- Top opacity: 0.8 (80% opacity at 5% offset)
- Bottom opacity: 0.1 (10% opacity at 95% offset)
- Stroke color: Match fill base color at full opacity
- Gradient direction: Vertical (top to bottom)

---

### Tooltip Content Structure

**Purpose**: Consistent tooltip layout across all charts.

**Structure**:
```tsx
// Using ChartTooltip component
<Tooltip
  content={
    <ChartTooltip
      formatter={(value) => `${value} cards`}
      labelFormatter={(label) => format(new Date(label), 'MMM dd')}
    />
  }
/>
```

**Tooltip Layout**:
1. **Label** (top): Date or category name
   - Font: text-sm font-semibold
   - Color: text-foreground
   - Bottom margin: mb-2

2. **Data Series** (middle): One row per series
   - Color indicator: 12x12 circle matching series color
   - Series name: text-sm text-muted-foreground
   - Value: text-sm font-medium text-foreground

3. **Background**: bg-background with border and shadow-lg
4. **Padding**: p-3 (12px all sides)
5. **Min-width**: 120px

**Example**:
```
┌─────────────────────────┐
│ Jan 15, 2025           │  ← Label
│                         │
│ ● Learning: 25 cards   │  ← Series 1
│ ● Mastered: 45 cards   │  ← Series 2
└─────────────────────────┘
```

---

### Legend Positioning

**Purpose**: Consistent legend placement for all chart types.

**Horizontal Legend** (Default):
- Position: Below chart
- Layout: `flex-wrap items-center justify-center`
- Gap: gap-4 (16px)
- Padding top: pt-4 (16px)

**Vertical Legend**:
- Position: Right side of chart
- Layout: `flex-col`
- Gap: gap-4 (16px)
- Use case: When horizontal space is limited

**Usage**:
```tsx
// Horizontal legend (default)
<Legend content={<ChartLegend />} />

// Vertical legend
<Legend content={<ChartLegend vertical={true} />} />

// Custom positioning
<Legend
  content={<ChartLegend wrapperClassName="pt-6" />}
  verticalAlign="bottom"
  height={36}
/>
```

---

### Responsive Chart Patterns

**Purpose**: Charts adapt height and tick count based on viewport width.

**Breakpoints**:
| Viewport | Height | Ticks | Font Size |
|----------|--------|-------|-----------|
| Mobile (< 768px) | 250px | 4 | 10px |
| Tablet (768-1024px) | 300px | 6 | 11px |
| Desktop (≥ 1024px) | 350px | 8 | 12px |

**Implementation**:
```typescript
// From chartConfig.ts
export const getResponsiveHeight = (width: number): number => {
  if (width < 768) return 250;
  if (width < 1024) return 300;
  return 350;
};

// Usage in component
const [chartHeight, setChartHeight] = useState(350);

useEffect(() => {
  const handleResize = () => {
    setChartHeight(getResponsiveHeight(window.innerWidth));
  };

  handleResize(); // Set initial height
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);

// Or use ChartContainer component (handles this automatically)
<ChartContainer height={chartHeight}>
  <LineChart data={data}>
    {/* Chart configuration */}
  </LineChart>
</ChartContainer>
```

**Responsive Axis Configuration**:
```tsx
// Mobile: Fewer ticks, smaller font
<XAxis
  tickCount={window.innerWidth < 768 ? 4 : 8}
  tick={{ fontSize: window.innerWidth < 768 ? 10 : 12 }}
/>

// Or use media query approach
<XAxis
  className="text-xs md:text-sm"
  tickCount={4}
  // Recharts will handle responsive sizing
/>
```

**Window Resize Handling**:
```typescript
// Best practice: Use ChartContainer component
// It handles resize automatically

// Manual handling (if needed)
useEffect(() => {
  const handleResize = () => {
    setChartHeight(getResponsiveHeight(window.innerWidth));
  };

  // Debounce resize events (optional, improves performance)
  const debouncedResize = debounce(handleResize, 200);

  window.addEventListener('resize', debouncedResize);
  return () => {
    window.removeEventListener('resize', debouncedResize);
    debouncedResize.cancel(); // Cancel pending debounced calls
  };
}, []);
```

**Mobile Chart Optimization**:
- Reduce tick count (4 instead of 8)
- Simplify legend (stack vertically)
- Increase touch target size for interactive elements
- Consider hiding less important data series on mobile

---


## Data Display Patterns

### Color-Coded Thresholds

**Purpose**: Provide visual feedback on performance metrics using color to indicate quality levels.

**Pattern**: RetentionWidget and similar analytics components

**Threshold System**:
```typescript
// Example: Retention Rate Color Coding
const getColorScheme = (rate: number) => {
  if (rate >= 80) return {
    color: 'text-green-600',
    bg: 'bg-green-100',
    text: 'Excellent!'
  };
  if (rate >= 60) return {
    color: 'text-yellow-600',
    bg: 'bg-yellow-100',
    text: 'Good'
  };
  return {
    color: 'text-red-600',
    bg: 'bg-red-100',
    text: 'Needs work'
  };
};
```

**Color Thresholds**:
- **Excellent (≥80%)**: Green (#10b981) - Positive reinforcement
- **Good (60-79%)**: Yellow (#f59e0b) - Room for improvement
- **Needs Work (<60%)**: Red (#ef4444) - Actionable feedback

**Usage Guidelines**:
- Use consistent thresholds across similar metrics
- Always provide text label alongside color (accessibility)
- Avoid red for minor issues (reserve for critical feedback)
- Consider adding trend arrows for context

---

### Time Formatting

**Purpose**: Display duration values in human-readable format.

**Pattern**: TimeStudiedWidget and time-based metrics

**Format Function**:
```typescript
const formatTime = (minutes: number): string => {
  if (minutes === 0) return '0m';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins}m`;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};
```

**Examples**:
- 0 minutes → "0m"
- 45 minutes → "45m"
- 90 minutes → "1h 30m"
- 120 minutes → "2h"

**Usage Guidelines**:
- Always convert from seconds to minutes first
- Omit zero values (show "2h" not "2h 0m")
- Use lowercase "h" and "m" for compactness
- Consider adding full text labels for accessibility

---

### Motivational Messaging

**Purpose**: Provide encouraging feedback based on user progress.

**Pattern**: StreakWidget and progress-based components

**Message Tiers**:
```typescript
const getMessage = (days: number): string => {
  if (days === 0) return "Start your learning journey today!";
  if (days === 1) return "Great start! Keep it going!";
  if (days < 7) return "You're building a habit!";
  if (days < 30) return "Impressive consistency!";
  return "Amazing dedication! 🎉";
};
```

**Guidelines**:
- Use positive, encouraging language
- Scale encouragement with achievement level
- Include emojis sparingly for celebration (30+ days)
- Keep messages short (under 10 words)
- Avoid negative or discouraging language

---

### Percentage Calculation and Display

**Purpose**: Show proportions and progress as percentages.

**Pattern**: WordStatusWidget and distribution components

**Calculation Pattern**:
```typescript
const getPercentage = (count: number, total: number): string => {
  if (total === 0) return '0%';
  return `${Math.round((count / total) * 100)}%`;
};
```

**Display Guidelines**:
- Always round to whole numbers (no decimals)
- Handle division by zero gracefully (return '0%')
- Right-align percentages in tables/lists
- Use text-xs and gray-400 color for subtlety
- Always show count alongside percentage for context

**Example**:
```tsx
<div className="flex items-center justify-between">
  <Badge variant="outline">{count}</Badge>
  <span className="text-xs text-gray-400 w-12 text-right">
    {getPercentage(count, total)}
  </span>
</div>
```

---

### Active State Detection

**Purpose**: Visually indicate active vs. inactive states based on recency.

**Pattern**: StreakWidget streak activity detection

**Logic**:
```typescript
const isActive = (currentValue: number, lastDate: Date, thresholdHours: number = 48): boolean => {
  if (currentValue === 0) return false;

  const hoursSince = (new Date().getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60);
  return hoursSince < thresholdHours;
};
```

**Visual Indicators**:
- **Active State**: Bright icon color (orange-500), colored border (border-orange-500)
- **Inactive State**: Muted icon color (gray-400), default border (border-gray-200)

**Usage Guidelines**:
- Use 48-hour threshold for daily habits (allows one day off)
- Always check both value > 0 AND recency
- Apply color to both icon and border for consistency
- Consider adding tooltip explaining active criteria

---

### Icon Badge System

**Purpose**: Combine icons with colored background badges for visual hierarchy.

**Pattern**: All analytics widgets

**Implementation**:
```tsx
<div className={`rounded-lg p-2 ${bgColor}`}>
  <Icon className={`w-5 h-5 ${iconColor}`} aria-hidden={true} />
</div>
```

**Color Schemes**:
| Theme | Background | Icon Color | Usage |
|-------|-----------|------------|-------|
| Primary | bg-blue-100 | text-blue-600 | General metrics, time |
| Success | bg-green-100 | text-green-600 | Positive metrics, mastery |
| Warning | bg-yellow-100 | text-yellow-600 | Review items, attention |
| Danger | bg-red-100 | text-red-600 | Error states, low scores |
| Gray | bg-gray-100 | text-gray-500 | Neutral items, new cards |

**Guidelines**:
- Use consistent padding: p-2 or p-3
- Icon size: w-5 h-5 (20px) or w-6 h-6 (24px)
- Always include aria-hidden={true} for decorative icons
- Match background and icon color from same family
- Use rounded-lg (12px) for badge background

---
