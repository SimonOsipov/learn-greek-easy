# Frontend Style Guide

This document defines the visual design system, component patterns, and styling standards for the Greek Language Learning SaaS application.

---

## Overview

The style guide has been split into focused files for easier navigation. Each file contains complete design specifications, code examples, and implementation guidelines.

**Coverage**: Complete design system including colors, typography, component patterns, and accessibility standards

---

## Style Guide Files

### Design Foundation

**[Design Foundation](../../learn-greek-easy-frontend/docs/design-foundation.md)** (291 lines)
- **Design Strategy**: Philosophy, core principles, mobile-first approach
- **Color Palette**: Primary, secondary, semantic, text, background colors
- **Typography**: Font families, type scale, font weights
- **Spacing & Layout**: Spacing scale, container, grid system, breakpoints
- **Component Basics**: Button styles, card styles, progress bars, badges, navigation, forms, deck components
- **Shadows & Elevation**: 5-level elevation system
- **Animations & Transitions**: Duration standards, common transitions, hover transforms

**[Icons & Accessibility](../../learn-greek-easy-frontend/docs/icons-accessibility.md)** (485 lines)
- **Icons**: Emoji icons (prototype), Lucide React (production), icon sizing, icon colors, common icons, migration guide
- **Icon Library**: Installation, usage examples, icon wrapper component, best practices
- **Accessibility**: Color contrast, focus management, ARIA live regions, keyboard shortcuts, screen reader support, keyboard navigation, ARIA patterns, motion preferences

---

### UI Patterns

**[Authentication Patterns](../../learn-greek-easy-frontend/docs/patterns/authentication-patterns.md)** (244 lines)
- Form layout pattern
- Input field pattern (basic inputs, password with visibility toggle, field states)
- Error handling pattern (inline errors, form-level errors)
- Submit button pattern (loading states)
- Validation pattern (Zod schemas, React Hook Form setup)
- Accessibility considerations

**[Form & Protected Route Patterns](../../learn-greek-easy-frontend/docs/patterns/form-protected-route-patterns.md)** (184 lines)
- Route guard implementation
- Loading state pattern
- Return URL pattern
- Session management pattern (warning dialog, timing, auto-logout)
- Accessibility considerations

**[Dialog Patterns](../../learn-greek-easy-frontend/docs/patterns/dialog-patterns.md)** (155 lines)
- Confirmation dialog pattern (destructive actions)
- Dialog state management pattern
- Non-dismissible dialog pattern
- Dialog sizes (small, medium, large)
- Accessibility considerations

**[Mobile Patterns](../../learn-greek-easy-frontend/docs/patterns/mobile-patterns.md)** (183 lines)
- Mobile navigation pattern (bottom tab navigation)
- Touch interaction pattern (minimum touch targets)
- Responsive breakpoints (mobile, tablet, desktop)
- Mobile form pattern (input types, keyboard optimization)
- Accessibility considerations

**[Loading Patterns](../../learn-greek-easy-frontend/docs/patterns/loading-patterns.md)** (180 lines)
- Skeleton loading pattern
- Spinner loading pattern (page loader, button loading)
- Error state pattern
- Empty state pattern
- Accessibility considerations

**[Settings Patterns](../../learn-greek-easy-frontend/docs/patterns/settings-patterns.md)** (306 lines)
- Account info display pattern
- Subscription badge pattern (free vs premium)
- Form dialog pattern (email change, password change)
- Key principles (dialog size, header clarity, form spacing, security, loading states)
- Accessibility considerations

---

### Data Visualization

**[Data Visualization Patterns](../../learn-greek-easy-frontend/docs/patterns/data-visualization-patterns.md)** (758 lines)
- **Chart Color Palette**: 8-color spectrum, color schemes (binary, tertiary, spectrum, performance, progression)
- **Color Usage Guidelines**: Consistency, accessibility, semantic meaning, grayscale fallback, chart legend
- **Date Formatting**: Format patterns, standards table, implementation examples
- **Percentage Formatting**: Format patterns, display rules
- **Number Formatting**: Format patterns, ranges, compact notation
- **Gradient Definitions**: Area chart gradients, standards
- **Tooltip Structure**: Layout, content, styling
- **Legend Positioning**: Horizontal vs vertical, usage examples
- **Responsive Patterns**: Breakpoint handling, chart height, axis configuration
- **Color-Coded Thresholds**: Performance metrics, threshold system
- **Time Formatting**: Duration formatting, examples
- **Motivational Messaging**: Message tiers, guidelines
- **Percentage Display**: Calculation patterns, display guidelines
- **Active State Detection**: Logic, visual indicators
- **Icon Badge System**: Color schemes, guidelines

---

## Quick Navigation

### By Development Stage

1. **Foundation First**: [Design Foundation](../../learn-greek-easy-frontend/docs/design-foundation.md) - Set up colors, typography, spacing
2. **Icons & A11y**: [Icons & Accessibility](../../learn-greek-easy-frontend/docs/icons-accessibility.md) - Icon library and accessibility standards
3. **Auth Flow**: [Authentication Patterns](../../learn-greek-easy-frontend/docs/patterns/authentication-patterns.md) - Build login/register
4. **Protection**: [Form & Protected Route Patterns](../../learn-greek-easy-frontend/docs/patterns/form-protected-route-patterns.md) - Secure routes
5. **Interactions**: [Dialog Patterns](../../learn-greek-easy-frontend/docs/patterns/dialog-patterns.md), [Mobile Patterns](../../learn-greek-easy-frontend/docs/patterns/mobile-patterns.md)
6. **Feedback**: [Loading Patterns](../../learn-greek-easy-frontend/docs/patterns/loading-patterns.md) - Loading and empty states
7. **Settings**: [Settings Patterns](../../learn-greek-easy-frontend/docs/patterns/settings-patterns.md) - User preferences
8. **Analytics**: [Data Visualization Patterns](../../learn-greek-easy-frontend/docs/patterns/data-visualization-patterns.md) - Charts and metrics

### By Pattern Type

- **Visual Design**: [Design Foundation](../../learn-greek-easy-frontend/docs/design-foundation.md)
- **Interaction**: [Dialog Patterns](../../learn-greek-easy-frontend/docs/patterns/dialog-patterns.md), [Mobile Patterns](../../learn-greek-easy-frontend/docs/patterns/mobile-patterns.md)
- **Forms**: [Authentication Patterns](../../learn-greek-easy-frontend/docs/patterns/authentication-patterns.md), [Settings Patterns](../../learn-greek-easy-frontend/docs/patterns/settings-patterns.md)
- **Data**: [Data Visualization Patterns](../../learn-greek-easy-frontend/docs/patterns/data-visualization-patterns.md)
- **Feedback**: [Loading Patterns](../../learn-greek-easy-frontend/docs/patterns/loading-patterns.md)
- **Security**: [Form & Protected Route Patterns](../../learn-greek-easy-frontend/docs/patterns/form-protected-route-patterns.md)

---

## File Organization

```
learn-greek-easy-frontend/
├── docs/
│   ├── Style-Guide.md                     (this file - master index)
│   ├── Components-Reference.md            (master components index)
│   ├── design-foundation.md               (colors, typography, spacing, components)
│   ├── icons-accessibility.md             (icon library, accessibility standards)
│   ├── components/                        (component reference files)
│   │   └── [16 component reference files]
│   └── patterns/                          (UI pattern files)
│       ├── authentication-patterns.md     (login, register forms)
│       ├── form-protected-route-patterns.md (route guards, session management)
│       ├── dialog-patterns.md             (modal dialogs, confirmations)
│       ├── mobile-patterns.md             (mobile navigation, responsive)
│       ├── loading-patterns.md            (loading, empty states)
│       ├── settings-patterns.md           (settings UI, preferences)
│       └── data-visualization-patterns.md (charts, metrics, widgets)
```

---

## Design Philosophy

Our design system prioritizes **clarity, warmth, and encouragement** to create a stress-free learning environment for busy adults preparing for naturalization exams.

### Core Principles

- **Clarity First**: Every element should have a clear purpose and be easily understood
- **Warm & Encouraging**: Use colors and messaging that motivate rather than intimidate
- **Mobile-First**: Optimize for quick mobile sessions during commutes
- **Minimal Cognitive Load**: Reduce visual complexity to keep focus on learning
- **Consistent Patterns**: Use familiar UI patterns to minimize learning curve

---

## Design Tokens Summary

### Colors
- **Primary**: Blue (#2563eb)
- **Success**: Green (#10b981)
- **Warning**: Orange (#f97316)
- **Text**: Dark gray (#1a1a1a)
- **Background**: Light gray (#f8f9fa)

### Typography
- **Font**: System font stack
- **Scale**: 0.75rem - 2rem
- **Weights**: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

### Spacing
- **Base Unit**: 4px (0.25rem)
- **Scale**: 4px, 8px, 12px, 16px, 24px, 32px, 48px

### Breakpoints
- **Mobile**: 0 - 767px
- **Tablet**: 768px - 1023px
- **Desktop**: 1024px+

---

## Implementation Checklist

### Foundation Setup
- [ ] Install Tailwind CSS with custom config
- [ ] Set up color palette in tailwind.config.js
- [ ] Configure font stack
- [ ] Set up spacing scale
- [ ] Configure breakpoints

### Component Development
- [ ] Install Shadcn/ui base components
- [ ] Install Lucide React icons
- [ ] Set up React Hook Form + Zod
- [ ] Implement authentication patterns
- [ ] Build layout components
- [ ] Add loading and empty states
- [ ] Implement mobile navigation

### Accessibility
- [ ] Add focus indicators to all interactive elements
- [ ] Implement ARIA labels
- [ ] Test keyboard navigation
- [ ] Verify color contrast ratios
- [ ] Test with screen readers
- [ ] Add motion preferences support

### Analytics & Data Viz
- [ ] Install Recharts
- [ ] Set up chart color palette
- [ ] Implement responsive chart patterns
- [ ] Add tooltips and legends
- [ ] Create analytics widgets

---

## Related Documentation

- **[Components Reference](./Components-Reference.md)** - Complete component library
- **[Design Foundation](../../learn-greek-easy-frontend/docs/design-foundation.md)** - Core design system
- **[Icons & Accessibility](../../learn-greek-easy-frontend/docs/icons-accessibility.md)** - Icon and accessibility guidelines

---

## Usage Guidelines

1. **Start with Foundation**: Review [Design Foundation](../../learn-greek-easy-frontend/docs/design-foundation.md) first
2. **Follow Patterns**: Use pattern files as templates for your implementations
3. **Copy-Paste Ready**: All code examples are production-ready
4. **Accessibility First**: Every pattern includes accessibility considerations
5. **Mobile-First**: Start with mobile layout, enhance for desktop

---

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- iOS Safari (latest 2 versions)
- Chrome Android (latest 2 versions)

---

**Last Updated**: 2025-11-06
**Status**: Complete - Split into 9 focused files (all < 1,000 lines)
