# Page Components Reference

Full page components for the application.

[← Back to Main Components Reference](../Components-Reference.md)

---

## Page Components

Application pages that compose multiple components into complete user experiences. Each page manages routing, state, and layout orchestration.

### Authentication Pages

Authentication pages use `AuthLayout` wrapper and handle user sign-in, registration, and password recovery.

#### Login

**Purpose**: User authentication page with email/password form. Validates credentials and redirects authenticated users to dashboard.

**File**: `/src/pages/auth/Login.tsx`

**Route**: `/login`

**Access**: Public (wrapped in PublicRoute - redirects to dashboard if authenticated)

**Interface**:
```typescript
// Form validation schema
const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Valid email required'),
  password: z.string().min(1, 'Password is required').min(8, 'Min 8 characters'),
  rememberMe: z.boolean().default(false),
});

type LoginFormData = z.infer<typeof loginSchema>;
```

**Features**:
- Email and password input fields with React Hook Form + Zod validation
- Password visibility toggle (Eye/EyeOff icons)
- "Remember me" checkbox
- "Forgot password?" link
- Link to registration page
- Loading state during authentication with spinner
- Form-level error display for failed login attempts
- Return URL handling (redirects to intended page after login)

**State Management**:
- Store: `useAuthStore` (login method, isLoading state)
- Local state: showPassword (boolean), formError (string | null)
- Form state: React Hook Form (errors, isSubmitting)

**Key Components Used**:
- [AuthLayout](#authlayout) - Auth page wrapper
- [Card](#card) - Container for form
- [Input](#input) - Email and password fields
- [Checkbox](#checkbox) - Remember me option
- [Button](#button) - Submit and password toggle
- [Label](#label) - Form field labels

**Usage**:
```tsx
// In route configuration (App.tsx)
import { Login } from '@/pages/auth/Login';

<Route path="/login" element={
  <PublicRoute redirectTo="/dashboard">
    <Login />
  </PublicRoute>
} />
```

**Form Fields**:
| Field | Type | Validation |
|-------|------|------------|
| email | email | Required, valid email format |
| password | password | Required, min 8 characters |
| rememberMe | checkbox | Optional boolean |

**Key Interactions**:
- Submit form → Call `authStore.login(email, password, rememberMe)`
- Success → Redirect to `/dashboard` or saved returnUrl
- Error → Display error message at form level
- "Forgot password?" → Navigate to `/forgot-password`
- "Sign up" link → Navigate to `/register`
- Password toggle → Show/hide password text

**Related Pages**:
- [Register](#register) - Create new account
- [ForgotPassword](#forgotpassword) - Reset password
- [Dashboard](#dashboard) - Redirect destination after login

---

#### Register

**Purpose**: User registration page with comprehensive form validation. Creates new account and auto-logs in user.

**File**: `/src/pages/auth/Register.tsx`

**Route**: `/register`

**Access**: Public (wrapped in PublicRoute)

**Interface**:
```typescript
// Form validation schema with password confirmation
const registerSchema = z
  .object({
    name: z.string().min(1).min(2, 'Min 2 chars').max(50, 'Max 50 chars'),
    email: z.string().min(1, 'Email required').email('Valid email required'),
    password: z.string().min(1).min(8, 'Min 8 characters'),
    confirmPassword: z.string().min(1, 'Confirm password'),
    acceptedTerms: z.boolean().refine((val) => val === true, {
      message: 'You must accept the terms',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;
```

**Features**:
- Full name, email, password, confirm password fields
- Real-time password strength indicator (Weak/Fair/Strong)
- Password visibility toggles for both password fields
- Terms and conditions acceptance checkbox with link
- Form validation with Zod + React Hook Form
- Loading state during registration
- Form-level error display
- Auto-login after successful registration

**State Management**:
- Store: `useAuthStore` (register method, isLoading state)
- Local state: showPassword, showConfirmPassword, formError
- Form state: React Hook Form (errors, isSubmitting)
- Computed: passwordStrength (0-100 based on password complexity)

**Key Components Used**:
- [AuthLayout](#authlayout) - Auth page wrapper
- [Card](#card) - Container for form
- [Input](#input) - Form fields
- [Checkbox](#checkbox) - Terms acceptance
- [Button](#button) - Submit and password toggles
- [Progress](#progress) - Password strength indicator
- [Label](#label) - Form field labels

**Usage**:
```tsx
// In route configuration
import { Register } from '@/pages/auth/Register';

<Route path="/register" element={
  <PublicRoute redirectTo="/dashboard">
    <Register />
  </PublicRoute>
} />
```

**Form Fields**:
| Field | Type | Validation |
|-------|------|------------|
| name | text | Required, 2-50 characters |
| email | email | Required, valid email format |
| password | password | Required, min 8 characters |
| confirmPassword | password | Required, must match password |
| acceptedTerms | checkbox | Required (must be true) |

**Password Strength Calculation**:
- Length >= 8 chars: +25 points
- Length >= 12 chars: +25 points
- Mixed case (A-Z, a-z): +25 points
- Numbers (0-9): +12.5 points
- Special characters: +12.5 points
- Total: 0-100 (Weak < 33, Fair < 66, Strong >= 66)

**Key Interactions**:
- Submit form → Call `authStore.register({ name, email, password, agreeToTerms, ageConfirmation })`
- Success → Navigate to `/dashboard` (user auto-logged in)
- Error → Display error message at form level
- Type password → Update password strength indicator in real-time
- "Sign in" link → Navigate to `/login`
- Terms link → Navigate to `/terms` (in new tab)

**Related Pages**:
- [Login](#login) - Sign in to existing account
- [Dashboard](#dashboard) - Redirect destination after registration

---

#### ForgotPassword

**Purpose**: Password reset request page. Currently a placeholder for Phase 2 implementation.

**File**: `/src/pages/auth/ForgotPassword.tsx`

**Route**: `/forgot-password`

**Access**: Public

**Features**:
- Lock icon with gradient background
- "Coming in Phase 2" message
- Instructions to contact support
- Back to Login button

**State Management**:
- None (static page)

**Key Components Used**:
- [AuthLayout](#authlayout) - Auth page wrapper
- [Card](#card) - Container
- [Button](#button) - Back to login link
- Lock icon (Lucide React)

**Usage**:
```tsx
// In route configuration
import { ForgotPassword } from '@/pages/auth/ForgotPassword';

<Route path="/forgot-password" element={
  <PublicRoute>
    <ForgotPassword />
  </PublicRoute>
} />
```

**Key Interactions**:
- "Back to Login" → Navigate to `/login`

**Related Pages**:
- [Login](#login) - Return to login page

**Implementation Notes**:
- Password reset functionality will be implemented in Phase 2
- Will include email validation, reset token generation, and password update flow

---

### Main Application Pages

Core application pages for deck management, flashcard review, and user dashboard.

#### Dashboard

**Purpose**: Main landing page after login. Displays comprehensive analytics, progress metrics, charts, and activity feed.

**File**: `/src/pages/Dashboard.tsx`

**Route**: `/` or `/dashboard`

**Access**: Protected (requires authentication)

**Interface**:
```typescript
// Date range filter type
type DateRangeType = 'last7' | 'last30' | 'alltime';

// Component uses selectors from analytics store
const dashboardData = useAnalyticsStore(selectDashboardData);
const isLoading = useAnalyticsStore(selectIsLoading);
const error = useAnalyticsStore(selectError);
const dateRange = useAnalyticsStore(selectDateRange);
```

**Features**:
- Welcome section with personalized greeting
- Date range filter (Last 7 Days / Last 30 Days / All Time)
- 5 metric cards (Cards Reviewed, Current Streak, Cards Mastered, Accuracy, Time Studied)
- 4 charts (Progress Line Chart, Accuracy Area Chart, Deck Performance Chart, Stage Distribution Chart)
- 4 analytics widgets (Streak, Word Status, Retention, Time Studied)
- Activity feed with recent review sessions
- Loading skeleton states for all sections
- Error state with retry button
- Empty states for charts with no data

**State Management**:
- Store: `useAuthStore` (user information)
- Store: `useAnalyticsStore` (dashboard data, loading, error, date range)
- Actions: `loadAnalytics(userId)`, `setDateRange(range)`

**Key Components Used**:
- [WelcomeSection](#welcomesection) - Personalized greeting with CTA
- [MetricCard](#metriccard) - 5 top-level metrics
- [ProgressLineChart](#progresslinechart) - Cards reviewed over time
- [AccuracyAreaChart](#accuracyareachart) - Accuracy trend
- [DeckPerformanceChart](#deckperformancechart) - Deck comparison
- [StageDistributionChart](#stagedistributionchart) - Card status breakdown
- [StreakWidget](#streakwidget) - Streak details
- [WordStatusWidget](#wordstatuswidget) - Word progress
- [RetentionWidget](#retentionwidget) - Retention rate
- [TimeStudiedWidget](#timestudiedwidget) - Study time
- [ActivityFeed](#activityfeed) - Recent activity
- [Card](#card), [Skeleton](#skeleton), [Alert](#alert), [Button](#button)

**Usage**:
```tsx
// In route configuration
import { Dashboard } from '@/pages/Dashboard';

<Route path="/" element={
  <ProtectedRoute>
    <AppLayout>
      <Dashboard />
    </AppLayout>
  </ProtectedRoute>
} />
```

**Layout Sections**:
1. **Welcome Section**: Greeting, due count, streak, start review button
2. **Date Range Filter**: 3 buttons to toggle analytics timeframe
3. **Top Metrics**: 5 metric cards in responsive grid
4. **Progress Analytics**: 4 charts in 2-column grid
5. **Key Metrics**: 4 analytics widgets in responsive grid
6. **Recent Activity**: Activity feed with max 10 items

**Responsive Behavior**:
- Mobile: Single column, stacked sections
- Tablet: 2-column grid for metrics and widgets
- Desktop: 3-5 columns for metrics, 2 columns for charts

**Key Interactions**:
- Click date range filter → Update analytics data for selected timeframe
- Click "Start Review" in WelcomeSection → Navigate to `/review`
- Click "View all" in Activity Feed → Navigate to `/history`
- Click "Retry" in error state → Reload analytics data
- Load dashboard → Fetch analytics for current user

**Related Pages**:
- [FlashcardReviewPage](#flashcardreviewpage) - Start review session
- [DecksPage](#deckspage) - Browse decks

**Store Integration**:
- `useAuthStore`: Get user ID for analytics queries
- `useAnalyticsStore`: Full dashboard data, loading states, error handling, date range filtering

---

#### DecksPage

**Purpose**: Browse and filter available Greek vocabulary decks. Grid view with search and category filters.

**File**: `/src/pages/DecksPage.tsx`

**Route**: `/decks`

**Access**: Protected (requires authentication)

**Features**:
- Page header with title and description
- Deck filters (search, category, level, premium toggle)
- Responsive grid layout (1-3 columns based on screen size)
- Loading skeleton (6 deck cards)
- Error state with retry button
- Empty state when no decks match filters
- Clear filters button in empty state
- Auto-refresh on navigation back from detail page

**State Management**:
- Store: `useDeckStore` (decks, filters, isLoading, error)
- Actions: `fetchDecks()`, `setFilters(filters)`, `clearFilters()`, `clearError()`
- React Router: location.key to detect navigation changes

**Key Components Used**:
- [DeckFilters](#deckfilters) - Filter controls
- [DecksGrid](#decksgrid) - Grid of deck cards
- [Card](#card) - Error and empty state containers
- [Skeleton](#skeleton) - Loading state
- [Button](#button) - Retry and clear filters
- AlertCircle, BookOpen icons (Lucide React)

**Usage**:
```tsx
// In route configuration
import { DecksPage } from '@/pages/DecksPage';

<Route path="/decks" element={
  <ProtectedRoute>
    <AppLayout>
      <DecksPage />
    </AppLayout>
  </ProtectedRoute>
} />
```

**Layout Structure**:
```
Container
├── Page Header (title, description)
├── DeckFilters (search, category, level, premium)
├── Error State (if error)
├── Loading Skeleton (if loading)
├── DecksGrid (if success and decks > 0)
└── Empty State (if success and decks === 0)
```

**Key Interactions**:
- Change filters → Update deck list dynamically
- Click deck card → Navigate to `/decks/:deckId`
- Click "Try Again" in error → Clear error and re-fetch decks
- Click "Clear All Filters" in empty state → Reset filters and show all decks
- Navigate back from detail page → Re-fetch decks (location.key dependency)

**Related Pages**:
- [DeckDetailPage](#deckdetailpage) - View individual deck
- [FlashcardReviewPage](#flashcardreviewpage) - Start review from deck

**Store Integration**:
- `useDeckStore`: Deck list, filter state, loading and error states
- Fetches decks on mount and when navigating back

---

#### DeckDetailPage

**Purpose**: Individual deck view showing statistics, progress, and action buttons to start or continue learning.

**File**: `/src/pages/DeckDetailPage.tsx`

**Route**: `/decks/:id`

**Access**: Protected (requires authentication)

**Interface**:
```typescript
// Route params
interface DeckDetailPageParams {
  id: string; // Deck ID from URL
}

// Deck status determines which CTA to show
type DeckStatus = 'not-started' | 'in-progress' | 'completed';
```

**Features**:
- Breadcrumb navigation (Decks > Current Deck)
- Deck header with Greek/English titles, level badge, premium badge
- Progress bar (if deck started)
- Deck statistics (total cards, estimated time, due today, mastery rate)
- Card distribution chart (New, Learning, Mastered)
- Action buttons based on deck status
- Premium lock screen for locked decks
- Reset progress option (dropdown menu)
- Loading skeleton
- Error and not found states
- Last reviewed date

**State Management**:
- Store: `useDeckStore` (selectedDeck, isLoading, error)
- Store: `useAuthStore` (user role for premium check)
- Actions: `selectDeck(id)`, `clearSelection()`, `startLearning(id)`, `resetProgress(id)`, `reviewSession(id, cards, correct, time)`
- Local state: isResetting (boolean)

**Key Components Used**:
- [DeckBadge](#deckbadge) - Level and category badges
- [DeckProgressBar](#deckprogressbar) - Visual progress indicator
- [Card](#card) - Section containers
- [Button](#button) - Action buttons
- [DropdownMenu](#dropdownmenu) - Reset progress option
- [Skeleton](#skeleton) - Loading state
- [Alert](#alert) - Error state
- ChevronLeft, Lock, BookOpen, Clock, Target, TrendingUp, AlertCircle, MoreVertical, RotateCcw icons

**Usage**:
```tsx
// In route configuration
import { DeckDetailPage } from '@/pages/DeckDetailPage';

<Route path="/decks/:id" element={
  <ProtectedRoute>
    <AppLayout>
      <DeckDetailPage />
    </AppLayout>
  </ProtectedRoute>
} />

// Navigation
const navigate = useNavigate();
navigate(`/decks/${deckId}`);
```

**Deck Status Actions**:
| Status | CTA Button | Icon | Action |
|--------|-----------|------|--------|
| not-started | "Start Review" | BookOpen | Navigate to review page |
| in-progress | "Continue Review" | TrendingUp | Navigate to review page |
| completed | "Review Deck" | Target | Navigate to review page |
| premium-locked | "Upgrade to Premium" | Lock | Navigate to upgrade page |

**Statistics Cards**:
1. **Total Cards**: Deck card count + "flashcards" subtext
2. **Estimated Time**: Estimated completion time in minutes
3. **Due Today**: Cards due for review (only if progress exists)
4. **Mastery Rate**: Percentage of cards mastered (only if progress exists)

**Key Interactions**:
- Breadcrumb "Decks" → Navigate to `/decks`
- "Start Review" / "Continue Review" → `startLearning(deckId)` → Navigate to `/decks/:deckId/review`
- "Upgrade to Premium" (if locked) → Navigate to `/upgrade`
- "Reset Progress" → Confirm dialog → `resetProgress(deckId)` → Refresh deck stats
- "Simulate Study Session" (demo button) → `reviewSession(deckId, 10, 8, 15)` → Update progress
- Back button in error → window.history.back()
- "Browse All Decks" in not found → Navigate to `/decks`

**Related Pages**:
- [DecksPage](#deckspage) - Deck listing
- [FlashcardReviewPage](#flashcardreviewpage) - Review session

**Store Integration**:
- `useDeckStore`: Selected deck data, start learning, reset progress, simulate session
- `useAuthStore`: User role to check premium access

**Review Statistics**:
Uses `calculateDeckReviewStats(deckId)` helper to compute:
- Due today count
- Last reviewed date
- Based on localStorage review session data

---

#### FlashcardReviewPage

**Purpose**: Interactive flashcard review session implementing spaced repetition algorithm. Full-screen immersive learning experience.

**File**: `/src/pages/FlashcardReviewPage.tsx`

**Route**: `/decks/:deckId/review`

**Access**: Protected (requires authentication)

**Interface**:
```typescript
// Route params
interface FlashcardReviewPageParams {
  deckId: string;
}

// Review session state from store
interface ReviewState {
  activeSession: ReviewSession | null;
  currentCard: ReviewCard | null;
  isLoading: boolean;
  error: string | null;
  sessionSummary: SessionSummary | null;
}
```

**Features**:
- Full-screen gradient background (purple to blue)
- Exit review button (top-left)
- Current card display with flip animation
- Rating buttons (Again, Hard, Good, Easy) with keyboard shortcuts
- Progress header showing cards remaining
- Keyboard shortcuts help dialog (triggered by "?" key)
- Loading skeleton while fetching cards
- Error state with retry button
- No cards due state
- Auto-navigate to summary on session completion

**State Management**:
- Store: `useReviewStore` (activeSession, currentCard, startSession, isLoading, error, sessionSummary)
- Hook: `useKeyboardShortcuts()` (showHelp, setShowHelp, keyboard event listeners)
- React Router: deckId from URL params

**Key Components Used**:
- [FlashcardContainer](#flashcardcontainer) - Card display and flip logic
- [FlashcardSkeleton](#flashcardskeleton) - Loading state
- [KeyboardShortcutsHelp](#keyboardshortcutshelp) - Shortcut reference dialog
- [Alert](#alert) - Error and no cards states
- [Button](#button) - Exit and retry buttons
- ChevronLeft, AlertCircle icons

**Usage**:
```tsx
// In route configuration
import { FlashcardReviewPage } from '@/pages/FlashcardReviewPage';

<Route path="/decks/:deckId/review" element={
  <ProtectedRoute>
    {/* No AppLayout - fullscreen experience */}
    <FlashcardReviewPage />
  </ProtectedRoute>
} />

// Navigation to start review
const navigate = useNavigate();
navigate(`/decks/${deckId}/review`);
```

**Keyboard Shortcuts**:
| Key | Action | Description |
|-----|--------|-------------|
| Space | Flip card | Reveal answer on back of card |
| 1 | Rate "Again" | Show card again soon (< 1 min) |
| 2 | Rate "Hard" | Reduced interval (< 6 min) |
| 3 | Rate "Good" | Standard interval (< 10 min) |
| 4 | Rate "Easy" | Longer interval (4 days) |
| ? | Show help | Open keyboard shortcuts dialog |
| Esc | Exit review | Return to deck detail page |

**Session Flow**:
1. Mount → `startSession(deckId)` fetches cards due for review
2. Display first card (front side)
3. User flips card → Show answer (back side)
4. User rates card (1-4) → Submit rating to spaced repetition algorithm
5. Load next card → Repeat steps 2-4
6. All cards reviewed → Auto-navigate to `/decks/:deckId/summary`

**Key Interactions**:
- Click "Exit Review" → Navigate to `/decks/:deckId`
- Click "Retry" in error → `startSession(deckId)` again
- Click "Back to Deck" in no cards → Navigate to `/decks/:deckId`
- Session completes → Auto-navigate to summary page after 500ms delay
- Press "?" → Open keyboard shortcuts help
- Press Esc → Exit review (returns to deck)

**Related Pages**:
- [DeckDetailPage](#deckdetailpage) - Return destination
- [SessionSummaryPage](#sessionsummarypage) - Post-review summary (not implemented yet)

**Store Integration**:
- `useReviewStore`: Full review session management, card queue, rating submission, session summary

**Responsive Behavior**:
- Fullscreen on all devices (no AppLayout wrapper)
- Gradient background adapts to screen size
- Flashcard scales responsively
- Exit button stays in top-left corner

---

#### Profile

**Purpose**: User profile management with tabbed sections for personal info, statistics, preferences, and security settings.

**File**: `/src/pages/Profile.tsx`

**Route**: `/profile`

**Access**: Protected (requires authentication)

**Interface**:
```typescript
// Section navigation type
type ProfileSection = 'personal' | 'stats' | 'preferences' | 'security';

// Navigation item configuration
interface NavigationItem {
  id: ProfileSection;
  label: string;
  icon: typeof User; // Lucide React icon type
}
```

**Features**:
- Sidebar with profile header and section navigation
- Mobile toggle for sidebar (hamburger menu)
- 4 sections: Personal Info, Statistics, Preferences, Security
- Quick stats widget in sidebar (streak, words learned, XP)
- Dynamic section rendering based on active tab
- Responsive grid layout (1 column mobile, 3 column desktop)

**State Management**:
- Hook: `useAuth()` (user data)
- Local state: activeSection (ProfileSection), isSidebarOpen (boolean)

**Key Components Used**:
- [ProfileHeader](#profileheader) - Avatar, name, role badge
- [PersonalInfoSection](#personalinfosection) - Edit name, email, avatar
- [StatsSection](#statssection) - Detailed learning statistics
- [PreferencesSection](#preferencessection) - Language, theme, notifications
- [SecuritySection](#securitysection) - Password, 2FA, sessions
- [Card](#card) - Sidebar and main content containers
- [Button](#button) - Mobile toggle
- User, Settings, BarChart3, Shield, Menu, X icons

**Usage**:
```tsx
// In route configuration
import { Profile } from '@/pages/Profile';

<Route path="/profile" element={
  <ProtectedRoute>
    <AppLayout>
      <Profile />
    </AppLayout>
  </ProtectedRoute>
} />
```

**Section Navigation**:
| Section | Icon | Content Component |
|---------|------|-------------------|
| Personal Info | User | PersonalInfoSection (name, email, avatar) |
| Statistics | BarChart3 | StatsSection (learning stats) |
| Preferences | Settings | PreferencesSection (language, theme) |
| Security | Shield | SecuritySection (password, 2FA) |

**Quick Stats (Sidebar)**:
- Streak: Days in a row
- Words Learned: Total word count
- Total XP: Experience points

**Responsive Behavior**:
- **Mobile**: Sidebar hidden by default, toggle with hamburger menu
- **Tablet/Desktop**: Sidebar always visible, 1/3 width
- **Main content**: 2/3 width on desktop, full width on mobile

**Key Interactions**:
- Click section nav item → Switch active section, hide mobile sidebar
- Click mobile menu toggle → Show/hide sidebar
- Each section has its own interactions (edit profile, change password, etc.)

**Related Pages**:
- [Dashboard](#dashboard) - Quick link from profile
- Settings page (if separate from profile)

**Store Integration**:
- `useAuth()` hook provides user data and auth state

---

### Error Pages

Error pages handle 404 Not Found and 401 Unauthorized scenarios with user-friendly messages.

#### NotFound

**Purpose**: 404 error page displayed when user navigates to invalid route. Provides helpful message and navigation back to app.

**File**: `/src/pages/NotFound.tsx`

**Route**: `*` (catch-all route)

**Access**: Public (no authentication required)

**Features**:
- Greek temple emoji (🏛️) icon
- "404" heading
- Greek greeting "Ωχ!" (Oh no!)
- Humorous message about Mount Olympus
- Two action buttons: "Go to Dashboard" and "Go Back"
- Gradient background (blue to purple)
- Centered layout

**State Management**:
- None (static page)

**Key Components Used**:
- [Button](#button) - Navigation buttons
- Home, ArrowLeft icons (Lucide React)
- React Router Link component

**Usage**:
```tsx
// In route configuration (last route - catch-all)
import { NotFound } from '@/pages/NotFound';

<Routes>
  {/* All other routes */}
  <Route path="*" element={<NotFound />} />
</Routes>
```

**Content**:
- **Heading**: "404"
- **Subheading**: "Ωχ! Page Not Found"
- **Message**: "The page you're looking for seems to have wandered off to Mount Olympus. Let's get you back on track!"
- **CTA Buttons**:
  - Primary: "Go to Dashboard" (navigates to `/dashboard`)
  - Secondary: "Go Back" (window.history.back())

**Key Interactions**:
- Click "Go to Dashboard" → Navigate to `/dashboard`
- Click "Go Back" → window.history.back()

**Related Pages**:
- [Unauthorized](#unauthorized) - 401 error page
- [Dashboard](#dashboard) - Primary navigation destination

---

#### Unauthorized

**Purpose**: 401 error page displayed when user lacks permissions for requested resource. Handles both premium and admin restrictions.

**File**: `/src/pages/Unauthorized.tsx`

**Route**: `/unauthorized`

**Access**: Public (but typically redirected to from protected routes)

**Interface**:
```typescript
// Location state passed from protected route
interface UnauthorizedLocationState {
  requiredRole?: 'premium' | 'admin';
}
```

**Features**:
- Dynamic icon based on required role (Crown for premium, Lock for admin)
- Role-specific error message
- "Upgrade to Premium" button (if premium required)
- "Back to Dashboard" button
- Gradient background (blue to purple)
- Centered layout

**State Management**:
- React Router: location.state?.requiredRole (determines message and icon)

**Key Components Used**:
- [Button](#button) - Action buttons
- Lock, Crown icons (Lucide React)
- React Router Link component

**Usage**:
```tsx
// In route configuration
import { Unauthorized } from '@/pages/Unauthorized';

<Route path="/unauthorized" element={<Unauthorized />} />

// Redirect from protected route with state
navigate('/unauthorized', {
  state: { requiredRole: 'premium' }
});
```

**Dynamic Content Based on Role**:
| Required Role | Icon | Message | Primary CTA |
|--------------|------|---------|-------------|
| premium | Crown | "This feature requires Premium subscription. Upgrade to unlock all learning features!" | "Upgrade to Premium" → `/settings?tab=subscription` |
| admin | Lock | "This area is restricted to administrators only." | "Back to Dashboard" |
| undefined | Lock | "You don't have permission to access this page." | "Back to Dashboard" |

**Key Interactions**:
- Click "Upgrade to Premium" (if premium required) → Navigate to `/settings?tab=subscription`
- Click "Back to Dashboard" → Navigate to `/dashboard`

**Related Pages**:
- [NotFound](#notfound) - 404 error page
- [Dashboard](#dashboard) - Navigation destination
- Settings page - Upgrade destination

**Route Protection Integration**:
Used by ProtectedRoute component when user lacks required role:
```tsx
// In ProtectedRoute component
if (user.role !== requiredRole) {
  return <Navigate to="/unauthorized" state={{ requiredRole }} />;
}
```

---

