# Components Reference Guide

Quick reference guide for all UI components in the Greek Language Learning application. Use this alongside the [Style Guide](./Style-Guide.md) during implementation.

---

## Overview

This guide provides practical reference for all **23 components** identified in the MVP dashboard. Components are categorized for easy navigation, with complete TypeScript interfaces, usage examples, and implementation guidelines.

### Component Distribution
- **Shadcn/ui Components**: 14 pre-built components
- **Custom Components**: 9 application-specific components
- **Total UI Elements**: 47 instances across the dashboard

### Quick Navigation
- [Installation](#installation)
- [Component Categories](#component-categories)
- [Shadcn/ui Components](#shadcnui-components)
- [Custom Components](#custom-components)
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

## File Structure

### Recommended Organization

```
src/
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

**Last Updated**: 2025-10-25
**Status**: Complete - Ready for React Implementation
**Version**: 1.0.0
