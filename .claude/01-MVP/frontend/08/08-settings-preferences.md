# Task 08: Settings & User Preferences (Simplified)

**Status**: ✅ **COMPLETED** (4/4 subtasks - 100%)
**File**: [08-settings-preferences.md](./08-settings-preferences.md)
**Created**: 2025-11-05
**Completed**: 2025-11-06
**Priority**: Low (Optional for MVP, Required for Production)
**Duration**: 3 hours (180 minutes total)
**Dependencies**: Task 02 (Setup) ✅, Task 03 (Auth) ✅, Task 07 (UI Components) ✅

---

## Executive Summary

**What This Task Accomplishes**: Build a focused Settings page that provides essential account management and app preferences. The simplified Settings page consolidates critical user configuration options: account settings (email/password, subscription), daily study goal preferences, and danger zone actions (account deletion, progress reset).

**Why It Matters**: Users need a centralized location for critical account management tasks like changing passwords, viewing subscription status, adjusting study goals, and performing destructive actions. A simple, focused Settings page improves discoverability and follows UX conventions without overwhelming users with excessive options.

**What Success Looks Like**: A clean Settings page (`/settings`) with 3 organized sections: Account Settings (email/password, subscription display), App Preferences (daily goal only), and Danger Zone (delete account, reset progress). Users can manage their core account settings with clear visual hierarchy and confirmation dialogs for destructive actions.

---

## Background and Motivation

### Current State

**From Task 03 (Authentication & User Management) - Completed**:
- Profile page exists at `/profile` with 4 sections:
  - Personal Info (name, avatar)
  - Statistics (streak, words learned, XP, level, achievements)
  - **Preferences** (language, daily goal, notifications, theme placeholder)
  - Security (password change, 2FA placeholder, delete account placeholder)

**What Exists Today**:
- ✅ Profile page (`Profile.tsx`) with sidebar navigation
- ✅ PreferencesSection component (language, daily goal, notifications, theme placeholder)
- ✅ SecuritySection component (password change form, 2FA placeholder, danger zone)
- ✅ PersonalInfoSection component (name update form)
- ✅ StatsSection component (achievements, level progression, streak display)
- ✅ Settings route defined in App.tsx (`/settings`)
- ✅ Placeholder Settings page (`Settings.tsx`) - 15 lines, just heading + TODO comment

**Settings Page Placeholder** (`src/pages/Settings.tsx`):
```typescript
const Settings: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold">Settings</h1>
      <p className="mt-2 text-muted-foreground">Manage your account and preferences.</p>
      {/* TODO: Implement settings form */}
    </div>
  );
};
```

### The Gap

**What's Missing**:

1. **No Dedicated Settings Page Content**:
   - Settings route exists but shows empty placeholder
   - Users navigate to `/settings` and find no functionality
   - Navigation menu links to Settings but it's not useful

2. **Preference Duplication vs Organization**:
   - All settings currently live in Profile page (mixing stats + settings)
   - No clear distinction between "Profile" (personal info + stats) vs "Settings" (configuration + account management)
   - Users may not discover settings hidden in Profile page

3. **Missing Essential Account Management Features**:
   - **Email Update**: No way to change email address
   - **Password Change**: Exists in Profile, but should also be in Settings
   - **Account Deletion**: Security section has placeholder but not functional
   - **Progress Reset**: No way to reset learning progress while keeping account

4. **Missing Subscription Display**:
   - **Plan Display**: User can't see current subscription tier in Settings
   - **Upgrade Button**: No clear path to upgrade (placeholder for future payment integration)

5. **Limited App Preferences**:
   - **Daily Goal**: Exists in Profile, should be accessible in Settings too
   - Other preferences removed for MVP simplicity

### Business Value

**For Users**:
- **Discoverability**: Settings page is industry-standard UX - users know where to find it
- **Control**: Users feel empowered with essential account management capabilities
- **Self-Service**: Users can manage password, subscription, and account without contacting support
- **Safety**: Destructive actions (delete account, reset progress) have proper confirmation flows

**For Product**:
- **Support Cost Reduction**: Self-service account management reduces support tickets
- **Conversion**: Clear upgrade path in settings page drives premium conversions
- **Professionalism**: Clean settings page signals product maturity to users and investors
- **MVP Efficiency**: Focused feature set allows faster delivery without sacrificing quality

**For MVP Completeness**:
- **User Expectations**: Modern SaaS apps always have Settings page - absence feels unfinished
- **Essential Features**: Email/password management and account deletion are core requirements
- **Future-Proofing**: Settings page provides structure for adding features in post-MVP phases

### User Stories

1. **Dimitris (28, wants premium)**:
   - "I want to upgrade to Premium to unlock all decks but can't find where to do that"
   - Needs: Subscription section with current plan display and upgrade button

2. **Elena (42, changing email provider)**:
   - "I'm switching from Gmail to ProtonMail and need to update my account email"
   - Needs: Email update form in Settings

3. **Yiannis (45, account deletion)**:
   - "I finished my naturalization exam and want to delete my account permanently"
   - Needs: Account deletion flow with confirmation dialog and password verification

4. **Sofia (30, adjusting study routine)**:
   - "I want to increase my daily study goal from 15 to 30 minutes"
   - Needs: Daily goal slider in Settings

5. **Nikos (25, fresh start needed)**:
   - "I want to reset all my progress and start learning from scratch"
   - Needs: Progress reset with confirmation dialog

---

## Architecture Decision: Settings vs Profile Split

### Current Issue
The Profile page currently mixes two concerns:
1. **Profile Identity** (personal info, stats, achievements) - "Who am I?"
2. **App Configuration** (preferences, security, account management) - "How do I configure the app?"

### Proposed Solution (Simplified)

**Profile Page** (`/profile`) - Focus on identity + progress:
- Personal Info (name, avatar)
- Statistics (streak, XP, level, achievements)
- Learning Progress Summary
- Keep existing Preferences section (unchanged for MVP)

**Settings Page** (`/settings`) - Focus on essential account management:
- Account Settings (email, password, subscription)
- App Preferences (daily goal only)
- Danger Zone (delete account, reset progress)

### Migration Strategy

**Decision: Minimal Duplication Approach**:
- Keep PreferencesSection in Profile page (unchanged)
- Create minimal Settings page with only essential account management
- Daily goal slider duplicated in Settings for discoverability
- Both pages work independently (no breaking changes)
- Future: Can expand Settings or consolidate based on user feedback

**Rationale**: This simplified approach delivers essential functionality without overwhelming users with options, while maintaining Profile page functionality that users already know.

---

## Scope Definition

### In Scope (Simplified MVP Features)

**Settings Page Structure** (`/settings`):
- Simple page layout with sections
- 3 main sections: Account, App Preferences, Danger Zone
- Responsive design (375px - 1440px+)
- Loading states, error handling, success toasts
- No complex navigation - single page with scrollable sections

**08.01: Account Settings Section** (60 min):
- Email address display + update form (basic validation, no verification email)
- Password change form (current password + new password with validation)
- Subscription tier display (Free/Premium badge)
- Upgrade button (links to placeholder or future payment flow)
- Account creation date display

**08.02: App Preferences Section** (30 min):
- Daily goal slider (5-120 minutes)
- Auto-save functionality with debounced updates
- Sync with authStore preferences
- Simple, focused UI with no extra toggles

**08.03: Danger Zone Section** (60 min):
- Delete Account button (red destructive style)
- Account deletion confirmation dialog (multi-step with password verification)
- Data deletion explanation (what gets deleted, irreversible warning)
- Reset Progress button (delete all learning data, keep account)
- Reset progress confirmation dialog

**08.04: Integration & Testing** (30 min):
- Test all forms (email update, password change, account deletion, progress reset)
- Verify confirmation dialogs for destructive actions
- Mobile responsive testing (375px, 768px, 1024px)
- Update Components-Reference.md with settings components
- Update Style-Guide.md with settings patterns
- Capture screenshots for verification
- Verify TypeScript compilation and build success

### Out of Scope (Removed from MVP)

**Features Removed for Simplicity**:
- ❌ Privacy & Data section (analytics opt-out, data export, GDPR features)
- ❌ Language selector (English/Greek)
- ❌ Theme selector (Light/Dark/System)
- ❌ Notification settings (push notifications, email reminders)
- ❌ Accessibility settings (Reduce Motion, High Contrast, Font Size)
- ❌ Complex sidebar navigation
- ❌ Data export functionality
- ❌ Privacy policy links and cookie preferences

**Post-MVP / Premium Features**:
- Payment integration (Stripe/Paddle for subscriptions) - requires backend
- Two-Factor Authentication (2FA) - requires backend SMS/email service
- Active sessions management (view/revoke sessions) - requires backend session tracking
- Email verification flow - requires backend email service
- Billing history / Invoice downloads - requires payment backend
- Language learning preferences (spaced repetition intervals, card types) - complex feature
- Integration settings (Google Calendar, Notion export) - requires API integrations
- Team/Family plans - requires multi-user backend architecture

**Deferred to Post-MVP**:
- Email change verification (requires email service)
- Account recovery window (requires scheduled job to delete after 30 days)
- Analytics event tracking (requires analytics backend)
- GDPR compliance features (data export, cookie consent, privacy controls)
- Theme switching and dark mode
- Advanced accessibility settings

---

## Technical Architecture

### Component Structure (Simplified)

```
src/pages/
  Settings.tsx                    # Main settings page (simple scrollable layout)

src/components/settings/
  AccountSection.tsx              # Email, password, subscription management
  PreferencesSection.tsx          # Daily goal slider only
  DangerZoneSection.tsx           # Account deletion, progress reset

  dialogs/
    DeleteAccountDialog.tsx       # Multi-step account deletion confirmation
    ResetProgressDialog.tsx       # Progress reset confirmation

  index.ts                        # Barrel export

src/types/
  settings.ts                     # Settings-specific TypeScript interfaces (minimal)
```

**Note**: No dedicated settingsStore needed - we'll use authStore directly for account settings and preferences.

### Data Flow (Simplified)

```
User Interaction
  ↓
Settings Component (AccountSection, PreferencesSection, DangerZoneSection)
  ↓
Direct authStore actions (updateProfile, updatePassword, deleteAccount)
  ↓
Validation (Zod schemas in components)
  ↓
authStore updates localStorage automatically
  ↓
Toast Notification (Success/Error)
```

**Rationale**: No need for separate settingsStore - authStore already handles user data and preferences.

### TypeScript Interfaces (Simplified)

**settings.ts** (minimal):
```typescript
export interface SubscriptionInfo {
  plan: 'free' | 'premium' | 'lifetime';
  status: 'active' | 'cancelled' | 'expired';
  startDate: Date;
  expiresAt?: Date;
}

// Daily goal is already part of UserPreferences in auth.ts
// No need for additional interfaces
```

**Note**: Most settings types already exist in `auth.ts` (UserPreferences, User). We'll reuse those instead of creating duplicates.

---

## Subtasks (Simplified - 4 Total)

### 08.01: Account Settings Section (60 min) - ✅ **COMPLETED 2025-11-06**

**Description**: Create the Account Settings section with email/password management and subscription display.

**Steps**:
1. Create `src/components/settings/AccountSection.tsx`
2. Email display + update form:
   - Current email displayed with edit button
   - Email validation (Zod schema: email format, not empty)
   - Update email via authStore.updateProfile()
   - Success toast on update (note: no email verification in MVP)
3. Password change form:
   - Current password field (password type)
   - New password field (with PasswordField component from Task 07)
   - Confirm new password field (match validation)
   - "Change Password" button (disabled until valid)
   - Update via authStore.updatePassword()
   - Success toast on successful change
4. Subscription display:
   - Badge showing current plan (Free/Premium from authStore.user.role)
   - Plan start date (account creation date)
   - Upgrade button (Free users) → shows "Upgrade to Premium" (placeholder for future)
   - Premium badge display for premium users
5. Account metadata:
   - Account created date (formatted: "Member since October 2025")
6. Use form components from Task 07.06 (FormField, PasswordField, SubmitButton)
7. Mobile responsive layout (stacked on mobile, side-by-side on desktop)

**Success Criteria**:
- ✅ Email update form validates and updates authStore
- ✅ Password change validates current password and updates
- ✅ Subscription tier displays correct badge (Free/Premium)
- ✅ All forms use proper validation (Zod schemas)
- ✅ Loading states during async operations
- ✅ Error handling with user-friendly messages
- ✅ Mobile responsive (375px tested)
- ✅ TypeScript: 0 errors

**Files Created**:
- `src/components/settings/AccountSection.tsx` (~180 lines)
- `src/types/settings.ts` (~30 lines - SubscriptionInfo interface only)

**Files Modified**:
- None

---

### 08.02: App Preferences Section (30 min) - ✅ **COMPLETED 2025-11-06**

**Description**: Create simplified App Preferences section with daily goal slider only.

**Steps**:
1. Create `src/components/settings/PreferencesSection.tsx`
2. Daily goal slider (simple implementation):
   - Slider component: 5-120 minutes range
   - Label shows current value: "30 minutes per day"
   - Intensity badge display (Light/Moderate/Regular/Intensive based on value):
     - Light: 5-14 minutes
     - Moderate: 15-29 minutes
     - Regular: 30-59 minutes
     - Intensive: 60+ minutes
   - Update authStore.user.preferences.dailyGoal on change
3. Auto-save with 1-second debounce (use debounce helper)
4. Show "Preferences saved" toast after save
5. Mobile responsive design

**Success Criteria**:
- ✅ Daily goal slider functional (5-120 range)
- ✅ Intensity badge updates based on value
- ✅ Auto-save with debounce (no spam saving)
- ✅ Preferences persist to authStore and localStorage
- ✅ Success toast displayed after save
- ✅ Mobile responsive layout
- ✅ TypeScript: 0 errors

**Files Created**:
- `src/components/settings/PreferencesSection.tsx` (~80 lines)

**Files Modified**:
- None

---

### 08.03: Danger Zone Section (60 min) - ✅ **COMPLETED 2025-11-06**

**Description**: Build simplified Danger Zone with account deletion and progress reset functionality.

**Steps**:
1. Create `src/components/settings/DangerZoneSection.tsx`
2. Section header:
   - Heading: "Danger Zone"
   - Warning color scheme (red border, red icons)
   - Description: "These actions are irreversible. Proceed with caution."
3. Reset Progress button:
   - Button: "Reset Learning Progress" (red outline)
   - Explanation: "Delete all deck progress, reviews, and statistics. Your account stays active."
   - Opens `ResetProgressDialog.tsx` confirmation dialog
4. Delete Account button:
   - Button: "Delete Account" (red filled, destructive)
   - Explanation: "Permanently delete your account and all data. Cannot be undone."
   - Opens `DeleteAccountDialog.tsx` confirmation dialog
5. Create `src/components/settings/dialogs/ResetProgressDialog.tsx`:
   - Use ConfirmDialog component from Task 07
   - Two-step confirmation:
     - Step 1: Warning + "Are you sure?" with Cancel/Continue buttons
     - Step 2: Type "RESET" to confirm (text input validation)
   - On confirm:
     - Clear all deck progress from deckStore (deckStore.resetProgress())
     - Clear all review history from reviewStore (reviewStore.resetProgress())
     - Clear analytics data from analyticsStore (analyticsStore.clearData())
     - Keep user account and preferences
     - Show success toast: "Learning progress reset successfully"
     - Redirect to dashboard
6. Create `src/components/settings/dialogs/DeleteAccountDialog.tsx`:
   - Use ConfirmDialog component from Task 07
   - Multi-step confirmation:
     - Step 1: Warning + "This will delete everything" with Cancel/Continue
     - Step 2: Password verification input (validate against authStore)
     - Step 3: Type "DELETE" to confirm (text input validation)
   - On confirm:
     - Call `authStore.deleteAccount(password)`
     - Clear all stores (auth, deck, review, analytics)
     - Clear localStorage/sessionStorage
     - Show success toast: "Account deleted successfully"
     - Redirect to login page (`/login`)
7. Both dialogs have proper error handling (wrong password, validation errors)
8. Mobile responsive dialogs

**Success Criteria**:
- ✅ Reset Progress dialog validates "RESET" text input
- ✅ Reset Progress clears all learning data but keeps account
- ✅ Delete Account dialog validates password before deletion
- ✅ Delete Account dialog validates "DELETE" text input
- ✅ Delete Account clears all data and logs out user
- ✅ Both dialogs show loading states during processing
- ✅ Both dialogs have error handling (wrong password, etc.)
- ✅ User redirected appropriately after each action
- ✅ Success toasts display for both actions
- ✅ Mobile responsive dialogs (375px tested)
- ✅ TypeScript: 0 errors

**Files Created**:
- `src/components/settings/DangerZoneSection.tsx` (~120 lines)
- `src/components/settings/dialogs/ResetProgressDialog.tsx` (~150 lines)
- `src/components/settings/dialogs/DeleteAccountDialog.tsx` (~180 lines)
- `src/components/settings/dialogs/index.ts` (barrel export)

**Files Modified**:
- `src/stores/authStore.ts` (+deleteAccount method if not exists)
- `src/stores/deckStore.ts` (+resetProgress method if not exists)
- `src/stores/reviewStore.ts` (+resetProgress method if not exists)
- `src/stores/analyticsStore.ts` (+clearData method if not exists)

---

### 08.04: Integration & Testing (30 min) - ✅ **COMPLETED 2025-11-06**

**Description**: Build main Settings page, integrate all sections, and perform comprehensive testing.

**Steps**:

**Part A: Settings Page Integration** (15 min):
1. Create `src/pages/Settings.tsx` main page component
2. Simple page structure:
   - Page header: "Settings" title + description
   - Single scrollable page with 3 sections (no sidebar/tabs)
   - Each section in a Card component from Shadcn
   - Sections: Account Settings, App Preferences, Danger Zone
3. Import and render sections:
   ```typescript
   <div className="space-y-6">
     <AccountSection />
     <PreferencesSection />
     <DangerZoneSection />
   </div>
   ```
4. Loading state: Use Loading component from Task 07 while page initializes
5. Update barrel exports: `src/components/settings/index.ts` - export all section components
6. Update `src/pages/Settings.tsx` to replace placeholder

**Part B: Testing** (15 min):
1. **Functional Testing**:
   - Email update form validation and submission
   - Password change flow with validation
   - Subscription tier display (Free/Premium badge)
   - Daily goal slider (5-120 range)
   - Reset Progress flow (confirmation dialog, data clearing)
   - Delete Account flow (password verification, account deletion)

2. **UI/UX Testing**:
   - All sections render correctly
   - Forms have proper validation messages
   - Loading states show during async operations
   - Success toasts appear after actions
   - Error toasts appear on failures
   - Confirmation dialogs for destructive actions
   - Mobile responsive (375px, 768px, 1024px)

3. **Code Quality**:
   - TypeScript: 0 errors
   - Build: SUCCESS
   - No console errors in browser

4. **Documentation**:
   - Update `Components-Reference.md` with settings components:
     - AccountSection
     - PreferencesSection
     - DangerZoneSection
     - DeleteAccountDialog
     - ResetProgressDialog
   - Update `Style-Guide.md` with danger zone styling pattern
   - Capture screenshots:
     - Desktop: Settings page with all 3 sections
     - Mobile: Settings page responsive layout
     - Dialogs: Delete Account + Reset Progress confirmations

**Success Criteria**:
- ✅ Settings page renders all 3 sections correctly
- ✅ All forms validate and submit successfully
- ✅ Reset Progress clears learning data
- ✅ Delete Account deletes account and logs out
- ✅ Settings sync with authStore
- ✅ TypeScript: 0 errors
- ✅ Build: SUCCESS
- ✅ No console errors
- ✅ Mobile responsive (375px tested)
- ✅ WCAG 2.1 AA compliant (keyboard navigation, ARIA)
- ✅ Documentation updated (Components-Reference.md, Style-Guide.md)
- ✅ 3+ screenshots captured (desktop, mobile, dialogs)

**Files Created**:
- `src/pages/Settings.tsx` (~180 lines - replaces placeholder)
- `src/components/settings/index.ts` (barrel export)
- `.playwright-mcp/08/` folder with 3+ screenshots

**Files Modified**:
- `docs/Components-Reference.md` (+Settings components documentation ~200 lines)
- `docs/Style-Guide.md` (+Danger Zone styling pattern ~50 lines)

---

## Files to Create/Modify (Simplified)

### Files to Create (8 new files)

**Pages** (1 file):
1. `src/pages/Settings.tsx` - Main settings page (~180 lines)

**Components** (5 files):
2. `src/components/settings/AccountSection.tsx` - Account management (~180 lines)
3. `src/components/settings/PreferencesSection.tsx` - Daily goal slider (~80 lines)
4. `src/components/settings/DangerZoneSection.tsx` - Destructive actions (~120 lines)
5. `src/components/settings/dialogs/ResetProgressDialog.tsx` - Reset confirmation (~150 lines)
6. `src/components/settings/dialogs/DeleteAccountDialog.tsx` - Delete confirmation (~180 lines)

**Types** (1 file):
7. `src/types/settings.ts` - Minimal TypeScript interfaces (~30 lines)

**Barrel Exports** (1 file):
8. `src/components/settings/index.ts` - Export all settings components (~10 lines)

**Total New Files**: 8 files, ~930 lines of code

### Files to Modify (5 files - minimal changes)

1. `src/stores/authStore.ts` - Add `deleteAccount()` method if not exists (~20 lines added)
2. `src/stores/deckStore.ts` - Add `resetProgress()` method if not exists (~15 lines added)
3. `src/stores/reviewStore.ts` - Add `resetProgress()` method if not exists (~15 lines added)
4. `src/stores/analyticsStore.ts` - Add `clearData()` method if not exists (~10 lines added)
5. `docs/Components-Reference.md` - Add settings components documentation (~200 lines added)

**Optional** (if time permits):
6. `docs/Style-Guide.md` - Add danger zone styling pattern (~50 lines added)

**Total Modified**: 5-6 files, ~260-310 lines added

### Total Impact (Simplified)
- **New Files**: 8 files (vs 13 in original)
- **Modified Files**: 5-6 files (vs 9 in original)
- **New Code**: ~930 lines (vs ~2,095 in original)
- **Modified Code**: ~260-310 lines (vs ~513 in original)
- **Total Lines**: ~1,190-1,240 lines (vs ~2,608 in original)
- **Reduction**: ~54% less code than original scope

---

## Success Criteria (Simplified)

### Functional Requirements
- ✅ Settings page accessible at `/settings` route
- ✅ All 3 sections render correctly (Account, App Preferences, Danger Zone)
- ✅ Email update form validates and shows success toast
- ✅ Password change form validates current password and updates successfully
- ✅ Subscription tier displays correct badge (Free/Premium)
- ✅ Daily goal slider functional (5-120 minutes)
- ✅ Reset Progress dialog clears all learning data but keeps account
- ✅ Delete Account dialog validates password and deletes account + logs out user

### Data Persistence
- ✅ Account settings update authStore directly
- ✅ Daily goal updates authStore.user.preferences.dailyGoal
- ✅ Settings persist via authStore to localStorage
- ✅ Auto-save with 1-second debounce for daily goal

### UI/UX Requirements
- ✅ Simple scrollable page layout (no complex navigation)
- ✅ Loading states during async operations
- ✅ Success toasts after successful actions
- ✅ Error toasts on failures
- ✅ Confirmation dialogs for destructive actions (Delete Account, Reset Progress)
- ✅ Mobile responsive (375px, 768px, 1024px tested)

### Code Quality
- ✅ TypeScript: 0 errors
- ✅ Build: SUCCESS (`npm run build`)
- ✅ No 'any' types used
- ✅ All components use proper TypeScript interfaces
- ✅ Proper error handling in all async operations

### Accessibility
- ✅ WCAG 2.1 AA compliant
- ✅ Keyboard navigation works (Tab, Enter, Esc)
- ✅ Focus indicators visible (2px blue outline)
- ✅ ARIA labels on all interactive elements
- ✅ Screen reader announcements for dynamic changes
- ✅ Form validation errors announced to screen readers

### Documentation
- ✅ Components-Reference.md updated with settings components (~200 lines)
- ✅ Style-Guide.md updated with danger zone pattern (~50 lines) - optional
- ✅ 3+ screenshots captured:
  - Desktop: Settings page with all 3 sections
  - Mobile: Settings page responsive layout
  - Dialogs: Delete Account + Reset Progress confirmations

### Testing Verification
- ✅ All forms tested (email, password, daily goal)
- ✅ Destructive actions tested (Reset Progress, Delete Account)
- ✅ Mobile responsive tested (375px, 768px, 1024px)
- ✅ Keyboard navigation tested
- ✅ No console errors in browser

---

## Timeline and Dependencies

### Estimated Timeline (Simplified)

| Subtask | Duration | Cumulative |
|---------|----------|------------|
| 08.01: Account Settings Section | 60 min | 60 min |
| 08.02: App Preferences Section | 30 min | 90 min |
| 08.03: Danger Zone Section | 60 min | 150 min |
| 08.04: Integration & Testing | 30 min | 180 min |
| **Total** | **180 min** | **3 hours** |

**Note**: Timeline assumes developer familiar with codebase and existing component patterns from Task 07. Simplified scope allows for faster delivery without compromising quality.

### Dependencies

**Prerequisite Tasks** (All Completed ✅):
- ✅ **Task 02**: Core Frontend Setup (provides project structure, Tailwind, Shadcn/ui)
- ✅ **Task 03**: Authentication & User Management (provides authStore, user profile)
- ✅ **Task 07**: UI Components Documentation & Refactoring (provides reusable components: FormField, PasswordField, SubmitButton, ConfirmDialog, Loading)

**External Dependencies**:
- None (no new packages required)

**Internal Dependencies**:
- 08.01 → 08.04 (Account section needed for integration)
- 08.02 → 08.04 (Preferences section needed for integration)
- 08.03 → 08.04 (Danger Zone needed for integration)
- 08.04 → 08.01-08.03 (Integration requires all sections complete)

**Recommended Execution Order**:
1. Build sections sequentially: **08.01** → **08.02** → **08.03**
2. Alternatively, build all 3 sections in parallel (independent components)
3. Finally **08.04** (Integration & Testing) - brings everything together

---

## Risk Assessment (Simplified)

### High Risk Items
1. **Account Deletion Flow**:
   - Risk: Users accidentally delete account without understanding consequences
   - Mitigation: Multi-step confirmation (warning → password → type "DELETE")
   - Note: No recovery window in MVP - deletion is permanent

### Medium Risk Items
1. **Settings Sync with Profile Page**:
   - Risk: Daily goal updated in Settings page doesn't reflect in Profile page (or vice versa)
   - Mitigation: Both pages use same `authStore.user.preferences.dailyGoal` source of truth
   - Testing: Verify changes in Settings page appear in Profile page

### Low Risk Items
1. **Email Change Without Verification**:
   - Risk: User changes email without verifying new address
   - Status: Acceptable for MVP (backend email verification is post-MVP feature)
   - Note: Email updates immediately without verification

2. **Subscription Display Accuracy**:
   - Risk: Free/Premium badge shows wrong tier
   - Status: Low risk - badge pulled directly from `authStore.user.role`
   - Testing: Verify both Free and Premium users see correct badge

---

## Future Enhancements (Post-MVP)

### Features Removed from MVP (Can be added later)
1. **Privacy & GDPR Features**:
   - GDPR-compliant data export (download all data as JSON)
   - Analytics opt-out toggles
   - Cookie consent management
   - Data retention policies

2. **Theme & Appearance**:
   - Dark Mode (Light/Dark/System theme selector)
   - High Contrast mode
   - Font Size adjustment (Small/Medium/Large)
   - Reduce Motion toggle for accessibility

3. **Language & Notifications**:
   - Language selector (English/Greek)
   - Notification settings (daily reminders, streak alerts, achievement notifications)
   - Email digest preferences

4. **Backend Integration (Phase 2)**:
   - Email verification flow (verify new email before changing)
   - Two-Factor Authentication (2FA)
   - Active sessions management (view/revoke sessions)
   - Subscription management (billing history, plan changes, cancellation)
   - Account recovery window (30-day soft delete)

### Additional Future Features
1. **Advanced Learning Preferences**:
   - Spaced repetition interval customization
   - Card type preferences (recognition vs recall)
   - Review queue sorting options

2. **Integration Features**:
   - Export to Anki deck format (.apkg)
   - Import decks from CSV
   - Third-party integrations (Google Calendar, Notion)

3. **Team/Enterprise Features**:
   - Team management and shared decks
   - Admin dashboard
   - User analytics

---

## Open Questions (Simplified)

1. **Settings vs Profile Duplication**:
   - Should daily goal be in both Profile and Settings pages (duplication)?
   - **Decision**: Yes, keep in both for discoverability. Both update the same authStore value.

2. **Account Deletion Immediate vs Delayed**:
   - Should account deletion be immediate or have 30-day recovery window?
   - **Decision**: Immediate deletion for MVP (mark as "Cannot be undone"). Recovery window requires backend and can be added post-MVP.

3. **Email Change Verification**:
   - Should we implement email verification for MVP?
   - **Decision**: No - email updates immediately without verification. Backend email service can be added post-MVP.

4. **Subscription Upgrade Flow**:
   - Should "Upgrade" button link to `/pricing` page or be disabled?
   - **Decision**: Show button with placeholder action (toast saying "Coming Soon" or link to non-existent /pricing route)

---

## References

### Similar Apps Settings Pages
- **Duolingo**: Account, Learning, Notifications, Privacy, Manage Subscription
- **Anki**: Preferences (General, Scheduling, Network, Backups)
- **Memrise**: Account, Email Preferences, Privacy, Subscription
- **Busuu**: Profile, Learning Goals, Notifications, Subscription, Privacy

### Design Patterns
- [Settings Page Patterns](https://www.nngroup.com/articles/settings-design/) - Nielsen Norman Group
- [Account Settings Best Practices](https://www.smashingmagazine.com/2020/09/design-better-account-settings/) - Smashing Magazine
- [GDPR Data Export Requirements](https://gdpr.eu/right-to-data-portability/) - Article 20

### Existing Codebase
- Task 03: `src/pages/Profile.tsx` - Profile page with preferences section
- Task 03: `src/components/profile/PreferencesSection.tsx` - Language, daily goal, notifications
- Task 03: `src/components/profile/SecuritySection.tsx` - Password change, 2FA, delete account
- Task 07: `src/components/dialogs/ConfirmDialog.tsx` - Reusable confirmation dialog
- Task 07: `src/components/forms/FormField.tsx` - Reusable form field component

---

## Notes

1. **Simplified Scope**:
   - Original Task 08 had 7 subtasks (330 min / 5.5 hours)
   - Simplified version has 4 subtasks (180 min / 3 hours)
   - Removed: Privacy & Data section, Theme/Language/Notification/Accessibility settings, Data export, Complex navigation
   - Kept: Essential account management, daily goal, danger zone
   - Reduction: 54% less code (~1,190 lines vs ~2,608 lines)

2. **Profile vs Settings Minimal Duplication**:
   - Only daily goal slider is duplicated between Profile and Settings
   - Both update same authStore.user.preferences.dailyGoal value
   - Rationale: Improve discoverability without overwhelming users

3. **Backend Dependencies**:
   - Email verification, 2FA, billing, sessions require backend
   - MVP uses immediate updates without verification (acceptable for MVP)
   - Backend integration planned for Phase 2

4. **Time Estimate Assumptions**:
   - Assumes developer familiar with existing codebase patterns from Tasks 03 & 07
   - Assumes reuse of existing components (FormField, PasswordField, ConfirmDialog from Task 07)
   - Assumes no major design decisions needed (follow existing Style Guide)
   - Simplified scope allows 3-hour completion vs original 5.5 hours

---

**Document Version**: 2.0 (Simplified)
**Created**: 2025-11-05
**Last Updated**: 2025-11-05 (Simplified scope - removed Privacy, Theme, Language, Notifications, Accessibility features)
**Created By**: Claude (System Analyst Mode)
**Status**: Ready for Review - Simplified MVP Scope
