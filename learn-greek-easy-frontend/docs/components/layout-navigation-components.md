# Layout Components Reference

Core layout and navigation components for app structure.

[← Back to Main Components Reference](../Components-Reference.md)

---

## Custom Components

### AppLayout

**Purpose**: Main application layout wrapper that provides consistent structure with header, navigation, and content area for all authenticated pages. Automatically handles responsive behavior with mobile bottom navigation and sidebar sheet.

**File**: `/src/components/layout/AppLayout.tsx`

**Interface**:
```typescript
// AppLayout uses React Router's Outlet pattern - no props required
// Children are rendered via <Outlet /> from React Router
```

**Usage**:
```tsx
import { AppLayout } from '@/components/layout/AppLayout';
import { Route } from 'react-router-dom';

// Pattern 1: Wrap individual pages
<Route path="/" element={
  <ProtectedRoute>
    <AppLayout />
  </ProtectedRoute>
}>
  <Route index element={<Dashboard />} />
  <Route path="decks" element={<DecksPage />} />
  <Route path="statistics" element={<Statistics />} />
  <Route path="settings" element={<Settings />} />
  <Route path="profile" element={<Profile />} />
</Route>

// Pattern 2: Manual usage (less common)
<AppLayout>
  <Dashboard />
</AppLayout>
```

**Key Features**:
- Integrates Header component for desktop navigation with logo and user menu
- Integrates MobileNav for mobile bottom navigation (hidden on desktop ≥1024px)
- Includes mobile sidebar sheet with navigation (activated by hamburger menu)
- Provides consistent page background (bg-bg-page)
- Adds extra bottom padding on mobile for bottom navigation (pb-20 vs pb-8)
- Uses PageContainer for proper content constraints
- Automatically closes sidebar on route changes
- Uses LayoutContext for responsive behavior

**Layout Structure**:
```tsx
<div className="min-h-screen bg-bg-page">
  {/* Header - Always visible with logo, nav (desktop), user menu */}
  <Header />

  {/* Mobile Sidebar Sheet - Left side panel on mobile */}
  <Sheet open={isSidebarOpen} onOpenChange={closeSidebar}>
    {/* Navigation items with active states */}
  </Sheet>

  {/* Main Content Area */}
  <main className={isMobile ? 'pb-20' : 'pb-8'}>
    <PageContainer className="py-6">
      <Outlet /> {/* Router renders child routes here */}
    </PageContainer>
  </main>

  {/* Mobile Bottom Navigation - Fixed to bottom on mobile */}
  {!isDesktop && <MobileNav />}
</div>
```

**Navigation Items**:
The sidebar includes these navigation links:
- Dashboard (/) - Home icon
- Decks (/decks) - Layers icon
- Statistics (/statistics) - BarChart3 icon
- Settings (/settings) - Settings icon
- Profile (/profile) - User icon

**Responsive Behavior**:
- **Desktop (≥1024px)**:
  - Header with full navigation menu
  - No mobile sidebar
  - No bottom navigation
  - Standard bottom padding (pb-8)
- **Mobile (<1024px)**:
  - Header with hamburger menu toggle
  - Sheet sidebar (left side, 280px width)
  - Fixed bottom navigation (MobileNav)
  - Extra bottom padding (pb-20) to prevent content overlap

**Dependencies**:
- `useLayoutContext()` - Provides `isMobile`, `isDesktop`, `isSidebarOpen`, `closeSidebar`
- `useLocation()` - React Router hook for current route
- Lucide icons: Home, Layers, BarChart3, Settings, User
- Shadcn Sheet component for mobile sidebar

**Related Components**:
- [Header](#header) - Desktop navigation and user menu
- [MobileNav](#mobilenav) - Mobile bottom navigation
- [PageContainer](#pagecontainer) - Content width constraint
- [ProtectedRoute](#protectedroute) - Wraps authenticated routes

**Common Patterns**:

**DO**: Use AppLayout as router wrapper with Outlet
```tsx
// ✅ Correct - Clean route structure
<Route element={<AppLayout />}>
  <Route path="/" element={<Dashboard />} />
  <Route path="/decks" element={<DecksPage />} />
</Route>
```

**DON'T**: Manually add Header or MobileNav
```tsx
// ❌ Wrong - duplicates AppLayout functionality
<AppLayout>
  <Header />
  <Dashboard />
  <MobileNav />
</AppLayout>
```

**Integration with LayoutContext**:
```tsx
// AppLayout.tsx uses context for responsive state
const { isMobile, isDesktop, isSidebarOpen, closeSidebar } = useLayoutContext();

// Sidebar closes automatically on navigation
useEffect(() => {
  closeSidebar();
}, [location.pathname, closeSidebar]);
```

---

### Header

**Purpose**: Main navigation header containing logo, desktop navigation menu, mobile hamburger toggle, notifications, and user profile menu. Provides consistent top-level navigation across all authenticated pages.

**File**: `/src/components/layout/Header.tsx`

**Interface**:
```typescript
interface HeaderProps {
  className?: string;
}
```

**Usage**:
```tsx
import { Header } from '@/components/layout/Header';

// Default usage (typically inside AppLayout)
<Header />

// With custom className
<Header className="shadow-lg" />
```

**Structure**:
```tsx
<header className="sticky top-0 z-50 w-full border-b border-border-gray bg-white">
  <PageContainer>
    <div className="flex h-16 items-center justify-between">
      {/* Left: Mobile menu toggle + Logo */}
      <div className="flex items-center space-x-4">
        {!isDesktop && <Button onClick={toggleSidebar}>Menu</Button>}
        <Link to="/">
          <h1>Learn Greek Easy</h1>
        </Link>
      </div>

      {/* Center: Desktop Navigation (hidden on mobile) */}
      {isDesktop && (
        <nav>
          <Link to="/">Dashboard</Link>
          <Link to="/decks">Decks</Link>
          <Link to="/statistics">Statistics</Link>
          <Link to="/settings">Settings</Link>
        </nav>
      )}

      {/* Right: Notifications + User Menu */}
      <div className="flex items-center space-x-3">
        <Button variant="ghost" size="icon">
          <Bell /> {/* with notification badge */}
        </Button>
        <UserMenu /> {/* Avatar with dropdown */}
      </div>
    </div>
  </PageContainer>
</header>
```

**Navigation Items** (Desktop only):
- Dashboard (/)
- Decks (/decks)
- Statistics (/statistics)
- Settings (/settings)

**Key Features**:
- Sticky positioning (`sticky top-0 z-50`)
- 64px height (`h-16`)
- White background with bottom border
- Desktop navigation hidden on mobile (`hidden lg:flex`)
- Mobile hamburger menu toggle (shown when `!isDesktop`)
- Active route highlighting (text-primary for current route)
- Notification button with badge indicator
- User menu with avatar dropdown
- Logo links to homepage
- Uses PageContainer for consistent max-width

**Responsive Behavior**:
- **Desktop (≥1024px)**:
  - Shows full horizontal navigation menu
  - Hides hamburger menu toggle
  - Navigation items horizontally aligned
- **Mobile (<1024px)**:
  - Shows hamburger menu button to toggle sidebar
  - Hides desktop navigation menu
  - Logo and user menu remain visible

**User Menu Integration**:
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" className="relative h-9 w-9 rounded-full">
      <Avatar className="h-9 w-9">
        <AvatarImage src="" alt="User" />
        <AvatarFallback className="bg-gradient-to-br from-gradient-from to-gradient-to text-white">
          JD
        </AvatarFallback>
      </Avatar>
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" forceMount>
    <DropdownMenuLabel>
      <div>
        <p className="text-sm font-medium">John Doe</p>
        <p className="text-xs text-muted-foreground">john.doe@example.com</p>
      </div>
    </DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem asChild>
      <Link to="/profile">Profile</Link>
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
      <LogoutDialog />
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Notification Badge**:
- Shows red dot indicator (`bg-warning`) when notifications present
- Positioned absolutely (top-right of bell icon)
- 8px diameter (`h-2 w-2`)

**Dependencies**:
- `useLayoutContext()` - For `isDesktop` and `toggleSidebar()`
- `useLocation()` - For active route detection
- PageContainer - Content width wrapper
- Lucide icons: Menu, Bell
- Shadcn components: Button, Avatar, DropdownMenu
- LogoutDialog - Logout confirmation

**Related Components**:
- [AppLayout](#applayout) - Parent layout container
- [MobileNav](#mobilenav) - Mobile navigation alternative
- [UserMenu](#usermenu) - User profile dropdown (part of Header)
- [LogoutDialog](#logoutdialog) - Logout confirmation in user menu
- [PageContainer](#pagecontainer) - Content constraint wrapper

**Active Route Detection**:
```tsx
const location = useLocation();
const isActiveRoute = (path: string) => location.pathname === path;

// Apply active styling
<Link
  to={item.path}
  className={cn(
    'text-sm font-medium transition-colors hover:text-primary',
    isActiveRoute(item.path) ? 'text-primary' : 'text-text-secondary'
  )}
>
  {item.label}
</Link>
```

**Integration with AppLayout**:
```tsx
// In AppLayout.tsx
<div className="min-h-screen bg-bg-page">
  <Header /> {/* Sticky header at top */}
  <main className="flex-1">
    <PageContainer>
      <Outlet /> {/* Page content */}
    </PageContainer>
  </main>
  {!isDesktop && <MobileNav />}
</div>
```

---

### MobileNav

**Purpose**: Fixed bottom navigation bar for mobile devices providing quick access to main app sections. Automatically hidden on desktop viewports. Features icon + label layout with active state highlighting.

**File**: `/src/components/layout/MobileNav.tsx`

**Interface**:
```typescript
interface MobileNavProps {
  className?: string;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}
```

**Usage**:
```tsx
import { MobileNav } from '@/components/layout/MobileNav';

// Default usage (typically inside AppLayout)
<MobileNav />

// With custom className
<MobileNav className="border-t-2" />
```

**Navigation Items**:
```tsx
const navItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home, href: '/' },
  { id: 'decks', label: 'Decks', icon: Layers, href: '/decks' },
  { id: 'stats', label: 'Stats', icon: BarChart3, href: '/statistics' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
  { id: 'profile', label: 'Profile', icon: User, href: '/profile' },
];
```

**Key Features**:
- Fixed bottom positioning (`fixed bottom-0 left-0 right-0`)
- High z-index (`z-50`) to stay above content
- Hidden on desktop (`lg:hidden` - breakpoint at 1024px)
- 5 navigation items evenly spaced
- Icon + label vertical layout
- Active state highlighting based on current route
- Touch-friendly tap targets (min-w-[64px])
- White background with top border and shadow
- Smooth color transitions on active state

**Responsive Behavior**:
- **Mobile (<1024px)**: Visible, fixed to bottom
- **Desktop (≥1024px)**: Completely hidden
- Safe area padding for notched devices (implicit via py-2)

**Styling**:
```tsx
<nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border-gray bg-white shadow-nav lg:hidden">
  <div className="flex items-center justify-around py-2">
    {navItems.map((item) => {
      const Icon = item.icon;
      const active = isActive(item.href);

      return (
        <Link
          to={item.href}
          className={cn(
            'flex min-w-[64px] flex-col items-center px-3 py-2 transition-colors',
            active
              ? 'text-primary'
              : 'text-text-muted hover:text-text-secondary'
          )}
        >
          <Icon className="mb-1 h-5 w-5" />
          <span className="text-xs font-medium">{item.label}</span>
        </Link>
      );
    })}
  </div>
</nav>
```

**Active State Detection**:
```tsx
import { useLocation } from 'react-router-dom';

const location = useLocation();

const isActive = (href: string) => {
  return location.pathname === href;
};
```

**Active State Styling**:
- **Active**: `text-primary` (brand blue color)
- **Inactive**: `text-text-muted` (muted gray)
- **Hover**: `hover:text-text-secondary` (medium gray)

**Item Layout**:
```tsx
// Each nav item is a flex column
<Link className="flex min-w-[64px] flex-col items-center px-3 py-2">
  <Icon className="mb-1 h-5 w-5" />        {/* 20px icon with bottom margin */}
  <span className="text-xs font-medium">    {/* 12px label */}
    {item.label}
  </span>
</Link>
```

**Accessibility**:
- `aria-label` on each link for screen readers
- `aria-current="page"` for active link
- Semantic `<nav>` element
- Touch-friendly minimum width (64px)

**Complete Component**:
```tsx
import React from 'react';
import { Home, Layers, BarChart3, Settings, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface MobileNavProps {
  className?: string;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

const navItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home, href: '/' },
  { id: 'decks', label: 'Decks', icon: Layers, href: '/decks' },
  { id: 'stats', label: 'Stats', icon: BarChart3, href: '/statistics' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
  { id: 'profile', label: 'Profile', icon: User, href: '/profile' },
];

export const MobileNav: React.FC<MobileNavProps> = ({ className }) => {
  const location = useLocation();

  const isActive = (href: string) => {
    return location.pathname === href;
  };

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 border-t border-border-gray bg-white shadow-nav lg:hidden',
        className
      )}
    >
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.id}
              to={item.href}
              className={cn(
                'flex min-w-[64px] flex-col items-center px-3 py-2 transition-colors',
                active ? 'text-primary' : 'text-text-muted hover:text-text-secondary'
              )}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="mb-1 h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
```

**Dependencies**:
- React Router: `Link`, `useLocation`
- Lucide React icons: Home, Layers, BarChart3, Settings, User
- `cn()` utility for className merging

**Related Components**:
- [AppLayout](#applayout) - Parent container that conditionally renders MobileNav
- [Header](#header) - Desktop navigation alternative
- [PageContainer](#pagecontainer) - Should account for bottom nav height

**Integration with AppLayout**:
```tsx
// In AppLayout.tsx
<div className="min-h-screen bg-bg-page">
  <Header />
  <main className={isMobile ? 'pb-20' : 'pb-8'}>
    <PageContainer>
      <Outlet />
    </PageContainer>
  </main>
  {!isDesktop && <MobileNav />} {/* Only render on mobile */}
</div>
```

**Content Spacing Consideration**:
When MobileNav is visible, ensure main content has bottom padding to prevent overlap:
```tsx
<main className="pb-20"> {/* 80px padding for 56px nav height + spacing */}
  {/* Your content */}
</main>
```

**Design Tokens**:
- Height: ~56px (py-2 + content height)
- Icon size: 20px (h-5 w-5)
- Label font: 12px (text-xs)
- Min tap target: 64px width
- Border: 1px top border with border-border-gray
- Shadow: shadow-nav (custom shadow utility)
- Background: white
- Active color: var(--primary)
- Inactive color: var(--text-muted)

---
