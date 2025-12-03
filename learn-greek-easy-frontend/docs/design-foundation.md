# Design Foundation

Core design system including colors, typography, spacing, and component styling basics.

[← Back to Main Style Guide](./Style-Guide.md)

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


## Shadows & Elevation

### Elevation Levels
1. **Level 0**: No shadow (flat elements)
2. **Level 1**: `0 1px 3px rgba(0, 0, 0, 0.05)` - Cards, subtle elevation
3. **Level 2**: `0 4px 6px rgba(0, 0, 0, 0.05)` - Hover states
4. **Level 3**: `0 4px 6px rgba(0, 0, 0, 0.1)` - Metric card hover
5. **Level 4**: `0 4px 8px rgba(102, 126, 234, 0.3)` - Primary button hover
6. **Level 5**: `0 -2px 10px rgba(0, 0, 0, 0.05)` - Mobile navigation

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
