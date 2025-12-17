# Deck Management Components Reference

Deck creation, editing, and management components.

[← Back to Main Components Reference](../Components-Reference.md)

---

## Deck Management Components (8)

**Purpose**: Components for displaying, filtering, and managing Greek language learning decks with progress tracking and premium features.

**Location**: `/src/components/decks/`

---

### 1. DeckCard

**Purpose**: Main card component for displaying deck information, progress, level, and premium status with Greek typography.

**File**: `/src/components/decks/DeckCard.tsx`

**Interface**:
```typescript
interface DeckCardProps {
  deck: Deck;                    // Complete deck object with metadata and progress
  onClick?: () => void;          // Handler for deck selection/navigation
  showProgress?: boolean;        // Display progress bar (default: true)
  variant?: 'grid' | 'list';    // Display mode (default: 'grid')
  showStats?: boolean;           // Display stats row (default: true)
}
```

**Usage**:
```tsx
import { DeckCard } from '@/components/decks';
import { MOCK_DECKS } from '@/services/mockDeckData';

// Grid variant (default)
<DeckCard
  deck={MOCK_DECKS[0]} // Βασικές Λέξεις A1 deck
  onClick={() => navigate(`/decks/${MOCK_DECKS[0].id}`)}
  showProgress={true}
  showStats={true}
/>

// List variant with locked premium deck
<DeckCard
  deck={MOCK_DECKS[3]} // Premium locked deck
  variant="list"
  showProgress={false}
/>
```

**Features**:
- Greek title displayed prominently (1rem, font-semibold)
- English subtitle below Greek title (0.875rem, gray-500)
- Tier-based color-coded level badge (A1/A2: green, B1/B2: blue, C1/C2: red)
- Premium indicator with lock icon for locked decks
- Segmented progress bar showing new/learning/mastered cards
- Stats grid with card count, estimated time, mastery percentage
- Gold border on hover for premium unlocked decks
- 70% opacity for locked premium decks
- Keyboard accessible (Enter/Space to activate)
- Responsive design (mobile: full width, tablet: 2-col, desktop: 3-col grid)

**Props**:
| Name | Type | Default | Description |
|------|------|---------|-------------|
| deck | Deck | required | Complete deck object including progress data |
| onClick | () => void | undefined | Handler called when card is clicked (disabled if locked) |
| showProgress | boolean | true | Whether to display progress bar and completion percentage |
| variant | 'grid' \| 'list' | 'grid' | Display mode for different layouts |
| showStats | boolean | true | Whether to display stats row (cards/time/mastery) |

**Variants**:
- **Grid** (default): Vertical layout optimized for card grids, compact stats
- **List**: Horizontal layout with inline content, better for list views

**Responsive Behavior**:
- **Mobile (< 768px)**: Full width, stats stacked vertically
- **Tablet (768-1024px)**: Fits 2-column grid, condensed spacing
- **Desktop (≥ 1024px)**: Fits 3-column grid, full spacing

---

### 2. DeckProgressBar

**Purpose**: Segmented progress bar visualization showing new, learning, and mastered card distribution.

**File**: `/src/components/decks/DeckProgressBar.tsx`

**Interface**:
```typescript
interface DeckProgressBarProps {
  progress: DeckProgress;        // Progress data with card counts
  size?: 'default' | 'large';   // Bar height variant (8px or 12px)
  showLegend?: boolean;          // Display legend with color indicators (default: false)
  className?: string;            // Additional CSS classes
}
```

**Usage**:
```tsx
import { DeckProgressBar } from '@/components/decks';

// Default size with legend
<DeckProgressBar
  progress={{
    cardsNew: 50,
    cardsLearning: 30,
    cardsMastered: 20,
    cardsTotal: 100,
    deckId: 'deck-1',
    status: 'in-progress',
    cardsReview: 0,
    dueToday: 10,
    streak: 5,
    totalTimeSpent: 100,
    accuracy: 80
  }}
  showLegend={true}
/>

// Large size without legend
<DeckProgressBar
  progress={deck.progress}
  size="large"
  showLegend={false}
  className="mb-4"
/>
```

**Features**:
- Three color-coded segments (new: gray-200, learning: blue-500, mastered: green-500)
- Dynamic width calculation based on card distribution
- Two size variants (8px default, 12px large)
- Optional legend with color indicators and card counts
- Fully rounded borders (border-radius: 9999px)
- ARIA progressbar role with semantic labels
- Handles edge case of zero total cards

**Props**:
| Name | Type | Default | Description |
|------|------|---------|-------------|
| progress | DeckProgress | required | Object containing cardsNew, cardsLearning, cardsMastered counts |
| size | 'default' \| 'large' | 'default' | Height of progress bar (default: 8px, large: 12px) |
| showLegend | boolean | false | Whether to display legend with color indicators below bar |
| className | string | '' | Additional Tailwind CSS classes for container |

**Color Specifications**:
- **New Cards**: #e5e7eb (gray-200) - Cards not yet studied
- **Learning Cards**: #3b82f6 (blue-500) - Cards currently being learned
- **Mastered Cards**: #10b981 (green-500) - Cards fully mastered

---

### 3. DeckBadge

**Purpose**: Small badge component for displaying deck level (A1-B2) or status with color coding.

**File**: `/src/components/decks/DeckBadge.tsx`

**Interface**:
```typescript
interface DeckBadgeProps {
  type: 'level' | 'status';     // Badge type
  level?: DeckLevel;             // Required if type='level' (A1, A2, B1, B2)
  status?: DeckStatus;           // Required if type='status' (not-started, in-progress, completed)
  className?: string;            // Additional CSS classes
}
```

**Usage**:
```tsx
import { DeckBadge } from '@/components/decks';

// Level badges
<DeckBadge type="level" level="A1" />
<DeckBadge type="level" level="B2" />

// Status badges
<DeckBadge type="status" status="in-progress" />
<DeckBadge type="status" status="completed" />
```

**Features**:
- Color-coded level badges matching CEFR standards
- Status badges for tracking deck completion
- Compact design (text-xs, minimal padding)
- ARIA labels for accessibility
- Type-safe with TypeScript enums
- Returns null for invalid prop combinations

**Props**:
| Name | Type | Default | Description |
|------|------|---------|-------------|
| type | 'level' \| 'status' | required | Type of badge to display |
| level | DeckLevel | undefined | Level value (A1, A2, B1, B2) - required if type='level' |
| status | DeckStatus | undefined | Status value (not-started, in-progress, completed) - required if type='status' |
| className | string | '' | Additional Tailwind CSS classes |

**Level Badge Colors** (Tier-based):
- **A1, A2 (Beginner)**: Green (`bg-green-700`), white text
- **B1, B2 (Intermediate)**: Blue (`bg-blue-700`), white text
- **C1, C2 (Advanced)**: Red (`bg-red-700`), white text

**Note**: Colors are managed centrally via `/src/lib/cefrColors.ts` for consistency across the application.

**Status Badge Colors**:
- **Not Started**: Gray background, dark gray text
- **In Progress**: Light blue background, blue text
- **Completed**: Light green background, green text

---

### 4. DecksGrid

**Purpose**: Responsive grid container for displaying deck cards in 1/2/3 column layout based on viewport width.

**File**: `/src/components/decks/DecksGrid.tsx`

**Interface**:
```typescript
interface DecksGridProps {
  decks: Deck[];                    // Array of decks to display
  onDeckClick?: (deckId: string) => void;  // Optional click handler (defaults to navigation)
}
```

**Usage**:
```tsx
import { DecksGrid } from '@/components/decks';
import { useDeckStore } from '@/stores/deckStore';

const { decks } = useDeckStore();

<DecksGrid decks={decks} />

// With custom click handler
<DecksGrid
  decks={decks}
  onDeckClick={(deckId) => console.log('Clicked:', deckId)}
/>
```

**Features**:
- Responsive grid layout (1 col mobile, 2 col tablet, 3 col desktop)
- 16px gap between cards (gap-4)
- ARIA list/listitem roles for accessibility
- Keyboard navigation via DeckCard components
- Default behavior: navigate to `/decks/:deckId`
- Optional custom click handler via props
- Empty array renders nothing (no errors)

**Props**:
| Name | Type | Default | Description |
|------|------|---------|-------------|
| decks | Deck[] | required | Array of deck objects to display in grid |
| onDeckClick | (deckId: string) => void | undefined | Optional click handler. If not provided, navigates to deck detail page. |

**Responsive Behavior**:
- **Mobile (< 768px)**: 1 column, full width cards
- **Tablet (768-1024px)**: 2 columns, equal width
- **Desktop (≥ 1024px)**: 3 columns, equal width
- Uses Tailwind classes: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`

---

### 5. DeckFilters

**Purpose**: Filter and search UI for deck browsing - includes search input, level toggles, status filters, and premium filter.

**File**: `/src/components/decks/DeckFilters.tsx`

**Interface**:
```typescript
interface DeckFiltersProps {
  filters: DeckFilters;             // Current filter state
  onChange: (filters: Partial<DeckFilters>) => void;  // Partial filter update handler
  onClear: () => void;               // Reset all filters handler
  totalDecks: number;                // Total available decks (before filtering)
  filteredDecks: number;             // Count of decks after filtering
}
```

**Usage**:
```tsx
import { DeckFilters } from '@/components/decks';
import { useDeckStore } from '@/stores/deckStore';

const { filters, setFilters, clearFilters, decks } = useDeckStore();

<DeckFilters
  filters={filters}
  onChange={setFilters}
  onClear={clearFilters}
  totalDecks={6}
  filteredDecks={decks.length}
/>
```

**Features**:
- **Search Input**: Debounced search (300ms delay) with clear button
- **Level Filter**: 4 toggles (A1, A2, B1, B2) with level badge colors
- **Status Filter**: 3 toggles (Not Started, In Progress, Completed)
- **Premium Filter**: Single toggle for premium-only decks (amber color)
- **Clear All Button**: Resets all filters, shows active filter count
- **Results Counter**: "Showing X of Y decks" for user feedback
- **Responsive Layout**: Wraps filter buttons on mobile
- **ARIA States**: aria-pressed for toggle buttons

**Props**:
| Name | Type | Default | Description |
|------|------|---------|-------------|
| filters | DeckFilters | required | Current active filter state from store |
| onChange | (filters: Partial<DeckFilters>) => void | required | Handler to update filters (partial updates) |
| onClear | () => void | required | Handler to reset all filters to defaults |
| totalDecks | number | required | Total count of decks before any filtering |
| filteredDecks | number | required | Count of decks after current filters applied |

**Filter Options**:
- **search**: string (debounced 300ms)
- **levels**: DeckLevel[] (A1, A2, B1, B2)
- **status**: DeckStatus[] (not-started, in-progress, completed)
- **showPremiumOnly**: boolean (true/false)

**Level Filter Button Colors** (Tier-based):
- **A1, A2 (Beginner)**: Green (`bg-green-500`)
- **B1, B2 (Intermediate)**: Blue (`bg-blue-500`)
- **C1, C2 (Advanced)**: Red (`bg-red-500`)

**Note**: Colors are managed centrally via `/src/lib/cefrColors.ts` for consistency across the application.

**Debounce Behavior**:
- Search input has 300ms debounce delay
- No API calls until user stops typing for 300ms
- Prevents excessive re-renders during typing
- Uses debounce utility from `/src/lib/utils.ts`

**Responsive Behavior**:
- **Mobile**: Filter buttons wrap vertically, search full width
- **Desktop**: Filters displayed in horizontal rows
- Uses Tailwind `flex-wrap` for responsive wrapping

---

---

### 6. DeckDetailPage

**Purpose**: Main detail page for displaying comprehensive information about a single deck, including title, description, progress, statistics, and learning actions.

**Location**: `src/pages/DeckDetailPage.tsx`

**Route**: `/decks/:id`

**Interface**:
```typescript
// No props - uses route params and store
// URL Parameter: :id (deck ID)

// Internal Sub-components:
interface DeckHeaderSectionProps {
  deck: Deck;
  isPremiumLocked: boolean;
}

interface StatisticsSectionProps {
  deck: Deck;
}

interface ActionButtonsSectionProps {
  deck: Deck;
  isPremiumLocked: boolean;
  deckStatus: DeckStatus;
  onStartLearning: () => void;
  onContinue: () => void;
  onUpgrade: () => void;
}
```

**Usage**:
```tsx
// Accessed via React Router
<Route path="decks/:id" element={<DeckDetailPage />} />

// Navigation from DecksPage
navigate(`/decks/${deckId}`);

// Link from DeckCard
<Link to={`/decks/${deck.id}`}>View Details</Link>
```

**Features**:
- Greek typography hierarchy (titleGreek primary, title secondary)
- Premium access validation with upgrade CTA for locked decks
- Context-aware action buttons (Start Learning, Continue, Upgrade)
- Deck status detection (not-started, in-progress, completed)
- Detailed statistics grid (cards, time, mastery, accuracy)
- Card distribution visualization (new/learning/mastered)
- Segmented progress bar with legend
- Breadcrumb navigation (Decks > Deck Name)
- Loading skeleton matching final layout
- Error state with retry functionality
- 404 not found state
- WCAG AA accessibility compliance
- Mobile-first responsive design

**Components Used**:
- `DeckBadge` - Level badge and status badges
- `DeckProgressBar` - Progress visualization
- `Card`, `CardHeader`, `CardTitle`, `CardContent` - Layout
- `Button` - Action buttons with gradients
- `Skeleton` - Loading placeholders
- `Alert` - Error messages
- Lucide icons: `ChevronLeft`, `Lock`, `BookOpen`, `Clock`, `Target`, `TrendingUp`, `AlertCircle`

**State Management**:
- `useDeckStore().selectDeck(deckId)` - Fetch deck by ID
- `useDeckStore().selectedDeck` - Current deck
- `useDeckStore().isLoading` - Loading state
- `useDeckStore().error` - Error message
- `useDeckStore().startLearning(deckId)` - Initialize learning
- `useAuthStore().user.role` - Premium access check

**Action Buttons Logic**:
| Deck State | User Type | Button Text | Color | Handler |
|------------|-----------|-------------|-------|---------|
| Premium deck | Free user | "Upgrade to Premium" | Amber gradient | Navigate to `/upgrade` |
| Not started | Any | "Start Learning" | Blue-Purple gradient | Call `startLearning()`, navigate to `/learn/:id` |
| In progress | Any | "Continue Learning" | Green gradient | Navigate to `/learn/:id` |
| Completed | Any | "Review Deck" | Purple-Pink gradient | Navigate to `/learn/:id` |

**Responsive Behavior**:
- **Mobile (< 768px)**: Single column, stacked statistics (2-col grid)
- **Tablet (768-1024px)**: Moderate spacing, 4-col stats grid
- **Desktop (≥ 1024px)**: Max-width 896px (4xl), full spacing

**Accessibility**:
- Breadcrumb navigation with `aria-label="Breadcrumb"`
- Heading hierarchy (h1 for title, h3 for section titles)
- ARIA labels for icons (`aria-label="Premium locked"`)
- Keyboard navigation support (focus states on buttons)
- Screen reader announcements for loading/error states
- Color contrast meeting WCAG AA (all text on backgrounds)

**Error Handling**:
- Loading skeleton during fetch
- Error state with retry button
- 404 not found for invalid deck IDs
- Premium access blocking with upgrade CTA

**Greek Typography Pattern**:
- Primary: `titleGreek` - 2xl/3xl, font-semibold, gray-900
- Secondary: `title` - base/lg, gray-600
- Always Greek first, English subtitle below

---

*Note: 2 additional Deck Management Components will be documented in future tasks: DeckStats, DeckProgress*

---
