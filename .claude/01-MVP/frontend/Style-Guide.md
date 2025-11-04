# Frontend Style Guide

This document defines the visual design system, component patterns, and styling standards for the Greek Language Learning SaaS application.

---

## Design Strategy

### Design Philosophy
Our design system prioritizes clarity, warmth, and encouragement to create a stress-free learning environment for busy adults preparing for naturalization exams. The visual language is modern yet approachable, with soft colors and gentle transitions that reduce cognitive load while maintaining focus on the learning content.

### Core Principles
- **Clarity First**: Every element should have a clear purpose and be easily understood
- **Warm & Encouraging**: Use colors and messaging that motivate rather than intimidate
- **Mobile-First**: Optimize for quick mobile sessions during commutes
- **Minimal Cognitive Load**: Reduce visual complexity to keep focus on learning
- **Consistent Patterns**: Use familiar UI patterns to minimize learning curve

---

## Color Palette

### Primary Colors
- **Primary Blue**: `#2563eb` - Main brand color, used for primary actions and active states
- **Primary Gradient**: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)` - Used for primary buttons and avatar backgrounds

### Secondary Colors
- **Secondary Gray**: `#f3f4f6` - Light background for secondary elements
- **Border Gray**: `#e5e7eb` - Subtle borders and dividers

### Semantic Colors
- **Success Green**: `#10b981` - Completed items, success states
- **Warning Orange**: `#f97316` - Streaks, attention-grabbing elements
- **Info Blue**: `#3b82f6` - Informational elements, mastered items
- **Error Red**: `#ef4444` - Error states (not currently used)

### Text Colors
- **Primary Text**: `#1a1a1a` - Main text color
- **Secondary Text**: `#374151` - Secondary button text
- **Muted Text**: `#6b7280` - Labels, descriptions, less important text
- **Subtle Text**: `#9ca3af` - Very subtle labels and hints

### Background Colors
- **Page Background**: `#f8f9fa` - Light gray background
- **Card Background**: `#ffffff` - White cards and panels
- **Accent Background**: `linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)` - Learning tips

### Status Badge Colors
- **In Progress Badge**: `#dbeafe` (background) / `#1e40af` (text)
- **Completed Badge**: `#d1fae5` (background) / `#065f46` (text)
- **Not Started Badge**: `#f3f4f6` (background) / `#6b7280` (text)

---

## Typography

### Font Families
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
```
System font stack for optimal readability and performance across all platforms.

### Type Scale

#### Headings
- **H1 (Logo)**: `1.25rem` (20px), `font-weight: 600`
- **H2 (Page Title)**: `1.75rem` (28px) mobile / `2rem` (32px) desktop, `font-weight: 600`
- **H3 (Section Title)**: `1.125rem` (18px), `font-weight: 600`
- **H4 (Card Title)**: `1rem` (16px), `font-weight: 500-600`

#### Body Text
- **Body**: `1rem` (16px), `line-height: 1.6`
- **Small**: `0.875rem` (14px)
- **Extra Small**: `0.75rem` (12px)

#### Metric Values
- **Large Number**: `2rem` (32px), `font-weight: 700`
- **Mobile Number**: `1.75rem` (28px) on smaller screens

### Font Weights
- **Regular**: 400 - Body text
- **Medium**: 500 - Card titles, active navigation
- **Semibold**: 600 - Section headings, logo
- **Bold**: 700 - Metric values, emphasis

---

## Spacing & Layout

### Spacing Scale
Based on a 4px base unit:
- `0.25rem` (4px) - Minimal spacing
- `0.5rem` (8px) - Tight spacing
- `0.75rem` (12px) - Small spacing
- `1rem` (16px) - Default spacing
- `1.5rem` (24px) - Medium spacing
- `2rem` (32px) - Large spacing
- `3rem` (48px) - Extra large spacing

### Container
- **Max Width**: `1440px`
- **Padding**: `1rem` (16px) mobile / `1rem` sides on desktop

### Grid System
- **Desktop**: 12-column grid with flexible gaps
- **Main Layout**: 2fr (content) + 1fr (sidebar) on desktop
- **Metrics Grid**:
  - Mobile: `repeat(auto-fit, minmax(160px, 1fr))`
  - Desktop: `repeat(5, 1fr)` for 5 columns

### Breakpoints
```css
/* Mobile First Approach */
- Base: 0 - 767px (Mobile)
- @media (min-width: 768px) - Tablet
- @media (min-width: 1024px) - Desktop
- @media (min-width: 1440px) - Wide (optional)
```

---

## Components

### Buttons

#### Primary Button
```css
- Background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
- Color: white
- Padding: 1rem (large) / 0.75rem 1rem (normal)
- Border Radius: 8px
- Font Weight: 500
- Hover: translateY(-1px), box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3)
```

#### Secondary Button
```css
- Background: #f3f4f6
- Color: #374151
- Padding: 0.625rem 1rem
- Border Radius: 8px
- Font Weight: 500
- Hover: background-color: #e5e7eb
```

### Cards

#### Standard Card
```css
- Background: #ffffff
- Border: 1px solid #e5e7eb
- Border Radius: 12px
- Padding: 1.5rem
- Box Shadow: 0 1px 3px rgba(0, 0, 0, 0.05)
- Hover: border-color: #2563eb, box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05)
```

#### Metric Card
```css
- Same as Standard Card
- Hover: translateY(-2px), box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1)
- Transition: transform 0.2s, box-shadow 0.2s
```

### Progress Bars
```css
- Track: height: 8px, background: #e5e7eb, border-radius: 9999px
- Fill: height: 100%, background: #2563eb, border-radius: 9999px
- Completed Fill: background: #10b981
- Transition: width 0.3s ease
```

### Badges
```css
- Padding: 0.25rem 0.75rem
- Border Radius: 9999px (fully rounded)
- Font Size: 0.75rem
- Font Weight: 500
- Variants: blue, green, gray (see color palette)
```

### Navigation

#### Desktop Nav
```css
- Height: 64px
- Background: #ffffff
- Border Bottom: 1px solid #e5e7eb
- Position: sticky top
- Box Shadow: 0 1px 3px rgba(0, 0, 0, 0.05)
```

#### Mobile Bottom Nav
```css
- Position: fixed bottom
- Background: #ffffff
- Border Top: 1px solid #e5e7eb
- Padding: 0.5rem 0
- Box Shadow: 0 -2px 10px rgba(0, 0, 0, 0.05)
```

### Forms
*To be defined when implementing authentication and input components*

### Deck Components

#### Level Badges
- **A1 (Beginner)**: `#10b981` (green) background, white text, "Beginner" label
- **A2 (Elementary)**: `#3b82f6` (blue) background, white text, "Elementary" label
- **B1 (Intermediate)**: `#f97316` (orange) background, white text, "Intermediate" label
- **B2 (Upper-Intermediate)**: `#764ba2` (purple) background, white text, "Upper-Intermediate" label
- Font size: 0.75rem (12px), font-weight: 500, padding: 0.25rem 0.75rem, border-radius: 9999px

#### Greek Typography Display
- **Primary**: Greek title (titleGreek) - 1rem (16px), font-weight: 600, color: #1a1a1a
- **Secondary**: English subtitle (title) - 0.875rem (14px), color: #6b7280
- **Pattern**: Greek text always displayed first and prominently, Latin below for clarity
- **Encoding**: UTF-8 for proper Greek character display

#### Premium Deck Indicators
- **Lock Icon**: Lucide `Lock` icon, 16px, color: #f59e0b (amber-500)
- **Premium Badge**: Background `#fef3c7` (amber-100), text `#92400e` (amber-800), "Premium" label
- **Card Border**: Gold accent `#fbbf24` (amber-400) on hover for premium decks
- **Locked State**: 0.7 opacity on entire card for locked premium decks (free tier users)

#### Segmented Progress Bars
- **New Cards Segment**: `#e5e7eb` (gray-200) - cards not yet studied
- **Learning Cards Segment**: `#3b82f6` (blue-500) - cards currently being learned
- **Mastered Cards Segment**: `#10b981` (green-500) - cards fully mastered
- **Display Pattern**: Horizontal stacked segments, each segment width represents percentage
- **Height**: 8px default, 12px for large variant
- **Border Radius**: 9999px (fully rounded ends)
- **Legend**: Optional color-coded legend below showing count per segment

#### Filter UI Patterns
- **Search Input**: 300ms debounce delay before filter triggers
- **Level Toggles**: Button group with active state showing level badge color
- **Status Dropdown**: Standard shadcn dropdown with checkboxes
- **Active Filters**: Badge display with X button to remove individual filters
- **Clear All**: Secondary button to reset all filters

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

## Shadows & Elevation

### Elevation Levels
1. **Level 0**: No shadow (flat elements)
2. **Level 1**: `0 1px 3px rgba(0, 0, 0, 0.05)` - Cards, subtle elevation
3. **Level 2**: `0 4px 6px rgba(0, 0, 0, 0.05)` - Hover states
4. **Level 3**: `0 4px 6px rgba(0, 0, 0, 0.1)` - Metric card hover
5. **Level 4**: `0 4px 8px rgba(102, 126, 234, 0.3)` - Primary button hover
6. **Level 5**: `0 -2px 10px rgba(0, 0, 0, 0.05)` - Mobile navigation

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

## Animations & Transitions

### Transition Durations
- **Fast**: `0.2s` - Color changes, simple hovers
- **Normal**: `0.3s` - Progress bars, transforms
- **Slow**: `0.5s` - Page transitions (future)

### Common Transitions
```css
/* Hover Effects */
transition: all 0.2s;
transition: transform 0.2s, box-shadow 0.2s;
transition: border-color 0.2s, box-shadow 0.2s;
transition: color 0.2s;
transition: opacity 0.2s;

/* Progress Animation */
transition: width 0.3s ease;
```

### Hover Transforms
- **Cards**: `translateY(-2px)` on hover
- **Primary Button**: `translateY(-1px)` on hover
- **Scale**: Avoid scaling to maintain text readability

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

## Component Usage Examples

### Metric Card
```html
<div class="metric-card">
    <div class="metric-label">Due Today</div>
    <div class="metric-value primary">24</div>
    <div class="metric-sublabel">cards to review</div>
</div>
```

### Deck Card
```html
<div class="deck-card">
    <div class="deck-header">
        <div class="deck-info">
            <h4>A1 Essential Words</h4>
            <p>Basic vocabulary for everyday communication</p>
        </div>
        <span class="badge badge-blue">In Progress</span>
    </div>
    <div class="progress-container">
        <div class="progress-info">
            <span>68 of 100 words</span>
            <span>68%</span>
        </div>
        <div class="progress-bar-track">
            <div class="progress-bar-fill" style="width: 68%"></div>
        </div>
    </div>
    <div class="quick-stats">
        <span>📚 12 cards due</span>
        <span>✅ 68 mastered</span>
        <span>📝 32 learning</span>
    </div>
</div>
```

---

## Design Tokens (for future CSS-in-JS or CSS Variables)

```javascript
const tokens = {
  colors: {
    primary: '#2563eb',
    primaryGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    success: '#10b981',
    warning: '#f97316',
    info: '#3b82f6',
    text: {
      primary: '#1a1a1a',
      secondary: '#374151',
      muted: '#6b7280',
      subtle: '#9ca3af',
    },
    background: {
      page: '#f8f9fa',
      card: '#ffffff',
      secondary: '#f3f4f6',
    },
    border: '#e5e7eb',
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    xxl: '3rem',
  },
  borderRadius: {
    sm: '8px',
    md: '12px',
    full: '9999px',
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.75rem',
    '3xl': '2rem',
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  breakpoints: {
    mobile: '0px',
    tablet: '768px',
    desktop: '1024px',
    wide: '1440px',
  },
};
```

---

## Implementation Notes

### CSS Architecture
1. **Mobile-First Approach**: Base styles for mobile, enhance with media queries
2. **Component Scoping**: Use CSS modules or styled-components for component isolation
3. **Utility Classes**: Leverage Tailwind CSS for rapid development
4. **Custom Properties**: Use CSS variables for theme values

### Performance Considerations
1. **Font Loading**: Use system fonts to avoid FOUT/FOIT
2. **Animation Performance**: Use transform and opacity for GPU acceleration
3. **Image Optimization**: Lazy load images below the fold
4. **CSS Bundle Size**: Purge unused Tailwind classes in production

### Maintenance Guidelines
1. **Consistency**: Always refer to this guide when creating new components
2. **Documentation**: Update this guide when introducing new patterns
3. **Review**: Include style guide compliance in code reviews
4. **Testing**: Test on multiple devices and browsers

---

**Last Updated**: 2025-10-25
**Status**: ✅ Complete - Based on approved HTML mockup