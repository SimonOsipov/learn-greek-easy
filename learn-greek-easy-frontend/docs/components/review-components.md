# Review Components Reference

Flashcard review, grammar, and learning session components.

[← Back to Main Components Reference](../Components-Reference.md)

---

## Flashcard Review Components (17)

**Purpose**: Components for the interactive flashcard review experience with Greek typography, grammar displays, rating system, keyboard shortcuts, accessibility features, and premium feature gating.

**Location**: `/src/components/review/`

---

### 1. FlashcardReviewPage

**Purpose**: Main page component for flashcard review sessions with full-screen experience.

**File**: `/src/pages/FlashcardReviewPage.tsx`

**Route**: `/decks/:deckId/review`

**Interface**:
```typescript
// No props - uses route params
// URL Parameter: :deckId (deck ID to review)
```

**Usage**:
```tsx
// Accessed via React Router
<Route path="decks/:deckId/review" element={<FlashcardReviewPage />} />

// Navigation from deck page
navigate(`/decks/${deckId}/review`);
```

**Features**:
- Auto-starts review session on mount
- Keyboard shortcuts enabled (Space, 1-4)
- Loading skeleton during session initialization
- Error state with retry functionality
- No cards due state with back navigation
- Exit review button
- Full-screen gradient background
- Integration with reviewStore

---

### 2. FlashcardContainer

**Purpose**: Main card container managing flip state, tense selection, and rendering all card sections.

**File**: `/src/components/review/FlashcardContainer.tsx`

**Interface**:
```typescript
interface FlashcardContainerProps {
  card: CardReview;
}
```

**Features**:
- White card with rounded corners and shadow
- Hover animation (translateY -4px)
- Manages tense selection state for verbs
- Resets tense on card change
- Conditional rendering of noun/verb grammar
- Min-height 800px
- Max-width 896px (4xl)

---

### 3. ProgressHeader

**Purpose**: Display session progress bar and time estimate.

**File**: `/src/components/review/ProgressHeader.tsx`

**Features**:
- Gradient progress bar (purple)
- Card count (X of Y)
- Estimated time remaining
- Gray background header

---

### 4. CardMain

**Purpose**: Main clickable card area with Greek word, pronunciation, translation, and badges.

**File**: `/src/components/review/CardMain.tsx`

**Features**:
- Click anywhere to flip
- Keyboard accessible (Enter/Space)
- Greek word (48px, bold)
- Pronunciation (18px, italic)
- Word type badge
- Level badge
- Translation reveal on flip
- "Click to reveal" hint

---

### 5. RatingButtons

**Purpose**: Four-button rating panel (Again, Hard, Good, Easy).

**File**: `/src/components/review/RatingButtons.tsx`

**Features**:
- Four color-coded buttons
- Disabled until card flipped
- Hover animations
- Keyboard shortcuts (1-4)
- Visual feedback on click
- Max-width 120px per button

**Button Colors**:
- Again: Red (bg-red-500)
- Hard: Orange (bg-orange-500)
- Good: Green (bg-green-500)
- Easy: Dark Green (bg-green-700)

---

### 6. GreekWord

**Purpose**: Display Greek word with pronunciation.

**File**: `/src/components/review/shared/GreekWord.tsx`

**Interface**:
```typescript
interface GreekWordProps {
  word: string;
  pronunciation: string;
}
```

---

### 7. Translation

**Purpose**: Translation text with fade-in animation.

**File**: `/src/components/review/shared/Translation.tsx`

**Features**:
- Opacity transition (0 to 1)
- Top border when visible
- 32px font size
- Gray-600 color

---

### 8. WordTypeBadge

**Purpose**: Badge showing word type and metadata (noun gender, verb voice).

**File**: `/src/components/review/shared/WordTypeBadge.tsx`

**Features**:
- Noun: Blue background
- Verb: Purple background
- Shows gender for nouns
- Shows voice for verbs

---

### 9. LevelBadge

**Purpose**: CEFR level badge (A1, A2, B1, B2).

**File**: `/src/components/review/shared/LevelBadge.tsx`

**Colors**:
- A1: Green
- A2: Blue
- B1: Orange
- B2: Purple

---

### 10. PremiumGate

**Purpose**: Wrapper for premium content with blur effect and badge.

**File**: `/src/components/review/shared/PremiumGate.tsx`

**Interface**:
```typescript
interface PremiumGateProps {
  isLocked: boolean;
  badgeText?: string;
  children: React.ReactNode;
}
```

**Features**:
- Blur effect when locked
- Amber "Pro" badge overlay
- No effect when unlocked

---

### 11. NounGrammarSection

**Purpose**: Display noun cases table with premium gating.

**File**: `/src/components/review/grammar/NounGrammarSection.tsx`

**Features**:
- 4 rows (singular, plural, genitive singular, genitive plural)
- Premium gated
- Section header with emoji

---

### 12. VerbGrammarSection

**Purpose**: Display verb conjugation table with tense tabs.

**File**: `/src/components/review/grammar/VerbGrammarSection.tsx`

**Features**:
- 6 rows (all persons)
- Tense tabs (Present/Past/Future)
- Premium gated
- Tabs disabled for free users

---

### 13. ConjugationTable

**Purpose**: 6-row table for verb conjugations.

**File**: `/src/components/review/grammar/ConjugationTable.tsx`

**Features**:
- 3 columns (person, Greek, English)
- Gray background for person column
- Center-aligned cells

---

### 14. CasesTable

**Purpose**: 4-row table for noun cases.

**File**: `/src/components/review/grammar/CasesTable.tsx`

**Features**:
- 2 columns (case name, Greek form)
- Consistent styling with ConjugationTable

---

### 15. ExampleSection

**Purpose**: Display example sentence with translation reveal.

**File**: `/src/components/review/shared/ExampleSection.tsx`

**Features**:
- Premium gated
- Greek sentence bold
- English translation hidden until flip
- Left border accent

---

### 16. SessionSummary

**Purpose**: Display comprehensive post-session statistics with performance metrics, rating breakdown, and progress visualization.

**File**: `/src/components/review/SessionSummary.tsx`

**Interface**:
```typescript
interface SessionSummaryProps {
  summary: SessionSummary;
  onBackToDeck: () => void;
  onReviewAgain: () => void;
  onDashboard: () => void;
}
```

**Usage**:
```tsx
import { SessionSummary } from '@/components/review/SessionSummary';
import { useReviewStore } from '@/stores/reviewStore';

const { sessionSummary } = useReviewStore();

<SessionSummary
  summary={sessionSummary}
  onBackToDeck={() => navigate(`/decks/${deckId}`)}
  onReviewAgain={() => navigate(`/decks/${deckId}/review`)}
  onDashboard={() => navigate('/dashboard')}
/>
```

**Features**:
- Performance-based encouraging messages (6 tiers: 100%, 90%+, 70%+, 50%+, 0%, default)
- Key metrics grid: Cards Reviewed, Accuracy %, Time Spent, Avg Per Card
- Color-coded accuracy indicator (green ≥70%, orange 50-69%, red <50%)
- Rating breakdown with percentages (Again/Hard/Good/Easy)
- State transition visualization (new→learning→mastered)
- Conditional rendering (hides transitions if none occurred)
- Edge case handling (0 cards, 100% accuracy, 0% accuracy)
- Responsive layout (2x2 grid on mobile, 1x4 on desktop)
- Action buttons: Back to Deck (primary), Review Again (secondary), Dashboard (tertiary)

**Sections**:
1. **Completion Message Card**: Gradient background (blue-50 to purple-50), CheckCircle icon, dynamic encouraging message
2. **Statistics Grid**: 4 cards with icons (Target, TrendingUp, Clock x2) showing key metrics
3. **Rating Breakdown Card**: 4 colored boxes (red, orange, green, blue) with counts and percentages
4. **Progress Transitions Card**: Conditional, shows state changes with emojis (🆕 📚 ✨ 🔄)
5. **Action Buttons**: Responsive row/column layout with gradient primary button

**Utility Functions** (in `@/lib/sessionSummaryUtils`):
- `formatTime(seconds)`: Converts seconds to "5m 32s" format
- `getEncouragingMessage(accuracy, cardsReviewed)`: Returns performance-based message
- `getAccuracyColor(accuracy)`: Returns Tailwind color class based on percentage
- `formatRatingBreakdown(summary)`: Calculates percentages for each rating
- `hasProgressTransitions(summary)`: Checks if any transitions occurred
- `adjustPercentages()`: Ensures rating percentages sum to 100%

**Props**:
| Name | Type | Description |
|------|------|-------------|
| summary | SessionSummary | Complete session statistics from reviewStore |
| onBackToDeck | () => void | Navigate to deck detail page |
| onReviewAgain | () => void | Start new review session for same deck |
| onDashboard | () => void | Navigate to main dashboard (hidden on mobile) |

**Edge Cases**:
- Zero cards: Shows simplified message with single button
- Perfect score (100%): Special celebration message
- All "again" (0%): Supportive message with encouragement
- Missing summary: SessionSummaryPage handles redirect

**Responsive Behavior**:
- Mobile (< 640px): 2x2 grids, stacked buttons, smaller fonts (text-xl/2xl)
- Desktop (≥ 640px): 1x4 grids, row buttons, larger fonts (text-2xl/3xl)
- Max width: 768px (3xl container)
- Min touch target: 44px for accessibility

**Color Specifications**:
- Background: gray-50
- Completion card: gradient from blue-50 to purple-50, border blue-200
- Again: bg-red-50, text-red-600
- Hard: bg-orange-50, text-orange-600
- Good: bg-green-50, text-green-600
- Easy: bg-blue-50, text-blue-600
- Primary button: gradient from blue-600 to purple-600

**Related Components**:
- [SessionSummaryPage](#sessionsummarypage) - Page wrapper for this component

---

### 17. SessionSummaryPage

**Purpose**: Container page for displaying session summary after review completion.

**File**: `/src/pages/SessionSummaryPage.tsx`

**Route**: `/decks/:deckId/summary`

**Interface**:
```typescript
// No props - uses route params and reviewStore
// URL Parameter: :deckId (deck ID)
```

**Usage**:
```tsx
// Accessed via React Router
<Route path="/decks/:deckId/summary" element={<SessionSummaryPage />} />

// Navigation after session ends
navigate(`/decks/${deckId}/summary`);
```

**Features**:
- Auto-redirect if no session summary available
- Loading skeleton while redirect processing
- Cleanup summary on unmount
- Error handling for missing deckId
- Integration with reviewStore
- Full-screen gray background (bg-gray-50)
- Responsive container (px-4 padding)
- Padding top/bottom: 8 (mobile) to 12 (desktop)

**State Management**:
- Reads `reviewStore.sessionSummary`
- Calls `reviewStore.clearSessionSummary()` on unmount
- No local state (all data from store)

**Navigation Handlers**:
- Back to Deck: `/decks/:deckId`
- Review Again: `/decks/:deckId/review`
- Dashboard: `/dashboard`

**Error States**:
- No summary: Redirect to deck detail with console warning
- Invalid deckId: Show error alert with dashboard button

**Lifecycle**:
1. Mount: Check for sessionSummary
2. If no summary: Redirect to deck with replace=true
3. If valid: Render SessionSummary component
4. Unmount: Clear summary from store (prevents stale data)

**Why Clear Summary on Unmount?**
- Prevents stale data on next visit
- Keeps store clean
- Forces fresh session for each review
- Avoids confusion if user navigates back

**Testing**:
- Complete review session, verify navigation
- Direct URL access, verify redirect
- Back button, verify cleanup
- Refresh page, verify redirect (summary cleared)

---

### 18. KeyboardShortcutsHelp

**Purpose**: Modal dialog displaying all keyboard shortcuts with visual kbd elements for accessibility and user guidance.

**File**: `/src/components/review/KeyboardShortcutsHelp.tsx`

**Interface**:
```typescript
interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**Usage**:
```tsx
import { KeyboardShortcutsHelp } from '@/components/review/KeyboardShortcutsHelp';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

const { showHelp, setShowHelp } = useKeyboardShortcuts();

<KeyboardShortcutsHelp open={showHelp} onOpenChange={setShowHelp} />
```

**Features**:
- Shadcn Dialog component with focus trap
- Two sections: Review Actions and Navigation
- Keyboard shortcut badges with kbd styling
- Color-coded section borders (blue for Review, purple for Navigation)
- Helpful tip footer with blue background
- ESC key closes dialog
- Click outside closes dialog

**Keyboard Shortcuts Displayed**:

**Review Actions** (blue border):
- Space: Flip flashcard
- 1: Rate "Again" (show again soon)
- 2: Rate "Hard" (reduced interval)
- 3: Rate "Good" (standard interval)
- 4: Rate "Easy" (longer interval)

**Navigation** (purple border):
- ?: Show/hide keyboard shortcuts
- Esc: Close help or exit review

**Visual Design**:
- Max width: 500px (sm:max-w-[500px])
- Shortcut items: flex justify-between with py-2 spacing
- kbd badges: min-w-[2rem], rounded, border gray-300, bg gray-100, shadow-sm
- Border accents: 2px left border (blue-500 or purple-500)
- Footer tip: rounded-lg, bg-blue-50, text-blue-800, p-3

**Accessibility**:
- Dialog role with proper ARIA attributes (handled by Radix UI)
- Focus trap prevents keyboard navigation outside dialog
- ESC key support for closing
- Descriptive text for all shortcuts
- Screen reader friendly kbd elements

**Props**:
| Name | Type | Description |
|------|------|-------------|
| open | boolean | Controls dialog visibility |
| onOpenChange | (open: boolean) => void | Callback when dialog open state changes |

**State Management**:
- Managed by parent component (FlashcardReviewPage)
- State provided by useKeyboardShortcuts hook
- No internal state

**Related Components**:
- [FlashcardReviewPage](#flashcardreviewpage) - Renders this component
- useKeyboardShortcuts hook - Manages help dialog state

**Integration**:
```tsx
// In FlashcardReviewPage.tsx
const { showHelp, setShowHelp } = useKeyboardShortcuts();

return (
  <div>
    <FlashcardContainer card={currentCard} />
    <KeyboardShortcutsHelp open={showHelp} onOpenChange={setShowHelp} />
  </div>
);
```

**Testing**:
- Press "?" key to open dialog
- Verify focus trap (tab navigation stays within dialog)
- Press ESC to close
- Click outside dialog to close
- Verify all shortcuts are documented

---

