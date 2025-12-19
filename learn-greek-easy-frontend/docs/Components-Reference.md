# Components Reference Guide

Quick reference guide for all UI components in the Greek Language Learning application. Use this alongside the [Style Guide](./Style-Guide.md) during implementation.

---

## Overview

This guide has been split into category-based files for easier navigation. Each file contains complete TypeScript interfaces, usage examples, and implementation guidelines.

**Total Components**: 60+ components across 16 category files

---

## Component Category Files

### UI Foundation Components

**[UI Components](../../learn-greek-easy-frontend/docs/components/ui-components.md)** (460 lines)
- Shadcn/ui base components: Avatar, Badge, Button, Card, Dialog, Dropdown, Navigation, Progress, Scroll Area, Separator, Sheet, Skeleton, Toast, Tooltip

---

### Authentication & Security

**[Auth Components](../../learn-greek-easy-frontend/docs/components/auth-components.md)** (894 lines)
- ProtectedRoute, PublicRoute, RouteGuard, AuthLayout, LogoutDialog

**[Auth Patterns](../../learn-greek-easy-frontend/docs/components/auth-patterns.md)** (301 lines)
- Authentication UI patterns, form layouts, validation patterns

---

### Layout & Navigation

**[Layout & Navigation Components](../../learn-greek-easy-frontend/docs/components/layout-navigation-components.md)** (551 lines)
- AppLayout, Header, MobileNav

**[Display & Dashboard Components](../../learn-greek-easy-frontend/docs/components/display-dashboard-components.md)** (618 lines)
- MetricCard, DeckCard, ProgressBar, QuickStats, ReviewItem, WelcomeSection, QuickActionsPanel, UpcomingReviews, LearningTip, PageContainer, ContentLayout

---

### Forms & Input

**[Form Components](../../learn-greek-easy-frontend/docs/components/form-components.md)** (331 lines)
- FormField, PasswordField, SubmitButton, useForm hook

---

### User Management

**[Settings Components](../../learn-greek-easy-frontend/docs/components/settings-components.md)** (~884 lines)
- Profile, ProfileHeader, PersonalInfoSection, StatsSection, PreferencesSection, SecuritySection, AccountSection, DangerZoneSection, ResetProgressDialog, DeleteAccountDialog

---

### Analytics & Data Visualization

**[Analytics Hooks](../../learn-greek-easy-frontend/docs/components/analytics-hooks.md)** (609 lines)
- useAnalytics, useProgressData, useDeckPerformance, useStudyStreak

**[Analytics Charts](../../learn-greek-easy-frontend/docs/components/analytics-charts.md)** (432 lines)
- ChartContainer, ChartTooltip, ChartLegend, ProgressLineChart, AccuracyAreaChart, DeckPerformanceChart, StageDistributionChart

**[Analytics Widgets](../../learn-greek-easy-frontend/docs/components/analytics-widgets.md)** (345 lines)
- StatCard, StreakWidget, WordStatusWidget, RetentionWidget, TimeStudiedWidget

**[Analytics Data Layer](../../learn-greek-easy-frontend/docs/components/analytics-data-layer.md)** (237 lines)
- TypeScript interfaces, mock analytics API, analytics store, data flow architecture

---

### Deck Management

**[Deck Components](../../learn-greek-easy-frontend/docs/components/deck-components.md)** (462 lines)
- CreateDeckDialog, EditDeckDialog, DeleteDeckDialog, DeckFilters, DeckSortDropdown, DeckCard (detailed), DeckGrid, DeckListSkeleton

---

### Review & Learning

**[Review Components](../../learn-greek-easy-frontend/docs/components/review-components.md)** (530 lines)
- FlashCard, ReviewSession, RatingButtons, ProgressHeader, CompletionDialog, ReviewControls, CardCounter, KeyboardShortcutsHelp, FlipButton, TimerDisplay, SessionStats, AnswerFeedback, ReviewHistory, ReviewSettings, StreakDisplay, GoalProgress, ReviewSchedule

---

### Pages

**[Page Components](../../learn-greek-easy-frontend/docs/components/page-components.md)** (861 lines)
- **Authentication Pages**: Login, Register, ForgotPassword
- **Main Pages**: Dashboard, DecksPage, DeckDetailPage, ReviewPage, Statistics, Settings, Profile
- **Error Pages**: NotFound (404), Unauthorized (403)

---

### Dialogs & Utilities

**[Dialog Components](../../learn-greek-easy-frontend/docs/components/dialog-components.md)** (189 lines)
- ActivityFeed, ActivityItem

**[Utility, Feedback & Grammar Components](../../learn-greek-easy-frontend/docs/components/grammar-utility-components.md)** (678 lines)
- **Feedback**: EmptyState, Loading, CardSkeleton, ListSkeleton
- **Error Handling**: ErrorBoundary, ErrorFallback
- **Grammar**: GrammarNoteDisplay, PartOfSpeechBadge, TenseTabs, ConjugationTable, DifficultyBadge
- **Utility**: Toaster, KeyboardShortcutsHelp
- File structure guidelines, common patterns, development checklist

---

## Quick Navigation by Function

### By Development Priority

1. **Start Here**: [UI Components](../../learn-greek-easy-frontend/docs/components/ui-components.md) - Install Shadcn/ui components first
2. **Authentication**: [Auth Components](../../learn-greek-easy-frontend/docs/components/auth-components.md) - Secure your routes
3. **Layout**: [Layout & Navigation](../../learn-greek-easy-frontend/docs/components/layout-navigation-components.md) - Set up app structure
4. **Pages**: [Page Components](../../learn-greek-easy-frontend/docs/components/page-components.md) - Build main pages
5. **Features**: [Deck Components](../../learn-greek-easy-frontend/docs/components/deck-components.md), [Review Components](../../learn-greek-easy-frontend/docs/components/review-components.md)
6. **Analytics**: [Analytics Hooks](../../learn-greek-easy-frontend/docs/components/analytics-hooks.md), [Charts](../../learn-greek-easy-frontend/docs/components/analytics-charts.md), [Widgets](../../learn-greek-easy-frontend/docs/components/analytics-widgets.md)

### By Component Type

- **Third-party**: [UI Components](../../learn-greek-easy-frontend/docs/components/ui-components.md)
- **Custom Layout**: [Layout & Navigation](../../learn-greek-easy-frontend/docs/components/layout-navigation-components.md), [Display & Dashboard](../../learn-greek-easy-frontend/docs/components/display-dashboard-components.md)
- **Forms**: [Form Components](../../learn-greek-easy-frontend/docs/components/form-components.md)
- **Data Visualization**: [Analytics Charts](../../learn-greek-easy-frontend/docs/components/analytics-charts.md), [Analytics Widgets](../../learn-greek-easy-frontend/docs/components/analytics-widgets.md)
- **Full Pages**: [Page Components](../../learn-greek-easy-frontend/docs/components/page-components.md)

---

## Installation Quick Start

```bash
# Install Shadcn/ui base
npx shadcn-ui@latest init

# Install all UI components at once
npx shadcn-ui@latest add avatar badge button card dialog dropdown-menu navigation-menu progress separator sheet skeleton toast tooltip scroll-area

# Install icon library
npm install lucide-react

# Install form handling
npm install react-hook-form @hookform/resolvers zod

# Install charts (for analytics)
npm install recharts
```

---

## File Organization

```
learn-greek-easy-frontend/
├── docs/
│   ├── Components-Reference.md        (this file - master index)
│   ├── Style-Guide.md                 (master style guide index)
│   ├── design-foundation.md           (colors, typography, spacing)
│   ├── icons-accessibility.md         (icons and accessibility)
│   ├── components/                    (component reference files)
│   │   ├── ui-components.md
│   │   ├── auth-components.md
│   │   ├── auth-patterns.md
│   │   ├── layout-navigation-components.md
│   │   ├── display-dashboard-components.md
│   │   ├── form-components.md
│   │   ├── settings-components.md
│   │   ├── analytics-hooks.md
│   │   ├── analytics-charts.md
│   │   ├── analytics-widgets.md
│   │   ├── analytics-data-layer.md
│   │   ├── deck-components.md
│   │   ├── review-components.md
│   │   ├── page-components.md
│   │   ├── dialog-components.md
│   │   └── grammar-utility-components.md
│   └── patterns/                      (UI pattern files)
│       ├── authentication-patterns.md
│       ├── form-protected-route-patterns.md
│       ├── dialog-patterns.md
│       ├── mobile-patterns.md
│       ├── loading-patterns.md
│       ├── settings-patterns.md
│       └── data-visualization-patterns.md
```

---

## Usage Guidelines

1. **Start with Shadcn/ui**: Install base components from [UI Components](../../learn-greek-easy-frontend/docs/components/ui-components.md)
2. **Follow Patterns**: Reference [Style Guide](./Style-Guide.md) for consistent styling
3. **Copy-Paste Ready**: All code examples are production-ready
4. **TypeScript First**: Every component has full type definitions
5. **Accessibility Built-in**: ARIA labels and keyboard navigation included

---

## Related Documentation

- **[Style Guide](./Style-Guide.md)** - Design system, colors, typography, patterns
- **[Design Foundation](../../learn-greek-easy-frontend/docs/design-foundation.md)** - Core design tokens
- **[Icons & Accessibility](../../learn-greek-easy-frontend/docs/icons-accessibility.md)** - Icon guidelines and accessibility standards

---

**Last Updated**: 2025-11-06
**Status**: Complete - Split into 16 category files (all < 1,000 lines)
