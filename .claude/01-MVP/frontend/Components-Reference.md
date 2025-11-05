# Components Reference Guide

Quick reference guide for all UI components in the Greek Language Learning application. Use this alongside the [Style Guide](./Style-Guide.md) during implementation.

---

## Overview

This guide provides practical reference for all **38 components** identified in the MVP dashboard. Components are categorized for easy navigation, with complete TypeScript interfaces, usage examples, and implementation guidelines.

### Component Distribution
- **Shadcn/ui Components**: 14 pre-built components
- **Custom Components**: 24 application-specific components (including 4 chart components and 5 analytics widgets)
- **Chart Components**: 4 analytics visualization components
- **Analytics Widget Components**: 5 metric display widgets
- **Total UI Elements**: 62+ instances across the dashboard, profile, and analytics pages

### Quick Navigation
- [Installation](#installation)
- [Component Categories](#component-categories)
- [Shadcn/ui Components](#shadcnui-components)
- [Custom Components](#custom-components)
- [Profile Management Components](#profile-management-components)
- [File Structure](#file-structure)
- [Common Patterns](#common-patterns)

---

## Installation

### Initial Setup

```bash
# Initialize Shadcn/ui in your project
npx shadcn-ui@latest init

# Add all required Shadcn components at once
npx shadcn-ui@latest add avatar badge button card dialog dropdown-menu navigation-menu progress separator sheet skeleton toast tooltip scroll-area
```

### Individual Component Installation

```bash
# Navigation & Layout
npx shadcn-ui@latest add navigation-menu
npx shadcn-ui@latest add sheet
npx shadcn-ui@latest add separator
npx shadcn-ui@latest add scroll-area

# User Interface
npx shadcn-ui@latest add avatar
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add button
npx shadcn-ui@latest add badge

# Data Display
npx shadcn-ui@latest add card
npx shadcn-ui@latest add progress
npx shadcn-ui@latest add tooltip

# Feedback
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add skeleton
```

### Dependencies

All Shadcn components automatically install their required Radix UI dependencies and utilities:
- `@radix-ui/react-*` - Headless UI primitives
- `class-variance-authority` - Component variants
- `clsx` + `tailwind-merge` - Class name utilities
- `lucide-react` - Icon library

---

## Component Categories

### Navigation Components (6)
Components for app navigation and routing

| Component | Type | Purpose |
|-----------|------|---------|
| [Header](#header) | Custom | Main navigation container |
| [NavigationMenu](#navigationmenu) | Shadcn | Desktop navigation links |
| [MobileMenuToggle](#mobilemenutoggle) | Custom | Mobile menu trigger |
| [MobileBottomNav](#mobilebottomnav) | Custom | Mobile tab navigation |
| [NavLink](#navlink) | Custom | Active navigation link |
| [UserMenu](#usermenu) | Composite | User avatar + dropdown |

### Layout Components (5)
Components for page structure and content organization

| Component | Type | Purpose |
|-----------|------|---------|
| [PageContainer](#pagecontainer) | Custom | Max-width wrapper |
| [ContentLayout](#contentlayout) | Custom | Two-column grid |
| [Section](#section) | Custom | Content section wrapper |
| [Sidebar](#sidebar) | Custom | Right column container |
| [Grid](#grid) | Custom | Responsive grid system |

### Data Display Components (6)
Components for showing user data and metrics

| Component | Type | Purpose |
|-----------|------|---------|
| [MetricCard](#metriccard) | Custom | KPI display |
| [DeckCard](#deckcard) | Custom | Deck with progress |
| [ProgressBar](#progressbar) | Composite | Progress indicator |
| [Badge](#badge) | Shadcn | Status labels |
| [QuickStats](#quickstats) | Custom | Inline statistics |
| [ReviewItem](#reviewitem) | Custom | Schedule display |

### Interactive Components (4)
Components for user actions and interactions

| Component | Type | Purpose |
|-----------|------|---------|
| [Button](#button) | Shadcn | All button variants |
| [IconButton](#iconbutton) | Custom | Icon-only button |
| [QuickActionsPanel](#quickactionspanel) | Custom | Action buttons group |
| [DeckCardInteractive](#deckcardinteractive) | Custom | Clickable deck card |

### Typography Components (5)
Components for text display and hierarchy

| Component | Type | Purpose |
|-----------|------|---------|
| PageTitle | Custom | H2 headings |
| SectionTitle | Custom | H3 headings |
| CardTitle | Custom | H4 headings |
| Label | Custom | Form/metric labels |
| Paragraph | Custom | Body text |

### Profile Management Components (6)
Components for user profile and settings management

| Component | Type | Purpose |
|-----------|------|---------|
| [Profile](#profile) | Custom | Main profile page container |
| [ProfileHeader](#profileheader-1) | Custom | User avatar and role display |
| [PersonalInfoSection](#personalinfosection) | Custom | Edit personal information form |
| [StatsSection](#statssection) | Custom | Learning statistics dashboard |
| [PreferencesSection](#preferencessection) | Custom | Learning preferences settings |
| [SecuritySection](#securitysection) | Custom | Password and security settings |

---

## Shadcn/ui Components

### Avatar

**Purpose**: Display user profile pictures or initials

**Installation**: `npx shadcn-ui@latest add avatar`

**Usage**:
```tsx
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// With image
<Avatar>
  <AvatarImage src="/avatar.jpg" alt="User Name" />
  <AvatarFallback>UN</AvatarFallback>
</Avatar>

// Initials only
<Avatar>
  <AvatarFallback className="bg-gradient-to-br from-[#667eea] to-[#764ba2]">
    AS
  </AvatarFallback>
</Avatar>
```

**Props**:
- Inherits all `div` props
- `AvatarImage`: `src`, `alt`
- `AvatarFallback`: Displays when image fails or is loading

---

### Badge

**Purpose**: Status indicators and labels

**Installation**: `npx shadcn-ui@latest add badge`

**Variants**: `default`, `secondary`, `destructive`, `outline`

**Custom Variants for App**:
```tsx
import { Badge } from '@/components/ui/badge';
import { cva } from 'class-variance-authority';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
  {
    variants: {
      status: {
        'in-progress': 'bg-[#dbeafe] text-[#1e40af]',
        completed: 'bg-[#d1fae5] text-[#065f46]',
        'not-started': 'bg-[#f3f4f6] text-[#6b7280]',
      },
    },
  }
);

// Usage
<Badge className={badgeVariants({ status: 'in-progress' })}>
  In Progress
</Badge>
```

**Props**:
- `variant`: Badge style variant
- `className`: Additional classes

---

### Button

**Purpose**: All user action triggers

**Installation**: `npx shadcn-ui@latest add button`

**Variants**: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`

**Sizes**: `default`, `sm`, `lg`, `icon`

**Usage**:
```tsx
import { Button } from '@/components/ui/button';

// Primary button (use gradient via className)
<Button
  size="lg"
  className="bg-gradient-to-br from-[#667eea] to-[#764ba2] hover:shadow-lg"
>
  Start Review
</Button>

// Secondary button
<Button variant="secondary">
  View All Decks
</Button>

// Ghost button
<Button variant="ghost" size="sm">
  Cancel
</Button>

// Icon button
<Button variant="ghost" size="icon">
  <SearchIcon className="h-4 w-4" />
</Button>
```

**Props**:
- `variant`: Button style
- `size`: Button size
- `disabled`: Disabled state
- `onClick`: Click handler
- All standard `button` props

---

### Card

**Purpose**: Container for grouped content

**Installation**: `npx shadcn-ui@latest add card`

**Components**: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`

**Usage**:
```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

<Card className="hover:border-[#2563eb] transition-all">
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Card content goes here</p>
  </CardContent>
</Card>
```

**Styling**:
- Default: White background, 1px border (#e5e7eb), 12px border radius
- Hover: Blue border, elevated shadow

---

### Dialog

**Purpose**: Modal dialogs for confirmations and forms

**Installation**: `npx shadcn-ui@latest add dialog`

**Components**: `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`

**Usage**:
```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

<Dialog>
  <DialogTrigger asChild>
    <Button>Start Review</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Ready to review?</DialogTitle>
    </DialogHeader>
    <p>You have 24 cards due for review.</p>
    <DialogFooter>
      <Button variant="secondary">Cancel</Button>
      <Button>Start</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### DropdownMenu

**Purpose**: Contextual menus and user menus

**Installation**: `npx shadcn-ui@latest add dropdown-menu`

**Components**: `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`

**Usage**:
```tsx
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon">
      <Avatar>
        <AvatarFallback>AS</AvatarFallback>
      </Avatar>
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem>Profile</DropdownMenuItem>
    <DropdownMenuItem>Settings</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Logout</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

### NavigationMenu

**Purpose**: Desktop navigation with dropdowns

**Installation**: `npx shadcn-ui@latest add navigation-menu`

**Components**: `NavigationMenu`, `NavigationMenuList`, `NavigationMenuItem`, `NavigationMenuLink`

**Usage**:
```tsx
import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuLink } from '@/components/ui/navigation-menu';

<NavigationMenu>
  <NavigationMenuList>
    <NavigationMenuItem>
      <NavigationMenuLink href="/dashboard" active>
        Dashboard
      </NavigationMenuLink>
    </NavigationMenuItem>
    <NavigationMenuItem>
      <NavigationMenuLink href="/decks">
        All Decks
      </NavigationMenuLink>
    </NavigationMenuItem>
  </NavigationMenuList>
</NavigationMenu>
```

---

### Progress

**Purpose**: Visual progress indicator

**Installation**: `npx shadcn-ui@latest add progress`

**Usage**:
```tsx
import { Progress } from '@/components/ui/progress';

// Default blue progress
<Progress value={68} className="h-2" />

// Success green progress
<Progress value={100} className="h-2 [&>div]:bg-[#10b981]" />
```

**Props**:
- `value`: Progress value (0-100)
- `max`: Maximum value (default: 100)
- `className`: Additional styling

---

### ScrollArea

**Purpose**: Custom scrollbar for content areas

**Installation**: `npx shadcn-ui@latest add scroll-area`

**Usage**:
```tsx
import { ScrollArea } from '@/components/ui/scroll-area';

<ScrollArea className="h-[400px] w-full">
  <div className="space-y-4">
    {items.map(item => <DeckCard key={item.id} {...item} />)}
  </div>
</ScrollArea>
```

**Use Cases**:
- Deck lists with > 5 items
- Long statistics tables
- Mobile content areas

---

### Separator

**Purpose**: Visual dividers between content

**Installation**: `npx shadcn-ui@latest add separator`

**Usage**:
```tsx
import { Separator } from '@/components/ui/separator';

<div>
  <Section>Content 1</Section>
  <Separator className="my-6" />
  <Section>Content 2</Section>
</div>
```

**Props**:
- `orientation`: `horizontal` (default) or `vertical`
- `decorative`: `true` if purely visual (hides from screen readers)

---

### Sheet

**Purpose**: Slide-out panels and mobile menus

**Installation**: `npx shadcn-ui@latest add sheet`

**Components**: `Sheet`, `SheetTrigger`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription`

**Usage**:
```tsx
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

<Sheet>
  <SheetTrigger asChild>
    <Button variant="ghost" size="icon">
      <MenuIcon />
    </Button>
  </SheetTrigger>
  <SheetContent side="right">
    <nav className="space-y-4">
      <a href="/dashboard">Dashboard</a>
      <a href="/decks">All Decks</a>
      <a href="/statistics">Statistics</a>
      <a href="/settings">Settings</a>
    </nav>
  </SheetContent>
</Sheet>
```

**Props**:
- `side`: `top`, `right` (default), `bottom`, `left`

---

### Skeleton

**Purpose**: Loading placeholders

**Installation**: `npx shadcn-ui@latest add skeleton`

**Usage**:
```tsx
import { Skeleton } from '@/components/ui/skeleton';

// Loading metric card
<Card>
  <CardContent className="space-y-2 p-6">
    <Skeleton className="h-4 w-24" />
    <Skeleton className="h-8 w-16" />
    <Skeleton className="h-3 w-32" />
  </CardContent>
</Card>

// Loading deck card
<Card>
  <CardContent className="space-y-4 p-6">
    <Skeleton className="h-5 w-3/4" />
    <Skeleton className="h-3 w-full" />
    <Skeleton className="h-2 w-full" />
  </CardContent>
</Card>
```

---

### Toast

**Purpose**: Temporary notification messages

**Installation**: `npx shadcn-ui@latest add toast`

**Setup**:
```tsx
// In your root layout
import { Toaster } from '@/components/ui/toaster';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
```

**Usage**:
```tsx
import { useToast } from '@/components/ui/use-toast';

function Component() {
  const { toast } = useToast();

  const handleSuccess = () => {
    toast({
      title: "Success!",
      description: "Deck completed successfully.",
    });
  };

  const handleError = () => {
    toast({
      title: "Error",
      description: "Failed to load decks.",
      variant: "destructive",
    });
  };
}
```

---

### Tooltip

**Purpose**: Contextual hints on hover

**Installation**: `npx shadcn-ui@latest add tooltip`

**Components**: `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`

**Usage**:
```tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <div className="metric-card">
        <span>Due Today</span>
        <span className="text-2xl font-bold">24</span>
      </div>
    </TooltipTrigger>
    <TooltipContent>
      <p>Cards scheduled for review today</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

---

## Custom Components

### Header

**Purpose**: Main navigation container with logo, navigation, and user menu

**Location**: `src/components/navigation/Header.tsx`

**Interface**:
```typescript
interface HeaderProps {
  user: {
    name: string;
    email: string;
    avatar?: string;
    initials: string;
  };
  isAuthenticated: boolean;
  onLogout: () => void;
}
```

**Usage**:
```tsx
<Header
  user={currentUser}
  isAuthenticated={true}
  onLogout={handleLogout}
/>
```

**Features**:
- Fixed positioning with sticky top
- Responsive: Desktop navigation + mobile hamburger
- White background with bottom border
- 64px height

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

### MobileBottomNav

**Purpose**: Fixed bottom navigation for mobile devices

**Location**: `src/components/navigation/MobileBottomNav.tsx`

**Interface**:
```typescript
interface MobileBottomNavProps {
  items: Array<{
    id: string;
    label: string;
    icon: React.ReactNode;
    href: string;
  }>;
  activeItem: string;
  onNavigate: (id: string) => void;
}
```

**Usage**:
```tsx
<MobileBottomNav
  items={[
    { id: 'home', label: 'Home', icon: <HomeIcon />, href: '/dashboard' },
    { id: 'decks', label: 'Decks', icon: <FolderIcon />, href: '/decks' },
    { id: 'stats', label: 'Stats', icon: <ChartIcon />, href: '/statistics' },
    { id: 'profile', label: 'Profile', icon: <UserIcon />, href: '/profile' },
  ]}
  activeItem="home"
  onNavigate={(id) => navigate(items.find(i => i.id === id)?.href)}
/>
```

**Features**:
- Fixed bottom positioning
- 5 navigation items maximum
- Active state highlighting
- Icon + label layout
- White background with top border
- Hidden on desktop (>= 768px)

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

## Profile Management Components

### Profile

**Purpose**: Main container page for user profile settings and information

**Location**: `src/pages/Profile.tsx`

**Interface**:
```typescript
type ProfileSection = 'personal' | 'stats' | 'preferences' | 'security';

interface NavigationItem {
  id: ProfileSection;
  label: string;
  icon: typeof User;
}
```

**Usage**:
```tsx
import { Profile } from '@/pages/Profile';

// In your router
<Route path="/profile" element={<Profile />} />
```

**Features**:
- Section-based navigation (personal, stats, preferences, security)
- Responsive sidebar with mobile hamburger menu
- State management integration with auth store
- Auto-save functionality for preferences
- Form validation with zod schemas

**Responsive Behavior**:
- Desktop: 3-column grid (1 for sidebar, 2 for content)
- Mobile: Collapsible sidebar with hamburger menu
- Breakpoint: md (768px)

---

### ProfileHeader

**Purpose**: Display user avatar, role badge, and account metadata in profile sidebar

**Location**: `src/components/profile/ProfileHeader.tsx`

**Interface**:
```typescript
interface ProfileHeaderProps {
  user: User;
  onAvatarClick?: () => void;
}
```

**Usage**:
```tsx
import { ProfileHeader } from '@/components/profile/ProfileHeader';

<ProfileHeader
  user={currentUser}
  onAvatarClick={() => handleAvatarUpload()}
/>
```

**Features**:
- Avatar with initials fallback
- Role badges (Admin/Premium/Free) with icons
- Member since date formatting
- Last activity display
- Hover effect on avatar for upload indication
- Gradient background for initials

**Role Badge Variants**:
- Admin: Red badge with Shield icon
- Premium: Purple badge with Crown icon
- Free: Gray secondary badge

---

### PersonalInfoSection

**Purpose**: Form for editing user personal information with validation

**Location**: `src/components/profile/PersonalInfoSection.tsx`

**Interface**:
```typescript
interface PersonalInfoSectionProps {
  user: User;
}

// Form schema
const profileSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens and apostrophes'),
});
```

**Usage**:
```tsx
import { PersonalInfoSection } from '@/components/profile/PersonalInfoSection';

<PersonalInfoSection user={currentUser} />
```

**Features**:
- React Hook Form integration
- Zod schema validation
- Avatar upload placeholder (coming soon)
- Name editing with real-time validation
- Read-only email and account ID display
- Save/Cancel buttons with loading states
- Success/error toast notifications

**Form Fields**:
- Profile Picture (placeholder with upload button)
- Full Name (editable with validation)
- Email Address (read-only)
- Account ID (read-only)

---

### StatsSection

**Purpose**: Display comprehensive learning statistics and achievements

**Location**: `src/components/profile/StatsSection.tsx`

**Interface**:
```typescript
interface StatsSectionProps {
  stats: UserStats;
}

interface UserStats {
  streak: number;
  wordsLearned: number;
  totalXP: number;
  joinedDate: Date;
  lastActivity?: Date;
}
```

**Usage**:
```tsx
import { StatsSection } from '@/components/profile/StatsSection';

<StatsSection stats={user.stats} />
```

**Features**:
- Streak counter with motivational messages
- Words learned with average per day calculation
- XP and level progression system
- Activity timeline (join date, last active)
- Achievement badges grid
- Dynamic progress bars
- Color-coded stat cards

**Stat Cards**:
- Current Streak (Flame icon, orange)
- Words Learned (BookOpen icon, blue)
- Total XP (Trophy icon, yellow)

**Level System**:
- 1000 XP per level
- Visual progress bar to next level
- Current level badge display

**Achievements**:
- First Steps (Complete first deck)
- Week Warrior (7-day streak)
- Century Club (100 words learned)
- Fire Keeper (30-day streak)

---

### PreferencesSection

**Purpose**: Manage learning preferences with auto-save functionality

**Location**: `src/components/profile/PreferencesSection.tsx`

**Interface**:
```typescript
interface PreferencesSectionProps {
  user: User;
}

interface UserPreferences {
  language: 'en' | 'el';
  dailyGoal: number; // minutes per day
  notifications: boolean;
  theme: 'light' | 'dark' | 'auto';
}
```

**Usage**:
```tsx
import { PreferencesSection } from '@/components/profile/PreferencesSection';

<PreferencesSection user={currentUser} />
```

**Features**:
- Auto-save with 1-second debounce
- Language selector with flags
- Daily goal slider (5-120 minutes)
- Notifications toggle switch
- Theme selector (coming soon)
- Real-time saving feedback
- No explicit save button needed

**Preference Cards**:
- Interface Language (Globe icon, blue)
- Daily Goal (Clock icon, green)
- Notifications (Bell icon, purple)
- Theme (Palette icon, gray - coming soon)

**Auto-save Pattern**:
```typescript
const debouncedSaveRef = useRef(
  debounce(async (newPreferences) => {
    await updateProfile({ preferences: newPreferences });
    toast({ title: 'Preferences saved' });
  }, 1000)
);
```

---

### SecuritySection

**Purpose**: Manage password, authentication settings, and account security

**Location**: `src/components/profile/SecuritySection.tsx`

**Interface**:
```typescript
// No props - uses global auth context

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});
```

**Usage**:
```tsx
import { SecuritySection } from '@/components/profile/SecuritySection';

<SecuritySection />
```

**Features**:
- Password change form with validation
- Password strength requirements checklist
- Two-factor authentication (coming soon)
- Active sessions display
- Account deletion with confirmation dialog
- Form validation with zod
- Loading states for async operations

**Security Cards**:
- Change Password (Key icon, blue)
- Two-Factor Authentication (Smartphone icon, green - disabled)
- Active Sessions (Lock icon, purple)
- Danger Zone (AlertTriangle icon, red)

**Delete Account Confirmation**:
- Warning dialog with consequences list
- Type "DELETE" to confirm
- Multiple confirmation steps
- Support contact redirect

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

## File Structure

### Recommended Organization

```
src/
├── pages/
│   ├── Dashboard.tsx
│   └── Profile.tsx                 # Main profile page
│
├── components/
│   ├── layout/
│   │   ├── PageContainer.tsx
│   │   ├── ContentLayout.tsx
│   │   ├── Section.tsx
│   │   ├── Sidebar.tsx
│   │   └── Grid.tsx
│   │
│   ├── navigation/
│   │   ├── Header.tsx
│   │   ├── NavigationMenu.tsx      # Wraps Shadcn NavigationMenu
│   │   ├── MobileMenuToggle.tsx
│   │   ├── MobileBottomNav.tsx
│   │   ├── NavLink.tsx
│   │   └── UserMenu.tsx            # Avatar + DropdownMenu
│   │
│   ├── display/
│   │   ├── MetricCard.tsx
│   │   ├── DeckCard.tsx
│   │   ├── ProgressBar.tsx         # Wraps Shadcn Progress
│   │   ├── QuickStats.tsx
│   │   ├── ReviewItem.tsx
│   │   ├── WelcomeSection.tsx
│   │   ├── UpcomingReviews.tsx
│   │   └── LearningTip.tsx
│   │
│   ├── interactive/
│   │   ├── QuickActionsPanel.tsx
│   │   ├── IconButton.tsx
│   │   └── DeckCardInteractive.tsx
│   │
│   ├── profile/
│   │   ├── ProfileHeader.tsx       # User avatar and role display
│   │   ├── PersonalInfoSection.tsx # Personal info form
│   │   ├── StatsSection.tsx        # Learning statistics
│   │   ├── PreferencesSection.tsx  # Learning preferences
│   │   └── SecuritySection.tsx     # Security settings
│   │
│   └── ui/
│       ├── avatar.tsx              # Shadcn component
│       ├── badge.tsx               # Shadcn component
│       ├── button.tsx              # Shadcn component
│       ├── card.tsx                # Shadcn component
│       ├── dialog.tsx              # Shadcn component
│       ├── dropdown-menu.tsx       # Shadcn component
│       ├── navigation-menu.tsx     # Shadcn component
│       ├── progress.tsx            # Shadcn component
│       ├── separator.tsx           # Shadcn component
│       ├── sheet.tsx               # Shadcn component
│       ├── skeleton.tsx            # Shadcn component
│       ├── toast.tsx               # Shadcn component
│       ├── toaster.tsx             # Shadcn component
│       ├── tooltip.tsx             # Shadcn component
│       ├── scroll-area.tsx         # Shadcn component
│       └── use-toast.ts            # Shadcn hook
│
├── types/
│   ├── user.ts
│   ├── deck.ts
│   ├── dashboard.ts
│   └── components.ts
│
├── hooks/
│   ├── useAuth.ts
│   ├── useDashboard.ts
│   └── useDecks.ts
│
└── lib/
    ├── utils.ts                    # cn() utility
    └── constants.ts
```

---

## Common Patterns

### Import Patterns

```tsx
// Shadcn UI components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Custom components
import { MetricCard } from '@/components/display/MetricCard';
import { DeckCard } from '@/components/display/DeckCard';
import { Header } from '@/components/navigation/Header';

// Utilities
import { cn } from '@/lib/utils';

// Types
import type { Deck, DashboardMetrics } from '@/types';
```

### Component Composition

```tsx
// Composing Shadcn components with custom logic
export function UserMenu({ user, onLogout }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Avatar>
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback>{user.initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => navigate('/profile')}>
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/settings')}>
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout}>
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Variant Patterns

```tsx
// Using CVA for component variants
import { cva, type VariantProps } from 'class-variance-authority';

const metricCardVariants = cva(
  'rounded-xl border border-[#e5e7eb] bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5',
  {
    variants: {
      color: {
        primary: 'hover:border-[#2563eb]',
        orange: 'hover:border-[#f97316]',
        green: 'hover:border-[#10b981]',
        blue: 'hover:border-[#3b82f6]',
        muted: 'hover:border-[#9ca3af]',
      },
    },
    defaultVariants: {
      color: 'primary',
    },
  }
);

interface MetricCardProps extends VariantProps<typeof metricCardVariants> {
  label: string;
  value: number | string;
  sublabel: string;
}

export function MetricCard({ label, value, sublabel, color }: MetricCardProps) {
  return (
    <div className={metricCardVariants({ color })}>
      <div className="text-[#6b7280] text-sm">{label}</div>
      <div className={cn('text-2xl font-bold', getColorClass(color))}>
        {value}
      </div>
      <div className="text-[#9ca3af] text-xs">{sublabel}</div>
    </div>
  );
}
```

### Loading States

```tsx
// Component with loading state using Skeleton
export function MetricCard({ label, value, sublabel, loading }: MetricCardProps) {
  if (loading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-8 w-16 mb-1" />
        <Skeleton className="h-3 w-32" />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      {/* actual content */}
    </Card>
  );
}
```

### Responsive Patterns

```tsx
// Mobile-first responsive component
export function DeckSection({ decks }: DeckSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold">Your Decks</h3>
        <Button variant="secondary" className="mt-2 sm:mt-0">
          View All
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {decks.map(deck => (
          <DeckCard key={deck.id} deck={deck} />
        ))}
      </div>
    </div>
  );
}
```

### Error Handling

```tsx
// Component with error state
export function DashboardMetrics() {
  const { data, error, isLoading } = useDashboardMetrics();
  const { toast } = useToast();

  useEffect(() => {
    if (error) {
      toast({
        title: "Error loading metrics",
        description: "Failed to load dashboard metrics. Please try again.",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  if (isLoading) {
    return <MetricsGridSkeleton />;
  }

  if (error) {
    return (
      <Card className="p-6">
        <p className="text-[#6b7280]">Unable to load metrics</p>
        <Button variant="secondary" onClick={() => refetch()}>
          Retry
        </Button>
      </Card>
    );
  }

  return <MetricsGrid metrics={data} />;
}
```

### Accessibility Patterns

```tsx
// Accessible interactive component
export function DeckCard({ deck, onClick }: DeckCardProps) {
  return (
    <Card
      role="button"
      tabIndex={0}
      className="cursor-pointer hover:border-[#2563eb] transition-all"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      aria-label={`${deck.title} - ${deck.progress.percentage}% complete`}
    >
      {/* card content */}
    </Card>
  );
}
```

---

## Component Development Checklist

### Before Implementation
- [ ] Component interface defined with TypeScript
- [ ] Variants and props documented
- [ ] Accessibility requirements identified
- [ ] Responsive behavior specified
- [ ] Loading and error states designed

### During Implementation
- [ ] Follow Style Guide for colors and spacing
- [ ] Use semantic HTML elements
- [ ] Add proper ARIA labels and roles
- [ ] Ensure keyboard navigation works
- [ ] Test on mobile and desktop viewports
- [ ] Verify color contrast meets WCAG AA

### After Implementation
- [ ] Component documented with usage examples
- [ ] Unit tests written and passing
- [ ] Storybook story created (if using)
- [ ] Performance optimized (React.memo if needed)
- [ ] Props validated with PropTypes or TypeScript
- [ ] Cross-browser tested

---

## Quick Reference Tables

### Component Priority for Implementation

| Priority | Phase | Components |
|----------|-------|-----------|
| Critical | Phase 1 | PageContainer, Header, NavigationMenu, MobileBottomNav, ContentLayout |
| High | Phase 2 | MetricCard, DeckCard, ProgressBar, Badge, Card, Button |
| High | Phase 3 | UserMenu, QuickActionsPanel, Sheet |
| Medium | Phase 4 | WelcomeSection, UpcomingReviews, LearningTip, Tooltip, Skeleton |
| Low | Phase 5 | Toast, Dialog, ScrollArea, Separator |

### Shadcn vs Custom Decision Matrix

| Use Shadcn When | Build Custom When |
|-----------------|-------------------|
| Standard UI pattern exists | Unique business logic required |
| Accessibility critical | Specific design requirements |
| Forms and inputs | Complex composite components |
| Feedback (toast, dialog) | Application-specific patterns |
| Common interactions | Tight integration with data layer |

### Common Prop Patterns

| Pattern | Example | Usage |
|---------|---------|-------|
| Children | `children: React.ReactNode` | Layout components |
| Variants | `variant: 'primary' \| 'secondary'` | Component styles |
| Callbacks | `onClick?: () => void` | User interactions |
| Data Objects | `deck: Deck` | Display components |
| Booleans | `loading?: boolean` | Component states |
| Class Merging | `className?: string` | Custom styling |

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

## Deck Management Components (8)

**Purpose**: Components for displaying, filtering, and managing Greek language learning decks with progress tracking and premium features.

**Location**: `/src/components/decks/`

---

### 1. DeckCard

**Purpose**: Main card component for displaying deck information, progress, level, and premium status with Greek typography.

**File**: `/src/components/decks/DeckCard.tsx`

**Interface**:
```typescript
interface DeckCardProps {
  deck: Deck;                    // Complete deck object with metadata and progress
  onClick?: () => void;          // Handler for deck selection/navigation
  showProgress?: boolean;        // Display progress bar (default: true)
  variant?: 'grid' | 'list';    // Display mode (default: 'grid')
  showStats?: boolean;           // Display stats row (default: true)
}
```

**Usage**:
```tsx
import { DeckCard } from '@/components/decks';
import { MOCK_DECKS } from '@/services/mockDeckData';

// Grid variant (default)
<DeckCard
  deck={MOCK_DECKS[0]} // Βασικές Λέξεις A1 deck
  onClick={() => navigate(`/decks/${MOCK_DECKS[0].id}`)}
  showProgress={true}
  showStats={true}
/>

// List variant with locked premium deck
<DeckCard
  deck={MOCK_DECKS[3]} // Premium locked deck
  variant="list"
  showProgress={false}
/>
```

**Features**:
- Greek title displayed prominently (1rem, font-semibold)
- English subtitle below Greek title (0.875rem, gray-500)
- Color-coded level badge (A1: green, A2: blue, B1: orange, B2: purple)
- Premium indicator with lock icon for locked decks
- Segmented progress bar showing new/learning/mastered cards
- Stats grid with card count, estimated time, mastery percentage
- Gold border on hover for premium unlocked decks
- 70% opacity for locked premium decks
- Keyboard accessible (Enter/Space to activate)
- Responsive design (mobile: full width, tablet: 2-col, desktop: 3-col grid)

**Props**:
| Name | Type | Default | Description |
|------|------|---------|-------------|
| deck | Deck | required | Complete deck object including progress data |
| onClick | () => void | undefined | Handler called when card is clicked (disabled if locked) |
| showProgress | boolean | true | Whether to display progress bar and completion percentage |
| variant | 'grid' \| 'list' | 'grid' | Display mode for different layouts |
| showStats | boolean | true | Whether to display stats row (cards/time/mastery) |

**Variants**:
- **Grid** (default): Vertical layout optimized for card grids, compact stats
- **List**: Horizontal layout with inline content, better for list views

**Responsive Behavior**:
- **Mobile (< 768px)**: Full width, stats stacked vertically
- **Tablet (768-1024px)**: Fits 2-column grid, condensed spacing
- **Desktop (≥ 1024px)**: Fits 3-column grid, full spacing

---

### 2. DeckProgressBar

**Purpose**: Segmented progress bar visualization showing new, learning, and mastered card distribution.

**File**: `/src/components/decks/DeckProgressBar.tsx`

**Interface**:
```typescript
interface DeckProgressBarProps {
  progress: DeckProgress;        // Progress data with card counts
  size?: 'default' | 'large';   // Bar height variant (8px or 12px)
  showLegend?: boolean;          // Display legend with color indicators (default: false)
  className?: string;            // Additional CSS classes
}
```

**Usage**:
```tsx
import { DeckProgressBar } from '@/components/decks';

// Default size with legend
<DeckProgressBar
  progress={{
    cardsNew: 50,
    cardsLearning: 30,
    cardsMastered: 20,
    cardsTotal: 100,
    deckId: 'deck-1',
    status: 'in-progress',
    cardsReview: 0,
    dueToday: 10,
    streak: 5,
    totalTimeSpent: 100,
    accuracy: 80
  }}
  showLegend={true}
/>

// Large size without legend
<DeckProgressBar
  progress={deck.progress}
  size="large"
  showLegend={false}
  className="mb-4"
/>
```

**Features**:
- Three color-coded segments (new: gray-200, learning: blue-500, mastered: green-500)
- Dynamic width calculation based on card distribution
- Two size variants (8px default, 12px large)
- Optional legend with color indicators and card counts
- Fully rounded borders (border-radius: 9999px)
- ARIA progressbar role with semantic labels
- Handles edge case of zero total cards

**Props**:
| Name | Type | Default | Description |
|------|------|---------|-------------|
| progress | DeckProgress | required | Object containing cardsNew, cardsLearning, cardsMastered counts |
| size | 'default' \| 'large' | 'default' | Height of progress bar (default: 8px, large: 12px) |
| showLegend | boolean | false | Whether to display legend with color indicators below bar |
| className | string | '' | Additional Tailwind CSS classes for container |

**Color Specifications**:
- **New Cards**: #e5e7eb (gray-200) - Cards not yet studied
- **Learning Cards**: #3b82f6 (blue-500) - Cards currently being learned
- **Mastered Cards**: #10b981 (green-500) - Cards fully mastered

---

### 3. DeckBadge

**Purpose**: Small badge component for displaying deck level (A1-B2) or status with color coding.

**File**: `/src/components/decks/DeckBadge.tsx`

**Interface**:
```typescript
interface DeckBadgeProps {
  type: 'level' | 'status';     // Badge type
  level?: DeckLevel;             // Required if type='level' (A1, A2, B1, B2)
  status?: DeckStatus;           // Required if type='status' (not-started, in-progress, completed)
  className?: string;            // Additional CSS classes
}
```

**Usage**:
```tsx
import { DeckBadge } from '@/components/decks';

// Level badges
<DeckBadge type="level" level="A1" />
<DeckBadge type="level" level="B2" />

// Status badges
<DeckBadge type="status" status="in-progress" />
<DeckBadge type="status" status="completed" />
```

**Features**:
- Color-coded level badges matching CEFR standards
- Status badges for tracking deck completion
- Compact design (text-xs, minimal padding)
- ARIA labels for accessibility
- Type-safe with TypeScript enums
- Returns null for invalid prop combinations

**Props**:
| Name | Type | Default | Description |
|------|------|---------|-------------|
| type | 'level' \| 'status' | required | Type of badge to display |
| level | DeckLevel | undefined | Level value (A1, A2, B1, B2) - required if type='level' |
| status | DeckStatus | undefined | Status value (not-started, in-progress, completed) - required if type='status' |
| className | string | '' | Additional Tailwind CSS classes |

**Level Badge Colors**:
- **A1 - Beginner**: Green (#10b981), white text
- **A2 - Elementary**: Blue (#3b82f6), white text
- **B1 - Intermediate**: Orange (#f97316), white text
- **B2 - Upper-Intermediate**: Purple (#764ba2), white text

**Status Badge Colors**:
- **Not Started**: Gray background, dark gray text
- **In Progress**: Light blue background, blue text
- **Completed**: Light green background, green text

---

### 4. DecksGrid

**Purpose**: Responsive grid container for displaying deck cards in 1/2/3 column layout based on viewport width.

**File**: `/src/components/decks/DecksGrid.tsx`

**Interface**:
```typescript
interface DecksGridProps {
  decks: Deck[];                    // Array of decks to display
  onDeckClick?: (deckId: string) => void;  // Optional click handler (defaults to navigation)
}
```

**Usage**:
```tsx
import { DecksGrid } from '@/components/decks';
import { useDeckStore } from '@/stores/deckStore';

const { decks } = useDeckStore();

<DecksGrid decks={decks} />

// With custom click handler
<DecksGrid
  decks={decks}
  onDeckClick={(deckId) => console.log('Clicked:', deckId)}
/>
```

**Features**:
- Responsive grid layout (1 col mobile, 2 col tablet, 3 col desktop)
- 16px gap between cards (gap-4)
- ARIA list/listitem roles for accessibility
- Keyboard navigation via DeckCard components
- Default behavior: navigate to `/decks/:deckId`
- Optional custom click handler via props
- Empty array renders nothing (no errors)

**Props**:
| Name | Type | Default | Description |
|------|------|---------|-------------|
| decks | Deck[] | required | Array of deck objects to display in grid |
| onDeckClick | (deckId: string) => void | undefined | Optional click handler. If not provided, navigates to deck detail page. |

**Responsive Behavior**:
- **Mobile (< 768px)**: 1 column, full width cards
- **Tablet (768-1024px)**: 2 columns, equal width
- **Desktop (≥ 1024px)**: 3 columns, equal width
- Uses Tailwind classes: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`

---

### 5. DeckFilters

**Purpose**: Filter and search UI for deck browsing - includes search input, level toggles, status filters, and premium filter.

**File**: `/src/components/decks/DeckFilters.tsx`

**Interface**:
```typescript
interface DeckFiltersProps {
  filters: DeckFilters;             // Current filter state
  onChange: (filters: Partial<DeckFilters>) => void;  // Partial filter update handler
  onClear: () => void;               // Reset all filters handler
  totalDecks: number;                // Total available decks (before filtering)
  filteredDecks: number;             // Count of decks after filtering
}
```

**Usage**:
```tsx
import { DeckFilters } from '@/components/decks';
import { useDeckStore } from '@/stores/deckStore';

const { filters, setFilters, clearFilters, decks } = useDeckStore();

<DeckFilters
  filters={filters}
  onChange={setFilters}
  onClear={clearFilters}
  totalDecks={6}
  filteredDecks={decks.length}
/>
```

**Features**:
- **Search Input**: Debounced search (300ms delay) with clear button
- **Level Filter**: 4 toggles (A1, A2, B1, B2) with level badge colors
- **Status Filter**: 3 toggles (Not Started, In Progress, Completed)
- **Premium Filter**: Single toggle for premium-only decks (amber color)
- **Clear All Button**: Resets all filters, shows active filter count
- **Results Counter**: "Showing X of Y decks" for user feedback
- **Responsive Layout**: Wraps filter buttons on mobile
- **ARIA States**: aria-pressed for toggle buttons

**Props**:
| Name | Type | Default | Description |
|------|------|---------|-------------|
| filters | DeckFilters | required | Current active filter state from store |
| onChange | (filters: Partial<DeckFilters>) => void | required | Handler to update filters (partial updates) |
| onClear | () => void | required | Handler to reset all filters to defaults |
| totalDecks | number | required | Total count of decks before any filtering |
| filteredDecks | number | required | Count of decks after current filters applied |

**Filter Options**:
- **search**: string (debounced 300ms)
- **levels**: DeckLevel[] (A1, A2, B1, B2)
- **status**: DeckStatus[] (not-started, in-progress, completed)
- **showPremiumOnly**: boolean (true/false)

**Level Badge Colors**:
- **A1**: Green (bg-green-500)
- **A2**: Blue (bg-blue-500)
- **B1**: Orange (bg-orange-500)
- **B2**: Purple (bg-purple-600)

**Debounce Behavior**:
- Search input has 300ms debounce delay
- No API calls until user stops typing for 300ms
- Prevents excessive re-renders during typing
- Uses debounce utility from `/src/lib/utils.ts`

**Responsive Behavior**:
- **Mobile**: Filter buttons wrap vertically, search full width
- **Desktop**: Filters displayed in horizontal rows
- Uses Tailwind `flex-wrap` for responsive wrapping

---

---

### 6. DeckDetailPage

**Purpose**: Main detail page for displaying comprehensive information about a single deck, including title, description, progress, statistics, and learning actions.

**Location**: `src/pages/DeckDetailPage.tsx`

**Route**: `/decks/:id`

**Interface**:
```typescript
// No props - uses route params and store
// URL Parameter: :id (deck ID)

// Internal Sub-components:
interface DeckHeaderSectionProps {
  deck: Deck;
  isPremiumLocked: boolean;
}

interface StatisticsSectionProps {
  deck: Deck;
}

interface ActionButtonsSectionProps {
  deck: Deck;
  isPremiumLocked: boolean;
  deckStatus: DeckStatus;
  onStartLearning: () => void;
  onContinue: () => void;
  onUpgrade: () => void;
}
```

**Usage**:
```tsx
// Accessed via React Router
<Route path="decks/:id" element={<DeckDetailPage />} />

// Navigation from DecksPage
navigate(`/decks/${deckId}`);

// Link from DeckCard
<Link to={`/decks/${deck.id}`}>View Details</Link>
```

**Features**:
- Greek typography hierarchy (titleGreek primary, title secondary)
- Premium access validation with upgrade CTA for locked decks
- Context-aware action buttons (Start Learning, Continue, Upgrade)
- Deck status detection (not-started, in-progress, completed)
- Detailed statistics grid (cards, time, mastery, accuracy)
- Card distribution visualization (new/learning/mastered)
- Segmented progress bar with legend
- Breadcrumb navigation (Decks > Deck Name)
- Loading skeleton matching final layout
- Error state with retry functionality
- 404 not found state
- WCAG AA accessibility compliance
- Mobile-first responsive design

**Components Used**:
- `DeckBadge` - Level badge and status badges
- `DeckProgressBar` - Progress visualization
- `Card`, `CardHeader`, `CardTitle`, `CardContent` - Layout
- `Button` - Action buttons with gradients
- `Skeleton` - Loading placeholders
- `Alert` - Error messages
- Lucide icons: `ChevronLeft`, `Lock`, `BookOpen`, `Clock`, `Target`, `TrendingUp`, `AlertCircle`

**State Management**:
- `useDeckStore().selectDeck(deckId)` - Fetch deck by ID
- `useDeckStore().selectedDeck` - Current deck
- `useDeckStore().isLoading` - Loading state
- `useDeckStore().error` - Error message
- `useDeckStore().startLearning(deckId)` - Initialize learning
- `useAuthStore().user.role` - Premium access check

**Action Buttons Logic**:
| Deck State | User Type | Button Text | Color | Handler |
|------------|-----------|-------------|-------|---------|
| Premium deck | Free user | "Upgrade to Premium" | Amber gradient | Navigate to `/upgrade` |
| Not started | Any | "Start Learning" | Blue-Purple gradient | Call `startLearning()`, navigate to `/learn/:id` |
| In progress | Any | "Continue Learning" | Green gradient | Navigate to `/learn/:id` |
| Completed | Any | "Review Deck" | Purple-Pink gradient | Navigate to `/learn/:id` |

**Responsive Behavior**:
- **Mobile (< 768px)**: Single column, stacked statistics (2-col grid)
- **Tablet (768-1024px)**: Moderate spacing, 4-col stats grid
- **Desktop (≥ 1024px)**: Max-width 896px (4xl), full spacing

**Accessibility**:
- Breadcrumb navigation with `aria-label="Breadcrumb"`
- Heading hierarchy (h1 for title, h3 for section titles)
- ARIA labels for icons (`aria-label="Premium locked"`)
- Keyboard navigation support (focus states on buttons)
- Screen reader announcements for loading/error states
- Color contrast meeting WCAG AA (all text on backgrounds)

**Error Handling**:
- Loading skeleton during fetch
- Error state with retry button
- 404 not found for invalid deck IDs
- Premium access blocking with upgrade CTA

**Greek Typography Pattern**:
- Primary: `titleGreek` - 2xl/3xl, font-semibold, gray-900
- Secondary: `title` - base/lg, gray-600
- Always Greek first, English subtitle below

---

*Note: 2 additional Deck Management Components will be documented in future tasks: DeckStats, DeckProgress*

---

## Flashcard Review Components (17)

**Purpose**: Components for the interactive flashcard review experience with Greek typography, grammar displays, rating system, keyboard shortcuts, accessibility features, and premium feature gating.

**Location**: `/src/components/review/`

---

### 1. FlashcardReviewPage

**Purpose**: Main page component for flashcard review sessions with full-screen experience.

**File**: `/src/pages/FlashcardReviewPage.tsx`

**Route**: `/decks/:deckId/review`

**Interface**:
```typescript
// No props - uses route params
// URL Parameter: :deckId (deck ID to review)
```

**Usage**:
```tsx
// Accessed via React Router
<Route path="decks/:deckId/review" element={<FlashcardReviewPage />} />

// Navigation from deck page
navigate(`/decks/${deckId}/review`);
```

**Features**:
- Auto-starts review session on mount
- Keyboard shortcuts enabled (Space, 1-4)
- Loading skeleton during session initialization
- Error state with retry functionality
- No cards due state with back navigation
- Exit review button
- Full-screen gradient background
- Integration with reviewStore

---

### 2. FlashcardContainer

**Purpose**: Main card container managing flip state, tense selection, and rendering all card sections.

**File**: `/src/components/review/FlashcardContainer.tsx`

**Interface**:
```typescript
interface FlashcardContainerProps {
  card: CardReview;
}
```

**Features**:
- White card with rounded corners and shadow
- Hover animation (translateY -4px)
- Manages tense selection state for verbs
- Resets tense on card change
- Conditional rendering of noun/verb grammar
- Min-height 800px
- Max-width 896px (4xl)

---

### 3. ProgressHeader

**Purpose**: Display session progress bar and time estimate.

**File**: `/src/components/review/ProgressHeader.tsx`

**Features**:
- Gradient progress bar (purple)
- Card count (X of Y)
- Estimated time remaining
- Gray background header

---

### 4. CardMain

**Purpose**: Main clickable card area with Greek word, pronunciation, translation, and badges.

**File**: `/src/components/review/CardMain.tsx`

**Features**:
- Click anywhere to flip
- Keyboard accessible (Enter/Space)
- Greek word (48px, bold)
- Pronunciation (18px, italic)
- Word type badge
- Level badge
- Translation reveal on flip
- "Click to reveal" hint

---

### 5. RatingButtons

**Purpose**: Four-button rating panel (Again, Hard, Good, Easy).

**File**: `/src/components/review/RatingButtons.tsx`

**Features**:
- Four color-coded buttons
- Disabled until card flipped
- Hover animations
- Keyboard shortcuts (1-4)
- Visual feedback on click
- Max-width 120px per button

**Button Colors**:
- Again: Red (bg-red-500)
- Hard: Orange (bg-orange-500)
- Good: Green (bg-green-500)
- Easy: Dark Green (bg-green-700)

---

### 6. GreekWord

**Purpose**: Display Greek word with pronunciation.

**File**: `/src/components/review/shared/GreekWord.tsx`

**Interface**:
```typescript
interface GreekWordProps {
  word: string;
  pronunciation: string;
}
```

---

### 7. Translation

**Purpose**: Translation text with fade-in animation.

**File**: `/src/components/review/shared/Translation.tsx`

**Features**:
- Opacity transition (0 to 1)
- Top border when visible
- 32px font size
- Gray-600 color

---

### 8. WordTypeBadge

**Purpose**: Badge showing word type and metadata (noun gender, verb voice).

**File**: `/src/components/review/shared/WordTypeBadge.tsx`

**Features**:
- Noun: Blue background
- Verb: Purple background
- Shows gender for nouns
- Shows voice for verbs

---

### 9. LevelBadge

**Purpose**: CEFR level badge (A1, A2, B1, B2).

**File**: `/src/components/review/shared/LevelBadge.tsx`

**Colors**:
- A1: Green
- A2: Blue
- B1: Orange
- B2: Purple

---

### 10. PremiumGate

**Purpose**: Wrapper for premium content with blur effect and badge.

**File**: `/src/components/review/shared/PremiumGate.tsx`

**Interface**:
```typescript
interface PremiumGateProps {
  isLocked: boolean;
  badgeText?: string;
  children: React.ReactNode;
}
```

**Features**:
- Blur effect when locked
- Amber "Pro" badge overlay
- No effect when unlocked

---

### 11. NounGrammarSection

**Purpose**: Display noun cases table with premium gating.

**File**: `/src/components/review/grammar/NounGrammarSection.tsx`

**Features**:
- 4 rows (singular, plural, genitive singular, genitive plural)
- Premium gated
- Section header with emoji

---

### 12. VerbGrammarSection

**Purpose**: Display verb conjugation table with tense tabs.

**File**: `/src/components/review/grammar/VerbGrammarSection.tsx`

**Features**:
- 6 rows (all persons)
- Tense tabs (Present/Past/Future)
- Premium gated
- Tabs disabled for free users

---

### 13. ConjugationTable

**Purpose**: 6-row table for verb conjugations.

**File**: `/src/components/review/grammar/ConjugationTable.tsx`

**Features**:
- 3 columns (person, Greek, English)
- Gray background for person column
- Center-aligned cells

---

### 14. CasesTable

**Purpose**: 4-row table for noun cases.

**File**: `/src/components/review/grammar/CasesTable.tsx`

**Features**:
- 2 columns (case name, Greek form)
- Consistent styling with ConjugationTable

---

### 15. ExampleSection

**Purpose**: Display example sentence with translation reveal.

**File**: `/src/components/review/shared/ExampleSection.tsx`

**Features**:
- Premium gated
- Greek sentence bold
- English translation hidden until flip
- Left border accent

---

### 16. SessionSummary

**Purpose**: Display comprehensive post-session statistics with performance metrics, rating breakdown, and progress visualization.

**File**: `/src/components/review/SessionSummary.tsx`

**Interface**:
```typescript
interface SessionSummaryProps {
  summary: SessionSummary;
  onBackToDeck: () => void;
  onReviewAgain: () => void;
  onDashboard: () => void;
}
```

**Usage**:
```tsx
import { SessionSummary } from '@/components/review/SessionSummary';
import { useReviewStore } from '@/stores/reviewStore';

const { sessionSummary } = useReviewStore();

<SessionSummary
  summary={sessionSummary}
  onBackToDeck={() => navigate(`/decks/${deckId}`)}
  onReviewAgain={() => navigate(`/decks/${deckId}/review`)}
  onDashboard={() => navigate('/dashboard')}
/>
```

**Features**:
- Performance-based encouraging messages (6 tiers: 100%, 90%+, 70%+, 50%+, 0%, default)
- Key metrics grid: Cards Reviewed, Accuracy %, Time Spent, Avg Per Card
- Color-coded accuracy indicator (green ≥70%, orange 50-69%, red <50%)
- Rating breakdown with percentages (Again/Hard/Good/Easy)
- State transition visualization (new→learning→mastered)
- Conditional rendering (hides transitions if none occurred)
- Edge case handling (0 cards, 100% accuracy, 0% accuracy)
- Responsive layout (2x2 grid on mobile, 1x4 on desktop)
- Action buttons: Back to Deck (primary), Review Again (secondary), Dashboard (tertiary)

**Sections**:
1. **Completion Message Card**: Gradient background (blue-50 to purple-50), CheckCircle icon, dynamic encouraging message
2. **Statistics Grid**: 4 cards with icons (Target, TrendingUp, Clock x2) showing key metrics
3. **Rating Breakdown Card**: 4 colored boxes (red, orange, green, blue) with counts and percentages
4. **Progress Transitions Card**: Conditional, shows state changes with emojis (🆕 📚 ✨ 🔄)
5. **Action Buttons**: Responsive row/column layout with gradient primary button

**Utility Functions** (in `@/lib/sessionSummaryUtils`):
- `formatTime(seconds)`: Converts seconds to "5m 32s" format
- `getEncouragingMessage(accuracy, cardsReviewed)`: Returns performance-based message
- `getAccuracyColor(accuracy)`: Returns Tailwind color class based on percentage
- `formatRatingBreakdown(summary)`: Calculates percentages for each rating
- `hasProgressTransitions(summary)`: Checks if any transitions occurred
- `adjustPercentages()`: Ensures rating percentages sum to 100%

**Props**:
| Name | Type | Description |
|------|------|-------------|
| summary | SessionSummary | Complete session statistics from reviewStore |
| onBackToDeck | () => void | Navigate to deck detail page |
| onReviewAgain | () => void | Start new review session for same deck |
| onDashboard | () => void | Navigate to main dashboard (hidden on mobile) |

**Edge Cases**:
- Zero cards: Shows simplified message with single button
- Perfect score (100%): Special celebration message
- All "again" (0%): Supportive message with encouragement
- Missing summary: SessionSummaryPage handles redirect

**Responsive Behavior**:
- Mobile (< 640px): 2x2 grids, stacked buttons, smaller fonts (text-xl/2xl)
- Desktop (≥ 640px): 1x4 grids, row buttons, larger fonts (text-2xl/3xl)
- Max width: 768px (3xl container)
- Min touch target: 44px for accessibility

**Color Specifications**:
- Background: gray-50
- Completion card: gradient from blue-50 to purple-50, border blue-200
- Again: bg-red-50, text-red-600
- Hard: bg-orange-50, text-orange-600
- Good: bg-green-50, text-green-600
- Easy: bg-blue-50, text-blue-600
- Primary button: gradient from blue-600 to purple-600

**Related Components**:
- [SessionSummaryPage](#sessionsummarypage) - Page wrapper for this component

---

### 17. SessionSummaryPage

**Purpose**: Container page for displaying session summary after review completion.

**File**: `/src/pages/SessionSummaryPage.tsx`

**Route**: `/decks/:deckId/summary`

**Interface**:
```typescript
// No props - uses route params and reviewStore
// URL Parameter: :deckId (deck ID)
```

**Usage**:
```tsx
// Accessed via React Router
<Route path="/decks/:deckId/summary" element={<SessionSummaryPage />} />

// Navigation after session ends
navigate(`/decks/${deckId}/summary`);
```

**Features**:
- Auto-redirect if no session summary available
- Loading skeleton while redirect processing
- Cleanup summary on unmount
- Error handling for missing deckId
- Integration with reviewStore
- Full-screen gray background (bg-gray-50)
- Responsive container (px-4 padding)
- Padding top/bottom: 8 (mobile) to 12 (desktop)

**State Management**:
- Reads `reviewStore.sessionSummary`
- Calls `reviewStore.clearSessionSummary()` on unmount
- No local state (all data from store)

**Navigation Handlers**:
- Back to Deck: `/decks/:deckId`
- Review Again: `/decks/:deckId/review`
- Dashboard: `/dashboard`

**Error States**:
- No summary: Redirect to deck detail with console warning
- Invalid deckId: Show error alert with dashboard button

**Lifecycle**:
1. Mount: Check for sessionSummary
2. If no summary: Redirect to deck with replace=true
3. If valid: Render SessionSummary component
4. Unmount: Clear summary from store (prevents stale data)

**Why Clear Summary on Unmount?**
- Prevents stale data on next visit
- Keeps store clean
- Forces fresh session for each review
- Avoids confusion if user navigates back

**Testing**:
- Complete review session, verify navigation
- Direct URL access, verify redirect
- Back button, verify cleanup
- Refresh page, verify redirect (summary cleared)

---

### 18. KeyboardShortcutsHelp

**Purpose**: Modal dialog displaying all keyboard shortcuts with visual kbd elements for accessibility and user guidance.

**File**: `/src/components/review/KeyboardShortcutsHelp.tsx`

**Interface**:
```typescript
interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**Usage**:
```tsx
import { KeyboardShortcutsHelp } from '@/components/review/KeyboardShortcutsHelp';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

const { showHelp, setShowHelp } = useKeyboardShortcuts();

<KeyboardShortcutsHelp open={showHelp} onOpenChange={setShowHelp} />
```

**Features**:
- Shadcn Dialog component with focus trap
- Two sections: Review Actions and Navigation
- Keyboard shortcut badges with kbd styling
- Color-coded section borders (blue for Review, purple for Navigation)
- Helpful tip footer with blue background
- ESC key closes dialog
- Click outside closes dialog

**Keyboard Shortcuts Displayed**:

**Review Actions** (blue border):
- Space: Flip flashcard
- 1: Rate "Again" (show again soon)
- 2: Rate "Hard" (reduced interval)
- 3: Rate "Good" (standard interval)
- 4: Rate "Easy" (longer interval)

**Navigation** (purple border):
- ?: Show/hide keyboard shortcuts
- Esc: Close help or exit review

**Visual Design**:
- Max width: 500px (sm:max-w-[500px])
- Shortcut items: flex justify-between with py-2 spacing
- kbd badges: min-w-[2rem], rounded, border gray-300, bg gray-100, shadow-sm
- Border accents: 2px left border (blue-500 or purple-500)
- Footer tip: rounded-lg, bg-blue-50, text-blue-800, p-3

**Accessibility**:
- Dialog role with proper ARIA attributes (handled by Radix UI)
- Focus trap prevents keyboard navigation outside dialog
- ESC key support for closing
- Descriptive text for all shortcuts
- Screen reader friendly kbd elements

**Props**:
| Name | Type | Description |
|------|------|-------------|
| open | boolean | Controls dialog visibility |
| onOpenChange | (open: boolean) => void | Callback when dialog open state changes |

**State Management**:
- Managed by parent component (FlashcardReviewPage)
- State provided by useKeyboardShortcuts hook
- No internal state

**Related Components**:
- [FlashcardReviewPage](#flashcardreviewpage) - Renders this component
- useKeyboardShortcuts hook - Manages help dialog state

**Integration**:
```tsx
// In FlashcardReviewPage.tsx
const { showHelp, setShowHelp } = useKeyboardShortcuts();

return (
  <div>
    <FlashcardContainer card={currentCard} />
    <KeyboardShortcutsHelp open={showHelp} onOpenChange={setShowHelp} />
  </div>
);
```

**Testing**:
- Press "?" key to open dialog
- Verify focus trap (tab navigation stays within dialog)
- Press ESC to close
- Click outside dialog to close
- Verify all shortcuts are documented

---

## Additional Resources

### Documentation Links
- [Shadcn/ui Documentation](https://ui.shadcn.com)
- [Radix UI Primitives](https://www.radix-ui.com)
- [Tailwind CSS](https://tailwindcss.com)
- [Class Variance Authority](https://cva.style)

### Related Guides
- [Style Guide](./Style-Guide.md) - Visual design system
- [Component Identification](./01/01.03-component-identification.md) - Detailed component analysis
- [Project Architecture](../architecture.md) - Overall system design

### Design Tokens Reference
See Style Guide for complete design tokens including:
- Color palette with hex values
- Spacing scale (4px base unit)
- Typography scale and weights
- Border radius values
- Shadow levels
- Breakpoint values

---

**Last Updated**: 2025-11-05
**Status**: Complete - All Components Implemented (Including Chart Components, Analytics Hooks, and Analytics Data Layer)
**Version**: 1.3.0
