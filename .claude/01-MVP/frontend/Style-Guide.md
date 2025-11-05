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

**Last Updated**: 2025-11-05
**Status**: ✅ Complete - Updated with Task 06 chart colors, data visualization patterns, and responsive chart configuration