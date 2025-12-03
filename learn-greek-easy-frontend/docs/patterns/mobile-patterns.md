# Mobile Patterns

Mobile-specific UI patterns, navigation, and responsive design.

[← Back to Main Style Guide](../Style-Guide.md)

---

## Mobile-Specific Patterns

### Mobile Navigation Pattern

Use bottom tab navigation on mobile, header navigation on desktop.

**Pattern** (from MobileNav.tsx):
```tsx
import { Home, Layers, BarChart3, Settings, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { id: 'home', label: 'Home', icon: Home, href: '/' },
  { id: 'decks', label: 'Decks', icon: Layers, href: '/decks' },
  { id: 'stats', label: 'Stats', icon: BarChart3, href: '/statistics' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
  { id: 'profile', label: 'Profile', icon: User, href: '/profile' },
];

export const MobileNav: React.FC = () => {
  const location = useLocation();

  const isActive = (href: string) => location.pathname === href;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white shadow-nav lg:hidden">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.id}
              to={item.href}
              className={cn(
                'flex min-w-[64px] flex-col items-center px-3 py-2',
                active ? 'text-primary' : 'text-muted hover:text-secondary'
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

**Mobile Nav Characteristics**:
- Fixed to bottom on mobile (< 1024px)
- Hidden on desktop (lg:hidden)
- 5 navigation items max
- Icon + label for each item
- Active state with primary color
- Min-width 64px for touch targets

---

### Touch Interaction Pattern

Optimize tap targets and touch gestures for mobile.

**Minimum Touch Target Size**: 44x44px (iOS) / 48x48px (Android)

```tsx
// Correct - adequate touch target
<Link className="flex min-w-[64px] flex-col items-center px-3 py-2">
  <Icon className="h-5 w-5" />
  <span className="text-xs">Label</span>
</Link>

// Wrong - touch target too small
<button className="p-1">
  <Icon className="h-4 w-4" />
</button>
```

---

### Responsive Breakpoints

Tailwind breakpoints used throughout the application:

| Breakpoint | Min Width | Device | Key Changes |
|------------|-----------|--------|-------------|
| (default) | 0px | Mobile | Bottom nav, single column, stacked layouts |
| sm | 640px | Large mobile | Slightly wider containers |
| md | 768px | Tablet | 2-column layouts |
| lg | 1024px | Desktop | Desktop nav, multi-column, sidebar |
| xl | 1280px | Large desktop | Max content width |

**Key Breakpoint (lg - 1024px)**:
- Mobile nav → Desktop nav
- Single column → Multi-column
- Stacked forms → Side-by-side

**Pattern Examples**:
```tsx
// Mobile: Hidden, Desktop: Visible
<div className="hidden lg:block">Desktop Navigation</div>

// Mobile: Visible, Desktop: Hidden
<div className="lg:hidden">Mobile Navigation</div>

// Mobile: 1 column, Desktop: 3 columns
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">

// Mobile: Stack, Desktop: Row
<div className="flex flex-col lg:flex-row gap-4">
```

---

### Mobile Form Pattern

Optimize forms for mobile input.

**Pattern**:
```tsx
<form className="space-y-4">
  <Input
    type="email"
    inputMode="email" // Shows email keyboard on mobile
    autoComplete="email"
    className="w-full text-base" // Prevent zoom on iOS (font-size >= 16px)
  />

  <Input
    type="tel"
    inputMode="tel" // Shows phone keyboard
    autoComplete="tel"
  />

  <Button type="submit" className="w-full lg:w-auto">
    Submit
  </Button>
</form>
```

**Input Types for Mobile Keyboards**:
- `type="email"` + `inputMode="email"` → Email keyboard
- `type="tel"` + `inputMode="tel"` → Phone keyboard
- `type="number"` + `inputMode="numeric"` → Numeric keyboard
- `type="url"` + `inputMode="url"` → URL keyboard

---

### When to Use

- **Mobile Navigation**: All authenticated pages (via AppLayout)
- **Touch Targets**: All interactive elements (buttons, links, icons)
- **Responsive Breakpoints**: All layouts and grids
- **Mobile Forms**: All input forms (login, register, create deck)

### Accessibility Considerations

- Touch targets minimum 44x44px
- Adequate spacing between interactive elements
- No hover-dependent interactions
- Keyboard accessibility maintained on all screen sizes
- Focus indicators visible for keyboard navigation
- aria-current for active navigation items

### Related Components

- MobileNav: `/src/components/layout/MobileNav.tsx`
- AppLayout: `@/components/layout/AppLayout`

---
