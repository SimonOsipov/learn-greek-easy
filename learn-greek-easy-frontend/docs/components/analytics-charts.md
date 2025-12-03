# Analytics Charts Reference

Chart components for data visualization using Recharts.

[← Back to Main Components Reference](../Components-Reference.md)

---

## Chart Components

**Purpose**: Wrapper components for Recharts visualization library providing consistent theming, responsive behavior, and loading states across all analytics charts.

**Location**: `/src/components/charts/`

**Dependencies**:
- `recharts` - Chart rendering library
- `/src/lib/chartConfig.ts` - Shared chart configuration
- `@/components/ui/skeleton` - Loading states
- `@/components/ui/card` - Container components

---

### ChartContainer

**Purpose**: Responsive container wrapper for all Recharts charts with automatic height adjustment, loading states, and optional Card wrapper.

**File**: `/src/components/charts/ChartContainer.tsx`

**Interface**:
```typescript
interface ChartContainerProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  loading?: boolean;
  noData?: boolean;
  className?: string;
  height?: number;
  bordered?: boolean;
  background?: boolean;
}
```

**Usage**:
```tsx
import { ChartContainer } from '@/components/charts/ChartContainer';
import { LineChart, Line } from 'recharts';

// Basic usage with auto-responsive height
<ChartContainer title="Progress Over Time" description="Last 7 days">
  <LineChart data={progressData}>
    <Line dataKey="cardsMastered" stroke="#3b82f6" />
  </LineChart>
</ChartContainer>

// With fixed height
<ChartContainer height={300}>
  <BarChart data={deckStats}>
    <Bar dataKey="accuracy" fill="#10b981" />
  </BarChart>
</ChartContainer>

// Loading state
<ChartContainer title="Analytics" loading={true} />

// No data state
<ChartContainer title="Retention" noData={true} />

// Without Card wrapper (borderless, transparent)
<ChartContainer bordered={false} background={false}>
  <AreaChart data={data} />
</ChartContainer>
```

**Features**:
- Automatic responsive height adjustment (250px mobile, 300px tablet, 350px desktop)
- Window resize listener for dynamic height updates
- Fixed height override via height prop
- Skeleton loading state with matching dimensions
- Empty state with "No data available" message
- Optional Card wrapper with title and description
- Borderless and transparent background variants
- Forwards ref for direct DOM access
- Clean unmount with event listener cleanup

**Props**:
| Name | Type | Default | Description |
|------|------|---------|-------------|
| children | React.ReactNode | required | Recharts chart component to render |
| title | string | undefined | Optional card title |
| description | string | undefined | Optional card description |
| loading | boolean | false | Show skeleton loading state |
| noData | boolean | false | Show empty state message |
| className | string | '' | Additional CSS classes for container |
| height | number | undefined | Fixed height in pixels (overrides responsive behavior) |
| bordered | boolean | true | Show card border (only if title/description provided) |
| background | boolean | true | Show card background (only if title/description provided) |

**Responsive Height Behavior**:
- Mobile (< 768px): 250px
- Tablet (768-1024px): 300px
- Desktop (≥ 1024px): 350px
- Uses `getResponsiveHeight()` from chartConfig.ts
- Height updates automatically on window resize
- Fixed height prop disables responsive behavior

**Integration Pattern**:
```tsx
// With analytics hooks
const { progressData, loading, error } = useProgressData();

return (
  <ChartContainer
    title="Learning Progress"
    loading={loading}
    noData={!progressData || progressData.length === 0}
  >
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={progressData}>
        {/* Chart configuration */}
      </LineChart>
    </ResponsiveContainer>
  </ChartContainer>
);
```

---

### ChartTooltip

**Purpose**: Custom tooltip component for Recharts with Shadcn/ui theming and flexible formatting options.

**File**: `/src/components/charts/ChartTooltip.tsx`

**Interface**:
```typescript
interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number | string;
    color: string;
    dataKey: string;
  }>;
  label?: string;
  className?: string;
  formatter?: (value: number | string) => string;
  labelFormatter?: (label: string) => string;
}
```

**Usage**:
```tsx
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { LineChart, Tooltip } from 'recharts';
import { format } from 'date-fns';

// Basic usage
<LineChart data={data}>
  <Tooltip content={<ChartTooltip />} />
  <Line dataKey="value" />
</LineChart>

// With custom formatters
<LineChart data={data}>
  <Tooltip
    content={
      <ChartTooltip
        formatter={(value) => `${value}%`}
        labelFormatter={(label) => format(new Date(label), 'MMM dd')}
      />
    }
  />
  <Line dataKey="accuracy" />
</LineChart>

// With custom styling
<AreaChart data={data}>
  <Tooltip
    content={
      <ChartTooltip className="border-2 border-blue-500" />
    }
  />
</AreaChart>
```

**Features**:
- Matches Shadcn/ui design system (border, background, shadow)
- Displays multiple data series in single tooltip
- Color indicator dots matching chart colors
- Custom value and label formatters
- Null/undefined handling (returns null when inactive)
- Minimum width 120px for readability
- Rounded corners with shadow-lg
- Semi-transparent background with backdrop blur

**Props**:
| Name | Type | Default | Description |
|------|------|---------|-------------|
| active | boolean | false | Whether tooltip is currently active (managed by Recharts) |
| payload | Array | [] | Data series to display (managed by Recharts) |
| label | string | undefined | X-axis label for tooltip |
| className | string | '' | Additional CSS classes |
| formatter | (value) => string | String(value) | Format individual values (e.g., add %, round numbers) |
| labelFormatter | (label) => string | identity | Format the label (e.g., date formatting) |

**Styling**:
- Background: bg-background (theme-aware)
- Border: border with theme color
- Padding: p-3 (12px)
- Shadow: shadow-lg
- Min-width: 120px
- Label: text-sm font-semibold text-foreground
- Values: text-sm font-medium text-foreground
- Series names: text-sm text-muted-foreground

**Common Formatter Examples**:
```typescript
// Percentage
formatter={(value) => `${value}%`}

// Currency
formatter={(value) => `$${value.toLocaleString()}`}

// Time duration
formatter={(value) => `${Math.floor(value / 60)}h ${value % 60}m`}

// Date label
labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')}
```

---

### ChartLegend

**Purpose**: Custom legend component for Recharts with consistent styling and optional click interactions.

**File**: `/src/components/charts/ChartLegend.tsx`

**Interface**:
```typescript
interface LegendPayload {
  value: string;
  type?: string;
  id?: string;
  color?: string;
}

interface ChartLegendProps {
  payload?: LegendPayload[];
  wrapperClassName?: string;
  className?: string;
  vertical?: boolean;
  onClick?: (dataKey: string) => void;
}
```

**Usage**:
```tsx
import { ChartLegend } from '@/components/charts/ChartLegend';
import { LineChart, Legend } from 'recharts';

// Basic horizontal legend
<LineChart data={data}>
  <Legend content={<ChartLegend />} />
  <Line dataKey="new" />
  <Line dataKey="learning" />
</LineChart>

// Vertical legend
<BarChart data={data}>
  <Legend content={<ChartLegend vertical={true} />} />
</BarChart>

// With click handler for toggling series
<AreaChart data={data}>
  <Legend
    content={
      <ChartLegend
        onClick={(dataKey) => toggleSeries(dataKey)}
      />
    }
  />
</AreaChart>

// Custom styling
<PieChart>
  <Legend
    content={
      <ChartLegend
        wrapperClassName="pt-6"
        className="text-xs"
      />
    }
  />
</PieChart>
```

**Features**:
- Horizontal (default) or vertical layout
- Color-coded circular indicators (3x3 rounded-full)
- Optional click handling for series toggling
- Hover effects when clickable (opacity-80 transition)
- Null/empty payload handling
- Accessible with proper list semantics
- Consistent spacing with flex/gap layout

**Props**:
| Name | Type | Default | Description |
|------|------|---------|-------------|
| payload | LegendPayload[] | [] | Legend items (managed by Recharts) |
| wrapperClassName | string | '' | Classes for outer wrapper div |
| className | string | '' | Classes for legend list (ul element) |
| vertical | boolean | false | Vertical layout instead of horizontal |
| onClick | (dataKey: string) => void | undefined | Click handler for interactive legends |

**Layout Patterns**:
- Horizontal: `flex flex-wrap items-center justify-center gap-4`
- Vertical: `flex flex-col gap-4`
- Default padding top: pt-4 (16px)

**Styling**:
- List: flex with gap-4, text-sm
- Items: flex items-center gap-2
- Color indicator: h-3 w-3 rounded-full (12x12 circle)
- Text: text-muted-foreground
- Interactive: cursor-pointer hover:opacity-80 transition-opacity

**Interactive Legend Example**:
```tsx
// Toggle series visibility on click
const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

const toggleSeries = (dataKey: string) => {
  setHiddenSeries(prev => {
    const newSet = new Set(prev);
    if (newSet.has(dataKey)) {
      newSet.delete(dataKey);
    } else {
      newSet.add(dataKey);
    }
    return newSet;
  });
};

<LineChart data={data}>
  <Legend content={<ChartLegend onClick={toggleSeries} />} />
  {!hiddenSeries.has('new') && <Line dataKey="new" />}
  {!hiddenSeries.has('learning') && <Line dataKey="learning" />}
</LineChart>
```

---

### Chart Components - Integration Guide

**Complete Chart Example**:
```tsx
import { ChartContainer } from '@/components/charts/ChartContainer';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { ChartLegend } from '@/components/charts/ChartLegend';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { chartColors, chartConfig } from '@/lib/chartConfig';
import { format } from 'date-fns';

const ProgressChart = () => {
  const { progressData, loading, error } = useProgressData();

  return (
    <ChartContainer
      title="Learning Progress"
      description="Cards mastered over time"
      loading={loading}
      noData={!progressData || progressData.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={progressData}
          margin={chartConfig.margin}
        >
          <CartesianGrid
            strokeDasharray={chartConfig.grid.strokeDasharray}
            stroke={chartConfig.grid.stroke}
          />
          <XAxis
            dataKey="dateString"
            tickFormatter={(date) => format(new Date(date), 'MMM dd')}
            stroke={chartConfig.axis.stroke}
            tick={{ fill: chartConfig.axis.tick.fill }}
          />
          <YAxis
            stroke={chartConfig.axis.stroke}
            tick={{ fill: chartConfig.axis.tick.fill }}
          />
          <Tooltip
            content={
              <ChartTooltip
                labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')}
                formatter={(value) => `${value} cards`}
              />
            }
          />
          <Legend content={<ChartLegend />} />
          <Line
            type="monotone"
            dataKey="cardsMastered"
            stroke={chartColors.chart1}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="cardsReviewed"
            stroke={chartColors.chart2}
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};
```

**Related Components**:
- [Analytics Dashboard Page](#analytics-dashboard-page) - Uses chart components
- [useProgressData](#useprogressdata) - Provides chart data
- [chartConfig](#chart-configuration) - Shared chart settings

---
