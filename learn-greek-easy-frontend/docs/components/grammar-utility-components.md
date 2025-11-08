# Utility, Feedback & Grammar Components Reference

Utility components, feedback components (loading, empty states, errors), and grammar-specific components.

[← Back to Main Components Reference](../../.claude/01-MVP/frontend/Components-Reference.md)

---

## Feedback Components

Located in `/src/components/feedback/`

### EmptyState

**File**: `/src/components/feedback/EmptyState.tsx`

**Purpose**: Displays consistent "no data" states across the application.

**Category**: Feedback Component

**Interface**:
```typescript
interface EmptyStateProps {
  icon?: LucideIcon;           // Icon component (default: InboxIcon)
  title: string;                // Title text
  description?: string;         // Optional description
  action?: {                    // Optional action button
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  };
  className?: string;           // Additional CSS classes
}
```

**Features**:
- Customizable icon (Lucide React icons)
- Title and optional description
- Optional action button with variant support
- Centered layout with muted text
- Uses `role="status"` for screen readers
- Icon has `aria-hidden="true"`

**Usage**:
```tsx
import { EmptyState } from '@/components/feedback';
import { BookOpenIcon } from 'lucide-react';

// Simple empty state
<EmptyState
  icon={BookOpenIcon}
  title="No decks yet"
  description="Create your first deck to start learning Greek words."
/>

// With action button
<EmptyState
  icon={BookOpenIcon}
  title="No Decks Found"
  description="No decks match your current filters."
  action={{
    label: 'Clear Filters',
    onClick: clearFilters,
    variant: 'secondary'
  }}
/>
```

**Used In**:
- DecksPage (no decks found)
- Dashboard (empty charts, no activity feed)

---

### Loading

**File**: `/src/components/feedback/Loading.tsx`

**Purpose**: Unified loading component with multiple display variants.

**Category**: Feedback Component

**Interface**:
```typescript
interface LoadingProps {
  variant?: 'page' | 'inline' | 'overlay' | 'skeleton';
  text?: string;                // Loading text (default: 'Loading...')
  rows?: number;                // Number of skeleton rows (default: 3)
  className?: string;           // Additional CSS classes
}
```

**Variants**:
1. **page**: Full page loading with centered spinner
2. **inline**: Small inline loader with text
3. **overlay**: Loading overlay on top of content
4. **skeleton**: Skeleton placeholder rows

**Features**:
- Uses `role="status"` and `aria-live="polite"`
- Provides `aria-label` with loading text
- Spinner has `aria-hidden="true"`
- Lucide React Loader2 icon with spin animation

**Usage**:
```tsx
import { Loading } from '@/components/feedback';

// Full page loading
<Loading variant="page" text="Loading your dashboard..." />

// Inline loader
<Loading variant="inline" text="Saving..." />

// Loading overlay
<div className="relative">
  <Content />
  {isLoading && <Loading variant="overlay" />}
</div>

// Skeleton placeholder
<Loading variant="skeleton" rows={5} />
```

**Used In**:
- Dashboard (page loading state)
- Various pages for async data loading

---

### CardSkeleton

**File**: `/src/components/feedback/Loading.tsx`

**Purpose**: Skeleton placeholder for card layouts.

**Category**: Feedback Component

**Interface**: No props

**Features**:
- Card layout skeleton with header and content placeholders
- Uses `role="status"` with `aria-label="Loading card"`
- Shimmer animation effect with Tailwind's `animate-pulse`

**Usage**:
```tsx
import { CardSkeleton } from '@/components/feedback';

// Loading grid of cards
<div className="grid grid-cols-3 gap-4">
  {[1, 2, 3, 4, 5, 6].map((i) => (
    <CardSkeleton key={i} />
  ))}
</div>
```

**Used In**:
- DecksPage (deck grid loading state)

---

### ListSkeleton

**File**: `/src/components/feedback/Loading.tsx`

**Purpose**: Skeleton placeholder for list layouts.

**Category**: Feedback Component

**Interface**:
```typescript
interface ListSkeletonProps {
  count?: number;               // Number of list items (default: 3)
  showAvatar?: boolean;         // Show avatar placeholder (default: true)
  className?: string;           // Additional CSS classes
}
```

**Features**:
- Configurable number of list items
- Optional avatar placeholder
- Uses `role="status"` with `aria-label="Loading list"`
- Shimmer animation effect

**Usage**:
```tsx
import { ListSkeleton } from '@/components/feedback';

// Loading list with avatars
<ListSkeleton count={5} showAvatar />

// Loading list without avatars
<ListSkeleton count={3} showAvatar={false} />
```

**Used In**:
- Activity feeds
- User lists

---

## Error Handling Components

Located in `/src/components/errors/`

### ErrorBoundary

**File**: `/src/components/errors/ErrorBoundary.tsx`

**Purpose**: React Error Boundary to catch and handle component errors gracefully.

**Category**: Error Handling Component

**Interface**:
```typescript
interface ErrorBoundaryProps {
  children: ReactNode;          // Child components to render
  fallback?: ReactNode;         // Optional custom fallback UI
  onError?: (error: Error, errorInfo: ErrorInfo) => void; // Error callback
}
```

**Features**:
- Catches errors during rendering, lifecycle methods, and constructors
- Logs errors to console
- Provides reset functionality
- Can integrate with error tracking services (Sentry, etc.)
- Must be a class component (React requirement)
- Uses `getDerivedStateFromError` to update state
- Uses `componentDidCatch` for side effects

**Usage**:
```tsx
import { ErrorBoundary } from '@/components/errors';

// Wrap entire app
<ErrorBoundary>
  <App />
</ErrorBoundary>

// With custom fallback
<ErrorBoundary fallback={<div>Something went wrong</div>}>
  <MyComponent />
</ErrorBoundary>

// With error handler
<ErrorBoundary onError={(error, errorInfo) => logToService(error, errorInfo)}>
  <MyComponent />
</ErrorBoundary>
```

**Used In**:
- App.tsx (wraps entire application)

---

### ErrorFallback

**File**: `/src/components/errors/ErrorFallback.tsx`

**Purpose**: User-friendly error display component used by ErrorBoundary.

**Category**: Error Handling Component

**Interface**:
```typescript
interface ErrorFallbackProps {
  error: Error | null;          // The caught error
  onReset?: () => void;         // Callback to reset error boundary
}
```

**Features**:
- User-friendly error message
- Shows error details in development mode
- "Try Again" button to reset error state
- "Go Home" button to navigate to homepage
- Contact support message
- Proper heading hierarchy
- Icon has `aria-hidden="true"`
- Buttons have clear labels

**Usage**:
```tsx
import { ErrorFallback } from '@/components/errors';

<ErrorFallback
  error={new Error('Something went wrong')}
  onReset={() => window.location.reload()}
/>
```

**Used In**:
- ErrorBoundary (default fallback)

---

## Review Grammar Components

Grammar-specific components used within flashcard review interface.

### TenseTabs

**Purpose**: Tab navigation for selecting verb tenses (present, past, future) in grammar flashcards.

**File**: `/src/components/review/grammar/TenseTabs.tsx`

**Category**: Grammar Review Component

**Interface**:
```typescript
interface TenseTabsProps {
  selectedTense: 'present' | 'past' | 'future';
  onTenseChange: (tense: 'present' | 'past' | 'future') => void;
  disabled?: boolean;
}
```

**Features**:
- 3 tense buttons (Present, Past, Future)
- Active state with gradient background
- Hover states on inactive tabs
- Disabled state support
- Capitalized labels
- Rounded pill design
- Accessible (aria-pressed attribute)

**Usage**:
```tsx
import { TenseTabs } from '@/components/review/grammar/TenseTabs';

const [selectedTense, setSelectedTense] = useState<'present' | 'past' | 'future'>('present');

<TenseTabs
  selectedTense={selectedTense}
  onTenseChange={setSelectedTense}
  disabled={!answerRevealed}
/>
```

**Styling**:
- **Active tab**: Gradient background (blue to purple), white text, bold font
- **Inactive tab**: Gray text, light gray hover background
- **Disabled**: Reduced opacity, not clickable
- **Container**: White background, padding, rounded corners

**Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| selectedTense | 'present' \| 'past' \| 'future' | Required | Currently selected tense |
| onTenseChange | (tense) => void | Required | Callback when tense changes |
| disabled | boolean | false | Disable all buttons |

**Key Interactions**:
- Click tense button → Call onTenseChange with selected tense
- Visual feedback → Active state changes immediately
- Keyboard accessible → Tab navigation, Enter/Space to activate

**Related Components**:
- [FlashcardContainer](#flashcardcontainer) - Parent component for grammar cards
- [VerbConjugationDisplay](#verbconjugationdisplay) - Displays conjugations for selected tense

**Use Cases**:
- Grammar flashcards with verb conjugations
- Tense comparison exercises
- Verb practice drills

---

### FlashcardSkeleton

**Purpose**: Animated loading skeleton matching flashcard dimensions, shown while flashcard content loads during review sessions.

**File**: `/src/components/review/FlashcardSkeleton.tsx`

**Category**: Loading/Feedback Component

**Features**:
- Matches FlashcardContainer layout exactly
- Progress header skeleton
- Main card content skeleton (word, translation, badges)
- Rating buttons skeleton (4 buttons)
- Grammar section skeleton (if applicable)
- Pulse animation on all skeleton elements
- White background with shadow
- Rounded corners matching flashcard

**Usage**:
```tsx
import { FlashcardSkeleton } from '@/components/review/FlashcardSkeleton';

// In FlashcardReviewPage while loading
{isLoading ? (
  <FlashcardSkeleton />
) : (
  <FlashcardContainer card={currentCard} />
)}
```

**Layout Structure**:
```
Container (800px min height, rounded, shadow)
├── Progress Header (gray bg, skeleton bar + text)
├── Main Card (white bg, centered)
│   ├── Word skeleton (h-12, w-64)
│   ├── Translation skeleton (h-5, w-40)
│   ├── Badge skeletons (2 pills)
│   └── Action skeleton (h-8, w-48)
├── Rating Buttons (4 button skeletons)
└── Grammar Section (white bg, 4 row skeletons)
```

**Dimensions**:
- Container: max-w-4xl, min-h-[800px]
- Word: h-12 (3rem), w-64
- Translation: h-5 (1.25rem), w-40
- Rating buttons: h-11, w-28 each
- Grammar rows: h-10 each

**Animation**:
All skeleton elements use `animate-pulse` class for subtle loading effect.

**Related Components**:
- [FlashcardContainer](#flashcardcontainer) - Actual flashcard component
- [Skeleton](#skeleton) - Base Shadcn skeleton component

**Use Cases**:
- Review page initial load
- Card transition loading
- Network delay feedback

---

## Utility Components

General-purpose utility components used across the application.

### KeyboardShortcutsHelp

**Purpose**: Modal dialog displaying all available keyboard shortcuts during flashcard review. Triggered by pressing "?" key.

**File**: `/src/components/review/KeyboardShortcutsHelp.tsx`

**Category**: Help/Documentation Component

**Interface**:
```typescript
interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutItemProps {
  keys: string[];
  description: string;
}
```

**Features**:
- Modal dialog with backdrop
- 2 shortcut categories: Review Actions and Navigation
- Keyboard key visualization (kbd elements)
- Color-coded categories (blue for review, purple for navigation)
- Helpful tip footer
- Close on ESC or click outside
- Focus trap when open

**Usage**:
```tsx
import { KeyboardShortcutsHelp } from '@/components/review/KeyboardShortcutsHelp';

const [showHelp, setShowHelp] = useState(false);

// In FlashcardReviewPage
<KeyboardShortcutsHelp
  open={showHelp}
  onOpenChange={setShowHelp}
/>

// Trigger with keyboard listener
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === '?') setShowHelp(true);
  };
  window.addEventListener('keypress', handleKeyPress);
  return () => window.removeEventListener('keypress', handleKeyPress);
}, []);
```

**Shortcut Categories**:

**Review Actions** (Blue border):
| Key | Description |
|-----|-------------|
| Space | Flip flashcard |
| 1 | Rate 'Again' (show again soon) |
| 2 | Rate 'Hard' (reduced interval) |
| 3 | Rate 'Good' (standard interval) |
| 4 | Rate 'Easy' (longer interval) |

**Navigation** (Purple border):
| Key | Description |
|-----|-------------|
| ? | Show/hide keyboard shortcuts |
| Esc | Close help or exit review |

**Footer Tip**:
"Tip: You can use your keyboard to review cards without touching your mouse!"

**Key Interactions**:
- Press "?" → Open dialog
- Press Esc → Close dialog
- Click backdrop → Close dialog
- Click X button → Close dialog
- Tab navigation → Focus trap within dialog

**Related Components**:
- [Dialog](#dialog) - Base dialog component
- [FlashcardReviewPage](#flashcardreviewpage) - Parent page
- [FlashcardContainer](#flashcardcontainer) - Implements shortcuts

**Accessibility**:
- Focus trap when open
- ESC to close
- ARIA labels on dialog
- Semantic kbd elements for keys

---

### Toaster

**Purpose**: Global toast notification system for displaying temporary messages, alerts, and confirmations.

**File**: `/src/components/ui/toaster.tsx`

**Category**: Feedback/Notification Component

**Interface**:
```typescript
// Uses toast hook
const { toasts } = useToast();

// Toast object structure
interface Toast {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  variant?: 'default' | 'destructive';
  // ... other ToastProps
}
```

**Features**:
- Displays multiple toasts in stack
- Auto-dismiss after timeout
- Manual dismiss with X button
- Variant support (default, destructive)
- Custom actions in toast
- Positioned in viewport corner
- Slide-in animation
- Accessible (ARIA live region)

**Usage**:
```tsx
// 1. Add Toaster to root layout (App.tsx)
import { Toaster } from '@/components/ui/toaster';

function App() {
  return (
    <>
      {/* App content */}
      <Toaster />
    </>
  );
}

// 2. Use toast hook in any component
import { useToast } from '@/hooks/use-toast';

function MyComponent() {
  const { toast } = useToast();

  const handleSuccess = () => {
    toast({
      title: 'Success!',
      description: 'Your changes have been saved.',
      variant: 'default',
    });
  };

  const handleError = () => {
    toast({
      title: 'Error',
      description: 'Something went wrong. Please try again.',
      variant: 'destructive',
    });
  };

  return (
    <Button onClick={handleSuccess}>Save</Button>
  );
}
```

**Toast Variants**:
| Variant | Use Case | Styling |
|---------|----------|---------|
| default | Success, info messages | Green/blue accent |
| destructive | Errors, warnings | Red accent |

**Toast Position**:
- Desktop: Bottom-right corner
- Mobile: Bottom center, full width

**Common Use Cases**:
- Form submission success/error
- Data save confirmation
- Network error alerts
- Action undo notifications
- Copy to clipboard feedback

**Props (via toast function)**:
| Prop | Type | Description |
|------|------|-------------|
| title | ReactNode | Toast heading |
| description | ReactNode | Toast body text |
| variant | 'default' \| 'destructive' | Visual style |
| action | ReactNode | Custom action button |
| duration | number | Auto-dismiss timeout (ms) |

**Key Interactions**:
- Toast appears → Slide-in animation
- Auto-dismiss → After 5 seconds (default)
- Click X → Immediate dismiss
- Click action → Execute custom action
- Multiple toasts → Stack vertically

**Related Components**:
- [Toast](#toast) - Base toast component (Shadcn)
- useToast hook - Toast management

**Accessibility**:
- ARIA live region (polite)
- Keyboard dismissible
- Screen reader announcements

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
**Status**: Complete - All Components Documented (Including Page Components, Review Components, and Utility Components)
**Version**: 1.4.0
**Total Components Documented**: 55+ (14 Shadcn/ui, 27 custom, 10 pages, 2 review grammar, 2 utility)
