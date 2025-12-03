# Loading & Empty State Patterns

Loading states, skeleton screens, and empty state patterns.

[← Back to Main Style Guide](../Style-Guide.md)

---

## Loading & Empty State Patterns

### Skeleton Loading Pattern

Use skeleton screens for loading states to improve perceived performance.

**Card Skeleton** (from DecksPage.tsx):
```tsx
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

const DeckGridSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <Card key={i} className="p-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" /> {/* Title */}
              <Skeleton className="h-4 w-1/2" /> {/* Subtitle */}
            </div>
            <Skeleton className="h-6 w-12 rounded-full" /> {/* Badge */}
          </div>
          <Skeleton className="h-3 w-full" /> {/* Description */}
          <Skeleton className="h-2 w-full rounded-full" /> {/* Progress bar */}
        </div>
      </Card>
    ))}
  </div>
);
```

**Usage**:
```tsx
{isLoading && <DeckGridSkeleton />}
{!isLoading && <DecksGrid decks={decks} />}
```

---

### Spinner Loading Pattern

Use spinners for inline loading states and buttons.

**Page Loader** (from ProtectedRoute.tsx):
```tsx
import { Loader2 } from 'lucide-react';

<div className="flex min-h-screen items-center justify-center">
  <div className="space-y-4 text-center">
    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
    <p className="text-muted-foreground">Checking authentication...</p>
  </div>
</div>
```

**Button Loading State**:
```tsx
<Button disabled={loading}>
  {loading ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Loading...
    </>
  ) : (
    'Submit'
  )}
</Button>
```

---

### Error State Pattern

Show clear error messages with recovery options.

**Page Error** (from DecksPage.tsx):
```tsx
import { AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

{error && (
  <Card className="mb-6 border-red-200 bg-red-50 p-4">
    <div className="flex items-start gap-3">
      <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
      <div className="flex-1">
        <h3 className="font-medium text-red-900">Error Loading Decks</h3>
        <p className="mt-1 text-sm text-red-700">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            clearError();
            fetchDecks();
          }}
          className="mt-3 border-red-300 text-red-700 hover:bg-red-100"
        >
          Try Again
        </Button>
      </div>
    </div>
  </Card>
)}
```

**Error State Structure**:
- Icon (AlertCircle) for visual indicator
- Error title (font-medium)
- Error message (text-sm)
- Recovery action button (Try Again)
- Color coding: red border, red background, red text

---

### Empty State Pattern

Show helpful empty states when no data is available.

**Pattern**:
```tsx
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
      <BookOpen className="h-16 w-16 text-muted/50 mb-4" />
      <h3 className="text-lg font-semibold mb-2">No decks found</h3>
      <p className="text-muted max-w-sm mb-6">
        No decks match your current filters. Try adjusting your search criteria.
      </p>
      <Button onClick={clearFilters}>
        Clear Filters
      </Button>
    </div>
  );
}
```

**Empty State Structure**:
1. Icon (large, muted color)
2. Title (text-lg, font-semibold)
3. Description (text-muted, max-w-sm)
4. Action button (optional)

---

### When to Use

- **Skeleton Loading**: Initial page load, content placeholders
- **Spinner Loading**: Button actions, inline data fetching, auth checks
- **Error State**: Failed data loading, network errors
- **Empty State**: No data available, no search results

### Accessibility Considerations

- Loading states announced to screen readers (aria-live="polite")
- Error messages have role="alert"
- Focus management during loading transitions
- Retry buttons keyboard accessible
- Clear, actionable error messages

### Related Components

- Skeleton: `@/components/ui/skeleton`
- Loader2: `lucide-react`
- DecksPage: `/src/pages/DecksPage.tsx`
- ProtectedRoute: `/src/components/auth/ProtectedRoute.tsx`

---
