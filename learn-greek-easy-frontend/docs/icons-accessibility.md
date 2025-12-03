# Icons & Accessibility

Icon library guidelines and accessibility standards.

[← Back to Main Style Guide](./Style-Guide.md)

---

## Icons

### Icon Set
Currently using emoji icons for quick prototyping:
- 🏠 Home
- 📚 Review/Learning
- 📂 Decks
- 📊 Statistics
- 👤 Profile
- 🔔 Notifications
- ✅ Completed
- 📝 Learning
- 🎉 Celebration
- 💡 Tips

### Future Icon Library
Recommend implementing **Lucide React** icons for production:
- Consistent line weight and style
- Tree-shakeable for optimal bundle size
- Extensive icon set for all use cases
- Accessibility-friendly with proper ARIA labels

---


## Icon Library Selection

### Primary Icon Library

**Lucide React** (Recommended for production)

### Why Lucide React?

1. **Modern React/Next.js Ecosystem Integration**
   - Designed specifically for React applications
   - Seamless integration with Next.js and TypeScript
   - Active development and community support

2. **Performance Optimized**
   - Tree-shakeable: Only imports icons you actually use
   - Lightweight bundle size (each icon ~1KB)
   - No full library import required
   - Optimized SVG output

3. **Consistent Design Language**
   - Uniform stroke width (2px default)
   - Consistent sizing and alignment
   - Professional, modern aesthetic
   - Matches our clean, minimal design philosophy

4. **Developer Experience**
   - Full TypeScript support with proper types
   - Intuitive prop API (size, color, strokeWidth)
   - Easy to customize and extend
   - Excellent documentation

5. **Accessibility Built-in**
   - Proper ARIA attributes
   - Screen reader friendly
   - Supports aria-label customization

### Installation

```bash
npm install lucide-react
```

### Usage Examples

#### Basic Icon Usage
```tsx
import { Home, BookOpen, BarChart3, Settings, User } from 'lucide-react';

// Simple icon
<Home size={24} color="#2563eb" />

// With custom styling
<BookOpen
  size={20}
  color="#6b7280"
  strokeWidth={2}
  aria-label="Review deck"
/>

// Responsive sizing
<BarChart3
  className="w-5 h-5 md:w-6 md:h-6"
  color="currentColor"
/>
```

#### Icon in Button
```tsx
import { Plus } from 'lucide-react';

<button className="primary-button">
  <Plus size={20} />
  <span>Add New Deck</span>
</button>
```

#### Icon in Navigation
```tsx
import { Home, Layers, BarChart3, Settings, User } from 'lucide-react';

const NavItem = ({ icon: Icon, label, active }) => (
  <a className={active ? 'nav-active' : 'nav-item'}>
    <Icon size={20} color={active ? '#2563eb' : '#6b7280'} />
    <span>{label}</span>
  </a>
);

// Usage
<NavItem icon={Home} label="Home" active={true} />
<NavItem icon={Layers} label="Decks" active={false} />
```

### Icon Sizing Standards

Use consistent sizes across the application:

- **Extra Small**: `16px` - Inline with small text, badges
- **Small**: `20px` - Navigation items, buttons
- **Medium**: `24px` - Card headers, primary actions
- **Large**: `32px` - Empty states, hero sections

```tsx
// Size examples
<Icon size={16} /> // xs
<Icon size={20} /> // sm (most common for nav)
<Icon size={24} /> // md (most common for cards)
<Icon size={32} /> // lg
```

### Icon Colors

Icons should inherit theme colors:

```tsx
// Using theme colors
<Icon color="#2563eb" />  // Primary blue (active states)
<Icon color="#6b7280" />  // Muted gray (inactive states)
<Icon color="#10b981" />  // Success green (completed)
<Icon color="#f97316" />  // Warning orange (streaks)
<Icon color="currentColor" />  // Inherit from parent text color
```

### Common Icons Used in Application

Based on the mockup and feature requirements:

#### Navigation Icons
```tsx
import {
  Home,           // Dashboard/Home
  Layers,         // Decks/Collections
  BarChart3,      // Statistics/Progress
  Settings,       // Settings
  User,           // Profile
  Bell,           // Notifications
} from 'lucide-react';
```

#### Action Icons
```tsx
import {
  Plus,           // Add new item
  Check,          // Completed/Success
  X,              // Close/Cancel
  ChevronRight,   // Next/Forward
  ChevronLeft,    // Back/Previous
  MoreVertical,   // Menu/Options
  Edit,           // Edit item
  Trash2,         // Delete item
} from 'lucide-react';
```

#### Learning & Content Icons
```tsx
import {
  BookOpen,       // Reading/Study
  GraduationCap,  // Learning/Education
  Brain,          // Memory/Cognition
  Lightbulb,      // Tips/Insights
  Target,         // Goals/Objectives
  TrendingUp,     // Progress/Improvement
  Award,          // Achievements
  Flame,          // Streak/Consistency
} from 'lucide-react';
```

#### Status & Feedback Icons
```tsx
import {
  CheckCircle,    // Success/Completed
  Circle,         // Not started
  Clock,          // In progress/Due
  AlertCircle,    // Warning/Alert
  Info,           // Information
  Star,           // Favorite/Important
} from 'lucide-react';
```

### Icon Component Wrapper (Recommended)

Create a reusable icon wrapper for consistent styling:

```tsx
// components/ui/Icon.tsx
import { LucideIcon } from 'lucide-react';

interface IconProps {
  icon: LucideIcon;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
  'aria-label'?: string;
}

const sizeMap = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
};

export const Icon = ({
  icon: IconComponent,
  size = 'sm',
  color = 'currentColor',
  className = '',
  'aria-label': ariaLabel,
}: IconProps) => {
  return (
    <IconComponent
      size={sizeMap[size]}
      color={color}
      className={className}
      aria-label={ariaLabel}
    />
  );
};

// Usage
<Icon icon={Home} size="md" color="#2563eb" aria-label="Go to home" />
```

### Alternative Icon Libraries

While Lucide React is recommended, these alternatives may be used for specific needs:

#### Heroicons
- **When to use**: If already using Tailwind CSS heavily
- **Pros**: Official Tailwind Labs icons, two styles (outline/solid)
- **Cons**: Smaller icon set compared to Lucide
- **Install**: `npm install @heroicons/react`

```tsx
import { HomeIcon, ChartBarIcon } from '@heroicons/react/24/outline';
<HomeIcon className="w-6 h-6" />
```

#### React Icons
- **When to use**: Need icons from multiple icon families
- **Pros**: Includes Font Awesome, Material Design, Feather, etc.
- **Cons**: Larger bundle size if not careful with imports
- **Install**: `npm install react-icons`

```tsx
import { FiHome, FiBarChart } from 'react-icons/fi'; // Feather icons
<FiHome size={24} />
```

### Migration from Emoji Icons

Current prototype uses emoji icons. Production migration steps:

1. Install Lucide React: `npm install lucide-react`
2. Replace emoji mappings:
   - 🏠 → `<Home />`
   - 📚 → `<BookOpen />`
   - 📂 → `<Layers />`
   - 📊 → `<BarChart3 />`
   - 👤 → `<User />`
   - 🔔 → `<Bell />`
   - ✅ → `<CheckCircle />`
   - 📝 → `<Edit />`
   - 💡 → `<Lightbulb />`
   - 🎉 → `<Award />` or `<Sparkles />`
3. Update navigation components
4. Update card headers and action buttons
5. Test accessibility with screen readers

### Icon Best Practices

1. **Consistency**: Always use the same icon for the same action across the app
2. **Accessibility**: Always provide `aria-label` for icon-only buttons
3. **Size**: Use standard sizes (16, 20, 24, 32) for visual consistency
4. **Color**: Use semantic colors that match the action (blue=primary, green=success, etc.)
5. **Performance**: Import only the icons you use, never import the entire library
6. **Spacing**: Maintain consistent spacing between icons and adjacent text
7. **Touch Targets**: Ensure icon buttons have minimum 44px touch target on mobile

```tsx
// Good: Specific import
import { Home } from 'lucide-react';

// Bad: Full library import
import * as Icons from 'lucide-react';
```

---


## Accessibility

### Color Contrast
- All text colors meet WCAG AA standards
- Primary text (#1a1a1a) on white: 12.63:1 ratio ✅
- Muted text (#6b7280) on white: 4.95:1 ratio ✅
- White text on primary gradient: >4.5:1 ratio ✅

### Focus Management

**Focus Indicators**:
- All interactive elements must have visible focus indicators
- Use 2px blue outline: `focus:outline-none focus:ring-2 focus:ring-blue-500`
- Ensure contrast ratio of 3:1 minimum between focus indicator and background

**Focus Order**:
- Logical tab order following visual layout
- Skip links for keyboard users (optional for MVP)
- Auto-focus on primary action after state changes

**Focus Trap**:
- Modal dialogs must trap focus (use Radix UI Dialog)
- Esc key closes dialog and returns focus

**Example**:
```tsx
<button
  className="px-4 py-2 bg-blue-500 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
>
  Primary Action
</button>
```

### ARIA Live Regions

**Usage**:
- Use `aria-live="polite"` for non-critical announcements
- Use `aria-live="assertive"` only for critical errors
- Pair with `aria-atomic="true"` for complete message reading

**Examples**:
- Card flip: "Answer revealed"
- Progress: "Card 5 of 24"
- State changes: "Session paused"

**Implementation**:
```tsx
<div
  aria-live="polite"
  aria-atomic="true"
  className="sr-only"
>
  {announcement}
</div>
```

### Keyboard Shortcuts

**Best Practices**:
- Single-key shortcuts for frequent actions (Space, 1-4)
- Special keys for meta actions (?, Esc)
- Display shortcuts in help dialog (Dialog component)
- Show visual hints on hover (Tooltip component)

**Standard Shortcuts**:
- Space: Primary action (flip, submit, etc.)
- Esc: Close/cancel/exit
- ?: Show help
- Numbers: Quick selections

**Keyboard Shortcut Help Dialog**:
```tsx
import { KeyboardShortcutsHelp } from '@/components/review/KeyboardShortcutsHelp';

// In component
const { showHelp, setShowHelp } = useKeyboardShortcuts();

// In JSX
<KeyboardShortcutsHelp open={showHelp} onOpenChange={setShowHelp} />
```

### Screen Reader Support

**ARIA Labels**:
- All interactive elements need `aria-label` or visible text
- Use `aria-describedby` for additional context
- Use `aria-labelledby` for headings

**Example**:
```tsx
<button
  aria-label="Rate card as Good"
  onClick={() => rateCard('good')}
>
  Good
</button>
```

**Semantic HTML**:
- Use proper heading hierarchy (h1 → h2 → h3)
- Use `<button>` for actions, `<a>` for navigation
- Use landmarks: `<main>`, `<nav>`, `<section>`

**Hidden Content**:
- Use `.sr-only` class for screen-reader-only content:
  ```css
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
  ```

### Keyboard Navigation
- All interactive elements are keyboard accessible
- Tab order follows visual hierarchy
- Mobile navigation items have adequate touch targets (min 44px)

### ARIA Patterns
- Use semantic HTML elements where possible
- Add `aria-label` for icon-only buttons
- Include `role` attributes for custom components
- Ensure proper heading hierarchy (h1 → h2 → h3)

### Motion Preferences
```css
@media (prefers-reduced-motion: reduce) {
    * {
        animation: none !important;
        transition: none !important;
    }
}
```

---


## Dark Mode

*Currently not implemented. Future considerations:*

### Potential Dark Mode Colors
- Background: `#0f172a` (slate-900)
- Card Background: `#1e293b` (slate-800)
- Border: `#334155` (slate-700)
- Primary Text: `#f1f5f9` (slate-100)
- Muted Text: `#94a3b8` (slate-400)

### Implementation Strategy
- Use CSS custom properties for color tokens
- Implement theme context in React
- Store user preference in localStorage
- Respect system preferences with `prefers-color-scheme`

---
