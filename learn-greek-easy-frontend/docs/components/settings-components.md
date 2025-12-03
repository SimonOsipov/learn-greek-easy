# Settings & Profile Components Reference

User profile, settings, and preferences management components.

[← Back to Main Components Reference](../Components-Reference.md)

---

## Profile Management Components

### Profile

**Purpose**: Main container page for user profile settings and information

**Location**: `src/pages/Profile.tsx`

**Interface**:
```typescript
type ProfileSection = 'personal' | 'stats' | 'preferences' | 'security';

interface NavigationItem {
  id: ProfileSection;
  label: string;
  icon: typeof User;
}
```

**Usage**:
```tsx
import { Profile } from '@/pages/Profile';

// In your router
<Route path="/profile" element={<Profile />} />
```

**Features**:
- Section-based navigation (personal, stats, preferences, security)
- Responsive sidebar with mobile hamburger menu
- State management integration with auth store
- Auto-save functionality for preferences
- Form validation with zod schemas

**Responsive Behavior**:
- Desktop: 3-column grid (1 for sidebar, 2 for content)
- Mobile: Collapsible sidebar with hamburger menu
- Breakpoint: md (768px)

---

### ProfileHeader

**Purpose**: Display user avatar, role badge, and account metadata in profile sidebar

**Location**: `src/components/profile/ProfileHeader.tsx`

**Interface**:
```typescript
interface ProfileHeaderProps {
  user: User;
  onAvatarClick?: () => void;
}
```

**Usage**:
```tsx
import { ProfileHeader } from '@/components/profile/ProfileHeader';

<ProfileHeader
  user={currentUser}
  onAvatarClick={() => handleAvatarUpload()}
/>
```

**Features**:
- Avatar with initials fallback
- Role badges (Admin/Premium/Free) with icons
- Member since date formatting
- Last activity display
- Hover effect on avatar for upload indication
- Gradient background for initials

**Role Badge Variants**:
- Admin: Red badge with Shield icon
- Premium: Purple badge with Crown icon
- Free: Gray secondary badge

---

### PersonalInfoSection

**Purpose**: Form for editing user personal information with validation

**Location**: `src/components/profile/PersonalInfoSection.tsx`

**Interface**:
```typescript
interface PersonalInfoSectionProps {
  user: User;
}

// Form schema
const profileSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens and apostrophes'),
});
```

**Usage**:
```tsx
import { PersonalInfoSection } from '@/components/profile/PersonalInfoSection';

<PersonalInfoSection user={currentUser} />
```

**Features**:
- React Hook Form integration
- Zod schema validation
- Avatar upload placeholder (coming soon)
- Name editing with real-time validation
- Read-only email and account ID display
- Save/Cancel buttons with loading states
- Success/error toast notifications

**Form Fields**:
- Profile Picture (placeholder with upload button)
- Full Name (editable with validation)
- Email Address (read-only)
- Account ID (read-only)

---

### StatsSection

**Purpose**: Display comprehensive learning statistics and achievements

**Location**: `src/components/profile/StatsSection.tsx`

**Interface**:
```typescript
interface StatsSectionProps {
  stats: UserStats;
}

interface UserStats {
  streak: number;
  wordsLearned: number;
  totalXP: number;
  joinedDate: Date;
  lastActivity?: Date;
}
```

**Usage**:
```tsx
import { StatsSection } from '@/components/profile/StatsSection';

<StatsSection stats={user.stats} />
```

**Features**:
- Streak counter with motivational messages
- Words learned with average per day calculation
- XP and level progression system
- Activity timeline (join date, last active)
- Achievement badges grid
- Dynamic progress bars
- Color-coded stat cards

**Stat Cards**:
- Current Streak (Flame icon, orange)
- Words Learned (BookOpen icon, blue)
- Total XP (Trophy icon, yellow)

**Level System**:
- 1000 XP per level
- Visual progress bar to next level
- Current level badge display

**Achievements**:
- First Steps (Complete first deck)
- Week Warrior (7-day streak)
- Century Club (100 words learned)
- Fire Keeper (30-day streak)

---

### PreferencesSection

**Purpose**: Manage learning preferences with auto-save functionality

**Location**: `src/components/profile/PreferencesSection.tsx`

**Interface**:
```typescript
interface PreferencesSectionProps {
  user: User;
}

interface UserPreferences {
  language: 'en' | 'el';
  dailyGoal: number; // minutes per day
  notifications: boolean;
  theme: 'light' | 'dark' | 'auto';
}
```

**Usage**:
```tsx
import { PreferencesSection } from '@/components/profile/PreferencesSection';

<PreferencesSection user={currentUser} />
```

**Features**:
- Auto-save with 1-second debounce
- Language selector with flags
- Daily goal slider (5-120 minutes)
- Notifications toggle switch
- Theme selector (coming soon)
- Real-time saving feedback
- No explicit save button needed

**Preference Cards**:
- Interface Language (Globe icon, blue)
- Daily Goal (Clock icon, green)
- Notifications (Bell icon, purple)
- Theme (Palette icon, gray - coming soon)

**Auto-save Pattern**:
```typescript
const debouncedSaveRef = useRef(
  debounce(async (newPreferences) => {
    await updateProfile({ preferences: newPreferences });
    toast({ title: 'Preferences saved' });
  }, 1000)
);
```

---

### SecuritySection

**Purpose**: Manage password, authentication settings, and account security

**Location**: `src/components/profile/SecuritySection.tsx`

**Interface**:
```typescript
// No props - uses global auth context

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});
```

**Usage**:
```tsx
import { SecuritySection } from '@/components/profile/SecuritySection';

<SecuritySection />
```

**Features**:
- Password change form with validation
- Password strength requirements checklist
- Two-factor authentication (coming soon)
- Active sessions display
- Account deletion with confirmation dialog
- Form validation with zod
- Loading states for async operations

**Security Cards**:
- Change Password (Key icon, blue)
- Two-Factor Authentication (Smartphone icon, green - disabled)
- Active Sessions (Lock icon, purple)
- Danger Zone (AlertTriangle icon, red)

**Delete Account Confirmation**:
- Warning dialog with consequences list
- Type "DELETE" to confirm
- Multiple confirmation steps
- Support contact redirect

---

## Settings Components

Settings page components for account management and user preferences.

### AccountSection

**Purpose**: Account management section displaying email, password change, and subscription information with dialog-based editing forms.

**Location**: `/src/components/settings/AccountSection.tsx`

**Interface**:
```typescript
// No props - uses global auth context from useAuthStore

// Email change form schema
const emailChangeSchema = z.object({
  newEmail: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  currentPassword: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters'),
});

// Password change form schema
const passwordChangeSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, 'Current password is required')
      .min(8, 'Password must be at least 8 characters'),
    newPassword: z
      .string()
      .min(1, 'New password is required')
      .min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
```

**Usage**:
```tsx
import { AccountSection } from '@/components/settings/AccountSection';

// In Settings page
<AccountSection />
```

**Features**:
- Email address display with "Change Email" button
- Email change dialog with password confirmation
- Password change dialog with strength indicator
- Subscription tier badge display (Free/Premium)
- "Upgrade to Premium" button for Free users
- Member since date formatting
- Form validation with Zod schemas
- Loading states during async operations
- Toast notifications for success/error feedback

**Visual Structure**:

1. **Email Address Section**:
   - Mail icon header
   - Read-only email display in muted background card
   - "Change Email" outline button
   - Opens email change dialog on click

2. **Password Section**:
   - Lock icon header
   - Descriptive text about password security
   - "Change Password" outline button
   - Opens password change dialog on click

3. **Subscription Section**:
   - Crown icon header
   - Current plan display with badge:
     - Free: Gray secondary badge ("Free Plan")
     - Premium: Purple gradient badge ("Premium")
   - "Upgrade to Premium" button (Free users only)
   - Member since date with format "MMMM yyyy" (e.g., "January 2025")

**Email Change Dialog**:
```tsx
<Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Change Email Address</DialogTitle>
      <DialogDescription>
        Enter your new email address and confirm with your current password
      </DialogDescription>
    </DialogHeader>

    <form onSubmit={handleEmailSubmit(onEmailChange)}>
      <FormField
        label="New Email"
        name="newEmail"
        type="email"
        // ... field configuration
      />

      <PasswordField
        label="Current Password"
        name="currentPassword"
        // ... field configuration
      />

      <DialogFooter>
        <Button variant="outline">Cancel</Button>
        <SubmitButton loading={isEmailSubmitting}>Update Email</SubmitButton>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

**Password Change Dialog**:
```tsx
<Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Change Password</DialogTitle>
      <DialogDescription>
        Enter your current password and choose a new password
      </DialogDescription>
    </DialogHeader>

    <form onSubmit={handlePasswordSubmit(onPasswordChange)}>
      <PasswordField
        label="Current Password"
        name="currentPassword"
        // ... field configuration
      />

      <PasswordField
        label="New Password"
        name="newPassword"
        showStrength  // Shows password strength indicator
        // ... field configuration
      />

      <PasswordField
        label="Confirm New Password"
        name="confirmPassword"
        // ... field configuration
      />

      <DialogFooter>
        <Button variant="outline">Cancel</Button>
        <SubmitButton loading={isPasswordSubmitting}>Update Password</SubmitButton>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

**Integration**:
- Uses `useAuthStore` for user data and update methods:
  - `user` - Current user object with email, role, createdAt
  - `updateProfile({ email })` - Update email address
  - `updatePassword(currentPassword, newPassword)` - Update password
- Uses `FormField` component for standard text inputs
- Uses `PasswordField` component for password inputs with visibility toggle
- Uses `SubmitButton` component for loading states
- Uses `Dialog` from shadcn/ui for modal forms
- Uses `toast` from shadcn/ui for notifications
- Uses `date-fns` format function for date display

**Subscription Badge Styling**:
- **Free Badge**: `<Badge variant="secondary">Free Plan</Badge>`
  - Gray background
  - Default text color
- **Premium Badge**: `<Badge className="bg-gradient-to-r from-purple-500 to-purple-700 text-white border-0">Premium</Badge>`
  - Purple gradient background (500 → 700)
  - White text
  - No border

**Form Validation Flow**:
1. User fills form fields
2. React Hook Form validates with Zod schema on submit
3. If validation fails, show inline error messages
4. If validation passes, call authStore update method
5. Show toast notification on success/error
6. Close dialog and reset form on success

**Error Handling**:
- Inline field errors from Zod validation
- Toast notifications for API errors
- Loading states disable buttons during async operations
- Dialog remains open on error for user to retry

**Dependencies**:
- `react-hook-form` - Form state management
- `zod` - Schema validation
- `@hookform/resolvers/zod` - Zod resolver for RHF
- `date-fns` - Date formatting
- `lucide-react` - Icons (Mail, Lock, Crown)
- `@/stores/authStore` - User data and update methods
- `@/hooks/use-toast` - Toast notifications
- `@/components/ui/*` - Shadcn components (Card, Badge, Button, Dialog)
- `@/components/forms/*` - Form components (FormField, PasswordField, SubmitButton)

**Responsive Behavior**:
- All dialogs use `sm:max-w-md` for consistent sizing
- Mobile: Stack form fields vertically
- Desktop: Same vertical stack (forms are inherently vertical)
- Dialog footer buttons adapt to mobile width

**Accessibility**:
- All form fields have proper labels
- Error messages linked with aria-describedby
- Invalid inputs marked with aria-invalid
- Submit buttons disabled during loading
- Focus management: First input receives focus on dialog open
- Keyboard navigation: Tab through inputs, Enter to submit, Escape to close

---

### AppPreferencesSection

**Purpose**: App preferences management section providing daily study goal customization with auto-save functionality.

**Location**: `/src/components/settings/AppPreferencesSection.tsx`

**Interface**:
```typescript
// No props - uses global auth context from useAuthStore
```

**Usage**:
```tsx
import { AppPreferencesSection } from '@/components/settings';

// In Settings page
<AppPreferencesSection />
```

**Features**:
- Daily study goal slider (5-100 cards, step 5)
- Live value preview ("{X} cards per day")
- Auto-save with 1-second debounce (no manual save button)
- Success toast notification on save
- Preferences persist in localStorage via authStore
- Saving indicator (spinner) during auto-save

**Visual Structure**:

1. **Daily Study Goal Setting**:
   - Settings icon header
   - Description: "Number of new cards to review each day"
   - Slider component (min: 5, max: 100, step: 5)
   - Value display: "{dailyGoal} cards per day" (live update)
   - Auto-save triggers 1 second after last change

**Auto-Save Pattern**:
```typescript
useEffect(() => {
  if (dailyGoal === user?.preferences?.dailyGoal) {
    return; // Skip save if value unchanged
  }

  const timer = setTimeout(async () => {
    if (!user) return;

    await updateProfile({
      preferences: { ...user.preferences, dailyGoal },
    });
    toast({ title: 'Preferences saved' });
  }, 1000);

  return () => clearTimeout(timer);
}, [dailyGoal, user?.preferences, updateProfile]);
```

**Integration**:
- Uses `useAuthStore` for user data and update method:
  - `user.preferences.dailyGoal` - Current daily goal value (default: 20)
  - `updateProfile({ preferences })` - Update preferences
- Uses `Slider` component from shadcn/ui
- Uses `toast` from shadcn/ui for notifications
- Uses `lucide-react` Settings and Loader2 icons

**Debounce Logic**:
- User adjusts slider → State updates immediately (live preview)
- Timer starts (1000ms)
- If user adjusts again → Timer resets
- After 1 second of inactivity → Auto-save triggers
- Toast notification confirms save

**Error Handling**:
- Try-catch around updateProfile call
- Error toast displays with descriptive message
- Slider value remains at user-selected position (not reverted)

**Dependencies**:
- `@/stores/authStore` - User data and update method
- `@/hooks/use-toast` - Toast notifications
- `@/components/ui/slider` - Slider component (shadcn/ui)
- `@/components/ui/card` - Card container
- `lucide-react` - Settings and Loader2 icons

**Responsive Behavior**:
- Mobile (< 768px): Full-width slider, stacked layout
- Desktop (1024px+): Same layout (slider is inherently responsive)

**Accessibility**:
- Slider has `aria-label="Daily study goal slider"`
- Keyboard navigation: Arrow keys adjust value, Home/End for min/max
- Focus visible on slider thumb
- Value display provides immediate feedback for screen readers

---

### DangerZoneSection

**File**: `/src/components/settings/DangerZoneSection.tsx`

**Purpose**: Container for irreversible destructive actions with strong visual warnings

**Category**: Settings Component

**Interface**:
```typescript
// No props - manages internal dialog state
```

**Features**:
- Red danger-themed card with AlertTriangle icon
- Two destructive action cards: Reset Progress and Delete Account
- Clear warning messages about irreversibility
- Integrates with ResetProgressDialog and DeleteAccountDialog
- Responsive layout with proper spacing
- Light/dark mode red color variants

**Visual Structure**:
- Card with red border (border-red-200 dark:border-red-900)
- Header: AlertTriangle icon + "Danger Zone" title in red
- Description: "Irreversible actions that affect your account and data"
- Two action cards within card content:
  1. Reset Progress card (red-50 background)
  2. Delete Account card (red-50 background)

**Action Cards**:

**Reset Progress Card**:
- Icon: RotateCcw
- Title: "Reset All Progress"
- Description: Clear learning progress while preserving account
- Button: Outline variant with red styling

**Delete Account Card**:
- Icon: Trash2
- Title: "Delete Account"
- Description: Permanently delete account and all data
- Button: Destructive variant (solid red)

**Usage**:
```tsx
import { DangerZoneSection } from '@/components/settings';

<DangerZoneSection />
```

**State Management**:
- Internal useState for dialog visibility
- showResetDialog: Controls ResetProgressDialog visibility
- showDeleteDialog: Controls DeleteAccountDialog visibility

**Styling Details**:
- Card border: `border-red-200 dark:border-red-900`
- Title color: `text-red-600`
- Action cards background: `bg-red-50 dark:bg-red-950`
- Action card borders: `border-red-100/border-red-200 dark:border-red-900`
- Text colors: `text-red-700/900 dark:text-red-100/300/400`
- Button styling: Outline and destructive variants with red theme

**Integration**:
```tsx
// In Settings.tsx
<DangerZoneSection />
```

**Dependencies**:
- Card, CardContent, CardHeader, CardTitle, CardDescription (UI)
- Button (UI)
- AlertTriangle, Trash2, RotateCcw icons (lucide-react)
- ResetProgressDialog (settings)
- DeleteAccountDialog (settings)

**Responsive Behavior**:
- Desktop: Action description and button side-by-side
- Mobile: Stack vertically when needed
- Buttons maintain fixed size

**Accessibility**:
- AlertTriangle icon for visual warning
- Clear danger zone labeling
- Descriptive button text
- Color contrast meets WCAG AA standards

**Security Considerations**:
- Actions require multi-step confirmations (handled by child dialogs)
- Visual warnings before any destructive action
- No accidental clicks due to dialog confirmations

**Used In**:
- Settings page (bottom section)

---

### ResetProgressDialog

**File**: `/src/components/settings/ResetProgressDialog.tsx`

**Purpose**: 2-step confirmation dialog for resetting all learning progress

**Category**: Settings Dialog Component

**Interface**:
```typescript
interface ResetProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**Features**:
- 2-step confirmation flow (warning → type-to-confirm)
- Type "RESET" validation (case-sensitive)
- Back navigation between steps
- Loading state during progress reset
- Success toast notification
- Clears specific localStorage keys
- Page reload after completion
- Lists what will be deleted vs preserved

**Step Flow**:

**Step 1: Warning with Consequences**
- AlertTriangle icon with "Reset All Progress?" title
- List of items that will be deleted:
  - All deck progress and review history
  - All learning statistics and analytics
  - All spaced repetition data
  - Study streaks and achievements
- Green box showing preserved data:
  - "Your account and settings will be preserved"
- Warning: "This action cannot be undone"
- Buttons: Cancel, Continue

**Step 2: Type-to-Confirm**
- Title: "Final Confirmation"
- Instruction: Type "RESET" exactly (case-sensitive)
- Input field with font-mono styling
- Real-time validation feedback
- Error message if text doesn't match
- Loading state with spinner during reset
- Buttons: Back (with ArrowLeft icon), Reset My Progress (disabled until valid)

**State Management**:
```typescript
const [step, setStep] = useState<1 | 2>(1);
const [confirmText, setConfirmText] = useState('');
const [isResetting, setIsResetting] = useState(false);
```

**Data Clearing Logic**:
Removes these localStorage keys:
- `learn-greek-easy:review-data`
- `learn-greek-easy:analytics`
- `learn-greek-easy:deck-progress`

Preserves:
- Account data
- User settings
- Authentication state

**Usage**:
```tsx
import { ResetProgressDialog } from '@/components/settings';

const [showDialog, setShowDialog] = useState(false);

<ResetProgressDialog
  open={showDialog}
  onOpenChange={setShowDialog}
/>
```

**Validation Logic**:
```typescript
const isConfirmValid = confirmText === 'RESET';
// Button disabled until isConfirmValid === true
```

**Success Flow**:
1. User types "RESET" correctly
2. Clicks "Reset My Progress" button
3. Loading state shows (1.5s simulated delay)
4. localStorage keys cleared
5. Success toast appears
6. Dialog closes
7. Page reloads after 1 second

**Error Handling**:
- Try-catch around reset operation
- Error toast if reset fails
- Loading state cleared on error
- User can try again

**Dependencies**:
- Dialog components (UI)
- Input, Label (UI)
- Button (UI)
- AlertTriangle, ArrowLeft, Loader2, Check icons (lucide-react)
- toast from sonner

**Accessibility**:
- Clear step-by-step instructions
- Error messages for invalid input
- Loading states announced
- Keyboard navigation supported
- Focus management in dialog

**Used In**:
- DangerZoneSection (triggered by "Reset Progress" button)

---

### DeleteAccountDialog

**File**: `/src/components/settings/DeleteAccountDialog.tsx`

**Purpose**: 3-step confirmation dialog for permanent account deletion

**Category**: Settings Dialog Component

**Interface**:
```typescript
interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**Features**:
- 3-step confirmation flow (warning → password → acknowledgment)
- Password verification with visibility toggle
- Checkbox acknowledgment requirement
- Back navigation between steps
- Loading state during account deletion
- Complete data clearing (all localStorage)
- Logout and redirect to home
- Error handling for incorrect password

**Step Flow**:

**Step 1: Warning with Consequences**
- AlertTriangle icon with "Delete Account?" title in red
- Comprehensive list of what will be deleted:
  - Your account and all login credentials
  - All learning progress and review history
  - All statistics, analytics, and achievements
  - All deck data and flashcards
  - All settings and preferences
- Strong warning: "This action cannot be undone. All data will be lost permanently."
- Buttons: Cancel, Continue

**Step 2: Password Verification**
- Title: "Verify Your Password"
- Instruction: "Enter your current password to continue"
- Password input field with show/hide toggle
- Eye/EyeOff icon button for visibility
- Error message display for incorrect password
- Validation: Minimum 6 characters (MVP simplified)
- Buttons: Back (with ArrowLeft icon), Verify Password

**Step 3: Final Confirmation**
- Title: "Final Confirmation"
- Question: "Are you absolutely sure you want to delete your account?"
- Warning: "All your data will be permanently deleted and cannot be recovered."
- Checkbox with red danger styling:
  - "I understand this action cannot be undone and all my data will be permanently deleted"
- Error message if checkbox not checked
- Buttons: Back, Delete My Account (disabled until acknowledged)

**State Management**:
```typescript
const [step, setStep] = useState<1 | 2 | 3>(1);
const [password, setPassword] = useState('');
const [showPassword, setShowPassword] = useState(false);
const [acknowledged, setAcknowledged] = useState(false);
const [isDeleting, setIsDeleting] = useState(false);
const [error, setError] = useState<string | null>(null);
```

**Password Verification Logic** (MVP):
```typescript
// For MVP: Accept any password with length >= 6
// TODO: Replace with actual API verification
if (password.length < 6) {
  setError('Please enter your password');
  return;
}
setStep(3); // Move to final confirmation
```

**Deletion Flow**:
1. User completes all 3 steps
2. Clicks "Delete My Account" button
3. Loading state shows (2s simulated delay)
4. All localStorage cleared with `localStorage.clear()`
5. Success toast appears
6. User logged out via `logout()` action
7. Redirected to home page via `navigate('/')`
8. Dialog closes

**Data Clearing Logic**:
```typescript
// Clears ALL localStorage data
localStorage.clear();

// Logs out user
logout();

// Redirects to home
navigate('/');
```

**Error Handling**:
- Password validation errors
- Checkbox validation errors
- API/operation errors with toast
- Loading state cleared on error
- User can go back and retry

**Usage**:
```tsx
import { DeleteAccountDialog } from '@/components/settings';

const [showDialog, setShowDialog] = useState(false);

<DeleteAccountDialog
  open={showDialog}
  onOpenChange={setShowDialog}
/>
```

**Dependencies**:
- Dialog components (UI)
- Input, Label, Checkbox (UI)
- Button (UI)
- AlertTriangle, ArrowLeft, Loader2, Eye, EyeOff icons (lucide-react)
- useAuthStore (stores)
- useNavigate from react-router-dom
- toast from sonner

**Security Considerations**:
- 3-step confirmation prevents accidental deletion
- Password verification required
- Explicit acknowledgment checkbox
- Multiple warnings about permanence
- No way to recover after deletion

**Accessibility**:
- Multi-step flow clearly indicated
- Password field with show/hide toggle
- Checkbox with clear label
- Error messages announced
- Keyboard navigation supported
- Focus management in dialog

**Used In**:
- DangerZoneSection (triggered by "Delete Account" button)

---
